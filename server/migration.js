"use strict";

const addFrequencyField = (glyph) => {
  const data = cjklib.getCharacterData(glyph.character);
  glyph.metadata.frequency = data.frequency;
  Glyphs.save(glyph);
}

const addSimplifiedAndTraditionalFields = (glyph) => {
  const data = cjklib.getCharacterData(glyph.character);
  glyph.simplified = data.simplified;
  glyph.traditional = data.traditional;
  Glyphs.save(glyph);
}

const checkStrokeExtractorStability = (glyph) => {
  const strokes = stroke_extractor.getStrokes(
      glyph.stages.path, glyph.stages.bridges);
  if (!_.isEqual(strokes.strokes.sort(), glyph.stages.strokes.sort())) {
    console.log(`Different strokes for ${glyph.character}`);
  }
}

const convertOldPathSchemaToSVGPath = (path) => {
  const terms = [];
  for (let segment of path) {
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

const dumpGlyph = (dictionary, graphics) => (glyph) => {
  if (!glyph.stages.verified) {
    return;
  }
  const analysis = glyph.stages.analysis;
  const order = glyph.stages.order;
  const data = cjklib.getCharacterData(glyph.character);
  const pinyin = (glyph.metadata.pinyin || data.pinyin || '')
                     .split(',').map((x) => x.trim()).filter((x) => x);
  const strokes = order.map((x) => glyph.stages.strokes[x.stroke]);
  const medians = order.map((x) => x.median);
  strokes.map((x) => assert(x));
  medians.map((x) => assert(x));
  const has_etymology =
      analysis.etymology.hint || (analysis.etymology.type === 'pictophonetic');

  dictionary.write(JSON.stringify({
    character: glyph.character,
    definition: glyph.metadata.definition || data.definition,
    pinyin: pinyin,
    decomposition: analysis.decomposition || '？',
    etymology: has_etymology ? analysis.etymology : undefined,
    radical: analysis.radical,
    matches: order.map((x) => x.match),
  }) + '\n');
  graphics.write(JSON.stringify({
    character: glyph.character,
    strokes: strokes,
    medians: medians,
    normalized_medians: medians.map(median_util.normalizeForMatch),
  }) + '\n');
}

const migrateOldGlyphSchemaToNew = (glyph) => {
  const codepoint = parseInt(glyph.name.substr(3), 16);
  const character = String.fromCodePoint(codepoint);
  const data = cjklib.getCharacterData(character);
  assert(glyph.manual && glyph.manual.verified !== undefined,
         `Glyph ${character} was not verified.`);
  // Pull definition and pinyin from simplified character, if available.
  let definition = undefined;
  let pinyin = undefined;
  if (data.simplified) {
    const simplified = Glyphs.get(data.simplified);
    const metadata = (simplified || {metadata: {}}).metadata;
    const base = cjklib.getCharacterData(data.simplified);
    definition = metadata.definition || base.definition;
    pinyin = metadata.pinyin || base.pinyin;
  }
  const result = {
    character: character,
    codepoint: codepoint,
    metadata: {
      definition: definition,
      frequency: data.frequency,
      kangxi_index: data.kangxi_index,
      pinyin: pinyin,
      strokes: undefined,
    },
    stages: {
      path: convertOldPathSchemaToSVGPath(glyph.path),
      bridges: glyph.manual.bridges,
      strokes: glyph.derived.strokes,
      analysis: undefined,
      order: undefined,
      verified: undefined,
    },
    simplified: data.simplified,
    traditional: data.traditional,
  };
  assert(result.stages.path !== undefined);
  assert(result.stages.bridges !== undefined);
  assert(result.stages.strokes !== undefined);
  return result;
}

// Meteor methods that make use of the migration system follow.

const dumpToNewSchemaJSON = () => {
  const fs = Npm.require('fs');
  const path = Npm.require('path');
  const directory = path.join(getPWD(), 'server', 'release');
  const dictionary = fs.createWriteStream(
      path.join(directory, 'dictionary.txt'));
  const graphics = fs.createWriteStream(
      path.join(directory, 'graphics.txt'));
  runMigration(dumpGlyph(dictionary, graphics), (() => {
    dictionary.end();
    graphics.end();
  }));
}

const loadFromOldSchemaJSON = (filename) => {
  const fs = Npm.require('fs');
  const path = Npm.require('path');
  const filepath = path.join(getPWD(), 'public', filename);
  fs.readFile(filepath, 'utf8', Meteor.bindEnvironment((error, data) => {
    if (error) throw error;
    const lines = data.split('\n').filter((x) => x.length > 0);
    console.log(`Loaded ${lines.length} old-schema glyphs.`);
    let migrated = 0;
    let definition = 0;
    let pinyin = 0;
    for (var line of lines) {
      try {
        const old_glyph = JSON.parse(line);
        const new_glyph = migrateOldGlyphSchemaToNew(old_glyph);
        const glyph = Glyphs.get(new_glyph.character);
        if (glyph && glyph.stages.verified) {
          console.log(`Glyph already verified: ${glyph.character}`);
          continue;
        }
        Glyphs.save(new_glyph);
        migrated += 1;
        definition += new_glyph.metadata.definition ? 1 : 0;
        pinyin += new_glyph.metadata.pinyin ? 1 : 0;
      } catch (error) {
        console.error(error);
      }
    }
    console.log(`Successfully migrated ${migrated} glyphs.`);
    console.log(`Pulled definitions for ${definition} glyphs.`);
    console.log(`Pulled pinyin for ${pinyin} glyphs.`);
  }));
}

// Runs the given per-glyph callback for each glyph in the database.
// When all the glyphs are migrated, runs the completion callback.
const runMigration = (per_glyph_callback, completion_callback) => {
  console.log('Running migration...');
  if (per_glyph_callback) {
    const codepoints =
        Glyphs.find({}, {fields: {codepoint: 1}, sort: {codepoint: 1}}).fetch();
    for (let i = 0; i < codepoints.length; i++) {
      const glyph = Glyphs.findOne({codepoint: codepoints[i].codepoint});
      assert(glyph, 'Glyphs changed during migration!');
      per_glyph_callback(glyph);
      if ((i + 1) % 1000 === 0) {
        console.log(`Migrated ${i + 1} glyphs.`);
      }
    }
  }
  if (completion_callback) {
    completion_callback();
  }
  console.log('Migration complete.');
}

Meteor.methods({
  'export': () => {
    cjklib.promise.then(Meteor.bindEnvironment(dumpToNewSchemaJSON))
                  .catch(console.error.bind(console));
  },
  'loadFromOldSchemaJSON': (filename) => {
    cjklib.promise.then(
        Meteor.bindEnvironment(() => loadFromOldSchemaJSON(filename)))
                  .catch(console.error.bind(console));
  },
});

Meteor.startup(() => {
  const completion_callback = undefined;
  const per_glyph_callback = undefined;
  if (!per_glyph_callback && !completion_callback) {
    return;
  }
  console.log('Preparing for migration...');
  const migration = () => runMigration(per_glyph_callback, completion_callback);
  cjklib.promise.then(Meteor.bindEnvironment(migration))
                .catch(console.error.bind(console));
});
