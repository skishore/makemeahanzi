const character = new ReactiveVar('你');
const complete = new ReactiveVar();
const label = new ReactiveVar();
const medians = new ReactiveVar();
const strokes = new ReactiveVar();
const zoom = new ReactiveVar(1);

let handwriting = null;

const kCanvasSize = 512;
const kFontSize = 1024;
const kMatchThreshold = -200;

// A couple small utility functions for Euclidean geometry.

const fixMedianCoordinates = (median) => median.map((x) => [x[0], 900 - x[1]]);

const scale = (median, k) => median.map((point) => point.map((x) => k * x));

const match = (stroke) => {
  let best_index = -1;
  let best_score = kMatchThreshold;
  const matcher = new makemeahanzi.Matcher([], {bounds: [[0, 0], [1, 1]]});
  for (let i = 0; i < medians.get().length; i++) {
    const score = matcher.score(stroke, medians.get()[i]);
    if (score > best_score) {
      best_index = i;
      best_score = score;
    }
  }
  return best_index;
}

// Event handlers which will be bound to various Meteor-dispatched events.

const onRendered = function() {
  zoom.set(this.getZoom());
  const element = $(this.firstNode).find('.handwriting');
  handwriting = new makemeahanzi.Handwriting(element, onStroke, zoom.get());
}

const onStroke = (stroke) => {
  const index = match(scale(stroke, 1 / kCanvasSize));
  if (index < 0) {
    console.log('No match...');
    return;
  }
  const current = complete.get();
  if (current[index]) {
    console.log(`Re-matched stroke ${index}.`);
    return;
  }
  current[index] = true;
  complete.set(current);
  console.log(`Matched stroke ${index}.`);
  if (current.every((x) => x)) {
    console.log('Success!');
  }
}

const updateCharacter = () => {
  makemeahanzi.lookupCharacter(character.get(), (row) => {
    if (row.character === character.get()) {
      complete.set(new Array(row.medians.length).fill(false));
      label.set(`${row.pinyin.join(', ')} - ${row.definition}`);
      medians.set(row.medians.map(fixMedianCoordinates)
                             .map((x) => scale(x, 1 / kFontSize)));
      strokes.set(row.strokes);
    }
  });
}

// Meteor template bindings.

Template.teach.helpers({
  label: () => label.get(),
  zoom: () => zoom.get(),
});

Template.teach.onRendered(onRendered);

Meteor.startup(() => Deps.autorun(updateCharacter));
