// Written in 2015 by Shaunak Kishore (kshaunak@gmail.com).
//
// To the extent possible under law, the author(s) have dedicated all copyright
// and related and neighboring rights to this software to the public domain
// worldwide. This software is distributed without any warranty.
const lookupCharacter = (character, callback) => {
  if (!character) return;
  const part = Math.floor(character.charCodeAt(0) / 256);
  $.get(`characters/part-${part}.txt`, (response, code) => {
    const error = `Failed to look up ${character}: `;
    if (code !== 'success') callback(undefined, error + code);
    const data = JSON.parse(response);
    for (let row of data) {
      if (row.character === character) {
        return callback(row);
      }
    }
    callback(undefined, error + 'not found');
  });
}

export {lookupCharacter};
