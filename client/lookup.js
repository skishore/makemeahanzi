// Written in 2015 by Shaunak Kishore (kshaunak@gmail.com).
//
// To the extent possible under law, the author(s) have dedicated all copyright
// and related and neighboring rights to this software to the public domain
// worldwide. This software is distributed without any warranty.
import {ungzip} from './external/pako_inflate';

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

const lookupCharacter = (character, callback) => {
  if (!character) return;
  const part = Math.floor(character.charCodeAt(0) / 256);
  loadBinaryData(`characters/part-${part}.txt.gz`).then((response) => {
    response = ungzip(response, {to: 'string'});
    const data = JSON.parse(response);
    for (let row of data) {
      if (row.character === character) {
        return callback(row);
      }
    }
    throw new Error(`Character not found: ${character}`);
  }).catch((error) => callback(undefined, error));
}

export {lookupCharacter};
