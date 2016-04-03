const items = new ReactiveVar([]);

const shortstraw = new makemeahanzi.Shortstraw;

const fixMedianCoordinates = (median) => median.map((x) => [x[0], 900 - x[1]]);

const scale = (median, k) => median.map((point) => point.map((x) => k * x));

const toSVGPath = (median) => {
  result = [];
  for (let i = 0; i < median.length; i++) {
    result.push(i === 0 ? 'M' : 'L');
    median[i].map((x) => result.push('' + Math.round(x)));
  }
  return result.join(' ');
}

const argmin = (list, method) => {
  let min_elt = null;
  let min_val = Infinity;
  list.map((x) => {
    const val = method(x);
    if (val < min_val) {
      min_elt = x;
      min_val = val;
    }
  });
  return min_elt;
}

const computeMedian = (d, median) => {
  const error = 64;
  const threshold = 64;
  const paths = svg.convertSVGPathToPaths(d);
  assert(paths.length === 1);
  const polygon = svg.getPolygonApproximation(paths[0], error);
  const last = median[median.length - 1];
  let start = argmin(polygon, (point) => Point.distance2(point, median[0]));
  const end = argmin(polygon, (point) => Point.distance2(point, last));
  if (Point.distance2(start, end) < threshold * threshold) {
    start = argmin(polygon, (point) => -Point.distance2(point, end));
  }

  const i = polygon.indexOf(start);
  const j = polygon.indexOf(end);
  assert(i !== j);
  let half1 = polygon.slice(Math.min(i, j), Math.max(i, j) + 1);
  let half2 = polygon.slice(Math.max(i, j))
                     .concat(polygon.slice(0, Math.min(i, j) + 1))
                     .reverse();
  if (i > j) {
    half1 = half1.reverse();
    half2 = half2.reverse();
  }
  const halves = [half1, half2].map((x) => refine(x, 64).slice(4, 60));
  return _.range(56).map((i) => Point.midpoint(halves[0][i], halves[1][i]));
}

const findCorners = (median) => {
  const first_pass = shortstraw.run(median);
  if (first_pass.length === 2) return first_pass;
  return first_pass;
  const source = getBounds([median]);
  const target = [[0, 0], [1, 1]];
  return shortstraw.run(median.map(getAffineTransform(source, target)))
                   .map(getAffineTransform(target, source));
}

const getAffineTransform = (source, target) => {
  const util = {subtract: (a, b) => [b[0] - a[0], b[1] - a[1]]};
  const sdiff = util.subtract(source[1], source[0]);
  const tdiff = util.subtract(target[1], target[0]);
  const ratio = [tdiff[0]/sdiff[0], tdiff[1]/sdiff[1]];
  return (point) => [
    ratio[0]*(point[0] - source[0][0]) + target[0][0],
    ratio[1]*(point[1] - source[0][1]) + target[0][1],
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

const pathLength = (median) => {
  let total = 0;
  const distances = _.range(median.length - 1).map(
      (i) => Math.sqrt(Point.distance2(median[i], median[i + 1])));
  distances.map((x) => total += x);
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
      const step = Math.sqrt(Point.distance2(position, median[index + 1]));
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
    result.push(Point.clone(position));
  }
  result.push(median[median.length - 1]);
  return result;
}

const truncate = (median, cutoff) => {
  const n = 64;
  const length = pathLength(median);
  const index = Math.round(n * Math.min(cutoff / length, 0.25));
  return refine(median, n).slice(index, n - index);
}

$.get('characters/part-130.txt', (response, code) => {
  if (code !== 'success') throw new Error(code);
  const data = JSON.parse(response);
  const result = [];
  for (let row of data) {
    const toCorner = (median) => ({
      class: median.length > 2 ? 'corner' : 'line',
      d: toSVGPath(median),
    });
    const medians = row.medians.map(fixMedianCoordinates)
                               .map((x) => truncate(x, 16))
                               .map((x) => scale(x, 1 / 1024));
    const corners = medians.map(findCorners)
                           .map((x) => scale(x, 1024))
                           .map(toCorner);
    const raw = medians.map((x) => scale(x, 1024))
                       .map((x) => ({class: 'raw', d: toSVGPath(x)}));
    const points = [];
    result.push({
      medians: corners.concat(raw),
      points: points,
      strokes: row.strokes,
    });
  }
  items.set(result);
});

Template.test.helpers({
  items: () => items.get(),
});
