const fs = require('fs');
const fn = require('./lib/stroke_caps/fixStrokes.js').fixStrokesWithDetails;

fs.readFileSync('graphics.txt', 'utf8').split('\n').forEach((line, i) => {
  if (!line) return;
  const data = JSON.parse(line);
  const corrected = fn(data.strokes);
  console.error(`Done ${i + 1} characters.`);
  if (!corrected.modified) return;
  console.log(JSON.stringify({
    character: data.character,
    strokes: corrected.strokes,
    medians: data.medians,
  }));
});
