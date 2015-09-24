const fs = maybeRequire('fs');
const path = maybeRequire('path');

this.cjklib = {};

// Input: a String of the form 'U+<hex>' representing a Unicode codepoint.
// Output: the character at that codepoint
parseUnicodeStr = (str) => String.fromCodePoint(parseInt(str.substr(2), 16));

// Input: String contents of a Unihan data file.
// Output: a list of rows, each of which is a list of String columns.
parseUnihanDataFile = (data) => {
  const lines = data.split('\n');
  return lines.filter((line) => line.length > 0 && line[0] !== '#')
              .map((line) => line.split('\t'));
}

// Input: the path to a Unihan data file, starting from the public directory.
// Output: Promise -> String contents of that file.
readFilePromise = (filename) => new Promise((resolve, reject) => {
  if (Meteor.isServer) {
    const filepath = path.join(process.env.PWD, 'public', filename);
    fs.readFile(filepath, 'utf8', (error, data) => {
      if (error) throw error;
      resolve(data);
    });
  } else {
    $.get(filename, (data, code) => {
      if (code !== 'success') throw new Error(code);
      resolve(data);
    });
  }
});

// Promises that return specific data tables.

// Output: Promise -> dict mapping CJK character -> total strokes.
strokeCountsPromise = () => {
  return readFilePromise('unihan/Unihan_DictionaryLikeData.txt')
      .then(parseUnihanDataFile)
      .then((rows) => {
    const result = {};
    rows.filter((row) => row[1] === 'kTotalStrokes')
        .map((row) => result[parseUnicodeStr(row[0])] = parseInt(row[2], 10));
    return result;
  });
}

Meteor.startup(() => {
  strokeCountsPromise()
      .then((stroke_counts) => { cjklib.stroke_counts = stroke_counts; })
      .catch(console.error.bind(console));
});
