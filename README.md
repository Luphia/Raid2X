Raid2X
=======
[![Build Status](https://travis-ci.org/Luphia/Raid2X.png?branch=master)](https://travis-ci.org/Luphia/Raid2X)
[![Deps Status](https://david-dm.org/Luphia/Raid2X.png)](https://david-dm.org/Luphia/Raid2X)

**Raid2X** is a software raid algorithm
* Pure JavaScript
* Support file Segmentation / Merge
* Support file Encrypt / Decrypt
* File would be divided into 2N parts (N mod 2 = 1)，and could be recovery by only N + 1 parts

## Installing
```shell
npm install raid2x
```
> <sub>Requires nodejs >= 0.10.x</sub>

## Usage
### Quick Test
```javascript
var Raid2X = require('raid2x');
var filepath = "/Users/luphia/Documents/Workspace/Playground/logo.png";
var distination = "/Users/luphia/Desktop/";
var r2x = new Raid2X(filepath), r2x1, meta;
r2x.setSliceSize(61440);
meta = r2x.getMeta(true);
r2x1 = new Raid2X(meta);
for(var i = 0; i < meta.sliceCount; i++) {
	r2x1.importShard(r2x.getShard(i));
}
r2x1.save(distination + meta.name);
```
### Initial Raid2X
```javascript
var Raid2X = require("raid2x");
var r2x = new Raid2X([options]);
```
* options - {Buffer|File path|Metadata}

#### Metadata
You can also export the Metadata from an exist Raid2X over r2x.getMeta()
*	name - [String] name of original file
*	size - [INT] size of original file
*	hash - [String] hash of original file (SHA1 + CRC)
*	encFile - [Boolean] to switch
*	encShard - [Boolean]
*	sliceCount - [INT]
*	sliceSize - [INT]
*	duplicate - [Boolean]
*	shardList - [String Array]

### Load file
```javascript
r2x.readFile("/path/to/your/file.txt", function(err, data) {
  if(err) { console.trace(e); }
  else {}
});

// You can also read a file by Buffer or Base64 string
var fs = require("fs");
var buffer = fs.readFileSync("/path/to/file.txt");
var base64 = buffer.toString('base64');

r2x.readBuffer(buffer);
r2x.readBase64(base64);
```

### Copy to another place
```javascript
var metadata = r2x.getMeta();
var copy = new Raid2X(metadata);
var shardCount = metadata.shardList.length;

var shard;
while(shard = r2x.nextShard()) {
  var progress = copy.importShard(shard);
  console.log(progress * 100 + "%");
  
  if(progress == 1) { break; }
}
```

### If the file is divided into 2N shards, you can recovery a it by only N+1 shards
```javascript
var recovery = new Raid2X(metadata);
for(var i = 0; i < metadata.shardList.length; i++) {
  if(i % 2 == 0 || i == r2x.attr.sliceCount) {
    recovery.importShard(r2x.getShard(i));
  }
}

var N = metadata.shardList.length / 2 + 1;
if(recovery.toBase64() == r2x.toBase64()) { console.log("recovery file with %d shards", N); }
else { console.log("recovery failed :("); }
```

### Get a shard / Import a shard
```javascript
var sample = new Raid2X(metadata);
var n = 0;

var type = "buffer";
var bufferShard = r2x.getShard(n, type);
sample.importBuffer(bufferShard);

type = "base64";
var base64Shard = r2x.getShard(n, type);
sample.importBase64(base64Shard);
```
* n - [INT] the order of the shard
* type - {buffer|base64} format of the shard

### Export the file / Save the file
```javascript
var bufferFile = r2x.toBinary();
var base64File = r2x.toBase64();

var writeStream = fs.createWriteStream('myBinaryFile');
writeStream.write(bufferFile);
writeStream.end();
```

## Usage in the Web
* upload somefile
```javascript
var r2x = new Raid2X();
r2x.readFile(file, function() {
  r2x.uploadAll(path, function(d) {
    console.log(d);
    if(d == 1) {
      console.log("upload complete");
    }
  });
});
```

* download somefile
```javascript
var r2x = new Raid2X(meta);
r2x.downloadAll(path, function(d) {
  console.log(d);
  if(d == 1) {
    // save to local
    r2x.save();
  }
});
```
