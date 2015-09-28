"use strict";

if (this.svg !== undefined) throw new Error('Redefining svg global!');
this.svg = {};

// A normal-form SVG path string is a data string with the following properties:
//   - Every command in the path is in ['L', 'M', 'Q', 'Z'].
//   - Adjacent tokens in the path are separated by exactly one space.
//   - There is exactly one 'Z', and it is the last command.
//
// A segment is a section of a path, represented as an object that has a start,
// an end, and possibly a control, all of which are valid Points (that is, pairs
// of Numbers).
//
// A path is a list of segments which is non-empty and closed - that is, the end
// of the last segment on the path is the start of the first.

// Returns twice the area contained in the path. The result is positive iff the
// path winds in the counter-clockwise direction.
//
// The approximation error is an upper-bound on the distance between consecutive
// points in the polygon approximation used to compute the area. The default
// error of 64 is chosen so that the sign will be correct with good likelihood.
const get2xArea = (path, approximation_error) => {
  const polygon_approximation = [path[0].start];
  approximation_error = approximation_error || 64;
  for (let x of path) {
    let num_points = 0;
    if (x.control !== undefined) {
      const distance = Math.sqrt(Point.distance2(x.start, x.end));
      num_points = Math.floor(distance/approximation_error);
    }
    for (let i = 0; i < num_points; i++) {
      const t = (i + 1)/(num_points + 1);
      const s = 1 - t;
      polygon_approximation.push(
          [s*s*x.start[0] + 2*s*t*x.control[0] + t*t*x.end[0],
           s*s*x.start[1] + 2*s*t*x.control[1] + t*t*x.end[1]]);
    }
    polygon_approximation.push(x.end);
  }
  let area = 0;
  for (var i = 0; i < polygon_approximation.length; i++) {
    const p1 = polygon_approximation[i];
    const p2 = polygon_approximation[(i + 1) % polygon_approximation.length];
    area += (p2[0] + p1[0])*(p2[1] - p1[1]);
  }
  return area;
}

// Takes a list of paths and orients them so that exterior contours are oriented
// counter-clockwise and interior contours clockwise.
const orientPaths = (paths, approximation_error) => {
  for (var i = 0; i < paths.length; i++) {
    const path = paths[i];
    let contains = 0;
    for (let j = 0; j < paths.length; j++) {
      if (j === i) {
        continue;
      } else if (pathContainsPoint(paths[j], path[0].start)) {
        contains += 1;
      }
    }
    const area = get2xArea(path);
    // The path is an external path iff it is contained in an even number of
    // other paths. It is counter-clockwise iff its area is positive. The path
    // should be reversed if (CCW && internal) || (CW && external).
    const should_reverse = (area > 0) !== (contains % 2 === 0);
    if (should_reverse) {
      for (let segment of path) {
        [segment.start, segment.end] = [segment.end, segment.start];
      }
      path.reverse();
    }
  }
  return paths;
}

// Returns true if the given point is contained inside the given path.
const pathContainsPoint = (path, point) => {
  const x = point[0];
  const y = point[1];
  let crossings = 0;
  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    if ((segment.start[0] < x && x < segment.end[0]) ||
        (segment.start[0] > x && x > segment.end[0])) {
      const t = (x - segment.end[0])/(segment.start[0] - segment.end[0]);
      const cy = t*segment.start[1] + (1 - t)*segment.end[1];
      if (y > cy) {
        crossings += 1;
      }
    } else if (segment.start[0] === x && segment.start[1] <= y) {
      if (segment.end[0] > x) {
        crossings += 1;
      }
      const last = path[(i + path.length - 1) % (path.length)];
      if (last.start[0] > x) {
        crossings += 1;
      }
    }
  }
  return crossings % 2 === 1;
}

// Takes a normal-form SVG path string and converts it to a list of paths.
const splitPath = (path) => {
  assert(path.length > 0);
  assert(path[0] === 'M', `Path did not start with M: ${path}`);
  assert(path[path.length - 1] === 'Z', `Path did not end with Z: ${path}`);
  const terms = path.split(' ');
  const result = [];
  let start = undefined;
  let current = undefined;
  for (let i = 0; i < terms.length; i++) {
    const command = terms[i];
    assert(command.length > 0, `Path includes empty command: ${path}`);
    assert('LMQZ'.indexOf(command) >= 0, command);
    if (command === 'M' || command === 'Z') {
      if (current !== undefined) {
        assert(Point.equal(current, start), `Path has open contour: ${path}`);
        assert(result[result.length - 1].length > 0,
               `Path has empty contour: ${path}`);
        if (command === 'Z') {
          assert(i === terms.length - 1, `Path ended early: ${path}`);
          return result;
        }
      }
      result.push([]);
      assert(i < terms.length - 2, `Missing point on path: ${path}`);
      start = [parseFloat(terms[i + 1], 10), parseFloat(terms[i + 2], 10)];
      assert(Point.valid(start));
      i += 2;
      current = Point.clone(start);
      continue;
    }
    let control = undefined;
    if (command === 'Q') {
      assert(i < terms.length - 2, `Missing point on path: ${path}`);
      control = [parseFloat(terms[i + 1], 10), parseFloat(terms[i + 2], 10)];
      assert(Point.valid(control));
      i += 2;
    }
    assert(i < terms.length - 2, `Missing point on path: ${path}`);
    const end = [parseFloat(terms[i + 1], 10), parseFloat(terms[i + 2], 10)];
    assert(Point.valid(end));
    i += 2;
    if (control !== undefined &&
        (Point.equal(control, current) || Point.equal(control, end))) {
      control = undefined;
    }
    result[result.length - 1].push({
      start: Point.clone(current),
      control: control,
      end: end,
    });
    current = Point.clone(end);
  }
}

// Takes a TrueType font command list (as provided by opentype.js) and returns
// a normal-form SVG path string as defined above.
svg.convertCommandsToPath = (commands) => {
  const terms = [];
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    assert('LMQZ'.indexOf(command.type) >= 0, command.type);
    if (command.type === 'Z') {
      assert(i === commands.length - 1);
      break;
    }
    terms.push(command.type);
    assert((command.x1 !== undefined) === (command.type === 'Q'));
    if (command.x1 !== undefined) {
      terms.push(command.x1);
      terms.push(command.y1);
    }
    assert(command.x !== undefined);
    terms.push(command.x);
    terms.push(command.y);
  }
  terms.push('Z');
  return terms.join(' ');
}

// Converts a normal-form SVG path string to a list of paths. The paths obey an
// orientation constraint: the external paths are oriented counter-clockwise,
// while the internal paths are oriented clockwise.
svg.convertSVGPathToPaths = (path) => {
  return orientPaths(splitPath(path));
}

// Takes the given list of paths and returns a normal-form SVG path string.
svg.convertPathsToSVGPath = (paths) => {
  const terms = [];
  for (let path of paths) {
    assert(path.length > 0);
    terms.push('M');
    terms.push(path[0].start[0]);
    terms.push(path[0].start[1]);
    for (let segment of path) {
      if (segment.control === undefined) {
        terms.push('L');
      } else {
        terms.push('Q');
        terms.push(segment.control[0]);
        terms.push(segment.control[1]);
      }
      terms.push(segment.end[0]);
      terms.push(segment.end[1]);
    }
  }
  terms.push('Z');
  return terms.join(' ');
}
