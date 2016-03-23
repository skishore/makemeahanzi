// TODO(skishore): Animate strokes when the user gets them correct.
//
// TODO(skishore): Do some kind of smoothing to avoid giving users hints based
// off of the straight segments where strokes intersects.
const character = new ReactiveVar();
const complete = new ReactiveVar();
const label = new ReactiveVar();
const medians = new ReactiveVar();
const mistakes = new ReactiveVar();
const strokes = new ReactiveVar();
const zoom = new ReactiveVar(1);

let handwriting = null;

const kCanvasSize = 512;
const kFontSize = 1024;
const kMaxMistakes = 3;

let characters = [];
let definitions = {};
let offset = -1;

// A couple small utility functions for Euclidean geometry.

const fixMedianCoordinates = (median) => median.map((x) => [x[0], 900 - x[1]]);

const scale = (median, k) => median.map((point) => point.map((x) => k * x));

const advance = () => {
  offset = (offset + 1) % characters.length;
  if (offset === 0) {
    characters = _.shuffle(characters);
  }
  character.set(characters[offset]);
}

const match = (stroke) => {
  let best_index = -1;
  let best_score = -Infinity;
  for (let i = 0; i < medians.get().length; i++) {
    const score = makemeahanzi.recognize(stroke, medians.get()[i]);
    if (score > best_score) {
      best_index = i;
      best_score = score;
    }
  }
  return best_index;
}

// Event handlers which will be bound to various Meteor-dispatched events.

const onData = (data, code) => {
  if (code !== 'success') throw new Error(code);
  for (let line of data.split('\n')) {
    const terms = line.split('\t');
    if (terms.length < 4) continue;
    const character = terms[0][0];
    characters.push(character);
    definitions[character] = terms[3];
  }
  advance();
}

const onRendered = function() {
  zoom.set(this.getZoom());
  const element = $(this.firstNode).find('.handwriting');
  const options = {
    onclick: onStroke,
    onstroke: onStroke,
    zoom: zoom.get(),
  };
  handwriting = new makemeahanzi.Handwriting(element, options);
}

const onStroke = (stroke) => {
  const current = complete.get();
  const missing = _.range(current.length).filter((i) => !current[i]);
  if (missing.length === 0) {
    handwriting.clear();
    advance();
  }
  if (missing.length === 0 || !stroke) {
    return;
  }

  const scaled = scale(stroke, 1 / kCanvasSize);
  const index = match(scaled);
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
  handwriting.emplace(strokes.get()[index]);
  if (missing.length === 1) {
    handwriting.glow();
  } else if (missing[0] < index) {
    handwriting.flash(strokes.get()[missing[0]]);
  } else {
    mistakes.set(0);
  }
}

const updateCharacter = () => {
  makemeahanzi.lookupCharacter(character.get(), (row) => {
    if (row.character === character.get()) {
      const definition = definitions[row.character] || row.definition;
      complete.set(new Array(row.medians.length).fill(false));
      label.set(`${row.pinyin.join(', ')} - ${definition}`);
      medians.set(row.medians.map(fixMedianCoordinates)
                             .map((x) => scale(x, 1 / kFontSize)));
      mistakes.set(0);
      strokes.set(row.strokes);
    }
  });
}

// Meteor template bindings.

$.get('radicals.txt', onData);

Template.teach.helpers({
  label: () => label.get(),
  zoom: () => zoom.get(),
});

Template.teach.onRendered(onRendered);

Meteor.startup(() => Deps.autorun(updateCharacter));
