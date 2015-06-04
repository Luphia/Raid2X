/*

Create new file

Rebuild file

 */

var NodeRSA = require('node-rsa')
,	fs = require('fs')
,	util= require('util')
;

var Raid2X = function(data) { this.init(data); }

Raid2X.prototype.init = function(data) {
	var self = this;

	this.attr = {}
	this.attr.size = 0;
	this.attr.slice = 1024 * 200;

	if(util.isBuffer(data)) {
	// with buffer
		this.binary = data;
	}
	else if(util.isString(data)) {
	// with file path
	}
	else {
	// blank
	}
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

};

Raid2X.prototype.setSliceSize = function(size) {

};

Raid2X.prototype.getSlice = function(n) {

};

module.exports = Raid2X;