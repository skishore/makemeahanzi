function save_glyph(glyph) {
  check(glyph.name, String);
  var saved_glyph = _.extend({}, glyph);
  saved_glyph.derived = {
    errors: saved_glyph.render.log.filter(function(pair) {
      return pair[0] !== 'success';
    }),
    strokes: saved_glyph.render.strokes,
  };
  delete saved_glyph.render;
  Glyphs.upsert({name: glyph.name}, saved_glyph);
  return glyph;
}

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
  get_fraction_verified: function() {
    return Glyphs.find({'manual.verified': true}).count()/Glyphs.find().count();
  },
  save_glyph: save_glyph,
  save_glyphs: function(glyphs) {
    for (var i = 0; i < glyphs.length; i++) {
      save_glyph(glyphs[i]);
    }
  },
});

Meteor.startup(function() {
  Glyphs._ensureIndex({name: 1}, {unique: true});
  Glyphs._ensureIndex({'manual.verified': 1});
});
