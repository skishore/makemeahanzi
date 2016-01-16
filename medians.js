"use strict";

// Helper methods used to decode data and build data structures follow.

// Given binary median data and an offset, returns a pair:
//   (character, medians): the entry at that offset
//   index: the index starting the next entry.
const decodeMedian = (buffer, i) => {
  const character = String.fromCodePoint(buffer[i] + (buffer[i + 1] << 8));
  const medians = [];
  const num_medians = buffer[i + 2];
  i += 3;
  for (let j = 0; j < num_medians; j++) {
    const median = [];
    const length = buffer[i];
    i += 1;
    for (let k = 0; k < length; k++) {
      median.push([buffer[i], buffer[i + 1]]);
      i += 2;
    }
    medians.push(median);
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
  const result = [];
  let decoded = null;
  for (let i = 0; i < buffer.length;) {
    const decoded = decodeMedian(buffer, i);
    result.push(decoded[0]);
    i = decoded[1];
  }
  return result;
}

// A global Promise that resolves to a list of (character, median) pairs.
this.mediansPromise =
    loadBinaryData('medians.bin').then(decodeMedians).catch(console.err);
