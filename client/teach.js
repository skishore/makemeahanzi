// TODO(skishore): Do some kind of smoothing to avoid giving users hints based
// off of the straight segments where strokes intersects.
const character = new ReactiveVar();
const complete = new ReactiveVar();
const definition = new ReactiveVar();
const medians = new ReactiveVar();
const mistakes = new ReactiveVar();
const pinyin = new ReactiveVar();
const strokes = new ReactiveVar();

let handwriting = null;

const kMaxMistakes = 3;
const kNumCharacters = 300;

let characters = [];
let definitions = {};
let offset = -1;

// A couple small utility functions for Euclidean geometry.

const fixMedianCoordinates = (median) => median.map((x) => [x[0], 900 - x[1]]);

const advance = () => {
  offset = (offset + 1) % characters.length;
  if (offset === 0) {
    characters = _.shuffle(characters);
  }
  character.set(characters[offset]);
}

const match = (stroke, expected) => {
  let best_result = {index: -1, score: -Infinity};
  for (let i = 0; i < medians.get().length; i++) {
    const offset = i - expected;
    const result = makemeahanzi.recognize(stroke, medians.get()[i], offset);
    if (result.score > best_result.score) {
      best_result = result;
      best_result.index = i;
    }
  }
  return best_result;
}

// Event handlers which will be bound to various Meteor-dispatched events.

const onLoadFrequency = (data, code) => {
  for (let line of data.split('\n')) {
    if (line.length === 0 || line[0] === '#') continue;
    const terms = line.split('\t');
    if (terms.length < 2) continue;
    if (parseInt(terms[0], 10) > kNumCharacters) continue;
    characters.push(terms[1]);
  }
}

const onLoadRadicals = (data, code) => {
  for (let line of data.split('\n')) {
    const terms = line.split('\t');
    if (terms.length < 4) continue;
    const character = terms[0][0];
    characters.push(character);
    definitions[character] = terms[3];
  }
}

const onRendered = function() {
  const element = $(this.firstNode).find('.handwriting');
  const options = {onclick: onStroke, onstroke: onStroke};
  handwriting = new makemeahanzi.Handwriting(element, options);
}

const onStroke = (stroke) => {
  const current = complete.get();
  const missing = _.range(current.length).filter((i) => !current[i]);
  if (missing.length === 0) {
    handwriting.clear();
    advance();
    return;
  } else if (!stroke) {
    handwriting.flash(strokes.get()[missing[0]]);
    return;
  }

  const shortstraw = new makemeahanzi.Shortstraw;
  const result = match(shortstraw.run(stroke), missing[0]);
  const index = result.index;
  if (index < 0) {
    handwriting.fade();
    mistakes.set(mistakes.get() + 1);
    if (mistakes.get() >= kMaxMistakes) {
      handwriting.flash(strokes.get()[missing[0]]);
    }
    return;
  }
  if (current[index]) {
    handwriting.undo();
    handwriting.flash(strokes.get()[index]);
    return;
  }

  current[index] = true;
  complete.set(current);
  const rotate = medians.get()[index].length === 2;
  handwriting.emplace(strokes.get()[index], rotate,
                      result.source, result.target);
  if (missing.length === 1) {
    handwriting.glow();
  } else if (missing[0] < index) {
    handwriting.flash(strokes.get()[missing[0]]);
  } else {
    mistakes.set(0);
  }
}

const updateCharacter = () => {
  makemeahanzi.lookupCharacter(character.get(), (row, error) => {
    if (error) {
      console.error(error);
      Meteor.setTimeout(advance);
      return;
    }
    if (row.character === character.get()) {
      complete.set(new Array(row.medians.length).fill(false));
      definition.set(definitions[row.character] || row.definition);
      medians.set(makemeahanzi.findCorners(row.medians));
      mistakes.set(0);
      pinyin.set(row.pinyin.join(', '));
      strokes.set(row.strokes);
    }
  });
}

// Meteor template bindings.

$.get('frequency.tsv', (data, code) => {
  if (code !== 'success') throw new Error(code);
  onLoadFrequency(data);
  advance();
});

Template.teach.helpers({
  definition: () => definition.get(),
  pinyin: () => pinyin.get(),
  solution: () => solution.get(),
});

Template.teach.onRendered(onRendered);

Meteor.startup(() => Deps.autorun(updateCharacter));
