Meteor.methods({
  get_glyph: function(name) {
    return Glyphs.findOne({name: name});
  },
  get_next_glyph: function(glyph) {
    var name = glyph ? glyph.name : undefined;
    var next = Glyphs.findOne({name: {$gt: name}}, {sort: {name: 1}});
    return next ? next : Glyphs.findOne({}, {sort: {name: 1}});
  },
  get_next_glyph_skip_verified: function(glyph) {
    var name = glyph ? glyph.name : undefined;
    var next = Glyphs.findOne(
      {name: {$gt: name}, 'manual.verified': {$ne: true}}, {sort: {name: 1}});
    return next ? next : Glyphs.findOne(
      {'manual.verified': {$ne: true}}, {sort: {name: 1}});
  },
  get_previous_glyph: function(glyph) {
    var name = glyph ? glyph.name : undefined;
    var prev = Glyphs.findOne({name: {$lt: name}}, {sort: {name: -1}});
    return prev ? prev : Glyphs.findOne({}, {sort: {name: -1}});
  },
  get_previous_glyph_skip_verified: function(glyph) {
    var name = glyph ? glyph.name : undefined;
    var prev = Glyphs.findOne(
      {name: {$lt: name}, 'manual.verified': {$ne: true}}, {sort: {name: -1}});
    return prev ? prev : Glyphs.findOne(
      {'manual.verified': {$ne: true}}, {sort: {name: -1}});
  },
});

Meteor.startup(function() {
  Glyphs._ensureIndex({name: 1}, {unique: true});
});
