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
this.Progress = new Mongo.Collection('progress');

Glyphs.get = (character) =>
    Glyphs.findOne({character: character}) || defaultGlyph(character);

Glyphs.getAll = (characters) => Glyphs.find({character: {$in: characters}});

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
  Progress.refresh();
}

Progress.refresh = () => {
  const total = Glyphs.find().count();
  const complete = Glyphs.find({'stages.verified': {$ne: null}}).count();
  Progress.upsert({}, {total: total, complete: complete});
}

if (Meteor.isServer) {
  // Construct indices on the Glyphs table.
  Glyphs._ensureIndex({character: 1}, {unique: true});
  Glyphs._ensureIndex({codepoint: 1}, {unique: true});
  Glyphs._ensureIndex({'stages.verified': 1});

  // Refresh the Progress counter.
  Progress.refresh();

  // Register the methods above so they are available to the client.
  const methods = {};
  const method_names = ['get', 'getNext', 'getPrevious', 'save'];
  method_names.map((name) => methods[`${name}Glyph`] = Glyphs[name]);
  methods.saveGlyphs = (glyphs) => glyphs.map(Glyphs.save);
  Meteor.methods(methods);

  // Publish accessors that will get all glyphs in a list and get the progress.
  Meteor.publish('getAllGlyphs', Glyphs.getAll);
  Meteor.publish('getProgress', Progress.find.bind(Progress));
}
