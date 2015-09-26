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

this.cjklib_radicals = {
  primary_radical: {},
  index_to_radical_map: {},
  radical_to_index_map: {},
  radical_to_character_map: {},
};

CHARACTER_FIELDS.map((field) => cjklib[field] = {});

// Input: String contents of a cjklib data file.
// Output: a list of rows, each of which is a list of String columns.
getCJKLibRows = (data) => {
  const lines = data.split('\n');
  return lines.filter((line) => line.length > 0 && line[0] !== '#')
              .map((line) => line.split(',').map(
                  (entry) => entry.replace(/["']/g, '')));
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

// Promises that fill data from specific tables.

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

// Output: Promise that fills multiple dictionaries in the result:
//   - index_to_radical_map: Map from index -> list of radicals at that index
//   - radical_to_index_map: Map from radical -> index of that radical
//   - primary_radical: Map from index -> primary radical at that index
fillRadicalData = (locale, radicals, result) => {
  return radicals.then((rows) => {
    rows.filter((row) => row[3].indexOf(locale) >= 0).map((row) => {
      if (!result.index_to_radical_map.hasOwnProperty(row[0])) {
        result.index_to_radical_map[row[0]] = [];
      }
      result.index_to_radical_map[row[0]].push(row[1]);
      result.radical_to_index_map[row[1]] = row[0];
      if (row[2] === 'R') {
        result.primary_radical[row[0]] = row[1];
      }
    });
  });
}

// Output: Promise that fills result with a map from Unicode radical-codeblock
// character -> equivalent Unicode CJK-codeblock (hopefully, GB2312) character.
// There may be Unicode radical characters without a CJK equivalent.
fillRadicalToCharacterMap = (locale, radical_equivalent_characters, result) => {
  return radical_equivalent_characters.then((rows) => {
    rows.filter((row) => row[2].indexOf(locale) >= 0)
        .map((row) => result[row[0]] = row[1]);
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

// Methods used for final post-processing of the loaded datasets.

cleanupCJKLibData = () => {
  const characters = cjklib;
  const radicals = cjklib_radicals;
  const convert_astral_characters = (x) => x.length === 1 ? x : '？'
  const radical_to_character = (x) => radicals.radical_to_character_map[x] || x;
  Object.keys(characters.decomposition).map((character) => {
    // Convert any 'astral characters' - that is, characters outside the Basic
    // Multilingual Plane - to wide question marks and replace radicals with an
    // equivalent character with that character.
    const decomposition = characters.decomposition[character];
    characters.decomposition[character] =
        Array.from(decomposition).map(convert_astral_characters)
                                 .map(radical_to_character).join('');
  });
  for (let i = 1; i <= 214; i++) {
    // All primary radicals should have an equivalent character form.
    const primary = radicals.primary_radical[i];
    assert(radicals.radical_to_character_map.hasOwnProperty(primary));
    radicals.primary_radical[i] = radicals.radical_to_character_map[primary];
    radicals.index_to_radical_map[i] =
        radicals.index_to_radical_map[i].map(radical_to_character).unique();
  }
  Object.keys(radicals.radical_to_index_map).map((radical) => {
    const character = radical_to_character(radical);
    if (character !== radical) {
      radicals.radical_to_index_map[character] =
          radicals.radical_to_index_map[radical];
      delete radicals.radical_to_index_map[radical];
    }
  });
  delete radicals.radical_to_character_map;
}

Meteor.startup(() => {
  // cjklib database data.
  const locale = 'C';
  const decomposition =
      readFile('cjklib/characterdecomposition.csv').then(getCJKLibRows);
  const glyphs = readFile('cjklib/localecharacterglyph.csv')
                     .then(getCJKLibRows)
                     .then(parseLocaleGlyphMap.bind(null, locale));
  const radicals = readFile('cjklib/kangxiradical.csv').then(getCJKLibRows);
  const radical_equivalent_characters =
      readFile('cjklib/radicalequivalentcharacter.csv').then(getCJKLibRows);
  const radical_isolated_characters =
      readFile('cjklib/kangxiradicalisolatedcharacter.csv').then(getCJKLibRows);

  // Unihan database data.
  const dictionary_like_data =
      readFile('unihan/Unihan_DictionaryLikeData.txt').then(getUnihanRows);
  const radical_stroke_counts =
      readFile('unihan/Unihan_RadicalStrokeCounts.txt').then(getUnihanRows);
  const readings = readFile('unihan/Unihan_Readings.txt').then(getUnihanRows);

  Promise.all([
      // Per-character data.
      fillDecompositions(decomposition, glyphs, cjklib.decomposition),
      fillDefinitions(readings, cjklib.definition),
      fillKangxiIndex(radical_stroke_counts, cjklib.kangxi_index),
      fillPinyin(readings, cjklib.pinyin),
      fillStrokeCounts(dictionary_like_data, cjklib.strokes),
      // Per-radical data.
      fillRadicalData(locale, radicals, cjklib_radicals),
      fillRadicalData(locale, radical_isolated_characters, cjklib_radicals),
      fillRadicalToCharacterMap(locale, radical_equivalent_characters,
                                cjklib_radicals.radical_to_character_map),
  ]).then(cleanupCJKLibData).catch(console.error.bind(console));
});
