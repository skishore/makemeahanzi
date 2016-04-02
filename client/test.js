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
  return {stroke: (median.length > 2 ? 'red' : 'black'), d: result.join(' ')};
}

$.get('characters/part-100.txt', (response, code) => {
  if (code !== 'success') throw new Error(code);
  const data = JSON.parse(response);
  const result = [];
  for (let row of data) {
    const medians = row.medians.map(fixMedianCoordinates)
                               .map((x) => scale(x, 1 / 1024))
                               .map(shortstraw.run.bind(shortstraw))
                               .map((x) => scale(x, 1024))
                               .map(toSVGPath);
    result.push({medians: medians, strokes: row.strokes});
  }
  items.set(result);
});

Template.test.helpers({
  items: () => items.get(),
});
