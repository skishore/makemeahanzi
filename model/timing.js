// Timing is a model class that maintains the user's state for their current
// Inkstone session and supports queries like:
//  - How many flash cards are left in this session?
//  - What is the next flash card?
import {Model} from './model';
import {Settings} from './settings';
import {Vocabulary} from './vocabulary';

// Timing state tier 1: a Ground collection storing a single record with raw
// counts for usage in this session and a timestamp of when the session began.

const kSessionDuration = 12 * 60 * 60;

const mCounts = Model.collection('counts');

const newCounts = (ts) => ({
  adds: 0,
  failures: 0,
  reviews: 0,
  min_cards: 0,
  ts: ts,
});

const updateTimestamp = () => {
  const now = Model.timestamp();
  const counts = mCounts.findOne() || {ts: -Infinity};
  const wait = counts.ts + kSessionDuration - now;
  if (wait > 0) {
    time_left.set(wait);
  } else {
    mCounts.upsert({}, newCounts(now));
    time_left.set(kSessionDuration);
  }
  requestAnimationFrame(updateTimestamp);
}

Model.startup(updateTimestamp);

// Timing state tier 2: reactive variables built on top of the session counts
// that track what the next card is and how many cards of different classes
// are left in this session.

const maxes = new ReactiveVar();
const next_card = new ReactiveVar();
const remainder = new ReactiveVar();
const time_left = new ReactiveVar();

const buildErrorCard = (counts, extra) => {
  const error = "You're done for the day!";
  const options = [{
    link: 'settings',
    text: 'Change scheduling settings',
  }];
  if (extra > 0) {
    const total = counts.adds + counts.reviews;
    options.unshift({
      extra: {min_cards: extra + total, ts: counts.ts},
      text: `Add ${extra} cards to today's deck`,
    });
  } else {
    options.push({
      link: 'lists',
      text: 'Enable another word list',
    });
  }
  return {data: {error: error, options: options}, deck: 'errors'};
}

const draw = (deck, ts) => {
  let count = 0;
  let earliest = null;
  let result = null;
  getters[deck](ts).forEach((card) => {
    const next = card.next || Infinity;
    if (!result || next < earliest) {
      count = 1;
      earliest = next;
      result = card;
    } else if (next === earliest) {
      count += 1;
      if (count * Math.random() < 1) {
        result = card;
      }
    }
  });
  if (!result) {
    throw new Error(`Drew from empty deck: ${deck}`);
  }
  return {data: result, deck: deck};
}

const getters = {
  adds: (ts) => Vocabulary.getNewItems(),
  extras: (ts) => Vocabulary.getExtraItems(ts),
  failures: (ts) => Vocabulary.getFailuresInRange(ts, ts + kSessionDuration),
  reviews: (ts) => Vocabulary.getItemsDueBy(ts, ts),
};

const mapDecks = (callback) => {
  const result = {};
  for (deck in getters) {
    if (deck === 'extras') continue;
    result[deck] = callback(deck);
  }
  return result;
}

const shuffle = () => {
  const counts = mCounts.findOne();
  const left = remainder.get();
  if (!counts || !left) return;

  if (left.adds + left.reviews > 0) {
    const index = Math.random() * (left.adds + left.reviews);
    const deck = index < left.adds ? 'adds' : 'reviews';
    next_card.set(draw(deck, counts.ts));
  } else if (left.failures > 0) {
    next_card.set(draw('failures', counts.ts));
  } else if (left.extras > 0) {
    const card = draw('extras', counts.ts);
    card.deck = card.data.attempts === 0 ? 'adds' : 'reviews';
    next_card.set(card);
  } else {
    const max = maxes.get() ? maxes.get().adds : 0;
    const extra = Math.min(getters.extras(counts.ts).count(), max);
    next_card.set(buildErrorCard(counts, extra));
  }
}

Model.autorun(() => {
  const value = mapDecks((k) => Settings.get(`settings.max_${k}`));
  value.failures = Settings.get('settings.revisit_failures') ? Infinity : 0;
  maxes.set(value);
});

Model.autorun(() => {
  const counts = mCounts.findOne();
  if (!counts || !maxes.get()) return;
  const value = mapDecks((k) => {
    const limit = maxes.get()[k] - counts[k];
    if (limit <= 0) return 0;
    return Math.min(getters[k](counts.ts).count(), limit);
  });
  // Only count the number of available extra cards if they are needed.
  const planned = counts.adds + counts.reviews + value.adds + value.reviews;
  if (planned < counts.min_cards) {
    const needed = counts.min_cards - planned;
    value.extras = Math.min(getters.extras(counts.ts).count(), needed);
  } else {
    value.extras = 0;
  }
  remainder.set(value);
});

Model.autorun(shuffle);

// Timing state tier 3: code executed when a user completes a given flashcard.

const addExtraCards = (extra) => {
  mCounts.update({ts: extra.ts}, {$set: {min_cards: extra.min_cards}});
}

const build = (k, v) => { const x = {}; x[k] = v; return x; }

const completeCard = (card, result) => {
  const selector = build(card.deck, {$exists: true});
  const update = {$inc: build(card.deck, 1)};
  if (mCounts.update(selector, update)) {
    if (card.deck === 'failures') {
      Vocabulary.clearFailed(card.data);
    } else {
      Vocabulary.updateItem(card.data, result);
    }
  } else {
    console.error('Failed to update card:', card, 'with result:', result);
    shuffle();
  }
}

// Timing interface: reactive getters for next_card and remainder.

class Timing {
  static addExtraCards(extra) { addExtraCards(extra); }
  static completeCard(card, result) { completeCard(card, result); }
  static getNextCard() { return next_card.get(); }
  static getRemainder() { return remainder.get(); }
  static getTimeLeft() { return time_left.get(); }
  static shuffle() { shuffle(); }
}

export {Timing}
