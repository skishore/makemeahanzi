// Written in 2015 by Shaunak Kishore (kshaunak@gmail.com).
//
// To the extent possible under law, the author(s) have dedicated all copyright
// and related and neighboring rights to this software to the public domain
// worldwide. This software is distributed without any warranty.
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

class Animation {
  constructor(options, strokes, medians) {
    this._delay = 1024*(options.delay || 0.5);
    this._speed = 1024*(options.speed || 0.05);
    this._completion = 0;
    this._strokes = strokes;
    this._lengths = medians.map((x) => getMedianLength(x) + width);
    this._paths = medians.map(getMedianPath);
  }
  step() {
    this._completion += this._speed;
    let completion = this._completion;
    let i = 0;
    const animations = [];
    for (i = 0; i < this._strokes.length; i++) {
      const partial = Math.max(this._lengths[i] - completion, 0);
      completion -= this._lengths[i] + this._delay;
      let cls = '';
      if (completion <= -this._delay) {
        cls = 'partial';
      } else if (completion <= 0) {
        cls = 'complete';
      }
      animations.push({
        class: cls,
        clip: `animation${i}`,
        stroke: this._strokes[i],
        median: this._paths[i],
        length: this._lengths[i],
        spacing: 2*this._lengths[i],
        advance: partial + width,
      });
      if (completion <= 0) {
        break;
      }
    }
    return {complete: i === this._strokes.length, animations: animations};
  }
}

export {Animation};
