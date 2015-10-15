"use strict";

const unknown = '(unknown)';

const parseIntWithValidation = (text) => {
  const result = parseInt(text, 10);
  assert(!Number.isNaN(result));
  return result;
}

const validators = {
  pinyin: pinyin_util.numberedPinyinToTonePinyin,
  strokes: parseIntWithValidation,
};

// We avoid arrow functions in this map so that this is bound to the template.
Template.metadata.events({
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
    if (value !== glyph.metadata[this.field] &&
        (value || glyph.metadata[this.field])) {
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
      result[0].separator = '; ';
      result[0].extra = `Kangxi radical ${index}`;
      if (glyph.character !== primary) {
        result[0].separator += 'variant of ';
        result[0].extra = `<a class="link" href="#${primary}">` +
                          `${result[0].extra} ${primary}</a>`;
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
