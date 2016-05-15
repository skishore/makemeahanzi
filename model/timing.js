// Timing is a model class that maintains the user's state for their current
// Inkstone session and supports queries like:
//  - How many flash cards are left in this session?
//  - What is the next flash card?
import {Vocabulary} from './vocabulary';

const kEpochDuration = 5;
const kMaxAdds = 50;
const kMaxReviews = 100;

const autorun = (callback) =>
    Meteor.startup(() => Tracker.autorun(() =>
        Meteor.isClient && Ground.ready() && callback()));

const clamp = (x, min, max) => Math.max(Math.min(x, max), min);

const getTimestamp = () => Math.floor(new Date().getTime() / 1000);

// Timing state tier 1: a Ground collection storing a single record with raw
// counts for this session.

const mEpoch = new Ground.Collection('epoch', {connection: null});

let handle = null;

const updateEpoch = () => {
  // WARNING: Meteor.setTimeout in dispatch:kernel sometimes drops callbacks.
  const now = getTimestamp();
  const record = mEpoch.findOne() || {timestamp: -Infinity};
  const wait = record.timestamp + kEpochDuration - now;
  if (wait > 0) {
    clearInterval(handle);
    handle = setTimeout(updateEpoch, 1000 * wait);
  } else {
    mEpoch.upsert({}, {timestamp: now});
    mCounters.upsert({}, newCounters());
    clearInterval(handle);
    handle = setTimeout(updateEpoch, 1000 * kEpochDuration);
  }
}

autorun(() => Meteor.setTimeout(updateEpoch));

// Timing state tier 2: a Ground collection storing a single record that
// tracks counters for the user's current session.

const mCounters = new Ground.Collection('counters', {connection: null});

const remainder = new ReactiveVar();

const newCounters = () => ({adds: 0, reviews: 0});

autorun(() => {
  const epoch = mEpoch.findOne();
  const counters = mCounters.findOne();
  if (!epoch || !counters) return;
  const ts = epoch.timestamp;

  const adds = Vocabulary.getNewItems();
  const failures = Vocabulary.getFailuresInRange(ts, ts + kEpochDuration);
  const reviews = Vocabulary.getItemsDueBy(ts, ts);

  const num_adds = adds.count();
  const num_reviews = reviews.count();

  const adds_left = clamp(kMaxAdds - counters.adds, 0, num_adds);
  const reviews_left = clamp(kMaxReviews - counters.reviews, 0, num_reviews);

  remainder.set({
    adds: adds_left,
    failures: failures.count(),
    reviews: reviews_left,
  });
  console.log(remainder.get());
});
