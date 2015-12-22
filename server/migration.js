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

const migrateOldGlyphSchemaToNew = (glyph) => {
  const codepoint = parseInt(glyph.name.substr(3), 16);
  const character = String.fromCodePoint(codepoint);
  const data = cjklib.getCharacterData(character);
  assert(glyph.manual && glyph.manual.verified !== undefined,
         `Glyph ${character} was not verified.`);
  const result = {
    character: character,
    codepoint: codepoint,
    metadata: {
      definition: undefined,
      frequency: data.frequency,
      kangxi_index: data.kangxi_index,
      pinyin: undefined,
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

const setAnalysisStageToReady = (glyph) => {
  const data = cjklib.getCharacterData(glyph.character);
  if (data && data.strokes === glyph.stages.strokes.length) {
    glyph.stages.analysis = {sentinel: true};
  } else {
    console.log(`Different stroke count for ${glyph.character}. Expected: ` +
                `${data.strokes}, got: ${glyph.stages.strokes.length}.`);
  }
}

const completionCallback = undefined;

const perGlyphCallback = undefined;

const loadFromOldSchemaJSON = (filename) => {
  const fs = Npm.require('fs');
  const path = Npm.require('path');
  const filepath = path.join(getPWD(), 'public', filename);
  fs.readFile(filepath, 'utf8', Meteor.bindEnvironment((error, data) => {
    if (error) throw error;
    const lines = data.split('\n').filter((x) => x.length > 0);
    console.log(`Loaded ${lines.length} old-schema glyphs.`);
    let migrated = 0;
    for (var line of lines) {
      try {
        const old_glyph = JSON.parse(line);
        const new_glyph = migrateOldGlyphSchemaToNew(old_glyph);
        setAnalysisStageToReady(new_glyph);
        Glyphs.save(new_glyph);
        migrated += 1;
      } catch (error) {
        console.error(error);
      }
    }
    console.log(`Successfully migrated ${migrated} glyphs.`);
  }));
}

// Runs the given per-glyph callback for each glyph in the database.
// When all the glyphs are migrated, runs the completion callback.
const runMigration = () => {
  console.log('Running migration...');
  if (perGlyphCallback) {
    const codepoints =
        Glyphs.find({}, {fields: {codepoint: 1}, sort: {codepoint: 1}}).fetch();
    for (let i = 0; i < codepoints.length; i++) {
      const glyph = Glyphs.findOne({codepoint: codepoints[i].codepoint});
      assert(glyph, 'Glyphs changed during migration!');
      perGlyphCallback(glyph);
      if ((i + 1) % 1000 === 0) {
        console.log(`Migrated ${i + 1} glyphs.`);
      }
    }
  }
  if (completionCallback) {
    completionCallback();
  }
  console.log('Migration complete.');
}

const scanForPairs = () => {
  const glyphs = [];
  const glyph_set = {};
  Glyphs.find({}, {fields: {character: 1}, sort: {codepoint: 1}}).forEach(
      (x) => {glyphs.push(x.character); glyph_set[x.character] = 1});
  const getCharacterInfo = (x) => {
    const data = cjklib.getCharacterData(x);
    const metadata = Glyphs.get(x).metadata;
    return `${x} - ${metadata.pinyin || data.pinyin} - ` +
           `${metadata.definition || data.definition}`;
  }
  glyphs.map((x) => {
    const data = cjklib.getCharacterData(x);
    if (glyph_set[data.simplified]) {
      const value0 = getCharacterInfo(x);
      const value1 = getCharacterInfo(data.simplified);
      if (value0.substr(1) !== value1.substr(1)) {
        console.log('');
        console.log(`Got pair: ${x} -> ${data.simplified}`);
        console.log(getCharacterInfo(x));
        console.log(getCharacterInfo(data.simplified));
      }
    }
  });
  console.log(`Checked ${glyphs.length} glyphs.`);
}

Meteor.methods({
  'loadFromOldSchemaJSON': (filename) => {
    cjklib.promise.then(
        Meteor.bindEnvironment(() => loadFromOldSchemaJSON(filename)))
                  .catch(console.error.bind(console));
  },
});

Meteor.startup(() => {
  cjklib.promise.then(Meteor.bindEnvironment(scanForPairs))
                .catch(console.error.bind(console));
  if (!perGlyphCallback && !completionCallback) {
    return;
  }
  console.log('Preparing for migration...');
  cjklib.promise.then(Meteor.bindEnvironment(runMigration))
                .catch(console.error.bind(console));
});
