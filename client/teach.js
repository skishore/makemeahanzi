// TODO(skishore): Do some kind of smoothing to avoid giving users hints based
// off of the straight segments where strokes intersects.
const character = new ReactiveVar();
const definition = new ReactiveVar();
const pinyin = new ReactiveVar();

let handwriting = null;

const kMaxMistakes = 3;
const kNumCharacters = 300;

const item = {done: [], mistakes: 0, medians: [], strokes: []};
const list = {characters: [], definitions: {}, offset: -1};

// A couple small utility functions for Euclidean geometry.

const fixMedianCoordinates = (median) => median.map((x) => [x[0], 900 - x[1]]);

const advance = () => {
  list.offset = (list.offset + 1) % list.characters.length;
  if (list.offset === 0) {
    list.characters = _.shuffle(list.characters);
  }
  character.set(list.characters[list.offset]);
}

const match = (stroke, expected) => {
  let best_result = {index: -1, score: -Infinity};
  for (let i = 0; i < item.medians.length; i++) {
    const offset = i - expected;
    const result = makemeahanzi.recognize(stroke, item.medians[i], offset);
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
    list.characters.push(terms[1]);
  }
}

const onLoadRadicals = (data, code) => {
  for (let line of data.split('\n')) {
    const terms = line.split('\t');
    if (terms.length < 4) continue;
    const character = terms[0][0];
    list.characters.push(character);
    list.definitions[character] = terms[3];
  }
}

const onRendered = function() {
  const element = $(this.firstNode).find('.handwriting');
  const options = {onclick: onStroke, onstroke: onStroke};
  handwriting = new makemeahanzi.Handwriting(element, options);
}

const onStroke = (stroke) => {
  const missing = _.range(item.done.length).filter((i) => !item.done[i]);
  if (missing.length === 0) {
    handwriting.clear();
    advance();
    return;
  } else if (!stroke) {
    handwriting.flash(item.strokes[missing[0]]);
    return;
  }

  const shortstraw = new makemeahanzi.Shortstraw;
  const result = match(shortstraw.run(stroke), missing[0]);
  const index = result.index;
  if (index < 0) {
    handwriting.fade();
    item.mistakes += 1;
    if (item.mistakes >= kMaxMistakes) {
      handwriting.flash(item.strokes[missing[0]]);
    }
    return;
  }
  if (item.done[index]) {
    handwriting.undo();
    handwriting.flash(item.strokes[index]);
    return;
  }

  item.done[index] = true;
  const rotate = item.medians[index].length === 2;
  handwriting.emplace(item.strokes[index], rotate,
                      result.source, result.target);
  if (missing.length === 1) {
    handwriting.glow();
  } else if (missing[0] < index) {
    handwriting.flash(item.strokes[missing[0]]);
  } else {
    item.mistakes = 0;
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
      definition.set(list.definitions[row.character] || row.definition);
      pinyin.set(row.pinyin.join(', '));
      item.done = new Array(row.medians.length).fill(false);
      item.medians = makemeahanzi.findCorners(row.medians);
      item.mistakes = 0;
      item.strokes = row.strokes;
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
