// TODO(skishore): Do some kind of smoothing to avoid giving users hints based
// off of the straight segments where strokes intersects.
import {recognize} from '../lib/recognizer';
import {Timing} from '../model/timing';
import {findCorners} from './corners';
import {Shortstraw} from './external/shortstraw';
import {Handwriting} from './handwriting';
import {lookupItem} from './lookup';
import {Popup} from './meteoric/popup';

let element = null;
let handwriting = null;

const kMaxMistakes = 3;
const kMaxPenalties  = 4;

const helpers = new ReactiveDict();
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
    if (task.missing.length > 0) {
      return false;
    } else if (task.result === null) {
      return true;
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
  return true;
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
  clone.css({transform: 'translate(-100vw, -50%)'});
  clone.find('canvas')[0].getContext('2d').drawImage(
      element.find('canvas')[0], 0, 0);
  wrapper.children().slice(1).remove();
  wrapper.append(clone);
  scroller.velocity({left: '100%'}, 0).velocity({left: 0}, 300);
}

// Event handlers for touch interactions on the handwriting canvas.

const onClick = () => {
  if (maybeAdvance()) return;
  const task = item.tasks[item.index];
  task.penalties += kMaxPenalties;
  handwriting.flash(task.steps[task.missing[0]].stroke);
}

const onDouble = () => {
  if (maybeAdvance()) return;
  const task = item.tasks[item.index];
  handwriting.reveal(task.steps.map((x) => x.stroke));
  handwriting.highlight(task.steps[task.missing[0]].stroke);
}

const onRegrade = (result) => {
  const task = item.tasks[item.index];
  if (!task || task.missing.length > 0 || task.result !== null) return;
  task.result = result;
  handwriting.glow(task.result);
  handwriting._stage.update();
  helpers.set('grading', false);
  element.find('#grading').remove();
  maybeAdvance();
}

const onRendered = function() {
  const options = {onclick: onClick, ondouble: onDouble, onstroke: onStroke};
  element = $(this.firstNode).find('.flashcard');
  handwriting = new Handwriting(element, options);
}

const onRequestRegrade = (stroke) => {
  const task = item.tasks[item.index];
  if (!task || task.missing.length > 0 || task.result === null) return false;
  const n = stroke.length;
  if (stroke[0][1] - stroke[n - 1][1] <
      Math.abs(stroke[0][0] - stroke[n - 1][0])) {
    return false;
  }
  task.result = null;
  handwriting.glow(task.result);
  helpers.set('grading', true);
  return true;
}

const onStroke = (stroke) => {
  if (onRequestRegrade(stroke) || maybeAdvance()) return;
  const task = item.tasks[item.index];
  const result = match(task, (new Shortstraw).run(stroke), task.missing[0]);
  const index = result.index;

  // The user's input does not match any of the character's strokes.
  if (index < 0) {
    task.mistakes += 1;
    handwriting.fade();
    if (task.mistakes >= kMaxMistakes) {
      task.penalties += kMaxPenalties;
      handwriting.flash(task.steps[task.missing[0]].stroke);
    }
    return;
  }

  // The user's input matches a stroke that was already drawn.
  if (task.missing.indexOf(index) < 0) {
    task.penalties += 1;
    handwriting.undo();
    handwriting.flash(task.steps[index].stroke);
    return;
  }

  // The user's input matches one of the missing strokes.
  task.missing.splice(task.missing.indexOf(index), 1);
  const rotate = task.steps[index].median.length === 2;
  handwriting.emplace([task.steps[index].stroke, rotate,
                       result.source, result.target]);
  if (result.warning) {
    task.penalties += result.penalties;
    handwriting.warn(result.warning);
  }
  if (task.missing.length === 0) {
    task.result = getResult(task.penalties);
    handwriting.glow(task.result);
  } else if (task.missing[0] < index) {
    task.penalties += 2 * (index - task.missing[0]);
    handwriting.flash(task.steps[task.missing[0]].stroke);
  } else {
    task.mistakes = 0;
    handwriting.highlight(task.steps[task.missing[0]].stroke);
  }
}

// Event handlers for keeping the item, card, and tasks up-to-date.

const onErrorCard = (card) => {
  helpers.clear();
  helpers.set('deck', card.deck);
  helpers.set('error', card.data.error);
  helpers.set('options', card.data.options);
  updateItem(card, {characters: []});
}

const onItemData = (data, error) => {
  if (error) {
    console.error('Card data request error:', error);
    defer(Timing.shuffle);
    return;
  }
  const card = Timing.getNextCard();
  if (!card || data.word !== card.data.word) {
    console.log('Moved on from card:', card);
    return;
  }
  helpers.clear();
  helpers.set('deck', card.deck);
  helpers.set('definition', data.definition);
  helpers.set('pinyin', data.pinyin);
  updateItem(card, data);
}

const updateCard = () => {
  const card = Timing.getNextCard();
  if (!card) return;
  handwriting && handwriting.clear();
  if (card.deck === 'errors') {
    onErrorCard(card);
  } else {
    defer(() => lookupItem(card.data, onItemData));
  }
}

const updateItem = (card, data) => {
  item.card = card;
  item.index = 0;
  item.tasks = data.characters.map((row, i) => ({
    data: row,
    index: i,
    mistakes: 0,
    penalties: 0,
    result: null,
    missing: _.range(row.medians.length),
    steps: row.medians.map((median, i) => ({
      median: findCorners([median])[0],
      stroke: row.strokes[i],
    })),
  }));
}

// Meteor template bindings.

const maybeShowAnswerForTask = (task) => {
  task = item.tasks[task.index];
  if (task.missing.length === 0) {
    showAnswerForTask(task);
    return;
  }
  const buttons = [
    {label: 'Yes', callback: () => showAnswerForTask(task)},
    {label: 'No', class: 'bold', callback: Popup.hide},
  ];
  const text = 'Looking at the details page will count as getting this ' +
               'character wrong. Proceed?';
  Popup.show({title: 'Character Details', text: text, buttons: buttons});
}

const showAnswerForTask = (task, skip_confirmation) => {
  task = item.tasks[task.index];
  if (task.missing.length > 0) {
    task.penalties += kMaxPenalties;
  }
  const codepoint = task.data.character.codePointAt(0);
  Meteor.setTimeout(() => window.location.hash = codepoint);
  Popup.hide(50);
}

Template.answer_selection.events({
  'click .option': function() { maybeShowAnswerForTask(this); },
});

Template.answer_selection.helpers({
  obfuscate: (task) => task.missing.length > 0 ? '?' : task.data.character,
  tasks: () => item.tasks,
});

Template.grading.events({
  'click .icon': function(event) {
    onRegrade(parseInt($(event.currentTarget).data('result'), 10));
  },
});

Template.teach.events({
  'click .flashcard > .error > .option': function(event) {
    if (this.extra) {
      transition();
      Timing.addExtraCards(this.extra);
    } else if (this.link) {
      Router.go(this.link);
    } else {
      console.error('Unable to apply option:', this);
    }
  },
  'click a.control.right': () => {
    if (item.tasks.length === 1) {
      maybeShowAnswerForTask(item.tasks[0]);
    } else {
      Popup.show({title: 'Character Details', template: 'answer_selection'});
    }
  },
});

Template.teach.helpers({get: (key) => helpers.get(key)});

Template.teach.onRendered(onRendered);

Tracker.autorun(updateCard);
