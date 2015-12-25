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

const dumpGlyph = (stream) => (glyph) => {
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
  const result = {
    // Unicode character for this glyph. Required.
    character: glyph.character,
    // String definition targeted towards second-language learners. Optional.
    definition: glyph.metadata.definition || data.definition,
    // Comma-separated list of pronunciations of this character. May be empty.
    pinyin: pinyin,
    // Ideograph Description Sequence decomposition of the character. See:
    // https://en.wikipedia.org/wiki/Chinese_character_description_languages#Ideographic_Description_Sequences
    //
    // Optional. Invalid if it starts with a full-width question mark '？'.
    // Note that even if the first character is a proper IDS symbol, any
    // component within the decomposition may be a wide question mark as well.
    // For example, if we have a decomposition of a character into a top and
    // bottom component but can only recognize the top component, we might
    // have a decomposition like so: '⿱逢？'
    decomposition: analysis.decomposition,
    // An etymology for the character. This field may be null. If present,
    // it will always have a "type" field, which will be one of "ideographic",
    // "pictographic", or "pictophonetic".
    //
    // If the type is one of the first two options, then the etymology will
    // always include a string "hint" field explaining its formation.
    //
    // If the type is "pictophonetic", then the etymology will contain three
    // other fields: "hint", "phonetic", and "semantic", each of which is
    // a string and each of which may be null. The etymology should be read as:
    //   ${semantic} (${hint}) provides the meaning while ${phonetic}
    //   provides the pronunciation.
    // with allowances for possible null values.
    etymology: has_etymology ? analysis.etymology : undefined,
    // Unicode primary radical for this character. Required.
    radical: analysis.radical,
    // List of SVG path data for each stroke of this character, ordered by
    // proepr stroke order. Each stroke is laid out on a 1024x1024 size
    // coordinate system where:
    //   - The upper-left corner is at position (0, 900)
    //   - The lower-right corner is at position (1024, 900)
    // Note that the y-axes DECREASES as you move downwards, which is strage!
    // To display these paths properly, you should hide render them as follows:
    //   <svg viewBox="0 0 1024 1024">
    //     <g transform="scale(1, -1) translate(0, -900)">
    //       <path d="STROKE[0] DATA GOES HERE"></path>
    //       <path d="STROKE[1] DATA GOES HERE"></path>
    //       ...
    //     </g>
    //   </svg>
    strokes: strokes,
    // A list of stroke medians, in the same coordinate system as the SVG
    // paths above. These medians can be used to produce a rough stroke-order
    // animation, although it is a bit tricky.
    //
    // Each median is a list of pairs of integers.
    // This list will be as long as the strokes list.
    medians: medians,
    // A list of stroke medians, normalized to be in a sane coordinate system
    // so that they can be used for handwriting recognition:
    //   - The upper-left corner is at position (0, 0)
    //   - The lower-right corner is at position (1, 1)
    //
    // Each normalized median is a list of pairs of floating-point numbers.
    // This list will be as long as the strokes list.
    normalized_medians: medians.map(median_util.normalizeForMatch),
    // A list of mappings from strokes of this character to strokes of its
    // components, as indexed in its decomposition tree. Any given entry in
    // this list may be null. If an entry is not null, it will be a list of
    // indices corresponding to a path down the decomposition tree.
    //
    // This schema is a little tricky to explain without an example. Suppose
    // that the character '俢' has the decomposition: '⿰亻⿱夂彡'
    //
    // The third stroke in that character belongs to the radical '夂'.
    // Its match would be [1, 0]. That is, if you think of the decomposition as
    // a tree, it has '⿰' at its root with two children '亻' and '⿱', and
    // '⿱' further has two children '夂' and '彡'. The path down the tree
    // to '夂' is to take the second child of '⿰' and the first of '⿱',
    // hence, [1, 0].
    //
    // This field can be used to generate visualizations marking each component
    // within a given character, or potentially for more exotic purposes.
    matches: order.map((x) => x.match),
  }
  stream.write(JSON.stringify(result));
  stream.write('\n');
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
  const filepath = path.join(getPWD(), 'server', 'makemeahanzi.txt');
  const stream = fs.createWriteStream(filepath);
  runMigration(dumpGlyph(stream), (() => stream.end()));
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
