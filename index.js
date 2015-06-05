/* Test code

var RSA = require('node-rsa');
var fs = require('fs');
var util= require('util');

var Raid2X = require('./index.js');
var r2x1, r2x2, r2x3, r2x4;

fs.readFile('./index.js', function(e, d) { r2x1 = new Raid2X(d); })
r2x2 = new Raid2X('./index.js')
r2x3 = new Raid2X()
r2x3.readBase64('LyogVGVzdCBjb2RlCgp2YXIgTm9kZVJTQSA9IHJlcXVpcmUoJ25vZGUtcnNhJyk7CnZhciBmcyA9IHJlcXVpcmUoJ2ZzJyk7CnZhciB1dGlsPSByZXF1aXJlKCd1dGlsJyk7Cgp2YXIgUmFpZDJYID0gcmVxdWlyZSgnLi9pbmRleC5qcycpOwp2YXIgcjJ4MSwgcjJ4MiwgcjJ4MywgcjJ4NDsKCmZzLnJlYWRGaWxlKCcuL2luZGV4LmpzJywgZnVuY3Rpb24oZSwgZCkgeyByMngxID0gbmV3IFJhaWQyWChkKTsgfSkKcjJ4MiA9IG5ldyBSYWlkMlgoJy4vaW5kZXguanMnKQoKICovCgovKgoKQ3JlYXRlIG5ldyBmaWxlCgpSZWJ1aWxkIGZpbGUKCiAqLwoKdmFyIE5vZGVSU0EgPSByZXF1aXJlKCdub2RlLXJzYScpCiwJZnMgPSByZXF1aXJlKCdmcycpCiwJdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKQo7Cgp2YXIgUmFpZDJYID0gZnVuY3Rpb24oZGF0YSkgeyB0aGlzLmluaXQoZGF0YSk7IH0KClJhaWQyWC5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uKGRhdGEpIHsKCXZhciBzZWxmID0gdGhpczsKCgl0aGlzLmF0dHIgPSB7fQoJdGhpcy5hdHRyLnNpemUgPSAwOwoJdGhpcy5hdHRyLnNsaWNlID0gMTAyNCAqIDIwMDsKCglpZih1dGlsLmlzQnVmZmVyKGRhdGEpKSB7CgkvLyB3aXRoIGJ1ZmZlcgoJCXRoaXMucmVhZEJ1ZmZlcihkYXRhLCBmdW5jdGlvbigpIHt9KTsKCX0KCWVsc2UgaWYodXRpbC5pc1N0cmluZyhkYXRhKSkgewoJLy8gd2l0aCBmaWxlIHBhdGgKCQl2YXIgYnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKGRhdGEpOwoJCXRoaXMucmVhZEJ1ZmZlcihidWZmZXIsIGZ1bmN0aW9uKCkge30pOwoJfQoJZWxzZSB7CgkvLyBibGFuawoJfQp9OwoKUmFpZDJYLnByb3RvdHlwZS5yZWFkQnVmZmVyID0gZnVuY3Rpb24oYnVmZmVyLCBjYWxsYmFjaykgewoJdGhpcy5iaW5hcnkgPSBidWZmZXI7Cgl0aGlzLmF0dHIuc2l6ZSA9IGJ1ZmZlci5sZW5ndGg7CgljYWxsYmFjayhmYWxzZSwgdGhpcy5hdHRyLnNpemUpOwoKCXJldHVybiB0aGlzLmF0dHIuc2l6ZTsKfTsKUmFpZDJYLnByb3RvdHlwZS5yZWFkRmlsZSA9IGZ1bmN0aW9uKHBhdGgsIGNhbGxiYWNrKSB7Cgl2YXIgc2VsZiA9IHRoaXM7Cglmcy5yZWFkRmlsZShwYXRoLCBmdW5jdGlvbihlLCBkKSB7CgkJaWYoZSkgewoJCQljYWxsYmFjayhlKTsKCQl9CgkJZWxzZSB7CgkJCXRoaXMuYnVmZmVyID0gZGF0YTsKCQkJdGhpcy5hdHRyLnNpemUgPSBkYXRhLmxlbmd0aDsKCQkJY2FsbGJhY2soZSwgdGhpcy5hdHRyLnNpemUpOwoJCX0KCX0pOwp9OwpSYWlkMlgucHJvdG90eXBlLnJlYWRCYXNlNjQgPSBmdW5jdGlvbihiYXNlNjQpIHsKCXZhciBidWZmZXIgPSBuZXcgQnVmZmVyKGJhc2U2NCwgJ2Jhc2U2NCcpOwp9OwoKUmFpZDJYLnByb3RvdHlwZS5zZXRTbGljZVNpemUgPSBmdW5jdGlvbihzaXplKSB7Cgp9OwoKUmFpZDJYLnByb3RvdHlwZS5nZXRTbGljZSA9IGZ1bmN0aW9uKG4pIHsKCn07Cgptb2R1bGUuZXhwb3J0cyA9IFJhaWQyWDs=')

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
;

var minSliceCount = 3;
var defaultSize = 200 * 1024;
var defaultKeySize = 2048;
var defaultEncryption = 'RSA';

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
	this.attr.encShard = false;
	this.attr.encFile = false;
	this.attr.duplicate = false;
	this.key = new RSA();

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
			this.buffer = data;
			this.attr.size = data.length;
			callback(e, this.attr.size);
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
	if(!util.isString(key) && key.length > 0) {
		try{
			this.key.importKey(key, 'pkcs8-public-string');
		}
		catch(e) { return false; }
	}

	return true;
};
Raid2X.prototype.setPrivateKey = function(key) {
	if(!util.isString(key) && key.length > 0) {
		try{
			this.key.importKey(key, 'pkcs8-private-string');
		}
		catch(e) { return false; }
	}

	return true;
};
Raid2X.prototype.setName = function(name) {
	if(!util.isString(name) && name.length > 0) {
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
	if(!util.isString(hash) && hash.length > 0) {
		this.attr.hash = hash;
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
	shardList
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
	meta.shardList = sliceInfo.shardList;
	meta.duplicate = sliceInfo.duplicate;
	meta.sliceSize = sliceInfo.sliceSize;

	return meta;
};
Raid2X.prototype.getSliceDetail = function() {
//++ not finish 2015/06/05
	var detail = {};
	detail.sliceSize = this.attr.sliceSize;
	detail.duplicate = this.attr.duplicate;

	var sliceCount = Math.ceil( (this.attr.size || 0) / this.attr.sliceSize )
	if(this.size > this.sliceSize * minSliceCount) {
		sliceCount = sliceCount + ((sliceCount + 1) % 2);
	}
	else {
		this.attr.duplicate = true;
		this.setSliceSize(this.attr.size);
		sliceCount = sliceCount > minSliceCount? sliceCount + ((sliceCount + 1) % 2): minSliceCount;
	}
	sliceCount = sliceCount > minSliceCount? sliceCount + ((sliceCount + 1) % 2): minSliceCount;

	return detail;
};

Raid2X.prototype.getSlice = function(n) {

};

module.exports = Raid2X;