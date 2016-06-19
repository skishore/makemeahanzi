const kListColumns = ['word', '', '', 'pinyin', 'definition'];

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
  if (!item || !item.word || item.lists.length === 0) {
    return Promise.reject(new Error(item));
  }
  return Promise.all([
    lookupList(item.lists[0]),
    Promise.all(Array.from(item.word).map(lookupCharacter)),
  ]).then((data) => {
    const entries = data[0].filter((x) => x.word === item.word);
    if (entries.length === 0) throw new Error(`Entry not found: ${item.word}`);
    const entry = entries[0];
    entry.characters = data[1];
    return entry;
  });
}

const lookupList = (list) => {
  return new Promise((resolve, reject) => {
    $.get(`lists/${list}.list`, (data, code) => {
      if (code !== 'success') throw new Error(code);
      const result = [];
      data.split('\n').map((line) => {
        const values = line.split('\t');
        if (values.length != kListColumns.length) return;
        const row = {};
        kListColumns.map((column, i) => {
          if (column !== '') row[column] = values[i];
        });
        result.push(row);
      });
      resolve(result);
    });
  });
}

export {lookupCharacter, lookupItem, lookupList};
