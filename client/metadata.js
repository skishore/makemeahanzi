"use strict";

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
    console.log(event, this, text);
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
    return fields.map((x) => ({
      field: x,
      label: `${x[0].toUpperCase()}${x.substr(1)}:`,
      value: glyph.metadata[x] || defaults[x] || '(unknown)',
    }));
  },
});
