// TODO(skishore): Do some kind of smoothing to avoid giving users hints based
// off of the straight segments where strokes intersects.
const character = new ReactiveVar();
const definition = new ReactiveVar();
const pinyin = new ReactiveVar();

let handwriting = null;

const kMaxMistakes = 3;
const kMaxPenalties  = 4;
const kNumCharacters = 300;

const item = {mistakes: 0, penalties: 0, steps: []};
const list = {characters: [], definitions: {}, offset: -1};

// A couple small utility functions for Euclidean geometry.

const findCorners = (median) => makemeahanzi.findCorners([median])[0];

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
  for (let i = 0; i < item.steps.length; i++) {
    const median = item.steps[i].median;
    const offset = i - expected;
    const result = makemeahanzi.recognize(stroke, median, offset);
    if (result.score > best_result.score) {
      best_result = result;
      best_result.index = i;
    }
  }
  return best_result;
}

const maybeAdvance = () => {
  const missing = _.range(item.steps.length)
                   .filter((i) => !item.steps[i].done);
  if (missing.length === 0) {
    handwriting.clear();
    advance();
    return true;
  }
  return false;
}

// Event handlers which will be bound to various Meteor-dispatched events.

const onClick = () => {
  if (maybeAdvance()) return;
  const missing = _.range(item.steps.length)
                   .filter((i) => !item.steps[i].done);
  item.penalties += kMaxPenalties;
  handwriting.flash(item.steps[missing[0]].stroke);
}

const onDouble = () => {
  if (maybeAdvance()) return;
  const missing = _.range(item.steps.length)
                   .filter((i) => !item.steps[i].done);
  handwriting.reveal(item.steps.map((x) => x.stroke));
  handwriting.highlight(item.steps[missing[0]].stroke);
}

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
  const options = {onclick: onClick, ondouble: onDouble, onstroke: onStroke};
  handwriting = new makemeahanzi.Handwriting(element, options);
}

const onStroke = (stroke) => {
  if (maybeAdvance()) return;
  const missing = _.range(item.steps.length)
                   .filter((i) => !item.steps[i].done);
  const shortstraw = new makemeahanzi.Shortstraw;
  const result = match(shortstraw.run(stroke), missing[0]);
  const index = result.index;

  // The user's input does not match any of the character's strokes.
  if (index < 0) {
    item.mistakes += 1;
    handwriting.fade();
    if (item.mistakes >= kMaxMistakes) {
      item.penalties += kMaxPenalties;
      handwriting.flash(item.steps[missing[0]].stroke);
    }
    return;
  }

  // The user's input matches a stroke that was already drawn.
  if (item.steps[index].done) {
    item.penalties += 1;
    handwriting.undo();
    handwriting.flash(item.steps[index].stroke);
    return;
  }

  // The user's input matches one of the remaining strokes.
  item.steps[index].done = true;
  const rotate = item.steps[index].median.length === 2;
  handwriting.emplace(item.steps[index].stroke, rotate,
                      result.source, result.target);
  if (missing.length === 1) {
    handwriting.glow(item.penalties < kMaxPenalties);
    handwriting.highlight();
  } else if (missing[0] < index) {
    item.penalties += 2 * (index - missing[0]);
    handwriting.flash(item.steps[missing[0]].stroke);
  } else {
    item.mistakes = 0;
    handwriting.highlight(item.steps[missing[1]].stroke);
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
      item.mistakes = 0;
      item.penalties = 0;
      item.steps = _.range(row.strokes.length).map((i) => ({
        done: false,
        median: findCorners(row.medians[i]),
        stroke: row.strokes[i],
      }));
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
