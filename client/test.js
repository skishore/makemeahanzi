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
  const halves = [half1, half2].map((x) => refine(x, 64));
  return _.range(64).map((i) => Point.midpoint(halves[0][i], halves[1][i]));
}

const refine = (median, n) => {
  const distances = _.range(median.length - 1).map(
      (i) => Math.sqrt(Point.distance2(median[i], median[i + 1])));
  let total = 0;
  distances.map((x) => total += x);
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

$.get('characters/part-100.txt', (response, code) => {
  if (code !== 'success') throw new Error(code);
  const data = JSON.parse(response);
  const result = [];
  for (let row of data) {
    const toCorner = (median) => ({
      class: median.length > 2 ? 'corner' : 'line',
      d: toSVGPath(median),
    });
    const medians = row.strokes.map((d, i) => computeMedian(d, row.medians[i]))
                               .map(fixMedianCoordinates)
                               .map((x) => scale(x, 1 / 1024));
    const corners = medians.map(shortstraw.run.bind(shortstraw))
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
