# Raid2X
A Software Raid Algorithm
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
```javascript
var Raid2X = require("raid2x");
var r2x = new Raid2X([options]);
```
* options - {Buffer|File path|Metadata}
### Metadata
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
