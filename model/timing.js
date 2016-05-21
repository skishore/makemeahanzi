// Timing is a model class that maintains the user's state for their current
// Inkstone session and supports queries like:
//  - How many flash cards are left in this session?
//  - What is the next flash card?
import {Vocabulary} from './vocabulary';

const kSessionDuration = 20 * 60 * 60;

const autorun = (callback) =>
    Meteor.startup(() => Tracker.autorun(() =>
        Meteor.isClient && Ground.ready() && callback()));

const clamp = (x, min, max) => Math.max(Math.min(x, max), min);

const getTimestamp = () => Math.floor(new Date().getTime() / 1000);

// Timing state tier 1: a Ground collection storing a single record with raw
// counts for usage in this session and a timestamp of when the session began.

const mCounts = new Ground.Collection('counts', {connection: null});

const newCounts = (ts) => ({adds: 0, failures: 0, reviews: 0, ts: ts});

let handle = null;

const updateTimestamp = () => {
  // WARNING: Meteor.setTimeout in dispatch:kernel sometimes drops callbacks.
  const now = getTimestamp();
  const counts = mCounts.findOne() || {ts: -Infinity};
  const wait = counts.ts + kSessionDuration - now;
  if (wait > 0) {
    clearInterval(handle);
    handle = setTimeout(updateTimestamp, 1000 * wait);
  } else {
    clearInterval(handle);
    handle = setTimeout(updateTimestamp, 1000 * kSessionDuration);
    mCounts.upsert({}, newCounts(now));
  }
}

autorun(() => Meteor.setTimeout(updateTimestamp));

// Timing state tier 2: reactive variables built on top of the session counts
// that track what the next card is and how many cards of different classes
// are left in this session.

const next_card = new ReactiveVar();
const remainder = new ReactiveVar();

const draw = (deck) => {
  let result = null;
  deck.forEach((card) => {
    if (!result || (card.next || 0) < result.next) {
      result = card;
    }
  });
  if (!result) throw new Error(`Drew from empty deck: ${deck}`);
  return result;
}

const mapDict = (dict, callback) => {
  const result = {};
  for (key in dict) {
    result[key] = callback(key, dict[key]);
  }
  return result;
}

autorun(() => {
  const counts = mCounts.findOne();
  if (!counts) return;
  const ts = counts.ts;

  const decks = {
    adds: Vocabulary.getNewItems(),
    failures: Vocabulary.getFailuresInRange(ts, ts + kSessionDuration),
    reviews: Vocabulary.getItemsDueBy(ts, ts),
  };
  // const maxes = mapDict(decks, (k, v) => Settings.get(`settings.max_${k}`);
  const maxes = {adds: 50, failures: Infinity, reviews: 100};
  const sizes = mapDict(decks, (k, v) => v.count());
  const left = mapDict(sizes, (k, v) => clamp(maxes[k] - counts[k], 0, v));

  let next = null;
  if (left.adds + left.reviews > 0) {
    const index = Math.random() * (left.adds + left.reviews);
    const deck = index < left.adds ? 'adds' : 'reviews';
    next = {card: draw(decks[deck]), deck: deck};
  } else if (left.failures > 0) {
    next = {card: draw(decks.failures), deck: 'failures'};
  } else {
    let error = "You're done for the day!";
    const extra = Vocabulary.getItemsDueBy(ts, Infinity);
    const count = extra.count();
    if (count > 0) {
      const bound = Math.min(count, Math.ceil(maxes.reviews / 2));
      error += ` Do you want to add ${bound} cards to today's deck?`;
    }
    next = {card: {error: error, type: 'error'}, deck: 'errors'};
  }

  next_card.set(next);
  remainder.set(left);
});
