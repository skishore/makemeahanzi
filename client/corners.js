// This module defines one public method, findCorners, which takes a list of
// medians and returns a list of corners for each one.
import {match} from '../lib/recognizer';
import {Shortstraw} from './external/shortstraw';

const kMinFirstSegmentFraction = 0.1;
const kMinLastSegmentFraction = 0.05;
const kFontSize = 1024;
const kTruncation = 16;

const kShuWanGouShapes = [[[4, 0], [0, 4], [4, 0], [0, -1]],
                          [[0, 4], [4, 0], [0, -1]]];

const fixMedianCoordinates = (median) => median.map((x) => [x[0], 900 - x[1]]);

const scale = (median, k) => median.map((point) => point.map((x) => k * x));

const dropDanglingHooks = (median) => {
  const n = median.length;
  if (n < 3) return median;
  const total = pathLength(median);
  const indices_to_drop = {};
  if (distance(median[0], median[1]) < kMinFirstSegmentFraction) {
    indices_to_drop[1] = true;
  }
  if (distance(median[n - 2], median[n - 1]) < kMinLastSegmentFraction) {
    indices_to_drop[n - 2] = true;
  }
  return median.filter((value, i) => !indices_to_drop[i]);;
}

const fixShuWanGou = (median) => {
  if (median.length === 2) return median;
  const indices_to_drop = {};
  for (let shape of kShuWanGouShapes) {
    if (match(median, shape)) {
      indices_to_drop[shape.length - 2] = true;
    }
  }
  return median.filter((value, i) => !indices_to_drop[i]);;
}

const distance = (point1, point2) => {
  const diff = [point1[0] - point2[0], point1[1] - point2[1]];
  return Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1]);
}

const findCorners = (medians) => {
  const shortstraw = new Shortstraw;
  return medians.map(fixMedianCoordinates)
                .map((x) => truncate(x, kTruncation))
                .map((x) => scale(x, 1 / kFontSize))
                .map(shortstraw.run.bind(shortstraw))
                .map(dropDanglingHooks)
                .map(fixShuWanGou);
}

const pathLength = (median) => {
  let total = 0;
  _.range(median.length - 1).map(
      (i) => total += distance(median[i], median[i + 1]));
  return total;
}

const refine = (median, n) => {
  const total = pathLength(median);
  const result = [];
  let index = 0;
  let position = median[0];
  let total_so_far = 0;
  for (let i of _.range(n - 1)) {
    const target = i*total/(n - 1);
    while (total_so_far < target) {
      const step = distance(position, median[index + 1]);
      if (total_so_far + step < target) {
        index += 1;
        position = median[index];
        total_so_far += step;
      } else {
        const t = (target - total_so_far)/step;
        position = [(1 - t)*position[0] + t*median[index + 1][0],
                    (1 - t)*position[1] + t*median[index + 1][1]];
        total_so_far = target;
      }
    }
    result.push([position[0], position[1]]);
  }
  result.push(median[median.length - 1]);
  return result;
}

const truncate = (median, truncation) => {
  const n = 64;
  const length = pathLength(median);
  const index = Math.round(n * Math.min(truncation / length, 0.25));
  return refined = refine(median, n).slice(index, n - index);
}

export {findCorners};
