const items = new ReactiveVar([]);

const shortstraw = new makemeahanzi.Shortstraw;

const fixMedianCoordinates = (median) => median.map((x) => [x[0], 900 - x[1]]);

const scale = (median, k) => median.map((point) => point.map((x) => k * x));

const convertToSVGPath = (median) => {
  result = [];
  for (let i = 0; i < median.length; i++) {
    result.push(i === 0 ? 'M' : 'L');
    median[i].map((x) => result.push('' + Math.round(x)));
  }
  return result.join(' ');
}

const detectCorners = (median) => {
  const angle = (median, i, j, k) => {
    const d1 = [median[j][0] - median[i][0], median[j][1] - median[i][1]];
    const d2 = [median[k][0] - median[j][0], median[k][1] - median[j][1]];
    const a1 = Math.atan2(d1[1], d1[0]);
    const a2 = Math.atan2(d2[1], d2[0]);
    const a = Math.abs(a2 - a1);
    if (a < -Math.PI) return a + 2 * Math.PI;
    if (a >= Math.PI) return a - 2 * Math.PI;
    return a;
  }
  const recursion = (median, i, k) => {
    let best_angle = Math.PI / 2;
    let best_index = null;
    for (let j = i + 1; j < k; j++) {
      const a = Math.abs(angle(median, i, j, k));
      if (a > best_angle) {
        best_angle = a;
        best_index = j;
      }
    }
    if (best_index !== null) {
      return recursion(median, i, best_index).concat(
          recursion(median, best_index, k).slice(1));
    }
    return [i, k];
  }
  const refined = refine(median, 64);
  return recursion(refined, 0, refined.length - 1).map((i) => refined[i]);
}

const distance = (point1, point2) => {
  const diff = [point1[0] - point2[0], point1[1] - point2[1]];
  return Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1]);
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

const truncate = (median, cutoff) => {
  const n = 64;
  const length = pathLength(median);
  const index = Math.round(n * Math.min(cutoff / length, 0.25));
  return refined = refine(median, n).slice(index, n - index);
}

$.get('characters/part-92.txt', (response, code) => {
  if (code !== 'success') throw new Error(code);
  const data = JSON.parse(response);
  const result = [];
  for (let row of data) {
    const toCorner = (median) => ({
      class: median.length > 2 ? 'corner' : 'line',
      d: convertToSVGPath(median),
    });
    const medians = row.medians.map(fixMedianCoordinates)
                               .map((x) => truncate(x, 16))
                               .map((x) => scale(x, 1 / 1024));
    const corners = medians.map(shortstraw.run.bind(shortstraw))
                           .map((x) => scale(x, 1024))
                           .map(toCorner);
    const raw = medians.map((x) => scale(x, 1024))
                       .map((x) => ({class: 'raw', d: convertToSVGPath(x)}));
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
