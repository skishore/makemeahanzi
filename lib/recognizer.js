// Written in 2015 by Shaunak Kishore (kshaunak@gmail.com).
//
// To the extent possible under law, the author(s) have dedicated all copyright
// and related and neighboring rights to this software to the public domain
// worldwide. This software is distributed without any warranty.
this.makemeahanzi = this.makemeahanzi || {};

const kAngleThreshold = Math.PI / 6;
const kDistanceThreshold = 0.2;

const util = {
  distance2: (point1, point2) => util.norm2(util.subtract(point1, point2)),
  norm2: (point) => point[0]*point[0] + point[1]*point[1],
  round: (point) => point.map(Math.round),
  subtract: (point1, point2) => [point1[0] - point2[0], point1[1] - point2[1]],
};

const angleDiff = (angle1, angle2) => {
  const diff = Math.abs(angle1 - angle2);
  return Math.min(diff, 2 * Math.PI - diff);
}

const getAngle = (median) => {
  const diff = util.subtract(median[median.length - 1], median[0]);
  return Math.atan2(diff[1], diff[0]);
}

const getBounds = (median) => {
  const min = [Infinity, Infinity];
  const max = [-Infinity, -Infinity];
  median.map((point) => {
    min[0] = Math.min(min[0], point[0]);
    min[1] = Math.min(min[1], point[1]);
    max[0] = Math.max(max[0], point[0]);
    max[1] = Math.max(max[1], point[1]);
  });
  return [min, max];
}

const getMidpoint = (median) => {
  const bounds = getBounds(median);
  return [(bounds[0][0] + bounds[1][0]) / 2,
          (bounds[0][1] + bounds[1][1]) / 2];
}

this.makemeahanzi.recognize = (source, target) => {
  const angle = angleDiff(getAngle(source), getAngle(target));
  const distance = Math.sqrt(util.distance2(
      getMidpoint(source), getMidpoint(target)));
  if (angle > kAngleThreshold || distance > kDistanceThreshold) {
    return -Infinity;
  }
  return -(angle + distance);
}
