const program = require('commander');
const fs = require('fs');
const fixStrokes = require('./fixStrokes');

program
  .option('-i --input <path>', 'path to graphics.txt. Defaults to ./graphics.txt')
  .option('-o --output <path>', 'path to write updated graphics.txt. Defaults to ./graphics-capped.txt', 'graphics-capped.txt')
  .option('-v --verbose', 'output debugging info while running')
  .parse(process.argv);

const inputFile = program.input || 'graphics.txt';
const outputFile = program.output || 'graphics-capped.txt';

const log = (msg, force = false) => program.verbose || force ? console.log(msg) : null;

log(`reading ${inputFile}`);
const input = fs.readFileSync(inputFile, 'utf8');
const inputLines = input.split('\n');
let outputJsonStrings = [];

let count = 0;
let modifiedChars = [];
let doubleClippedChars = [];
const total = inputLines.length;

inputLines.forEach(line => {
  if (!line) return;
  count += 1;
  const data = JSON.parse(line);
  log(`${count}/${total}:\t${data.character}`);
  const correction = fixStrokes(data.strokes);
  if (correction.modified) {
    log(`modified ${correction.modifiedStrokes.length} strokes`);
    modifiedChars.push(data.character);
    
    if (correction.hasDoubleClippedStroke) {
      doubleClippedChars.push(data.character);
    }
    
    data.strokes = correction.strokes;
  }
  outputJsonStrings.push(JSON.stringify(data));
});

log(`writing ${outputFile}`)
fs.writeFileSync(outputFile, outputJsonStrings.join('\n') + '\n');

log('Done!', true);
log(`Read ${count} chars`, true);
log(`Modified ${modifiedChars.length} chars`, true);
log(`Double-clipped stroke characters: ${doubleClippedChars.join(', ')}`);
