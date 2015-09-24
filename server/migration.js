"use strict";

function get_final_bridges(glyph, original_bridges) {
  var set = {};
  var result = original_bridges.concat(glyph.manual.bridges_added);
  for (var i = 0; i < glyph.manual.bridges_removed.length; i++) {
    var remove = glyph.manual.bridges_removed[i];
    set[JSON.stringify(remove)] = true;
    set[JSON.stringify([remove[1], remove[0]])] = true;
  }
  return result.filter(function(x) { return !set[JSON.stringify(x)]; });
}

function migrate_manual_bridges(glyph) {
  var render = get_glyph_render_data(glyph, glyph.manual.bridges);
  glyph.manual.bridges = get_final_bridges(glyph, render.bridges);
  var simulation = get_glyph_render_data(glyph, glyph.manual.bridges);
  assert(_.isEqual(simulation.strokes, glyph.derived.strokes));
  delete glyph.manual.bridges_added;
  delete glyph.manual.bridges_removed;
  return glyph;
}

function run_manual_bridges_migration() {
  var glyphs = Glyphs.find({'manual.verified': true}).fetch();
  for (var i = 0; i < glyphs.length; i++) {
    if (i > 0 && i % 100 === 0) {
      console.log('Migrated ' + i + ' glyphs.');
    }
    assert(glyphs[i].manual.bridges_added !== undefined &&
           glyphs[i].manual.bridges_removed !== undefined);
    var glyph = migrate_manual_bridges(glyphs[i]);
    Glyphs.upsert({name: glyph.name}, glyph);
  }
}
