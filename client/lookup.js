import {loadList} from '/client/templates/lists/code';

const lookupCharacter = (character) => {
  const part = Math.floor(character.charCodeAt(0) / 256);
  return new Promise((resolve, reject) => {
    $.get(`characters/part-${part}.txt`, (data, error) => {
      for (let row of JSON.parse(data)) {
        if (row.character === character) {
          resolve(row);
        }
      }
      reject(new Error(`Character not found: ${character}`));
    });
  });
}

const lookupItem = (item, callback) => {
  if (!item || !item.word || item.lists.length === 0) return;
  Promise.all([
    loadList(item.lists[0]),
    Promise.all(Array.from(item.word).map(lookupCharacter)),
  ]).then((data) => {
    const entry = data[0].filter((x) => x.word === item.word);
    if (entry.length === 0) throw new Error(`Entry not found: ${item.word}`);
    entry[0].characters = data[1];
    callback(entry[0], undefined);
  }).catch((error) => callback(undefined, error));
}

export {lookupCharacter, lookupItem};
