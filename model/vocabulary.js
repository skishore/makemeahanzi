// Schema: vocabulary is a list of words that the user is studying, with info
// about how often they've seen that word, when they've seen it last, etc:
//  - word: string
//  - entries: array of (list, definition) pairs with an entry for each
//             active list that the word appears in
//  - last: Unix timestamp when the word was last seen
//  - next: Unix timestamp when the word is next due
//  - attempts: number of times the user has seen the word
//  - successes: number of times the user has gotten the word right
//
// The "correct" and "update" model methods take a "result" argument which
// can be anything in the set {0, 1, 2, 3}, with higher numbers indicating
// that the user made more errors.
import {getNextInterval} from './external/interval_quantifier';

const vocabulary = new Ground.Collection('vocabulary', {connection: null});

const kIntervalFactors = [3.5, 2.2, 1.2, 0.25];
const kMaxInterval = [3, 2.2, 1.2, 0.25];
const kMinInterval = [3.5, 2.2, 1.2, 0.25];

const getTimestamp = () => Math.floor(new Date().getTime() / 1000);

class Vocabulary {
  static add(word, entry) {
    const last = getTimestamp();
    const update = {
      $addToSet: {entries: entry},
      $setOnInsert: {word: word, attempts: 0, successes: 0},
    };
    vocabulary.upsert({word: word}, update);
  }
  static drop(list) {
    vocabulary.update({}, {$pull: {entries: {list: list}}}, {multi: true});
  }
  static getNextDue() {
  }
  static getNextNew() {
  }
  static update(vocab, result, correction) {
    const last = getTimestamp();
    const next = last + getNextInterval(vocab, result, last);
    const success = result < 3;
    const update = {
      $set: {last: last, next: next},
      $inc: {attempts: 1, successes: (success ? 1 : 0)},
    };
    attempts = vocab.attempts + (correction ? 1 : 0);
    vocabulary.update({word: vocab.word, attempts: attempts}, update);
  }
}

if (Meteor.isClient) {
  window.vocabulary = vocabulary;
  window.Vocabulary = Vocabulary;
}

export {Vocabulary};
