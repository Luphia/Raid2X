importScripts('raid2x.js', 'forge.min.js');

self.onmessage = function(e) {
	self.readfile(e.data);
};

self.readfile = function(f) {
	var s = new Date();

	if(Array.isArray(f)) {
		for(var k in f) { self.readfile(f[k]); }
		return true;
	}
	else {
		var r2x = new Raid2X();
		r2x.readFile(f, function(e, d) {
			var meta = r2x.getMeta()
			self.postMessage(new Date() - s);
		});
	}
};