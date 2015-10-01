"use strict";

const defaultGlyph = (character) => {
  if (!character) return;
  assert(character.length === 1);
  const data = cjklib.getCharacterData(character);
  return {
    character: character,
    codepoint: character.codePointAt(0),
    metadata: {kangxi_index: data.kangxi_index},
    stages: {},
  }
}

this.Glyphs = new Mongo.Collection('glyphs');

Glyphs.get = (query) => Glyphs.findOne(query) || defaultGlyph(query.character);

Glyphs.getNext = (glyph) => {
  const codepoint = glyph ? glyph.codepoint : undefined;
  const next = Glyphs.findOne(
      {codepoint: {$gt: codepoint}}, {sort: {codepoint: 1}});
  return next ? next : Glyphs.findOne({}, {sort: {codepoint: 1}});
}

Glyphs.getPrevious = (glyph) => {
  const codepoint = glyph ? glyph.codepoint : undefined;
  const previous = Glyphs.findOne(
      {codepoint: {$lt: codepoint}}, {sort: {codepoint: -1}});
  return previous ? previous : Glyphs.findOne({}, {sort: {codepoint: -1}});
}

Glyphs.save = (glyph) => {
  check(glyph.character, String);
  assert(glyph.character.length === 1);
  Glyphs.upsert({character: glyph.character}, glyph);
}

// Register the methods above on the server so they are available to the client.
if (Meteor.isServer) {
  const methods = {};
  const method_names = ['get', 'getNext', 'getPrevious', 'save'];
  method_names.map((name) => methods[`${name}Glyph`] = Glyphs[name]);
  methods.saveGlyphs = (glyphs) => glyphs.map(Glyphs.save);
  Meteor.methods(methods);
}
