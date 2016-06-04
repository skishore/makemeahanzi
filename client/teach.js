// TODO(skishore): Do some kind of smoothing to avoid giving users hints based
// off of the straight segments where strokes intersects.
import {recognize} from '../lib/recognizer';
import {Timing} from '../model/timing';
import {findCorners} from './corners';
import {Shortstraw} from './external/shortstraw';
import {Handwriting} from './handwriting';
import {lookupItem} from './lookup';

const definition = new ReactiveVar();
const pinyin = new ReactiveVar();

let element = null;
let handwriting = null;

const kMaxMistakes = 3;
const kMaxPenalties  = 4;

const item = {card: null, index: 0, tasks: []};

// A couple small utility functions used by the logic below.

const defer = (callback) => Meteor.setTimeout(callback, 20);

const fixMedianCoordinates = (median) => median.map((x) => [x[0], 900 - x[1]]);

const getResult = (x) => Math.min(Math.floor(2 * x / kMaxPenalties) + 1, 3);

const match = (task, stroke, expected) => {
  let best_result = {index: -1, score: -Infinity};
  for (let i = 0; i < task.steps.length; i++) {
    const median = task.steps[i].median;
    const offset = i - expected;
    const result = recognize(stroke, median, offset);
    if (result.score > best_result.score) {
      best_result = result;
      best_result.index = i;
    }
  }
  return best_result;
}

const maybeAdvance = () => {
  const done = item.index === item.tasks.length;
  if (item.index < item.tasks.length) {
    const task = item.tasks[item.index];
    const missing = _.range(task.steps.length)
                     .filter((i) => !task.steps[i].done);
    if (missing.length > 0) {
      return task;
    }
    item.index += 1;
  }
  if (item.index < item.tasks.length) {
    handwriting.moveToCorner();
  } else if (!done) {
    transition();
    maybeRecordResult();
    handwriting.clear();
  }
  return null;
}

const maybeRecordResult = () => {
  if (!item.card) return;
  const result = _.reduce(item.tasks.map((x) => x.result),
                          (x, y) => Math.max(x, y), 0);
  defer(() => Timing.completeCard(item.card, result));
}

const transition = () => {
  const clone = element.clone();
  const wrapper = element.parent();
  const scroller = wrapper.parent();
  clone.css({transform: 'translate(-100vw, -150%)'});
  clone.find('canvas')[0].getContext('2d').drawImage(
      element.find('canvas')[0], 0, 0);
  wrapper.empty().append(element, clone);
  scroller.velocity({left: '100%'}, 0).velocity({left: 0}, 300);
}

// Event handlers which will be bound to various Meteor-dispatched events.

const onClick = () => {
  const task = maybeAdvance();
  if (!task) return;
  const missing = _.range(task.steps.length)
                   .filter((i) => !task.steps[i].done);
  task.penalties += kMaxPenalties;
  handwriting.flash(task.steps[missing[0]].stroke);
}

const onDouble = () => {
  const task = maybeAdvance();
  if (!task) return;
  const missing = _.range(task.steps.length)
                   .filter((i) => !task.steps[i].done);
  handwriting.reveal(task.steps.map((x) => x.stroke));
  handwriting.highlight(task.steps[missing[0]].stroke);
}

const onRendered = function() {
  const options = {onclick: onClick, ondouble: onDouble, onstroke: onStroke};
  element = $(this.firstNode).find('.handwriting');
  handwriting = new Handwriting(element, options);
}

const onStroke = (stroke) => {
  const task = maybeAdvance();
  if (!task) return;
  const missing = _.range(task.steps.length)
                   .filter((i) => !task.steps[i].done);
  const result = match(task, (new Shortstraw).run(stroke), missing[0]);
  const index = result.index;

  // The user's input does not match any of the character's strokes.
  if (index < 0) {
    task.mistakes += 1;
    handwriting.fade();
    if (task.mistakes >= kMaxMistakes) {
      task.penalties += kMaxPenalties;
      handwriting.flash(task.steps[missing[0]].stroke);
    }
    return;
  }

  // The user's input matches a stroke that was already drawn.
  if (task.steps[index].done) {
    task.penalties += 1;
    handwriting.undo();
    handwriting.flash(task.steps[index].stroke);
    return;
  }

  // The user's input matches one of the remaining strokes.
  task.steps[index].done = true;
  const rotate = task.steps[index].median.length === 2;
  handwriting.emplace([task.steps[index].stroke, rotate,
                       result.source, result.target]);
  if (result.warning) {
    task.penalties += result.penalties;
    handwriting.warn(result.warning);
  }
  if (missing.length === 1) {
    task.result = getResult(task.penalties);
    handwriting.glow(task.result);
  } else if (missing[0] < index) {
    task.penalties += 2 * (index - missing[0]);
    handwriting.flash(task.steps[missing[0]].stroke);
  } else {
    task.mistakes = 0;
    handwriting.highlight(task.steps[missing[1]].stroke);
  }
}

const updateCharacter = () => {
  // TODO(skishore): Handle other types of cards like error cards.
  // TODO(skishore): Allow the user to correct our grade for their response.
  const card = Timing.getNextCard();
  defer(() => lookupItem((card && card.data), (data, error) => {
    if (error) {
      console.error('Card data request error:', error);
      defer(Timing.shuffle);
      return;
    }
    const card = Timing.getNextCard();
    if (!card || data.word !== card.data.word) {
      console.error('Moved on from card:', card);
      return;
    }
    definition.set(data.definition);
    pinyin.set(data.pinyin);
    handwriting && handwriting.clear();
    updateItem(card, data);
  }));
}

const updateItem = (card, data) => {
  item.card = card;
  item.index = 0;
  item.tasks = data.characters.map((row) => ({
    mistakes: 0,
    penalties: 0,
    result: null,
    steps: row.medians.map((median, i) => ({
      done: false,
      median: findCorners([median])[0],
      stroke: row.strokes[i],
    })),
  }));
}

// Meteor template bindings.

Template.teach.helpers({
  definition: () => definition.get(),
  pinyin: () => pinyin.get(),
});

Template.teach.onRendered(onRendered);

Tracker.autorun(updateCharacter);
