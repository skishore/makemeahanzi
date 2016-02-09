// Written in 2015 by Shaunak Kishore (kshaunak@gmail.com).
//
// To the extent possible under law, the author(s) have dedicated all copyright
// and related and neighboring rights to this software to the public domain
// worldwide. This software is distributed without any warranty.
this.makemeahanzi = this.makemeahanzi || {};

const util = {
  distance2: (point1, point2) => util.norm2(util.subtract(point1, point2)),
  norm2: (point) => point[0]*point[0] + point[1]*point[1],
  round: (point) => point.map(Math.round),
  subtract: (point1, point2) => [point1[0] - point2[0], point1[1] - point2[1]],
};

const coerce = (x, y) => x == null ? y : x;

const filterMedian = (median, n) => {
  const result = [];
  let total = 0;
  for (let i = 0; i < median.length - 1; i++) {
    total += Math.sqrt(util.distance2(median[i], median[i + 1]));
  }
  let index = 0;
  let position = median[0];
  let total_so_far = 0;
  for (let i = 0; i < n - 1; i++) {
    const target = i*total/(n - 1);
    while (total_so_far < target) {
      const step = Math.sqrt(util.distance2(position, median[index + 1]));
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
    result.push(util.round(position));
  }
  result.push(median[median.length - 1]);
  return result;
}

const getAffineTransform = (source, target) => {
  const sdiff = util.subtract(source[1], source[0]);
  const tdiff = util.subtract(target[1], target[0]);
  const ratio = [tdiff[0]/sdiff[0], tdiff[1]/sdiff[1]];
  return (point) => [
    Math.round(ratio[0]*(point[0] - source[0][0]) + target[0][0]),
    Math.round(ratio[1]*(point[1] - source[0][1]) + target[0][1]),
  ];
}

const getBounds = (medians) => {
  const min = [Infinity, Infinity];
  const max = [-Infinity, -Infinity];
  medians.map((median) => median.map((point) => {
    min[0] = Math.min(min[0], point[0]);
    min[1] = Math.min(min[1], point[1]);
    max[0] = Math.max(max[0], point[0]);
    max[1] = Math.max(max[1], point[1]);
  }));
  return [min, max];
}

const normalizeBounds = (bounds, max_ratio, min_width) => {
  bounds = bounds.map(util.round);
  let diff = util.subtract(bounds[1], bounds[0]);
  if (diff[0] < 0 || diff[1] < 0) throw diff;
  if (diff[0] < min_width) {
    const extra = Math.ceil((min_width - diff[0])/2);
    bounds[0][0] -= extra;
    bounds[1][0] += extra;
  }
  if (diff[1] < min_width) {
    const extra = Math.ceil((min_width - diff[1])/2);
    bounds[0][1] -= extra;
    bounds[1][1] += extra;
  }
  if (max_ratio > 0) {
    diff = util.subtract(bounds[1], bounds[0]);
    if (diff[0] < diff[1]/max_ratio) {
      const extra = Math.ceil((diff[1]/max_ratio - diff[0])/2);
      bounds[0][0] -= extra;
      bounds[1][0] += extra;
    } else if (diff[1] < diff[0]/max_ratio) {
      const extra = Math.ceil((diff[0]/max_ratio - diff[1])/2);
      bounds[0][1] -= extra;
      bounds[1][1] += extra;
    }
  }
  return bounds;
}

const preprocessMedians = (medians, params) => {
  if (medians.length === 0 || medians.some((median) => median.length === 0)) {
    throw new Error(`Invalid medians list: ${JSON.stringify(medians)}`);
  }

  const n = params.side_length;
  const source = normalizeBounds(
      getBounds(medians), params.max_ratio, params.min_width);
  const target = [[0, 0], [params.side_length - 1, params.side_length - 1]];
  const transform = getAffineTransform(source, target);

  return medians.map((median) => {
    const result = filterMedian(median.map(transform), params.points);
    const diff = util.subtract(result[result.length - 1], result[0]);
    const angle = Math.atan2(diff[1], diff[0]);
    const normalized = Math.round((angle + Math.PI) * n / (2 * Math.PI)) % n;
    const length = Math.round(Math.sqrt(util.norm2(diff) / 2));
    return [].concat.apply([], result).concat([normalized, length]);
  });
}

const scoreMatch = (source, target, params, verbose) => {
  let score = 0;
  const n = params.points;
  for (let i = 0; i < source.length; i++) {
    const median1 = source[i];
    const median2 = target[i];
    for (let j = 0; j < n; j++) {
      score -= Math.abs(median1[2*j] - median2[2*j]);
      score -= Math.abs(median1[2*j + 1] - median2[2*j + 1]);
    }
    const angle = Math.abs(median1[2*n] - median2[2*n]);
    const ratio = (median1[2*n + 1] + median2[2*n + 1]) / params.side_length;
    score -= 4 * n * ratio * Math.min(angle, params.side_length - angle);
  }
  return score;
}

// A class that can be instantiated with a list of (character, median) pairs
// and then used to return closest character given a list of input strokes.

this.makemeahanzi.Matcher = class Matcher {
  constructor(medians, params) {
    params = params || {};
    params.points = coerce(params.points, 4);
    params.max_ratio = coerce(params.max_ratio, 1);
    params.min_width = coerce(params.max_width, 8);
    params.side_length = coerce(params.side_length, 256);

    this._medians = medians;
    this._params = params;
  }
  match(medians, n) {
    n = n || 1;
    let candidates = [];
    let scores = [];
    medians = this.preprocess(medians);
    for (let entry of this._medians) {
      if (entry[1].length !== medians.length) {
        continue;
      }
      const score = scoreMatch(medians, entry[1], this._params);
      let i = scores.length;
      while (i > 0 && score > scores[i - 1]) {
        i -= 1;
      }
      if (i < n) {
        candidates.splice(i, 0, entry[0]);
        scores.splice(i, 0, score);
        if (candidates.length > n) {
          candidates.pop();
          scores.pop();
        }
      }
    }
    return candidates;
  }
  preprocess(medians) {
    return preprocessMedians(medians, this._params);
  }
}
