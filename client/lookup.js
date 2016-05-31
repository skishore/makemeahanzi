import {ungzip} from './external/pako_inflate';
import {loadList} from './meteoric/lists';

const loadBinaryData = (url) => {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onload = (event) => {
      if (request.status != 200) throw request;
      resolve(new Uint8Array(request.response));
    }
    request.send(null);
  });
}

const loadCharacter = (character) => {
  const part = Math.floor(character.charCodeAt(0) / 256);
  return loadBinaryData(`characters/part-${part}.txt.gz.asset`)
                       .then((response) => {
    response = ungzip(response, {to: 'string'});
    const data = JSON.parse(response);
    for (let row of data) {
      if (row.character === character) {
        return row;
      }
    }
    throw new Error(`Character not found: ${character}`);
  });
}

const lookupItem = (item, callback) => {
  if (!item || !item.word || item.lists.length === 0) return;
  Promise.all([
    loadList(item.lists[0]),
    Promise.all(Array.from(item.word).map(loadCharacter)),
  ]).then((data) => {
    const entry = data[0].filter((x) => x.word === item.word);
    if (entry.length === 0) throw new Error(`Entry not found: ${item.word}`);
    entry[0].characters = data[1];
    callback(entry[0], undefined);
  }).catch((error) => callback(undefined, error));
}

export {lookupItem};
