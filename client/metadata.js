"use strict";

const vowel_to_tone =
    {0: "aeiouü", 1: "āēīōūǖ", 2: "áéíóúǘ", 3: "ǎěǐǒǔǚ", 4: "àèìòùǜ"};

const tokenSet = (tokens) => {
  const result = {};
  tokens.split(' ').map((x) => result[x] = true);
  return result;
}

const consonants = tokenSet('b p m f d t n l g k h j q x zh ch sh r z c s y w');
const vowels = tokenSet('a ai an ang ao e ei en eng er i ia ian iang iao ie ' +
                        'in ing io iong iu o ong ou u ua uai uan uang ue ui ' +
                        'un uo v van vn');
const two_syllables = tokenSet('iang iao ie io iong iu ua uai uan uang ue ui ' +
                               'uo van');
const unknown = '(unknown)';

const numberedPinyinToTonePinyin = (numbered) => {
  assert(numbered && numbered === numbered.toLowerCase());
  let tone = 0;
  if ('01234'.indexOf(numbered[numbered.length - 1]) >= 0) {
    tone = parseInt(numbered[numbered.length - 1], 10);
    numbered = numbered.substr(0, numbered.length - 1);
  }
  for (let i = 0; i < numbered.length; i++) {
    for (let option = 1; option <= 4; option++) {
      const index = vowel_to_tone[option].indexOf(numbered[i]);
      if (index >= 0) {
        tone = option;
        const toneless = 'aeiouv'[index];
        numbered = numbered.substr(0, i) + toneless + numbered.substr(i + 1);
      }
    }
  }
  let consonant = '';
  for (let i = 1; i < numbered.length; i++) {
    const candidate = numbered.substr(0, i);
    if (consonants[candidate]) {
      consonant = candidate;
    } else {
      break;
    }
  }
  let vowel = numbered.substr(consonant.length);
  assert((!consonant || consonants[consonant]) && vowels[vowel]);
  if (two_syllables[vowel]) {
    const index = 'aeiouv'.indexOf(vowel[1]);
    vowel = vowel[0] + vowel_to_tone[tone][index] + vowel.substr(2);
  } else {
    const index = 'aeiouv'.indexOf(vowel[0]);
    assert(index >= 0);
    vowel = vowel_to_tone[tone][index] + vowel.substr(1);
  }
  return consonant + vowel.replace('v', 'ü');
}

const parseIntWithValidation = (text) => {
  const result = parseInt(text, 10);
  assert(!Number.isNaN(result));
  return result;
}

const validators = {
  pinyin: numberedPinyinToTonePinyin,
  strokes: parseIntWithValidation,
};

window.validators = validators;

Template.metadata.events({
  'keypress .value': function(event) {
    if (event.which === 13 /* \n */) {
      $(event.target).trigger('blur');
      event.preventDefault();
    }
    event.stopPropagation();
  },
  'blur .value': function(event) {
    const text = $(event.target).text();
    let value = (text && text !== unknown ? text : null);
    if (value && validators.hasOwnProperty(this.field)) {
      try {
        value = validators[this.field](text);
      } catch (error) {
        console.log(error);
        value = null;
      }
    }
    const glyph = Session.get('editor.glyph');
    const defaults = cjklib.getCharacterData(glyph.character);
    if (value === defaults[this.field]) {
      value = null;
    }
    if (value !== glyph.metadata[this.field]) {
      $(event.target).text('');
      glyph.metadata[this.field] = value;
      Session.set('editor.glyph', glyph);
    } else {
      $(event.target).text(value || defaults[this.field] || unknown);
    }
  },
});

Template.metadata.helpers({
  character() {
    const glyph = Session.get('editor.glyph');
    if (!glyph) return;
    return glyph.character;
  },
  items() {
    const glyph = Session.get('editor.glyph');
    if (!glyph) return;
    const defaults = cjklib.getCharacterData(glyph.character);
    const fields = ['definition', 'pinyin', 'strokes']
    const result = fields.map((x) => ({
      field: x,
      label: `${x[0].toUpperCase()}${x.substr(1)}:`,
      value: glyph.metadata[x] || defaults[x] || unknown,
    }));
    if (cjklib.radicals.radical_to_index_map.hasOwnProperty(glyph.character)) {
      const index = cjklib.radicals.radical_to_index_map[glyph.character];
      const primary = cjklib.radicals.primary_radical[index];
      const variant = glyph.character !== primary;
      result[0].extra = `; ${variant ? 'variant of ' : ''}` +
                        `Kangxi radical ${index} ${variant ? primary : ''}`;
    }
    for (let entry of result) {
      const element = $(`.metadata .field [data-field="${entry.field}"]`);
      if (element.text() != entry.value) {
        element.text('');
      }
    }
    return result;
  },
  references() {
    const glyph = Session.get('editor.glyph');
    if (!glyph) return;
    const character = glyph.character;
    return [{
      href: 'http://www.archchinese.com/chinese_english_dictionary.html' +
            `?find=${character}`,
      label: 'Arch Chinese',
    }, {
      href: `https://en.wiktionary.org/wiki/${character}`,
      label: 'Wiktionary',
    }, {
      href: 'http://www.yellowbridge.com/chinese/character-etymology.php' +
            `?zi=${character}`,
      label: 'YellowBridge',
    }];
  },
});
