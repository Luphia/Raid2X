var BorgRing = (function() {

var guid = function() {
	var s4 = function() {
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	};
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' +s4() + '-' + s4() + s4() + s4();
};
var intToBuffer = function(int) {
	if(!Number.isFinite(int)) { return false; }

	var length = Math.ceil((Math.log(int + 1)/Math.log(2))/8);
	var buffer = new Uint8Array(length);
	var arr = [];

	while (int > 0) {
		var temp = int % 2;
		arr.push(temp);
		int = Math.floor(int / 2);
	}

	var counter = 0;
	var total = 0;

	for (var i = 0, j = arr.length; i < j; i++) {
		if (counter % 8 == 0 && counter > 0) {
			buffer[length - 1] = total;
			total = 0;
			counter = 0;
			length--;
		}

		if (arr[i] == 1) {
			total += Math.pow(2, counter);
		}
		counter++;
	}

	buffer[0] = total;
	return buffer;
};
var stringToInt = function(str) {
	var result = 0;
	for(var i = 0; i < str.length; i++) {
		result += str.charCodeAt(i) * (i + 1);
	}

	return result;
};
var bufferConcat = function(buffers) {
	var result;

	if(Array.isArray(buffers)) {
		var l = 0;
		for(var i = 0; i < buffers.length; i++) {
			l += buffers[i].length;
		}

		result = new Uint8Array(l);

		for(var i = 0, p = 0; i < buffers.length; i++) {
			result.set(buffers[i], p);
			p += buffers[i].length;
		}
	}
	else {
		result = buffers;
	}

	return result;
};
var clone = function(obj) {
	var rs;
	if(typeof(obj) == 'object') {
		rs = Array.isArray(obj)? []: {};
		for(var k in obj) {
			rs[k] = clone(obj[k]);
		}
	}
	else {
		rs = obj;
	}

	return rs;
};
var stringToUint8Array = function(s) {
	if(typeof(s) != 'string') { s = ''; }
	var rs = [];
	for(var i = 0; i < s.length; i++) {
		var n = s.charCodeAt(i);
		while(n > 256) {
			rs.push(n % 256);
			n = Math.floor(n / 256);
		}
		if(n > 0) { rs.push(n); }
	}

	return new Uint8Array(rs);
};
var getHash = function(v, n) {
	// number string boolean object
	var n = stringToUint8Array(n);

	if(typeof(v) == 'string') {
		v = stringToUint8Array(v);
	}
	else if(Number.isFinite(v)) {
		v = intToBuffer(v);
	}
	else if(typeof(v) == 'object') {
		v = stringToUint8Array( JSON.stringify(v) );
	}

	return new Rusha().digest( bufferConcat([v, n]) );
};
var compare = function(a, b, n) {
	// number string boolean object
	var n = stringToUint8Array(n);


	if(typeof(b) == 'string') {
		b = stringToUint8Array(b);
	}
	else if(Number.isFinite(b)) {
		b = intToBuffer(b);
	}
	else if(typeof(b) == 'object') {
		b = stringToUint8Array( JSON.stringify(b) );
	}

	a = getHash(a, n);
	b = getHash(b, n);

	return a > b ? 1 : a < b ? 0 : -1;
};
var	shuffle = function(arr, n) {
	if(!Array.isArray(arr)) { return false; }
	var n = stringToUint8Array(n);
	arr.sort(function(a, b) {
		compare(a, b, n);
	});
};

var BorgRing = function(data) { this.init(data); };
BorgRing.getAllocator = function(url, callback) {
	var request = new XMLHttpRequest();
	request.onload = function() {
		var rs;
		var br = new BorgRing();

		try {
			rs = JSON.parse(request.response).data;
			for(var i = 0; i < rs.length; i++) {
				br.addNode(rs[i]);
			}
		}
		catch(e) {console.trace(e)}

		var f = function(key) {
			var n = br.find(key).split(':');
			var p = 'http://' + n[0] + ':' + n[1] + '/shard/' + key;
			return p;
		};

		if(typeof(callback) == 'function') {
			callback(undefined, f);
		}
	};
	request.open('GET', url);
	request.send();
};
BorgRing.shuffle = shuffle;
BorgRing.guid = guid;

BorgRing.prototype.init = function(data) {
	this.nodes = [];
	this.attr = {};
};

BorgRing.prototype.addNode = function(node) {
	if(!this.exist(node)) {
		this.nodes.push(node);
	}

	return true;
};
BorgRing.prototype.removeNode = function(node) {
	var i = this.indexOf(node);
	if(i > -1) {
		this.nodes.splice(i, 1);
	}

	return this;
};

BorgRing.prototype.sort = function(n) {
	this.attr.sort = n;
	shuffle(this.nodes, n);

	return this;
};

BorgRing.prototype.exist = function(node) {
	var rs = this.indexOf(node) > -1;
	return rs;
};
BorgRing.prototype.indexOf = function(node) {
	var rs = -1;
	if(typeof(node) == 'object') {
		for(var i = 0; i < this.nodes.length; i++) {
			if(JSON.stringify(node) == JSON.stringify(this.nodes[i])) {
				rs = i;
				break;
			}
		}
	}
	else {
		rs = this.nodes.indexOf(node);
	}

	return rs;
};

BorgRing.prototype.getNode = function(n) {
	if(!(n > -1)) { n = Math.floor( Math.random() * this.nodes.length ); }
	return this.nodes[n];
};

BorgRing.prototype.getNodeList = function() {
	return clone(this.nodes);
};

BorgRing.prototype.getNeighbor = function(node) {
	var n = this.indexOf(node);
	if(n > -1) {
		n = (n + 1) % this.nodes.length;
	}

	return this.getNode(n);
};


BorgRing.prototype.find = function(key, n) {
	/*
	this.sort(n);
	var i = stringToInt(key) % this.nodes.length;
	rs = this.nodes[i];

	return rs;
	*/

	var rs;
	var upper = this.nodes.length - 1, lower = 0, idx = 0, comp = 0;
	if(upper == 0) { return undefined; }
	this.sort(n);

	while(lower <= upper) {
		idx = Math.floor((lower + upper) / 2);
		var node = this.nodes[idx];
		var oStr = typeof(node) == 'object'? JSON.stringify(node): node.toString();
		comp = compare(this.nodes[idx], key, n);

		if(comp == -1) {
			return this.nodes[idx];
		}
		else if(comp > 0) {
			upper = idx - 1;
		}
		else {
			lower = idx + 1;
		}
	}

	if(upper < 0) {
		upper = this.nodes.length - 1;
	}
	return this.nodes[upper];
};

return BorgRing;
})();