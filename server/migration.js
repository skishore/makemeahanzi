"use strict";

const completionCallback = undefined;

const perGlyphCallback = undefined; 

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

Meteor.startup(() => {
  if (!perGlyphCallback && !completionCallback) {
    return;
  }
  console.log('Preparing for migration...');
  cjklib.promise.then(Meteor.bindEnvironment(runMigration))
                .catch(console.error.bind(console));
});
