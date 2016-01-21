#!/usr/local/bin/node
"use strict";

const fs = require('fs');
const readline = require('readline');

const matcher = require('./matcher');

const encodeMedian = (median, result) => {
  result.push(median.length);
  for (let pair of median) {
    result.push(Math.floor(pair[0]/4));
    result.push(Math.floor((900 - pair[1])/4));
  }
}

const encode = (row) => {
  const result = [];
  // TODO(skishore): Figure out how to properly decode UTF-8 or -16 in
  // Javascript and then use one of those encodings here instead of this hack.
  const codepoint = row.character.charCodeAt(0);
  result.push(codepoint & 0xff);
  result.push(codepoint >> 8);
  // Push the medians into the binary representation.
  result.push(row.medians.length);
  row.medians.map((median) => encodeMedian(median, result));
  result.map((x) => { if (!(0 <= x && x < 256)) throw x; });
  return new Buffer(result);
}

const main = () => {
  const input = fs.createReadStream('makemeahanzi.txt');
  const reader = readline.createInterface({input: input});
  const writer = fs.createWriteStream('medians.bin');
  reader.on('line', (line) => {
    const row = JSON.parse(line.trim());
    writer.write(encode(row));
  });
  reader.on('end', () => writer.end());
}

main();
