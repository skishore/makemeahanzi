// Adapted from Skritter HTML5's IntervalQuantifier class, without the
// class boilerplate dropped and the schema of the "item" changed to our
// "vocabulary" schema.
//
// Original copyright and license found in the LICENSE file in this directory.

const kOneDay = 24 * 60 * 60;
const kInitialIntervals = [28 * kOneDay, 7 * kOneDay, kOneDay, 600];
const kIntervalFactors = [3.5, 2.2, 0.9, 0.25];
const kRandomFactor = 0.15;

const getNextInterval = (vocab, result, last) => {
  if (!vocab.last) {
    return randomizeInterval(kInitialIntervals[result]);
  }
  const actual = last - vocab.last;
  const intended = vocab.next - vocab.last;
  const success = result < 3;
  let factor = kIntervalFactors[result];
  // Adjust the factor based on readiness.
  if (factor > 1) {
    factor = ((factor - 1) * actual / intended) + 1;
  }
  // Compute the number of successes and attempts with the new result.
  const attempts = vocab.attempts + 1;
  const successes = vocab.successes + (success ? 1 : 0);
  const correct = successes / attempts;
  // Accelerate new items that appear to be known.
  if (attempts < 5 && correct === 1) {
    factor *= 1.5;
  }
  // Decelerate hard items that are consistently marked wrong.
  if (attempts > 8 && correct < 0.5) {
    factor *= Math.pow(correct, 0.7);
  }
  // Multiply by the factor, randomize the interval, and apply bounds.
  const interval = randomizeInterval(factor * intended);
  const max = (success ? 365 : 7) * kOneDay;
  return Math.max(Math.min(interval, max), 600);
}

const randomizeInterval = (interval) => {
  return Math.floor((1 + kRandomFactor * (Math.random() - 0.5)) * interval);
}

export {getNextInterval};
