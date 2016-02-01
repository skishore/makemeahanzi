const delay = 0.2;
const width = 128;

const distance2 = (point1, point2) => {
  const diff = [point1[0] - point2[0], point1[1] - point2[1]];
  return diff[0]*diff[0] + diff[1]*diff[1];
}

const getMedianLength = (median) => {
  let result = 0;
  for (let i = 0; i < median.length - 1; i++) {
    result += Math.sqrt(distance2(median[i], median[i + 1]));
  }
  return result;
}

const getMedianPath = (median) => {
  const result = [];
  for (let point of median) {
    result.push(result.length === 0 ? 'M' : 'L');
    result.push('' + point[0]);
    result.push('' + point[1]);
  }
  return result.join(' ');
}

exports.Animation = class Animation {
  constructor(strokes, medians) {
    this._strokes = strokes;
    this._lengths = medians.map((x) => getMedianLength(x) + width);
    this._paths = medians.map(getMedianPath);
  }
  get(completion) {
    const index = Math.floor(completion);
    const max = Math.min(index, this._strokes.length - 1);
    const partial = Math.max((completion - index - delay)/(1 - delay), 0);
    const result = [];
    for (let i = 0; i <= max; i++) {
      const fraction = i < index ? 1 : partial;
      result.push({
        clip: `animation${i}`,
        stroke: this._strokes[i],
        median: this._paths[i],
        length: this._lengths[i],
        spacing: 2*this._lengths[i],
        advance: (1 - fraction)*this._lengths[i] + width,
      });
    }
    return result;
  }
}
