// Timing is a model class that maintains the user's state for their current
// Inkstone session and supports queries like:
//  - How many flash cards are left in this session?
//  - What is the next flash card?
import {Model} from './model';
import {Vocabulary} from './vocabulary';

// Timing state tier 1: a Ground collection storing a single record with raw
// counts for usage in this session and a timestamp of when the session began.

const kSessionDuration = 20 * 60 * 60;

const mCounts = Model.collection('counts');

const newCounts = (ts) => ({adds: 0, failures: 0, reviews: 0, ts: ts});

const queueNextUpdate = (() => {
  let handle = null;
  return (time) => {
    clearInterval(handle);
    handle = setTimeout(updateTimestamp, 1000 * time);
  };
})();

const updateTimestamp = () => {
  const now = Model.timestamp();
  const counts = mCounts.findOne() || {ts: -Infinity};
  const wait = counts.ts + kSessionDuration - now;
  if (wait > 0) {
    queueNextUpdate(wait);
  } else {
    mCounts.upsert({}, newCounts(now));
    queueNextUpdate(kSessionDuration);
  }
}

Model.startup(updateTimestamp);

// Timing state tier 2: reactive variables built on top of the session counts
// that track what the next card is and how many cards of different classes
// are left in this session.

const next_card = new ReactiveVar();
const remainder = new ReactiveVar();

const clamp = (x, min, max) => Math.max(Math.min(x, max), min);

const draw = (deck) => {
  let count = 0;
  let result = null;
  deck.forEach((card) => {
    if (!result || (card.next || 0) < result.next) {
      count = 1;
      result = card;
    } else if (card.next === result.next) {
      count += 1;
      if (count * Math.random() < 1) {
        result = card;
      }
    }
  });
  if (!result) {
    throw new Error(`Drew from empty deck: ${deck}`);
  }
  return result;
}

const mapDict = (dict, callback) => {
  const result = {};
  for (key in dict) {
    result[key] = callback(key, dict[key]);
  }
  return result;
}

const updateCounts = () => {
  const counts = mCounts.findOne();
  if (!counts) return;
  const ts = counts.ts;

  const decks = {
    adds: Vocabulary.getNewItems(),
    failures: Vocabulary.getFailuresInRange(ts, ts + kSessionDuration),
    reviews: Vocabulary.getItemsDueBy(ts, ts),
  };
  // TODO(skishore): Make the maxes configurable:
  //const maxes = mapDict(decks, (k, v) => Settings.get(`settings.max_${k}`);
  const maxes = {adds: 50, failures: Infinity, reviews: 100};
  const sizes = mapDict(decks, (k, v) => v.count());
  const left = mapDict(sizes, (k, v) => clamp(maxes[k] - counts[k], 0, v));

  let next = null;
  if (left.adds + left.reviews > 0) {
    const index = Math.random() * (left.adds + left.reviews);
    const deck = index < left.adds ? 'adds' : 'reviews';
    next = {data: draw(decks[deck]), deck: deck};
  } else if (left.failures > 0) {
    next = {data: draw(decks.failures), deck: 'failures'};
  } else {
    // TODO(skishore): Implement adding extra cards.
    let error = "You're done for the day!";
    const extra = Vocabulary.getItemsDueBy(ts, Infinity);
    const count = extra.count();
    if (count > 0) {
      const bound = Math.min(count, Math.ceil(maxes.reviews / 2));
      error += ` Do you want to add ${bound} cards to today's deck?`;
    }
    next = {data: {error: error, type: 'error'}, deck: 'errors'};
  }

  next_card.set(next);
  remainder.set(left);
}

Model.autorun(updateCounts);

// Timing interface: reactive getters for next_card and remainder.

const make = (k, v) => { const x = {}; x[k] = v; return x; }

class Timing {
  static completeCard(card, result) {
    const selector = make(card.deck, {$exists: true});
    const update = {$inc: make(card.deck, 1)};
    if (mCounts.update(selector, update)) {
      if (card.deck === 'failures') {
        Vocabulary.clearFailed(card.data);
      } else {
        Vocabulary.updateItem(card.data, result, false /* correction */);
      }
    } else {
      console.error('Failed to update card:', card, 'with result:', result);
      Timing.shuffle();
    }
  }
  static getNextCard() {
    return next_card.get();
  }
  static getRemainder() {
    return remainder.get();
  }
  static shuffle() {
    updateCounts();
  }
}

export {Timing}