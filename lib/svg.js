"use strict";

if (this.svg !== undefined) throw new Error('Redefining svg global!');
this.svg = {};

// A normal-form SVG path is a path data string with the following properties:
//   - Every command in the path is in ['L', 'M', 'Q', 'Z'].
//   - Adjacent tokens in the path are separated by exactly one space.
//   - There is exactly one 'Z', and it is the last command.
//
// A segment is a section of a path, represented as an object that has a start,
// an end, and possibly a control, all of which are valid Points (that is, pairs
// of Numbers).

// Takes a normal-form SVG path and returns a list of lists of segments on it.
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
// a normal-form SVG path as defined above.
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

// Converts a normal-form SVG path to a list of list of segments. Each segment
// in the segment list has a start, an end, and possibly a control, all of which
// are valid Points (that is, pairs of numbers).
//
// The segment lists obey an orientation constraint: segments on external paths
// are oriented clockwise, while those on internal paths are oriented clockwise.
svg.convertPathToSegmentLists = (path) => {
  return splitPath(path);
}

// Takes the given segment lists and returns a normal-form SVG path that
// represents those segments.
svg.convertSegmentListsToPath = (paths) => {
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
