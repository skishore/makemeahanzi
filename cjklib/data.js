const fs = maybeRequire('fs');
const path = maybeRequire('path');

const CHARACTER_FIELDS = ['character', 'decomposition', 'definition',
                          'kangxi_index', 'pinyin', 'strokes'];

this.cjklib = {
  getCharacterData(character) {
    const result = {};
    CHARACTER_FIELDS.map((field) => result[field] = cjklib[field][character]);
    result.character = character;
    return result;
  },
};

CHARACTER_FIELDS.map((field) => cjklib[field] = {});

// Input: String contents of a cjklib data file.
// Output: a list of rows, each of which is a list of String columns.
getCJKLibRows = (data) => {
  const lines = data.split('\n');
  return lines.filter((line) => line.length > 0 && line[0] !== '#')
              .map((line) => line.split(',').map((x) => x.replace(/"/g, '')));
}

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

// Output: Promise that fills result with a mapping character -> decomposition.
// The decompositions are formatted using Ideographic Description Sequence
// symbols - see the Unicode standard for more details.
fillDecompositions = (decompositions, glyphs, result) => {
  return Promise.all([decompositions, glyphs]).then(([rows, glyphs]) => {
    rows.filter((row) => parseInt(row[2], 10) === (glyphs[row[0]] || 0))
        .map((row) => result[row[0]] = row[1]);
  });
}

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

// Given the rows of the locale-character map from the cjklib data, returns a
// mapping from characters to the appropriate glyph in that locale.
parseLocaleGlyphMap = (locale, rows) => {
  const result = {};
  rows.filter((row) => row[2].indexOf(locale) >= 0)
      .map((row) => result[row[0]] = parseInt(row[1], 10));
  return result;
}

Meteor.startup(() => {
  // cjklib database data.
  const decomposition =
      readFile('cjklib/characterdecomposition.csv').then(getCJKLibRows);
  const glyphs = readFile('cjklib/localecharacterglyph.csv')
                     .then(getCJKLibRows)
                     .then(parseLocaleGlyphMap.bind(null, 'C'));

  // Unihan database data.
  const dictionary_like_data =
      readFile('unihan/Unihan_DictionaryLikeData.txt').then(getUnihanRows);
  const radical_stroke_counts =
      readFile('unihan/Unihan_RadicalStrokeCounts.txt').then(getUnihanRows);
  const readings = readFile('unihan/Unihan_Readings.txt').then(getUnihanRows);

  Promise.all([
      fillDecompositions(decomposition, glyphs, cjklib.decomposition),
      fillDefinitions(readings, cjklib.definition),
      fillKangxiIndex(radical_stroke_counts, cjklib.kangxi_index),
      fillPinyin(readings, cjklib.pinyin),
      fillStrokeCounts(dictionary_like_data, cjklib.strokes),
  ]).catch(console.error.bind(console));
});
