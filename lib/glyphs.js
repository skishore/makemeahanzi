"use strict";

this.Glyphs = new Mongo.Collection('glyphs');

Glyphs.findGlyphsForRadical = function(radical) {
  if (radical) {
    return Glyphs.find({'index.radical': radical});
  }
  return Glyphs.find({'index.strokes': 0});
}

Glyphs.get_svg_path = function(glyph) {
  var terms = [];
  for (var i = 0; i < glyph.path.length; i++) {
    var segment = glyph.path[i];
    assert('LMQZ'.indexOf(segment.type) >= 0, segment.type);
    terms.push(segment.type);
    if (segment.x1 !== undefined) {
      terms.push(segment.x1);
      terms.push(segment.y1);
    }
    if (segment.x !== undefined) {
      terms.push(segment.x);
      terms.push(segment.y);
    }
  }
  return terms.join(' ');
}
