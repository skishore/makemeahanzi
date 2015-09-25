const fs = maybeRequire('fs');
const path = maybeRequire('path');

const CHARACTER_FIELDS = ['definition', 'kangxi_index', 'pinyin', 'strokes'];

this.cjklib = {
  getCharacterData(character) {
    const result = {};
    CHARACTER_FIELDS.map((field) => result[field] = cjklib[field][character]);
    return result;
  },
};

CHARACTER_FIELDS.map((field) => cjklib[field] = {});

// Input: String contents of a Unihan data file.
// Output: a list of rows, each of which is a list of String columns.
getUnihanRows = (data) => {
  const lines = data.split('\n');
  return lines.filter((line) => line.length > 0 && line[0] !== '#')
              .map((line) => line.split('\t'));
}

// Input: a String of the form 'U+<hex>' representing a Unicode codepoint.
// Output: the character at that codepoint
parseUnicodeStr = (str) => String.fromCodePoint(parseInt(str.substr(2), 16));

// Input: the path to a Unihan data file, starting from the public directory.
// Output: Promise that resolves to the String contents of that file.
readFile = (filename) => new Promise((resolve, reject) => {
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

// Output: Promise that fills result with a mapping character -> Pinyin.
fillDefinitions = (readings, result) => {
  return readings.then((rows) => {
    rows.filter((row) => row[1] === 'kDefinition')
        .map((row) => result[parseUnicodeStr(row[0])] = row[2]);
  });
}

// Output: Promise that fills result with a mapping character -> Kangxi radical-
// stroke count, which is a pair of integers [radical, extra_strokes].
fillKangxiIndex = (readings, result) => {
  return readings.then((rows) => {
    const getIndex = (adotb) => adotb.split('.').map((x) => parseInt(x, 10));
    rows.filter((row) => row[1] === 'kRSKangXi')
        .map((row) => result[parseUnicodeStr(row[0])] = getIndex(row[2]));
  });
}

// Output: Promise that fills result with a mapping character -> Pinyin.
fillPinyin = (readings, result) => {
  return readings.then((rows) => {
    rows.filter((row) => row[1] === 'kMandarin')
        .map((row) => result[parseUnicodeStr(row[0])] = row[2]);
  });
}

// Output: Promise that fills result with a mapping character -> stroke count.
fillStrokeCounts = (dictionary_like_data, result) => {
  return dictionary_like_data.then((rows) => {
    rows.filter((row) => row[1] === 'kTotalStrokes')
        .map((row) => result[parseUnicodeStr(row[0])] = parseInt(row[2], 10));
  });
}

Meteor.startup(() => {
  const dictionary_like_data =
      readFile('unihan/Unihan_DictionaryLikeData.txt').then(getUnihanRows);
  const radical_stroke_counts =
      readFile('unihan/Unihan_RadicalStrokeCounts.txt').then(getUnihanRows);
  const readings = readFile('unihan/Unihan_Readings.txt').then(getUnihanRows);
  Promise.all([
      fillDefinitions(readings, cjklib.definition),
      fillKangxiIndex(radical_stroke_counts, cjklib.kangxi_index),
      fillPinyin(readings, cjklib.pinyin),
      fillStrokeCounts(dictionary_like_data, cjklib.strokes),
  ]).catch(console.error.bind(console));
});
