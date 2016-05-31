// Schema: vocabulary is a list of words that the user is studying, with info
// about how often they've seen that word, when they've seen it last, etc:
//  - word: string
//  - last: Unix timestamp when the word was last seen
//  - next: Unix timestamp when the word is next due
//  - lists: array of active lists that the word appears in
//  - attempts: number of times the user has seen the word
//  - successes: number of times the user has gotten the word right
//  - failed: true if this item should be shown again in the failures deck
//
// The "updateItem" model method takes a "result" argument which should be a
// value in the set {0, 1, 2, 3}, with higher numbers indicating that the
// user made more errors.
import {getNextInterval} from './external/interval_quantifier';
import {Model} from './model';

const kColumns = 'word last next lists attempts successes failed'.split(' ');
const kIndices = {};
kColumns.map((x, i) => kIndices[x] = i);

const entries = {active: [], all: []};
const index = {};
const sentinel = new ReactiveVar();

const dirty = () => sentinel.set(sentinel.get() + 1);

const materialize = (entry) => {
  const result = {};
  kColumns.map((x, i) => result[x] = entry[i]);
  return result;
}

class Cursor {
  constructor(filter) {
    sentinel.get();
    this._list = entries.active.filter(filter);
  }
  count() {
    return this._list.length;
  }
  fetch() {
    return this._list.map(materialize);
  }
  forEach(callback) {
    this.fetch().forEach(callback);
  }
}

class Vocabulary {
  static addItem(word, list) {
    if (!index[word]) {
      const entry = [word, null, null, [], 0, 0, false];
      if (entry.length !== kColumns.length) throw new Error(entry);
      index[word] = entry;
      entries.all.push(entry);
    }
    const entry = index[word];
    const lists = entry[kIndices.lists];
    if (lists.indexOf(list) < 0) {
      lists.push(list);
      if (lists.length === 1) entries.active.push(entry);
    }
    dirty();
  }
  static clearFailed(item) {
    const entry = index[item.word];
    if (entry) entry[kIndices.failed] = false;
    dirty();
  }
  static dropList(list) {
    const updated = {active: [], all: []};
    entries.all.forEach((entry) => {
      const lists = entry[kIndices.lists].filter((x) => x !== list);
      if (lists.length + entry[kIndices.attempts] > 0) {
        entry[kIndices.lists] = lists;
        updated.all.push(entry);
        if (lists.length > 0) updated.active.push(entry);
      } else {
        delete index[entry[kIndices.word]];
      }
    });
    entries.active = updated.active;
    entries.all = updated.all;
    dirty();
  }
  static getFailuresInRange(start, end) {
    return new Cursor((entry) => {
      if (!entry[kIndices.failed]) return false;
      const last = entry[kIndices.last];
      return start <= last && last < end;
    });
  }
  static getItemsDueBy(last, next) {
    return new Cursor((entry) => {
      if (entry[kIndices.attempts] === 0) return false;
      return entry[kIndices.last] < last && entry[kIndices.next] < next;
    });
  }
  static getNewItems() {
    return new Cursor((entry) => entry[kIndices.attempts] === 0);
  }
  static updateItem(item, result, correction) {
    const entry = index[item.word];
    const expected = item.attempts + (correction ? 1 : 0);
    if (!entry || entry[kIndices.attempts] !== expected) return;

    const last = Model.timestamp();
    entry[kIndices.last] = last;
    entry[kIndices.next] = last + getNextInterval(item, result, last);

    const success = result < 3;
    entry[kIndices.attempts] = item.attempts + 1;
    entry[kIndices.successes] = item.successes + (success ? 1 : 0);
    entry[kIndices.failed] = !success;
    dirty();
  }
}

if (Meteor.isClient) {
  window.entries = entries;
  window.index = index;
  window.sentinel = sentinel;
  window.Vocabulary = Vocabulary;
}

export {Vocabulary};
