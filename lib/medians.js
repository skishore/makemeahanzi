// Written in 2015 by Shaunak Kishore (kshaunak@gmail.com).
//
// To the extent possible under law, the author(s) have dedicated all copyright
// and related and neighboring rights to this software to the public domain
// worldwide. This software is distributed without any warranty.
this.makemeahanzi = this.makemeahanzi || {};

// Helper methods used to decode data and build data structures follow.

// Given binary median data and an offset, returns a pair:
//   [character, medians]: the Matcher entry at that offset
//   index: the index starting the next entry.
const decodeMedian = (buffer, i) => {
  const character = String.fromCodePoint(buffer[i] + (buffer[i + 1] << 8));
  const medians = [];
  const num_medians = buffer[i + 2];
  i += 3;
  for (let j = 0; j < num_medians; j++) {
    const length = buffer[i];
    if (buffer.slice) {
      medians.push(buffer.slice(i + 1, i + length + 1));
    } else {
      const median = [];
      for (let k = 0; k < length; k++) {
        median.push(buffer[i + k + 1]);
      }
      medians.push(median);
    }
    i += length + 1;
  }
  return [[character, medians], i];
}

// Methods that return promises follow.

// Returns a Promise which resolves to an ArrayBuffer containing the data.
const loadBinaryData = (url) => {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onload = (event) => {
      if (request.status != 200) throw req;
      resolve(new Uint8Array(request.response));
    }
    request.send(null);
  });
}

// Returns a Promise that resolves to a list of (character, medians) pairs.
const decodeMedians = (buffer) => {
  var result = [];
  var decoded = null;
  for (var i = 0; i < buffer.length;) {
    var decoded = decodeMedian(buffer, i);
    result.push(decoded[0]);
    i = decoded[1];
  }
  return result;
}

// Returns a Promise that resolves to a list of [character, medians] pairs,
// where [medians] is a preprocessed Matcher entry for that character.
this.makemeahanzi.mediansPromise =
    loadBinaryData('medians.bin').then(decodeMedians).catch(console.err);
