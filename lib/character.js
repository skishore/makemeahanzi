this.makemeahanzi.lookupCharacter = (character, callback) => {
  if (!character) return;
  const part = Math.floor(character.charCodeAt(0) / 256);
  $.get(`characters/part-${part}.txt`, (response, code) => {
    if (code !== 'success') throw new Error(code);
    const data = JSON.parse(response);
    for (let row of data) {
      if (row.character === character) {
        callback(row);
      }
    }
  });
}
