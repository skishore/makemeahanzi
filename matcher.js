"use strict";

const util = {
  distance2: (point1, point2) => util.norm2(util.subtract(point1, point2)),
  norm2: (point) => point[0]*point[0] + point[1]*point[1],
  round: (point) => point.map(Math.round),
  subtract: (point1, point2) => [point1[0] - point2[0], point1[1] - point2[1]],
};

const centerMedians = (medians) => {
  const sum = [0, 0];
  let count = 0;
  medians.map((median) => median.map((point) => {
    sum[0] += point[0];
    sum[1] += point[1];
    count += 1;
  }));
  const mean = util.round([sum[0]/count, sum[1]/count]);
  return medians.map((median) => median.map((point) => point.subtract(mean)));
}

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

const normalizeMedians = (medians) => {
  return centerMedians(medians.map((x) => filterMedian(x, 4)));
}

const match = (source, target) => {
  source = normalizeMedians(target);
  target = normalizeMedians(target);
}

window.matcher = {
  centerMedians: centerMedians,
  filterMedian: filterMedian,
  match: match,
};
