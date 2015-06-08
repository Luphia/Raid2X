/* Test code

var RSA = require('node-rsa');
var fs = require('fs');
var util= require('util');

var Raid2X = require('./index.js');
var keyPair = Raid2X.genKey({b:512});
var r2x = new Raid2X();
r2x.setPrivateKey(keyPair.private);
r2x.readFile('/Users/isuntv-e3/Documents/workspace/resources/test.file.exe', function(e, d) {var iii = 0; while(r2x.nextShard()) {console.log(++iii)}});
r2x.getMeta();

var keyPair = Raid2X.genKey();
var key = new RSA();

key.exportKey('pkcs8-private-string') == keyPair.private;
key.exportKey('pkcs8-public-string') == keyPair.public;

key.importKey(keyPair.private, 'pkcs8-private-string');
key.exportKey('pkcs8-private-string') == keyPair.private;
key.exportKey('pkcs8-public-string') == keyPair.public;

key.importKey(keyPair.public, 'pkcs8-public-string');
key.exportKey('pkcs8-private-string') == keyPair.private;
key.exportKey('pkcs8-public-string') == keyPair.public;

 */

/*

Create new file

Rebuild file

 */

var RSA = require('node-rsa')
,	fs = require('fs')
,	util = require('util')
,	crypto = require('crypto')
;

var minSliceCount = 45;
var minSize = 512;
var defaultSize = 200 * 1024;
var defaultKeySize = 2048;
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
	if(!util.isBuffer(buff1) || !util.isBuffer(buff2)) { return false; }
	if(buff2.length > buff1.length) { return XOR(buff2, buff1); }

	var res = [];
	for(var i = 0; i < buff1.length; i++) {
		res.push(buff1[i] ^ buff2[i]);
	}
	return new Buffer(res);
};
var SHA1 = function(buffer) {
	return crypto.createHash('sha1').update(buffer).digest('hex');
};
var CRC32 = function(buffer) {
	var b, crc, i, len, code;
	if(!util.isBuffer(buffer)) { buffer = new Buffer(new String(buffer)); }
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
	if(!util.isBuffer(buffer)) { buffer = new Buffer(new String(buffer)); }

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
Raid2X.genKey = function(length) {
	length = length >= 512? length: defaultKeySize;
	var key = new RSA({b: length});
	var keypair = {};
	keypair.private = key.exportKey('pkcs8-private-string');
	keypair.public = key.exportKey('pkcs8-public-string');

	return keypair;
}

Raid2X.prototype.init = function(data) {
	var self = this;

	this.attr = {};
	this.attr.size = 0;
	this.attr.sliceSize = defaultSize;
	this.attr.sliceCount = minSliceCount;
	this.attr.encShard = false;
	this.attr.encFile = false;
	this.attr.duplicate = false;
	this.shards = [];
	this.shardList = [];
	this.key = new RSA();

	this.pointer = 0;

	if(util.isBuffer(data)) {
	// with buffer
		this.readBuffer(data, function() {});
	}
	else if(util.isString(data)) {
	// with file path
		var buffer = fs.readFileSync(data);
		this.readBuffer(buffer, function() {});
	}
	else if(util.isObject(data)) {
	// with metadata
		this.set(data);
	}

	return true;
};

Raid2X.prototype.readBuffer = function(buffer, callback) {
	this.binary = buffer;
	this.attr.size = buffer.length;
	this.parseFile();
	callback(false, this.attr.size);

	return this.attr.size;
};
Raid2X.prototype.readFile = function(path, callback) {
	var self = this;
	fs.readFile(path, function(e, d) {
		if(e) {
			callback(e);
		}
		else {
			self.binary = d;
			self.attr.size = d.length;
			self.parseFile();
			callback(e, self.attr.size);
		}
	});
};
Raid2X.prototype.readBase64 = function(base64) {
	var buffer = new Buffer(base64, 'base64');
	this.readBuffer(buffer, function() {});
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
	if(!util.isObject(option)) { option = {}; }
	this.setSliceSize(option.sliceSize);
	this.setSliceCount(option.sliceCount);
	this.setEncFile(option.encFile);
	this.setEncShard(option.encShard);
	this.setPublicKey(option.publicKey);
	this.setPrivateKey(option.privateKey);

	this.setName(option.name);
	this.setSize(option.size);
	this.setHash(option.hash);

	return true;
};
Raid2X.prototype.setSliceSize = function(size) {
	if(size > 0) {
		this.attr.sliceSize = size;
	}

	return true;
};
Raid2X.prototype.setSliceCount = function(count) {
	if(count > minSliceCount) {
		this.attr.sliceCount = count;
	}

	return true;
};
Raid2X.prototype.setEncFile = function(bool) {
	if(!util.isUndefined(bool)) {
		this.attr.encFile = !!bool;
	}

	return true;
};
Raid2X.prototype.setEncShard = function(bool) {
	if(!util.isUndefined(bool)) {
		this.attr.encShard = !!bool;
	}

	return true;
};
Raid2X.prototype.setPublicKey = function(key) {
	if(util.isString(key) && key.length > 0) {
		try{
			this.key.importKey(key, 'pkcs8-public-string');
		}
		catch(e) { return false; }
	}

	return true;
};
Raid2X.prototype.setPrivateKey = function(key) {
	if(util.isString(key) && key.length > 0) {
		try{
			this.key.importKey(key, 'pkcs8-private-string');
		}
		catch(e) { return false; }
	}

	return true;
};
Raid2X.prototype.setName = function(name) {
	if(util.isString(name) && name.length > 0) {
		this.attr.name = name;
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
	if(util.isString(hash) && hash.length > 0) {
		this.attr.hash = hash;
	}
	else if(util.isBuffer(this.binary)) {
		this.attr.hash = this.genHash(this.binary);
	}

	return true;
};

/*
	name
	size
	hash
	encFile
	encShard

	sliceCount
	sliceSize
	duplicate
	shardsList
 */
Raid2X.prototype.getMeta = function() {
	var meta = {};
	meta.name = this.attr.name;
	meta.size = this.attr.size;
	meta.hash = this.attr.hash;
	
	meta.encFile = this.attr.encFile;
	meta.encShard = this.attr.encShard;

	var sliceInfo = this.getSliceDetail();
	meta.sliceCount = sliceInfo.sliceCount;
	meta.sliceSize = sliceInfo.sliceSize;
	meta.shardList = sliceInfo.shardList;
	meta.duplicate = sliceInfo.duplicate;

	return meta;
};
Raid2X.prototype.parseFile = function() {
	var sliceCount;
	this.setHash();
	if(this.attr.size > this.attr.sliceSize * minSliceCount) {
		sliceCount = Math.ceil( (this.attr.size || 0) / this.attr.sliceSize );
		sliceCount = sliceCount + ((sliceCount + 1) % 2);
		this.setSliceCount(sliceCount);
	}
	else if(this.size > minSize * minSliceCount) {
		sliceCount = minSliceCount;
		this.setSliceCount(sliceCount);
		this.setSliceSize(Math.ceil(this.size / minSliceCount));
	}
	else {
		this.attr.duplicate = true;
		sliceCount = minSliceCount;
		this.setSliceCount(sliceCount);
		this.setSliceSize(this.attr.size);
	}

	this.resetShard();
};
Raid2X.prototype.resetShard = function() {
	this.shards = new Array(this.attr.sliceCount * 2);
	this.shardList = new Array(this.attr.sliceCount * 2);
	this.pointer = 0;
};
Raid2X.prototype.getSliceDetail = function() {
	var detail = {};

	detail.sliceCount = this.attr.sliceCount;
	detail.sliceSize = this.attr.sliceSize;
	detail.duplicate = this.attr.duplicate;
	detail.shardList = this.getShardList();

	return detail;
};
Raid2X.prototype.getShardList = function() {
	this.shardList = new Array(this.attr.sliceCount * 2);
	if(util.isBuffer(this.binary)) {
		for(var i = 0; i < this.attr.sliceCount * 2; i++) {
			this.shardList[i] = this.genHash(this.getShard(i));
		}
	}
	return this.shardList;
};
Raid2X.prototype.genHash = function(buffer) {
// sha1 + crc32
	var hash = SHA1(buffer) + CRC32(buffer);
	return hash;
};



Raid2X.prototype.getShard = function(n, type) {
	var shard;
	n = parseInt(n);

	if(!(n < this.attr.sliceCount * 2 && n >= 0)) { return false; }

	if(this.attr.duplicate) {
		shard = Buffer.concat([this.binary, new Buffer(n.toString())]);
	}
	else if(n >= this.attr.sliceCount) {
		var p1 = n - this.attr.sliceCount;
		var p2 = (n - this.attr.sliceCount + 2) % this.attr.sliceCount;
		shard = XOR(this.getShard(p1), this.getShard(p2));
	}
	else {
		var tmpBinary = Buffer.concat([this.binary, new Buffer(this.attr.sliceSize)]);
		shard = new Buffer(this.attr.sliceSize);
		tmpBinary.copy(shard, 0, n * this.attr.sliceSize, (n + 1) * this.attr.sliceSize);
	}

	if(this.attr.encShard) { shard = this.key.encrypt(shard); }
	switch(type) {
		case 'base64':
			shard = shard.toString('base64');
			break;

		default:
			break;
	}

	return shard;
};
Raid2X.prototype.nextShard = function(type) {
	if(this.pointer > this.attr.sliceCount * 2) { return false; }

	return this.getShard(++this.pointer, type);
};

module.exports = Raid2X;