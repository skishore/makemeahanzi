// Given an old-form glyph entry, returns the new glyph entry.
migrate_glyph = (glyph) => {
  const codepoint = parseInt(glyph.name.substr(3), 16);
  const character = String.fromCodePoint(codepoint);
  const data = cjklib.getCharacterData(character);
  assert(glyph.manual.verified !== undefined);
  const result = {
    character: character,
    codepoint: codepoint,
    metadata: {
      definition: undefined,
      kangxi_index: data.kangxi_index,
      pinyin: undefined,
      strokes: undefined,
    },
    stages: {
      path: Glyphs.get_svg_path(glyph),
      bridges: glyph.manual.bridges,
      strokes: glyph.derived.strokes,
      analysis: undefined,
      order: undefined,
      settled: undefined,
    },
  };
  assert(result.stages.path !== undefined);
  assert(result.stages.bridges !== undefined);
  assert(result.stages.strokes !== undefined);
  return result;
}

migrate_glyphs = () => {
  const names = Glyphs.find({}, {fields: {name: 1}, sort: {name: 1}}).fetch();
  names.reverse();
  for (name of names) {
    const glyph = Glyphs.findOne({name: name.name});
    const migrated_glyph = migrate_glyph(glyph);
    Glyphs.insert(migrated_glyph);
  }
  console.log('Migration complete.');
}

Meteor.startup(() => {
  //console.log('Running migration...');
  //cjklib.promise.then(Meteor.bindEnvironment(migrate_glyphs))
  //              .catch(console.error.bind(console));
  Glyphs._ensureIndex({character: 1}, {unique: true});
  Glyphs._ensureIndex({codepoint: 1}, {unique: true});
});
