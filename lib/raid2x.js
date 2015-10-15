/* Test code
var r2x = new Raid2X()
r2x.readFile(files[0], function() {})
r2x.save()

var metadata = r2x.getMeta();
var copy = new Raid2X(metadata);

var recovery = new Raid2X(metadata);
for(var i = 0; i < metadata.shardList.length; i++) {
  if(i % 2 == 0 || i == r2x.attr.sliceCount) {
    recovery.importShard(r2x.getShard(i));
  }
}
 */

/*
evt.target.files -> File
File.slice(0, file.size) -> Blob
Blob FileReader -> Uint8Array
----------------------------------------
var uint8Array;
var reader = new FileReader();
reader.onload = function() {
  uint8Array = new Uint8Array(reader.result);
};
reader.readAsArrayBuffer(blob);
----------------------------------------
new Blob([Uint8Array]) -> Blob
Blob ~= File

var rs = Uint8Array(size);
rs.set(Uint8Array, pointer);

Uint8Array to Base64
btoa(String.fromCharCode.apply(null, uint8Array))

Base64 to Uint8Array
new Uint8Array(atob(base64).split("").map(function(c) {return c.charCodeAt(0); }));
 */


/* for web worker
self.addEventListener('message', function(e) {
	console.log(e.data);
	var r2x = new Raid2X();
	r2x.readFile(e.data.file), function() {
		r2x.uploadAll(e.data.pathShard, function() {
			var meta = r2x.getMeta();
			console.log("save meta");
		});
	};
}, false);
*/

var Raid2X = (function() {
var duplicateCount = 5;
var minSliceCount = 25;
var minSize = 512;
var defaultSize = 4 * 1024 * 1024;
var defaultKeySize = 2048;
var maxConnection = 5;
var maxRetry = 3;
var defaultEncryption = 'RSA';
var CRCTable = (function() {
	var c = 0, table = new Array(256);

	for(var n = 0; n != 256; ++n) {
		c = n;
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
		table[n] = c;
	}

	return typeof Int32Array !== 'undefined' ? new Int32Array(table) : table;
})();

var XOR = function(buff1, buff2) {
	if(!buff1.buffer || !buff2.buffer) { return false; }
	if(buff2.length > buff1.length) { return XOR(buff2, buff1); }

	var res = [];
	for(var i = 0; i < buff1.length; i++) {
		res.push(buff1[i] ^ buff2[i]);
	}
	return new Uint8Array(res);
};
var bufferToBase64 = function(buffer) {
	var s = "";
	for(var i = 0; i < buffer.length;) {
		s = "".concat(
			s,
			String.fromCharCode(buffer[i++]),
			String.fromCharCode(buffer[i++]),
			String.fromCharCode(buffer[i++]),
			String.fromCharCode(buffer[i++]),
			String.fromCharCode(buffer[i++]),
			String.fromCharCode(buffer[i++]),
			String.fromCharCode(buffer[i++]),
			String.fromCharCode(buffer[i++])
		);
	}
	return btoa(s);
};
var SHA1 = function(buffer) {
	return new Rusha().digestFromBuffer(buffer);
};
var CRC32 = function(buffer) {
	var b, crc, i, len, code;
	if(buffer.length > 10000) return CRC32_8(buffer);

	for(var crc = -1, i = 0, len = buffer.length - 3; i < len;) {
		crc = (crc >>> 8) ^ CRCTable[(crc ^ buffer[i++])&0xFF];
		crc = (crc >>> 8) ^ CRCTable[(crc ^ buffer[i++])&0xFF];
		crc = (crc >>> 8) ^ CRCTable[(crc ^ buffer[i++])&0xFF];
		crc = (crc >>> 8) ^ CRCTable[(crc ^ buffer[i++])&0xFF];
	}
	while(i < len + 3) { crc = (crc >>> 8) ^ CRCTable[(crc ^ buffer[i++]) & 0xFF]; }
	code = (crc > 0? crc: crc * -1).toString(16);
	while(code.length < 8) { code = '0' + code; }
	return code;
};
var CRC32_8 = function(buffer) {
	var b, crc, i, len, code;

	for(var crc = -1, i = 0, len = buffer.length - 7; i < len;) {
		crc = (crc >>> 8) ^ CRCTable[(crc ^ buffer[i++]) & 0xFF];
		crc = (crc >>> 8) ^ CRCTable[(crc ^ buffer[i++]) & 0xFF];
		crc = (crc >>> 8) ^ CRCTable[(crc ^ buffer[i++]) & 0xFF];
		crc = (crc >>> 8) ^ CRCTable[(crc ^ buffer[i++]) & 0xFF];
		crc = (crc >>> 8) ^ CRCTable[(crc ^ buffer[i++]) & 0xFF];
		crc = (crc >>> 8) ^ CRCTable[(crc ^ buffer[i++]) & 0xFF];
		crc = (crc >>> 8) ^ CRCTable[(crc ^ buffer[i++]) & 0xFF];
		crc = (crc >>> 8) ^ CRCTable[(crc ^ buffer[i++]) & 0xFF];
	}
	while(i < len + 7) { crc = (crc >>> 8) ^ CRCTable[(crc ^ buffer[i++]) & 0xFF]; }
	code = (crc > 0? crc: crc * -1).toString(16);
	while(code.length < 8) { code = '0' + code; }
	return code;
};

var Raid2X = function(data) { this.init(data); }
Raid2X.connection = 0;
Raid2X.queue = [];
Raid2X.request = function(option) {
	var self = this;

	var path = option.path;
	var method = option.method;
	var responseType = option.responseType;
	var data = option.data;
	var callback = option.callback;

	if(this.connection >= maxConnection) { this.queue.push(option); }
	else {
		this.connection++;

		var request = new XMLHttpRequest();
		if(responseType) { request.responseType = responseType; }

		request.onload = function() {
			self.closeConnection();
			if(typeof(callback) == 'function') {
				callback(undefined, request.response);
			}
		};
		request.onreadystatechange = function (oEvent) {
			if (request.readyState === 4) {
		    if(request.status != 200) {
					callback(new Error(request.statusText));
					self.closeConnection();
				}
			}
		};
		request.open(method, path);
		request.send(data);
	}
};
Raid2X.closeConnection = function() {
	this.connection--;

	if(this.queue.length > 0 && this.connection < maxConnection) {
		var next = this.queue.pop();
		if(typeof(next)== 'function') { next(); }
	}

	return true;
};
Raid2X.toURL = function(blob) {
	if(!blob) { return false; }
	var url = window.URL.createObjectURL(blob);

	return url;
};
Raid2X.save = function(blob, name) {
	var url = this.toURL(blob);
	if(!url) { return false; }

	var a = document.createElement("a");
	document.body.appendChild(a);
	a.style = "display: none";
	a.href = url;
	a.download = name;
	a.click();
	window.URL.revokeObjectURL(url);
	document.body.removeChild(a);
	delete a;
};
Raid2X.guid = function() {
	var s4 = function() {
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	};
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' +s4() + '-' + s4() + s4() + s4();
};
Raid2X.genKey = function(length) {
	length = length >= 512? length: defaultKeySize;
	var rsa = new JSEncrypt();
	rsa.getKey();
	var keypair = {};
	keypair.private = rsa.getPrivateKey();
	keypair.public = rsa.getPublicKey();

	return keypair;
};
Raid2X.getMeta = function(file) {
	var name = file.name;
	var type = file.type;
	var size = file.size;
	var hash = this.guid();
	var sliceCount, sliceSize, duplicate;

	if(size > defaultSize * minSliceCount) {
		sliceCount = Math.ceil( (size || 0) / defaultSize );
		sliceCount = sliceCount + ((sliceCount + 1) % 2);
		sliceSize = defaultSize;
	}
	else if(size > minSize * minSliceCount) {
		sliceCount = minSliceCount;
		sliceSize = Math.ceil(size / minSliceCount);
	}
	else {
		duplicate = true;
		sliceCount = 1;
		sliceSize = size;
	}

	return {
		name: name,
		type: type,
		hash: hash,
		size: size,
		sliceCount: sliceCount,
		sliceSize: sliceSize,
		duplicate: !!duplicate
	};
};
Raid2X.quickSend = function(file, url, m, cb) {
	var callback, meta;
	if(arguments.length >= 4) {
		callback = cb;
		meta = m;
	}
	else {
		callback = arguments[2];
		meta = this.getMeta(file);
	}

	if(typeof(meta) != 'object') { meta = this.getMeta(file); }
	meta.maxBuffer = 1024 * 1024 * 1024 - (1024 * 1024 * 1024 % meta.sliceSize);
	meta.url = url;
	meta.uploads = [];
	meta.shardList = [];

	this.sendPartialFile(file, 0, meta, callback);

	return meta;
};
Raid2X.sendPartialFile = function(file, part, meta, callback) {
	var self = this;
	part = part >= 0? part: 0;
	var s = part * meta.maxBuffer;
	var e = s + meta.maxBuffer;
	e = e > file.size? file.size: e;
	f = file.slice(s, e);

	// end of file, stop sending
	if(f.size == 0) { return false; }

	// callback after send a shard
	var sendShard = function(partialFile, i) {
		if(i * meta.sliceSize < f.size) {
			// upload shard
			var n = (part * meta.maxBuffer / meta.sliceSize) + i;
			var ss = i * meta.sliceSize;
			var ee = ss + meta.sliceSize;
			ee = ee > partialFile.byteLength? partialFile.byteLength: ee;

			var info = self.genShardInfo(n, meta.sliceCount);
			var ui8a = new Uint8Array(meta.sliceSize + info.length);
			ui8a.set(new Uint8Array(partialFile.slice(ss, ee)), 0);
			ui8a.set(info, meta.sliceSize);
			var hash = self.genHash(ui8a);
			var uploadPath = typeof(meta.url) == 'function'? meta.url(hash): meta.url + hash;
			meta.shardList[n] = hash;

			var formData = new FormData();
			formData.append("file", new Blob([ui8a]));

			var target = {
				path: uploadPath,
				method: 'POST',
				data: formData,
				callback: function(error, resp) {
					sendShard(partialFile, i + 1);
					try {
						var rs = JSON.parse(resp);
						if(rs.result != 1) {
							throw new Error("failed");
						}
						else {
							if(meta.uploads.indexOf(n) == -1 && n < meta.sliceCount) { meta.uploads.push(n); }
							var rs = {
								hash: meta.hash,
								progress: (meta.uploads.length / meta.sliceCount),
								path: uploadPath,
								meta: meta
							};

							if(typeof(callback) == 'function') {
								callback(undefined, rs);
							}
						}
					}
					catch(e) {
						// send failed, retry
						target.retry = target.retry? (target.retry + 1): 1
						if(target.retry <= maxRetry) {
							//++ retry
							self.request(target);
						}
						//else { throw new Error("can not send shard: " + n); }
					}
				}
			};

			self.request(target);
		}
		else if(file.size > e) {
			// end of partial file, send next partial file
			part += 1;
			self.sendPartialFile(file, part, meta, callback);
		}
	}
	var reader = new FileReader();

	reader.onload = function() {
		var partialFile = reader.result;
		sendShard(partialFile, 0);
	};

	reader.readAsArrayBuffer(f);
};
Raid2X.genHash = function(buffer) {
	var hash;
	var maxBuffer = 256 * 1024 * 1024;

	if(Array.isArray(buffer)) {
		var l = 0, p = 0;
		var b;
		for(var i = 0; i < buffer.length; i++) { l += buffer[i].length; }
		if(l < maxBuffer) {
			b = new Uint8Array(l);
			for(var i = 0; i < buffer.length; i++) {
				b.set(buffer[i], p);
				p += buffer[i].length;
			}

			hash = SHA1(b) + CRC32(b);
		}
		else {
			hash = Raid2X.guid();
		}
	}
	else {
		// sha1 + crc32
		hash = SHA1(buffer) + CRC32(buffer);
	}
	return hash;
};
Raid2X.genShardInfo = function(n, sliceCount) {
	sliceCount = sliceCount || this.attr.sliceCount;
	if(!(n >= 0) || !(sliceCount > 0)) { return false; }
	return new Uint8Array( new Uint32Array([n, sliceCount]).buffer );
};

Raid2X.prototype.init = function(data) {
	var self = this;

	this.attr = {};
	this.attr.size = 0;
	this.attr.sliceSize = 0;
	this.attr.sliceCount = 0;
	this.attr.encShard = false;
	this.attr.encFile = false;
	this.attr.duplicate = false;
	this.uploads = [];
	this.downloads = [];
	this.lost = [];
	this.binary = [];
	this.shardList = [];
	//++this.key = forge.pki.rsa;

	this.pointer = 0;

	if(data.buffer) {
	// with buffer
		this.readBuffer(data);
	}
	else if(typeof(data) == "string") {
	// with base64
		this.readBase64(data);
	}
	else if(typeof(data) == "object") {
	// with metadata
		this.set(data);
	}

	return true;
};

Raid2X.prototype.readBuffer = function(buffer) {
	this.binary = buffer;
	this.attr.size = buffer.length;
	this.parseFile();

	return this.attr.size;
};
Raid2X.prototype.readPartialBuffer = function(buffer, i) {
	if(!Array.isArray(this.binary)) { this.binary = []; }
	if(i >= 0) {
		this.binary[i] = buffer;
	}
	else {
		this.binary.push(buffer)
	}


	return this.attr.size;
};
Raid2X.prototype.readFile = function(file, callback) {
	var self = this;
	var reader = new FileReader();

	self.setName(file.name);
	self.setType(file.type);
	self.setSize(file.size);
	self.parseFile();

	var maxBuffer = 500 * 1024 * 1024 - (500 * 1024 * 1024 % self.attr.sliceSize);

	var todo = 1;
	var done = function() {
		if(--todo == 0) {
			self.setHash();
			callback(false, self);
		}
	};

	for(var i = 0; i * maxBuffer <= file.size; i++) {
		todo ++;
		var s = i * maxBuffer;
		var e = s + maxBuffer;
		e = e > file.size? file.size: e;

		self.readPartialFile(file.slice(s, e), i * maxBuffer / self.attr.sliceSize, done);
	}

	done();
/*
	reader.onload = function() {
		var ui8a = new Uint8Array(reader.result);


		for(var i = 0; i < self.attr.sliceCount; i++) {
			var max = reader.result.size;
			var s = i * self.attr.sliceSize;
			var e = s + self.attr.sliceSize;
			e = e > max? max: e;

			var u8a = new Uint8Array(self.attr.sliceSize);
			u8a.set(reader.result.slice(s, e));

			self.readPartialBuffer(u8a, i);
		}

		callback(undefined, self);
	};

	reader.readAsArrayBuffer(file);
*/
};
Raid2X.prototype.readPartialFile = function(file, part, callback) {
	part = part >= 0? part: 0;

	var self = this;
	var reader = new FileReader();

	reader.onload = function() {
		for(var i = 0; i * self.attr.sliceSize < file.size; i++) {
			var index = part + i;
			var s = i * self.attr.sliceSize;
			var e = s + self.attr.sliceSize;
			e = e > reader.result.byteLength? reader.result.byteLength: e;

			var ui8a = new Uint8Array(self.attr.sliceSize);
			ui8a.set(new Uint8Array(reader.result.slice(s, e)), 0);

			self.readPartialBuffer(ui8a, index);
		}

		callback();
	};

	reader.readAsArrayBuffer(file);
};
Raid2X.prototype.readBase64 = function(base64) {
	var buffer = new Uint8Array(atob(base64).split("").map(function(c) {return c.charCodeAt(0); }));
	return this.readBuffer(buffer);
};

Raid2X.prototype.importShard = function(data) {
	if(data.buffer) {
	// with buffer
		return this.importBuffer(data);
	}
	else if(typeof(data) == "string") {
	// with base64
		return this.importBase64(buffer);
	}
};

Raid2X.prototype.importBuffer = function(buffer) {
	this.binary = !this.binary? []: this.binary;

	var info = this.readShardInfo(buffer);
	var index = info[0];
	var hash = this.shardList[index] || index;

	if(this.downloads.indexOf(index) == -1) { this.downloads.push(index); }

	buffer = buffer.subarray(0, this.attr.sliceSize);

	if(index > -1) {
		this.binary[index] = buffer;
		this.fixWith(hash);
		return this.done(hash);
	}

	return false;
};

Raid2X.prototype.importFile = function(file, callback) {
	var self = this;
	var reader = new FileReader();
	reader.onload = function() {
		var ui8a = new Uint8Array(reader.result);
		callback(undefined, self.importBuffer(ui8a));
	};
	reader.readAsArrayBuffer(file);
}

Raid2X.prototype.importBase64 = function(base64) {
	var buffer = new Uint8Array(atob(base64).split("").map(function(c) {return c.charCodeAt(0); }));
	return this.importBuffer(buffer);
};

/*
	name
	hash
	sliceSize
	encFile - false
	encShard - true
	publicKey
	privateKey
 */
Raid2X.prototype.set = function(option) {
	if(typeof(option) != "object") { option = {}; }
	this.setSliceSize(option.sliceSize);
	this.setSliceCount(option.sliceCount);
	this.setEncFile(option.encFile);
	this.setEncShard(option.encShard);
	this.setPublicKey(option.publicKey);
	this.setPrivateKey(option.privateKey);

	this.setName(option.name);
	this.setType(option.type);
	this.setSize(option.size);
	this.setHash(option.hash);
	this.setShardList(option.shardList);
	this.setDuplicate(option.duplicate);

	return true;
};
Raid2X.prototype.setSliceSize = function(size) {
	if(size >= 0) {
		this.attr.sliceSize = size;
	}

	return true;
};
Raid2X.prototype.setSliceCount = function(count) {
	if(count > 0) {
		this.attr.sliceCount = count;
	}

	return true;
};
Raid2X.prototype.setEncFile = function(bool) {
	if(!isNaN(bool) && !bool == this.attr.encFile) {
		this.attr.encFile = !!bool;

		if(this.attr.encFile) {
			this.binary = this.encrypt(this.binary);
		}
		else {
			this.binary = this.decrypt(this.binary);
		}
		this.setHash();
		this.resetShard();
	}

	return true;
};
Raid2X.prototype.setEncShard = function(bool) {
	if(!isNaN(bool) && !bool == this.attr.encShard) {
		this.attr.encShard = !!bool;

		this.resetShard();
	}

	return true;
};
Raid2X.prototype.setPublicKey = function(key) {
	if(typeof(key) == "string" && key.length > 0) {
		try{
			this.key.setPublicKey(key);
		}
		catch(e) { return false; }
	}

	return true;
};
Raid2X.prototype.setPrivateKey = function(key) {
	if(typeof(key) == "string" && key.length > 0) {
		try{
			this.key.setPrivateKey(key);
		}
		catch(e) { return false; }
	}

	return true;
};
Raid2X.prototype.setName = function(name) {
	if(typeof(name) == "string" && name.length > 0) {
		this.attr.name = name;
	}

	return true;
};
Raid2X.prototype.setType = function(type) {
	if(typeof(type) == "string" && type.length > 0) {
		this.attr.type = type;
	}

	return true;
};
Raid2X.prototype.setSize = function(size) {
	if(size > 0) {
		this.attr.size = size;
	}

	return true;
};
Raid2X.prototype.setHash = function(hash) {
	if(typeof(hash) == "string" && hash.length > 0) {
		this.attr.hash = hash;
	}
	else if(this.binary.length > 0) {
		this.attr.hash = this.genHash(this.binary);
	}

	return true;
};
Raid2X.prototype.setShardList = function(list) {
	if(Array.isArray(list)) {
		this.shardList = list;
		return true;
	}
	else {
		return false;
	}
};
Raid2X.prototype.setDuplicate = function(bool) {
	if(!isNaN(bool) && !bool == this.attr.duplicate) {
		this.attr.duplicate = !!bool;
	}

	return true;
};

Raid2X.prototype.encrypt = function(buffer) {
	var rs;
	try {
		rs = this.key.encrypt(buffer);
	}
	catch(e) {
		rs = buffer;
	}
	finally {
		return rs;
	}
}
Raid2X.prototype.decrypt = function(buffer) {
	var rs;
	try {
		rs = this.key.decrypt(buffer);
	}
	catch(e) {
		rs = buffer;
	}
	finally {
		return rs;
	}
}

/*
	name
	size
	hash
	encFile
	encShard

	sliceCount
	sliceSize
	duplicate
	shardList
 */
Raid2X.prototype.getMeta = function(simplify) {
	var meta = {};
	meta.name = this.attr.name;
	meta.type = this.attr.type;
	meta.size = this.attr.size;
	meta.hash = this.attr.hash;

	meta.encFile = this.attr.encFile;
	meta.encShard = this.attr.encShard;

	var sliceInfo = this.getSliceDetail(simplify);
	meta.sliceCount = sliceInfo.sliceCount;
	meta.sliceSize = sliceInfo.sliceSize;
	meta.shardList = sliceInfo.shardList;
	meta.duplicate = sliceInfo.duplicate;

	return meta;
};
Raid2X.prototype.parseFile = function() {
	var sliceCount;
	this.setHash();
	if(this.attr.size > defaultSize * minSliceCount) {
		sliceCount = Math.ceil( (this.attr.size || 0) / defaultSize );
		sliceCount = sliceCount + ((sliceCount + 1) % 2);
		this.setSliceCount(sliceCount);
		this.setSliceSize(defaultSize);
	}
	else if(this.attr.size > minSize * minSliceCount) {
		sliceCount = minSliceCount;
		this.setSliceCount(sliceCount);
		this.setSliceSize(Math.ceil(this.attr.size / minSliceCount));
	}
	else {
		this.attr.duplicate = true;
		sliceCount = duplicateCount;
		this.setSliceCount(sliceCount);
		this.setSliceSize(this.attr.size);
	}

	this.resetShard();
};
Raid2X.prototype.checkShard = function() {
	if(!Array.isArray(this.shardList) || this.shardList.length == 0) { return false; }

	for(var i = 0; i < this.shardList.length; i++) {
		if(!this.shardList[i]) { return false; }
	}

	return true;
};
Raid2X.prototype.checkComplete = function() {
	for(var i = 0; i < this.shardList.length; i++) {
		if(this.binary[i]) {
			this.uploads.push(this.shardList[i]);
		}
	}
};
Raid2X.prototype.resetShard = function() {
	this.uploads = new Array(this.attr.sliceCount * 2);
	this.shardList = new Array(this.attr.sliceCount * 2);
	this.pointer = 0;
};
Raid2X.prototype.getSliceDetail = function(simplify) {
	var detail = {};

	detail.sliceCount = this.attr.sliceCount;
	detail.sliceSize = this.attr.sliceSize;
	detail.duplicate = this.attr.duplicate;
	detail.shardList = simplify? this.shardList: this.getShardList();

	return detail;
};
Raid2X.prototype.getShardCount = function() {
	return this.attr.sliceCount * 2;
};
Raid2X.prototype.getShardList = function(reset) {
	if(reset || !this.checkShard()) {
		this.shardList = new Array(this.attr.sliceCount * 2);
		if(this.binary[0].buffer) {
			for(var i = 0; i < this.attr.sliceCount * 2; i++) {
				if(!this.shardList[i]) {
					var shard = this.getShard(i);
					this.shardList[i] = this.genHash(shard);
				}
			}
		}
	}

	return this.shardList;
};

Raid2X.prototype.genHash = Raid2X.genHash;
Raid2X.prototype.genShardInfo = Raid2X.genShardInfo;

Raid2X.prototype.readShardInfo = function(buffer) {
	if(!buffer.buffer || buffer.length < 8) {
		return false;
	}
	var s = this.attr.sliceSize;
	return [new Uint32Array(buffer.buffer.slice(s, s + 4))[0], new Uint32Array(buffer.buffer.slice(s + 4, s + 8))[0]];
};

Raid2X.prototype.genHashcash = function(n) {
	return new Uint8Array();
};
Raid2X.prototype.readHashcash = function(buffer) {
	return [];
};

Raid2X.prototype.getShard = function(n, type) {
	var shard, result;
	n = parseInt(n);

	if(!(n < this.attr.sliceCount * 2 && n >= 0)) { return false; }

	if(this.attr.duplicate) {
		shard = new Uint8Array(this.attr.sliceSize);
		shard.set(this.binary[0], 0);
	}
	else if(n >= this.attr.sliceCount) {
		var p1 = n - this.attr.sliceCount;
		var p2 = (n - this.attr.sliceCount + 2) % this.attr.sliceCount;
		shard = XOR(this.getShard(p1), this.getShard(p2));
		shard = shard.subarray(0, this.attr.sliceSize);
	}
	else {
		shard = this.binary[n];
	}

	if(this.attr.encShard) { shard = this.encrypt(shard); }

	// Add shard info
	var info = this.genShardInfo(n);
	// Add hashcash
	var hashcash = this.genHashcash(n);

	var exportShard = new Uint8Array(this.attr.sliceSize + info.byteLength + hashcash.byteLength);
	exportShard.set(shard);
	exportShard.set(info, this.attr.sliceSize);
	exportShard.set(hashcash, this.attr.sliceSize + info.byteLength);

	if(!this.shardList[n]) { this.shardList[n] = this.genHash(exportShard); }

	switch(type) {
		case 'base64':
			var s = "";
			for(var i = 0; i < exportShard.length;) {
				s = "".concat(
					s,
					String.fromCharCode(exportShard[i++]),
					String.fromCharCode(exportShard[i++]),
					String.fromCharCode(exportShard[i++]),
					String.fromCharCode(exportShard[i++]),
					String.fromCharCode(exportShard[i++]),
					String.fromCharCode(exportShard[i++]),
					String.fromCharCode(exportShard[i++]),
					String.fromCharCode(exportShard[i++])
				);
			}
			result = btoa(s);
			break;
		case 'hash':
			result = this.shardList[n];
			break;

		case 'blob':
			result = new Blob([exportShard]);
			break;

		case 'restful':
			var s = "";
			for(var i = 0; i < exportShard.length;) {
				s = "".concat(
					s,
					String.fromCharCode(exportShard[i++]),
					String.fromCharCode(exportShard[i++]),
					String.fromCharCode(exportShard[i++]),
					String.fromCharCode(exportShard[i++]),
					String.fromCharCode(exportShard[i++]),
					String.fromCharCode(exportShard[i++]),
					String.fromCharCode(exportShard[i++]),
					String.fromCharCode(exportShard[i++])
				);
			}

			result = {
				hash: this.shardList[n],
				base64: btoa(s)
			};
			break;

		default:
			result = exportShard;
			break;
	}

	return result;
};
Raid2X.prototype.nextShard = function(type) {
	if(this.pointer > this.attr.sliceCount * 2) { return false; }

	return this.getShard(this.pointer++, type);
};

Raid2X.prototype.done = function(hash, isUpload, isPartial) {
	if(!isNaN(hash) && hash >= 0) {
		// this.fixWith(hash);
	}
	else if(this.shardList.indexOf(hash) > -1 && this.uploads.indexOf(hash) == -1) {
		this.uploads.push(hash);
		this.lost.splice(this.lost.indexOf(hash), 1);
		// this.fixWith(hash);
	}

	return this.getProgress(isUpload, isPartial);
};
Raid2X.prototype.failed = function(hash) {
	this.uploads.splice(this.uploads.indexOf(hash) , 1);

	return this.getProgress();
};
Raid2X.prototype.gone = function(hash) {
	if(this.shardList.indexOf(hash) > -1 && this.uploads.indexOf(hash) == -1 && this.lost.indexOf(hash) == -1) {
		this.lost.push(hash);
	}

	return this.getProgress();
};
Raid2X.prototype.getProgress = function(isUpload, isPartial) {
	var progress;
	if(isPartial) {
		var complete = 0;
		for(var i = 0; i < this.attr.sliceCount; i++) {
			if(this.uploads.indexOf( this.shardList[i] ) > -1) { complete++; }
		}

		progress = (complete / this.attr.sliceCount) || 0;
	}
	else if(isUpload) {
		var complete = 0;
		for(var i = 0; i < this.attr.sliceCount * 2; i++) {
			if(this.uploads.indexOf( this.shardList[i] ) > -1) { complete++; }
		}

		progress = (complete / this.attr.sliceCount / 2) || 0;
	}
	else {
		if(this.attr.duplicate) { return this.downloads.length > 0? 1: 0; }

		var complete = 0;
		for(var i = 0; i < this.attr.sliceCount; i++) {
			if(this.binary[i]) { complete++; }
		}

		progress = (complete / this.attr.sliceCount) || 0;
	}

	return progress;
};

Raid2X.prototype.recovery = function() {
	if(this.getProgress() < 1) { return false; }

	var buffer = new Uint8Array(this.attr.size);
	var tmpbuffer;

	if(this.attr.duplicate) {
		var i = this.shardList.indexOf(this.uploads[0]);
		tmpbuffer = this.attr.encShard? this.key.decrypt(this.binary[i]): this.binary[i];
		buffer = new Uint8Array(tmpbuffer.subarray(0, this.attr.size));
	}
	else {
		for(var i = 0; i < this.attr.sliceCount; i++) {
			tmpbuffer = this.attr.encShard? this.key.decrypt(this.binary[i]): this.binary[i];
			if(this.attr.size - (i * this.attr.sliceSize) < this.attr.sliceSize) {
				buffer.set(tmpbuffer.subarray(0, this.attr.size - (i * this.attr.sliceSize)), i * this.attr.sliceSize)
			}
			else {
				buffer.set(tmpbuffer, i * this.attr.sliceSize);
			}
		}
	}

	this.binary = buffer;
	return true;
};
Raid2X.prototype.fixWith = function(hash) {
	if(this.attr.duplicate) { return true; }

	var index = isNaN(hash)? this.shardList.indexOf(hash): hash;
	var b1 = this.binary[index], b2, b3;
	var n = this.attr.sliceCount;
	var groups = [];

	if(index < this.attr.sliceCount) {
		var p1 = index + 2;
		var c1 = index + n;
		//groups.push([this.shardList[p1], this.shardList[c1]]);
		groups.push([p1, c1]);

		var p2 = (index + n - 2) % n;
		var c2 = p2 + n;
		//groups.push([this.shardList[p2], this.shardList[c2]]);
		groups.push([p2, c2]);
	}
	else {
		var p1 = index - n;
		var p2 = (index + 2) % n;
		//groups.push([this.shardList[p1], this.shardList[p2]]);
		groups.push([p1, p2]);
	}

	for(var k in groups) {
		// no need to fix check buffer
		if(this.binary[groups[k][0]] && !this.binary[groups[k][1]] && index >= this.attr.sliceCount) {
			b2 = this.binary[ groups[k][0] ];
			b3 = XOR(b1, b2);

			var info = this.genShardInfo(groups[k][1]);
			var fb = new Uint8Array(b3.length + info.length);
			fb.set(b3, 0);
			fb.set(info, this.attr.sliceSize);

			this.importBuffer(fb);
		}

		if(!this.binary[groups[k][0]] && this.binary[groups[k][1]]) {
			b2 = this.binary[ groups[k][1] ];
			b3 = XOR(b1, b2);

			var info = this.genShardInfo(groups[k][0]);
			var fb = new Uint8Array(this.attr.sliceSize + info.length);

			fb.set(b3, 0);
			fb.set(info, this.attr.sliceSize);
			this.importBuffer(fb);
		}
	}
	return this.getProgress();
};
Raid2X.prototype.getDownloadPlan = function() {
	var rs = [];
	for(var i = 0; i < this.attr.sliceCount; i++) {
		var n = this.attr.sliceCount;
		if(this.shardList.length > 0) {
			var hash = this.shardList[i];
			if(this.uploads.indexOf(this.shardList[i]) == -1) {
				if(this.lost.indexOf(this.shardList[i]) > -1) {
					if(this.uploads.indexOf(this.shardList[i + n]) == -1 && this.lost.indexOf(this.shardList[i + n]) == -1) {
						rs.push(this.shardList[i + n]);
					}
					if(this.uploads.indexOf(this.shardList[(i + n - 2) % n + n]) == -1 && this.lost.indexOf(this.shardList[(i + n - 2) % n + n]) == -1) {
						rs.push(this.shardList[(i + n - 2) % n + n]);
					}
				}
				else {
					rs.push(this.shardList[i]);
				}
			}
		}
		else {
			if(!this.binary[i]) {
				if(this.lost.indexOf(i) > -1) {
					rs.push(i + n);
					rs.push((i + n - 2) % n + n);
				}
				else {
					rs.push(i);
				}
			}
		}
	}

	return rs;
};


Raid2X.prototype.toBinary = function() {
	if(!!this.binary || this.recovery()) {
		return this.binary;
	}
};
Raid2X.prototype.toFile = function() {
	if(!!this.binary || this.recovery()) {
		var blob = new Blob(this.binary);
		blob.lastModifiedDate = new Date();
		blob.name = this.attr.name || this.attr.hash;

		return blob;
	}
};
Raid2X.prototype.toBase64 = function() {
	if(!!this.binary || this.recovery()) {
		return btoa(String.fromCharCode.apply(null, this.binary));
	}
};
Raid2X.prototype.toURL = function() {
	var blob = this.toFile();
	if(!blob) { return false; }
	var url = window.URL.createObjectURL(blob);

	return url;
};
Raid2X.prototype.save = function() {
	var url = this.toURL();
	if(!url) { return false; }

	var a = document.createElement("a");
	document.body.appendChild(a);
	a.style = "display: none";
	a.href = url;
	a.download = this.attr.name;
	a.click();
	window.URL.revokeObjectURL(url);
	document.body.removeChild(a);
	delete a;
};

// upload for web UI
Raid2X.prototype.addUploadList = function(target) {
	this.uploadQueue = this.uploadQueue || [];
	this.uploadQueue.push(target);
	return this;
};
Raid2X.prototype.startUpload = function() {
	var self = this;
	if(!this.uploadQueue || this.uploadQueue.length == 0) { return false; }
	if(Raid2X.connection >= maxConnection) {  Raid2X.queue.push(function() { self.startUpload(); }); return false; }

	var target = this.uploadQueue.pop();
	var path = target.path;
	var shard = this.getShard(target.n,'blob');
	var hash = this.getShard(target.n, 'hash');
	if(!shard) { return false; }

	var formData = new FormData();
	formData.append("file", shard);

	var option = {
		path: target.path,
		method: 'POST',
		data: formData,
		callback: function(error, resp) {
			if(self.uploadQueue.length > 0) {
				self.startUpload();
			}

			try {
				var rs = JSON.parse(resp);
				if(rs.result != 1) {
					throw new Error("failed");
				}
				else {
					//delete self.binary[target.n];
					if(typeof(target.callback) == 'function') {
						target.callback(undefined, self.done(hash, true));
					}
				}
			}
			catch(e) {
				// upload failed, retry
				target.retry = target.retry? (target.retry + 1): 1
				if(target.retry <= maxRetry) { self.addUploadList(target); }
				else { throw new Error("can not upload shard: " + target.n); }
			}
		}
	};

	Raid2X.request(option);
};
Raid2X.prototype.upload = function(path, n, callback) {
	// single
	var target = {path: path, n: n, callback: callback};
	this.addUploadList(target);
	// multiple

	this.startUpload();
};
Raid2X.prototype.uploadAll = function(path, callback) {

	var self = this;

	var addUpload = function() {
		var n = self.pointer;
		var h = self.nextShard('hash');
		var p = typeof(path) == 'function'? path(h): path + h;
		self.upload(p, n, function(e, d) {
			addUpload();
			if(typeof(callback) == 'function') {
				callback(e, d);
			}
		});
	};
	addUpload();
	addUpload();
	addUpload();

	return this;
};

// send for peer transfer
Raid2X.prototype.addSendList = function(target) {
	this.sendQueue = this.sendQueue || [];
	this.sendQueue.push(target);
	return this;
};
Raid2X.prototype.startSend = function() {
	var self = this;
	if(!this.sendQueue || this.sendQueue.length == 0) { return false; }
	if(Raid2X.connection >= maxConnection) {  Raid2X.queue.push(function() { self.startSend(); }); return false; }

	var target = this.sendQueue.pop();
	var path = target.path;
	var shard = this.getShard(target.n,'blob');
	var hash = this.getShard(target.n, 'hash');
	if(!shard) { return false; }

	var formData = new FormData();
	formData.append("file", shard);

	var option = {
		path: target.path,
		method: 'POST',
		data: formData,
		callback: function(error, resp) {
			if(self.sendQueue.length > 0) {
				self.startSend();
			}

			try {
				var rs = JSON.parse(resp);
				if(rs.result != 1) {
					throw new Error("failed");
				}
				else {
					delete self.binary[target.n];
					if(typeof(target.callback) == 'function') {
						target.callback(undefined, self.done(hash, true, true));
					}
				}
			}
			catch(e) {
				// send failed, retry
				target.retry = target.retry? (target.retry + 1): 1;
				if(target.retry <= maxRetry) { self.addSendList(target); }
				else { throw new Error("can not send shard: " + target.n); }
			}
		}
	};

	Raid2X.request(option);
};
Raid2X.prototype.send = function(path, n, callback) {
	// single
	var target = {path: path, n: n, callback: callback};
	this.addSendList(target);
	// multiple

	this.startSend();
};
Raid2X.prototype.sendAll = function(path, callback) {
	var self = this;

	var addSend = function() {
		var n = self.pointer;
		if(n >= self.attr.sliceCount) { return false; }

		var h = self.nextShard('hash');
		var p = typeof(path) == 'function'? path(h): path + h;
		self.send(p, n, function(e, d) {
			addSend();
			var rs = {
				hash: self.attr.hash,
				progress: d,
				path: p
			};
			if(typeof(callback) == 'function') {
				callback(undefined, rs);
			}
		});
	};
	addSend();
	addSend();
	addSend();

	return this;
};

// download for web UI
Raid2X.prototype.addDownloadList = function(target) {
	this.downloadQueue = this.downloadQueue || [];
	this.downloadQueue.push(target);
	return this;
};
Raid2X.prototype.startDownload = function() {
	var self = this;
	if(!this.downloadQueue || this.downloadQueue.length == 0) { return false; }
	if(Raid2X.connection >= maxConnection) { Raid2X.queue.push(function() { self.startDownload(); }); return false; }

	var target = this.downloadQueue.pop();
	var path = target.path;
	var option = {
		method: 'GET',
		path: target.path + "?t=" + (new Date() / 1),
		responseType: 'blob',
		callback: function(error, resp) {
			if(error) {
				if(path.indexOf(self.currNode) > -1) { self.off(); }
				if(!!self.currNode) {
					target.path = self.changePath(target.path);
					self.downloadQueue.push(target);
					self.startDownload();
					return false;
				}
			}
			if(self.downloadQueue.length > 0) {
				self.startDownload();
			}

			var file = new Blob([resp]);
			self.importFile(file, function(e, d) {
				if(!d) {
					// download failed, retry
					target.retry = target.retry? (target.retry + 1): 1;
					/*
					if(target.retry <= maxRetry) { self.addDownloadList(target); }
					else { self.gone(target.hash); }
					*/

					// no retry
					self.gone(target.hash);

					d = self.getProgress();
				}
				if(typeof(target.callback) == 'function') {
					target.callback(e, d);
				}
			});
		}
	};
	Raid2X.request(option);
};
Raid2X.prototype.download = function(path, n, hash, callback) {
	// single
	var target = {path: path, n: n, hash: hash, callback: callback};
	this.addDownloadList(target);
	// multiple

	this.startDownload();
};

Raid2X.prototype.setNodes = function (nodes) {
	this.nodes = nodes;
	this.currNode = this.nodes.pop();
};
Raid2X.prototype.changePath = function (path) {
	return this.currNode + path.split('/shard/').slice(1).join('/shard/');
};
Raid2X.prototype.getPath = function (key) {
	return this.currNode + key;
};
Raid2X.prototype.off = function () {
	this.currNode = this.nodes.pop();
};

Raid2X.prototype.downloadAll = function(path, callback) {
	var self = this;
	self.downloads = [];
	self.dqueue = self.getDownloadPlan().reverse();
	if(Array.isArray(path)) {
		this.setNodes(path);
	}

	var addDownload = function() {
		// var t = self.getDownloadPlan()[0];
		var t = self.dqueue.pop();
		var n, h, p;
		if(typeof(t) == "number") {
			n = t;
			h = self.shardList[n];
		}
		else if(!t) {
			callback(undefined, self.getProgress());
			return false;
		}
		else {
			n = self.shardList.indexOf(t);
			h = t;
		}
		if(n >= self.attr.sliceCount * 2) { return false; }
		p = typeof(path) == 'function'? path(h): !!self.currNode? self.currNode + h: path + h;
		self.download(p, n, h, function(e, d) {
			if(d < 1) {
				addDownload();
			}
			if(typeof(callback) == 'function') {
				callback(e, d);
			}
		});
	};
	addDownload();
	addDownload();
	addDownload();
	addDownload();
	addDownload();

	return this;
};

return Raid2X;
})();
