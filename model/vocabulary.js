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
// The "correct" and "update" model methods take a "result" argument which
// can be anything in the set {0, 1, 2, 3}, with higher numbers indicating
// that the user made more errors.
import {getNextInterval} from './external/interval_quantifier';

const vocabulary = new Ground.Collection('vocabulary', {connection: null});

const getTimestamp = () => Math.floor(new Date().getTime() / 1000);

class Vocabulary {
  static addItem(word, list) {
    // TODO(skishore): This method runs in time O(n) because of the upsert.
    // Implement a batch addList method that does not suffer this penalty.
    const update = {
      $addToSet: {lists: list},
      $setOnInsert: {word: word, attempts: 0, successes: 0},
    };
    vocabulary.upsert({word: word}, update);
  }
  static dropList(list) {
    vocabulary.update({}, {$pull: {lists: list}}, {multi: true});
    vocabulary.remove({lists: [], last: {$exists: false}});
  }
  static getFailuresInRange(start, end) {
    return vocabulary.find({
      last: {$exists: true, $gte: start, $lt: end},
      lists: {$ne: []},
      failed: true,
    });
  }
  static getItemsDueBy(last, next) {
    return vocabulary.find({
      last: {$exists: true, $lt: last},
      next: {$exists: true, $lt: next},
      lists: {$ne: []},
    });
  }
  static getNewItems() {
    return vocabulary.find({lists: {$ne: []}, last: {$exists: false}});
  }
  static update(vocab, result, correction) {
    const last = getTimestamp();
    const next = last + getNextInterval(vocab, result, last);
    const success = result < 3;
    const update = {
      last: last,
      next: next,
      attempts: vocab.attempts + 1,
      successes: vocab.successes + (success ? 1 : 0),
      failed: !success,
    };
    attempts = vocab.attempts + (correction ? 1 : 0);
    vocabulary.update({word: vocab.word, attempts: attempts}, update);
  }
}

export {Vocabulary};
