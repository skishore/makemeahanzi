"use strict";

const kWidth = 128;

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


if (this.getAnimationData) throw new Error('Redefining getAnimationData.');

this.getAnimationData = (strokes, medians, options) => {
  const delay = 1024*(options.delay || 0.5);
  const speed = 1024*(options.speed || 0.05);

  const lengths = medians.map((x) => getMedianLength(x) + kWidth)
                         .map(Math.round);
  const paths = medians.map(getMedianPath);

  const animations = [];
  let total_duration = 0;
  for (let i = 0; i < strokes.length; i++) {
    const offset = lengths[i] + kWidth;
    const duration = offset / speed / 60;
    animations.push({
      class: 'incomplete',
      d: paths[i],
      delay: `${total_duration}s`,
      duration: `${duration}s`,
      index: i,
      keyframes: `keyframes${i}`,
      length: lengths[i],
      offset: offset,
      spacing: 2 * lengths[i],
      stroke: strokes[i],
    });
    total_duration += duration + delay / speed / 60;
  }

  return {
    animations: animations,
    strokes: strokes.map((d) => ({class: 'incomplete', d: d})),
  };
}
