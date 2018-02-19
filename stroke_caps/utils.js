const svgPathUtils = require('point-at-length');

const dist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
const norm = (vect) => dist(vect, {x: 0, y: 0});
const subtract = (p1, p2) => ({x: p1.x - p2.x, y: p1.y - p2.y});
const ptEq = (p1, p2) => p1.x === p2.x && p1.y === p2.y;

const getOutlinePoints = (pathString, count = 1000) => {
  const path = svgPathUtils(pathString);
  const delta = path.length() / count;
  const outline = [];
  for (let i = 0; i < count; i += 1) {
    const svgPoint = path.at(i * delta);
    outline.push({x: svgPoint[0], y: svgPoint[1]});
  }
  return outline;
};

// get the intersection point of 2 lines defined by 2 points each
// from https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection
const getLinesIntersectPoint = (l1p1, l1p2, l2p1, l2p2) => {
  const x1 = l1p1.x;
  const x2 = l1p2.x;
  const x3 = l2p1.x;
  const x4 = l2p2.x;
  const y1 = l1p1.y;
  const y2 = l1p2.y;
  const y3 = l2p1.y;
  const y4 = l2p2.y;
  const xNumerator = (x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4);
  const yNumerator = (x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4);
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  return {x: xNumerator / denominator, y: yNumerator / denominator};
};

const getPointIndex = (point, pathOutline) => {
  const dists = pathOutline.map(outlinePoint => dist(point, outlinePoint));
  const min = Math.min(...dists);
  return dists.indexOf(min);
};

const getIndexAtDelta = (index, delta, pathOutline) => {
  return (pathOutline.length + index + delta) % pathOutline.length;
};

const getCosSimAroundPoint = (point, pathOutline) => {
  // if this is 1, the point is on a flat line.
  const pointIndex = getPointIndex(point, pathOutline);
  const preIndex = getIndexAtDelta(pointIndex, -3, pathOutline);
  const postIndex = getIndexAtDelta(pointIndex, 3, pathOutline);
  const vect1 = subtract(pathOutline[pointIndex], pathOutline[preIndex]);
  const vect2 = subtract(pathOutline[postIndex], pathOutline[pointIndex]);
  return (vect1.x * vect2.x + vect1.y * vect2.y) / (norm(vect1) * norm(vect2));
};

// return a new point, p3, which is on the same line as p1 and p2, but distance away
// from p2. p1, p2, p3 will always lie on the line in that order
const extendPointOnLine = (p1, p2, distance) => {
  const vect = subtract(p2, p1);
  const mag = distance / norm(vect);
  return {x: p2.x + mag * vect.x, y: p2.y + mag * vect.y};
};

const distToPath = (point, pathOutline) => {
  const dists = pathOutline.map(outlinePoint => dist(point, outlinePoint));
  return Math.min(...dists);
};

const roundPathPoints = (pathString) => {
  const floats = pathString.match(/\d+\.\d+/ig);
  if (!floats) return pathString;
  let fixedPathString = pathString;
  floats.forEach(float => {
    fixedPathString = fixedPathString.replace(float, Math.round(parseFloat(float)));
  });
  return fixedPathString;
};

const estimateTanPoints = (pathOutline, clipPoints) => {
  const cpIndex0 = getPointIndex(clipPoints[0], pathOutline);
  const cpIndex1 = getPointIndex(clipPoints[1], pathOutline);
  return [
    pathOutline[getIndexAtDelta(cpIndex0, -15, pathOutline)],
    pathOutline[getIndexAtDelta(cpIndex1, 15, pathOutline)],
  ];
};

module.exports = {
  distToPath,
  getCosSimAroundPoint,
  getOutlinePoints,
  getLinesIntersectPoint,
  extendPointOnLine,
  estimateTanPoints,
  dist,
  ptEq,
  roundPathPoints,
};
