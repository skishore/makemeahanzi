import {assert, Angle, Point} from '/lib/base';
import {Hungarian} from '/lib/hungarian';
import {svg} from '/lib/svg';

const MAX_BRIDGE_DISTANCE = 64;
const MIN_CORNER_ANGLE = 0.1*Math.PI;
const MIN_CORNER_TANGENT_DISTANCE = 4;
const REVERSAL_PENALTY = 0.5;

// Errors out if the bridges are invalid in some gross way.
const checkBridge = (bridge) => {
  assert(Point.valid(bridge[0]) && Point.valid(bridge[1]));
  assert(!Point.equal(bridge[0], bridge[1]));
}

// Returns the list of bridges on the path with the given endpoints. We strip
// nearly all of the metadata out of this list to make it easy to hand-correct.
// The list that we return is simply a list of pairs of points.
const getBridges = (endpoints, classifier) => {
  const result = [];
  const corners = endpoints.filter((x) => x.corner);
  const matching = matchCorners(corners, classifier);
  for (let i = 0; i < corners.length; i++) {
    const j = matching[i];
    if (j <= i && matching[j] === i) {
      continue;
    }
    result.push([Point.clone(corners[i].point), Point.clone(corners[j].point)]);
  }
  result.map(checkBridge);
  return result;
}

// Returns a list of angle and distance features between two corners.
const getFeatures = (ins, out) => {
  const diff = Point.subtract(out.point, ins.point);
  const trivial = Point.equal(diff, [0, 0]);
  const angle = Math.atan2(diff[1], diff[0]);
  const distance = Math.sqrt(Point.distance2(out.point, ins.point));
  return [
    Angle.subtract(angle, ins.angles[0]),
    Angle.subtract(out.angles[1], angle),
    Angle.subtract(ins.angles[1], angle),
    Angle.subtract(angle, out.angles[0]),
    Angle.subtract(ins.angles[1], ins.angles[0]),
    Angle.subtract(out.angles[1], out.angles[0]),
    (trivial ? 1 : 0),
    distance/MAX_BRIDGE_DISTANCE,
  ];
}

// A hand-tuned classifier that uses the features above to return a score for
// connecting two corners by a bridge. This classifier throws out most data.
const handTunedClassifier = (features) => {
  if (features[6] > 0) {
    return -Angle.penalty(features[4]);
  }
  let angle_penalty = Angle.penalty(features[0]) + Angle.penalty(features[1]);
  const distance_penalty = features[7];
  if (features[0] > 0 && features[1] > 0 &&
      features[2] + features[3] < -0.5*Math.PI) {
    angle_penalty = angle_penalty/16;
  }
  return -(angle_penalty + distance_penalty);
}

// Takes a list of corners and returns a bipartite matching between them.
// If matching[i] === j, then corners[i] is matched with corners[j] - that is,
// we should construct a bridge from corners[i].point to corners[j].point.
const matchCorners = (corners, classifier) => {
  const matrix = [];
  for (let i = 0; i < corners.length; i++) {
    matrix.push([]);
    for (let j = 0; j < corners.length; j++) {
      matrix[i].push(scoreCorners(corners[i], corners[j], classifier));
    }
  }
  for (let i = 0; i < corners.length; i++) {
    for (let j = 0; j < corners.length; j++) {
      const reversed_score = matrix[j][i] - REVERSAL_PENALTY;
      if (reversed_score > matrix[i][j]) {
        matrix[i][j] = reversed_score;
      }
    }
  }
  return (new Hungarian(matrix)).x_match;
}

// Takes two corners and returns the score assigned to constructing a bridge
// from one corner to the other. The score is directed: the bridge from ins to
// out may be weighted higher than from out to ins.
const scoreCorners = (ins, out, classifier) => {
  return classifier(getFeatures(ins, out));
}

// Stores angle and distance metadata around an SVG path segment's start point.
// This endpoint may be a 'corner', which is true if the path bends sharply in
// the negative (clockwise) direction at that point.
function Endpoint(paths, index) {
  this.index = index;
  const path = paths[index[0]];
  const n = path.length;
  this.indices = [[index[0], (index[1] + n - 1) % n], index];
  this.segments = [path[(index[1] + n - 1) % n], path[index[1]]];
  this.point = this.segments[0].end;
  assert(Point.valid(this.point), this.point);
  assert(Point.equal(this.point, this.segments[1].start), path);
  this.tangents = [
    Point.subtract(this.segments[0].end, this.segments[0].start),
    Point.subtract(this.segments[1].end, this.segments[1].start),
  ];
  const threshold = Math.pow(MIN_CORNER_TANGENT_DISTANCE, 2);
  if (this.segments[0].control !== undefined &&
      Point.distance2(this.point, this.segments[0].control) > threshold) {
    this.tangents[0] = Point.subtract(this.point, this.segments[0].control);
  }
  if (this.segments[1].control !== undefined &&
      Point.distance2(this.point, this.segments[1].control) > threshold) {
    this.tangents[1] = Point.subtract(this.segments[1].control, this.point);
  }
  this.angles = this.tangents.map(Point.angle);
  const diff = Angle.subtract(this.angles[1], this.angles[0]);
  this.corner = diff < -MIN_CORNER_ANGLE;
  return this;
}

// Code for the stroke extraction step follows.

const addEdgeToAdjacency = (edge, adjacency) => {
  assert(edge.length === 2);
  adjacency[edge[0]] = adjacency[edge[0]] || [];
  if (adjacency[edge[0]].indexOf(edge[1]) < 0) {
    adjacency[edge[0]].push(edge[1]);
  }
}

const extractStroke = (paths, endpoint_map, bridge_adjacency, log,
                       extracted_indices, start, attempt_one) => {
  const result = [];
  const visited = {};
  let current = start;

  // A list of line segments that were added to the path but that were not
  // part of the original stroke data. None of these should intersect.
  const line_segments = [];
  let self_intersecting = false;

  const advance = (index) =>
      [index[0], (index[1] + 1) % paths[index[0]].length];

  const angle = (index1, index2) => {
    const diff = Point.subtract(endpoint_map[Point.key(index2)].point,
                                endpoint_map[Point.key(index1)].point);
    assert(diff[0] !== 0 || diff[1] !== 0);
    const angle = Math.atan2(diff[1], diff[0]);
    return Angle.subtract(angle,  endpoint.angles[0]);
  }

  const getIntersection = (segment1, segment2) => {
    const diff1 = Point.subtract(segment1[1], segment1[0]);
    const diff2 = Point.subtract(segment2[1], segment2[0]);
    const cross = diff1[0]*diff2[1] - diff1[1]*diff2[0];
    if (cross === 0) {
      return undefined;
    }
    const v = Point.subtract(segment1[0], segment2[0]);
    const s = (diff1[0]*v[1] - diff1[1]*v[0])/cross;
    const t = (diff2[0]*v[1] - diff2[1]*v[0])/cross;
    if (0 < s && s < 1 && 0 < t && t < 1) {
      return [segment1[0][0] + t*diff1[0], segment1[0][1] + t*diff1[1]];
    }
    return undefined;
  }

  const indexToPoint = (index) => endpoint_map[Point.key(index)].point;

  const pushLineSegments = (points) => {
    const old_lines = line_segments.length;
    for (let i = 0; i < points.length - 1; i++) {
      line_segments.push([points[i], points[i + 1]]);
      result.push({
        start: Point.clone(points[i]),
        end: Point.clone(points[i + 1]),
        control: undefined,
      });
    }
    // Log an error if this stroke is self-intersecting.
    if (!self_intersecting) {
      for (let i = 0; i < old_lines; i++) {
        for (let j = old_lines; j < line_segments.length; j++) {
          if (getIntersection(line_segments[i], line_segments[j])) {
            self_intersecting = true;
            return;
          }
        }
      }
    }
  }

  // Here there be dragons!
  // TODO(skishore): Document the point of the geometry in this function.
  const selectBridge = (endpoint, options) => {
    if (options.length === 1 && extracted_indices[Point.key(options[0])]) {
      // Handle star-shaped strokes where one stroke ends at the intersection
      // of the bridges used by two other strokes.
      const indices1 = [endpoint.index, options[0]];
      const segment1 = indices1.map(indexToPoint);
      for (let key in bridge_adjacency) {
        if (Point.equal(endpoint_map[key].index, indices1[0])) {
          continue;
        }
        for (let i = 0; i < bridge_adjacency[key].length; i++) {
          if (Point.equal(bridge_adjacency[key][i], segment1[0])) {
            continue;
          }
          // Compute the other bridge segment and check if it intersects.
          const indices2 = [endpoint_map[key].index, bridge_adjacency[key][i]];
          const segment2 = indices2.map(indexToPoint);
          if (Point.equal(indices2[0], indices1[1]) &&
              !extracted_indices[Point.key(indices2[1])]) {
            pushLineSegments([segment1[0], segment1[1], segment2[1]]);
            return indices2[1];
          } else if (Point.equal(indices2[1], indices1[1]) &&
                     !extracted_indices[Point.key(indices2[0])]) {
            pushLineSegments([segment1[0], segment1[1], segment2[0]]);
            return indices2[0];
          }
          const intersection = getIntersection(segment1, segment2);
          if (intersection !== undefined) {
            const angle1 = angle(indices1[0], indices1[1]);
            const angle2 = angle(indices2[0], indices2[1]);
            if (Angle.subtract(angle2, angle1) < 0) {
              indices2.reverse();
              segment2.reverse();
            }
            pushLineSegments([segment1[0], intersection, segment2[1]]);
            return indices2[1];
          }
        }
      }
    } else {
      // Handle segments where the correct path is to follow a dead-end bridge,
      // even if there is another bridge that is more aligned with the stroke.
      for (let i = 0; i < options.length; i++) {
        const key = Point.key(options[i]);
        if (!extracted_indices[key]) {
          return options[i];
        }
      }
    }
    return options[0];
  }

  while (true) {
    // Add the current path segment to the path.
    result.push(paths[current[0]][current[1]]);
    visited[Point.key(current)] = true;
    current = advance(current);
    // If there are bridges at the start of the next path segment, follow the
    // one that makes the largest angle with the current path. The ordering
    // criterion enforce that we try to cross aligned bridges.
    const key = Point.key(current);
    if (bridge_adjacency.hasOwnProperty(key)) {
      var endpoint = endpoint_map[key];
      const options = bridge_adjacency[key].sort(
          (a, b) => angle(endpoint.index, a) - angle(endpoint.index, b));
      // HACK(skishore): The call to selectBridge may update the result.
      // When a stroke is formed by computing a bridge intersection, then the
      // two bridge fragments are added in selectBridge.
      const result_length = result.length;
      const next = (attempt_one ? options[0] : selectBridge(endpoint, options));
      if (result.length === result_length) {
        pushLineSegments([endpoint.point, endpoint_map[Point.key(next)].point]);
      }
      current = next;
    }
    // Check if we have either closed the loop or hit an extracted segment.
    const new_key = Point.key(current);
    if (Point.equal(current, start)) {
      if (self_intersecting) {
        log.push({cls: 'error',
                  message: 'Extracted a self-intersecting stroke.'});
      }
      let num_segments_on_path = 0;
      for (let index in visited) {
        extracted_indices[index] = true;
        num_segments_on_path += 1;
      }
      // Single-segment strokes may be due to graphical artifacts in the font.
      // We drop them to remove these artifacts.
      if (num_segments_on_path === 1) {
        log.push({cls: 'success', message: 'Dropping single-segment stroke.'});
        return undefined;
      }
      return result;
    } else if (extracted_indices[new_key] || visited[new_key]) {
      return undefined;
    }
  }
}

const extractStrokes = (paths, endpoints, bridges, log) => {
  // Build up the necessary hash tables and adjacency lists needed to run the
  // stroke extraction loop.
  const endpoint_map = {};
  const endpoint_position_map = {};
  for (let endpoint of endpoints) {
    endpoint_map[Point.key(endpoint.index)] = endpoint;
    endpoint_position_map[Point.key(endpoint.point)] = endpoint;
  }
  bridges.map(checkBridge);
  const bridge_adjacency = {};
  for (let bridge of bridges) {
    const keys = bridge.map(Point.key);
    assert(endpoint_position_map.hasOwnProperty(keys[0]));
    assert(endpoint_position_map.hasOwnProperty(keys[1]));
    const xs = keys.map((x) => endpoint_position_map[x].index);
    addEdgeToAdjacency([Point.key(xs[0]), xs[1]], bridge_adjacency);
    addEdgeToAdjacency([Point.key(xs[1]), xs[0]], bridge_adjacency);
  }
  // Actually extract strokes. Any given path segment index should appear on
  // exactly one stroke; if it is not on a stroke, we log a warning.
  const extracted_indices = {};
  const strokes = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    let missed = false;
    for (var i = 0; i < paths.length; i++) {
      for (var j = 0; j < paths[i].length; j++) {
        const index = [i, j];
        if (extracted_indices[Point.key(index)]) {
          continue;
        }
        const attempt_one = attempt === 0;
        const stroke = extractStroke(paths, endpoint_map, bridge_adjacency, log,
                                     extracted_indices, index, attempt_one);
        if (stroke === undefined) {
          missed = true;
          continue;
        }
        strokes.push(stroke);
      }
    }
    if (!missed) {
      return strokes;
    }
  }
  log.push({cls: 'error',
            message: 'Stroke extraction missed some path segments.'});
  return strokes;
}

// Exports go below this fold.

const stroke_extractor = {};

stroke_extractor.getBridges = (path, classifier) => {
  const paths = svg.convertSVGPathToPaths(path);
  const endpoints = [];
  for (let i = 0; i < paths.length; i++) {
    for (let j = 0; j < paths[i].length; j++) {
      endpoints.push(new Endpoint(paths, [i, j]));
    }
  }
  classifier = classifier || stroke_extractor.combinedClassifier;
  const bridges = getBridges(endpoints, classifier);
  return {endpoints: endpoints, bridges: bridges};
}

stroke_extractor.getStrokes = (path, bridges) => {
  const paths = svg.convertSVGPathToPaths(path);
  const endpoints = [];
  for (let i = 0; i < paths.length; i++) {
    for (let j = 0; j < paths[i].length; j++) {
      endpoints.push(new Endpoint(paths, [i, j]));
    }
  }
  const log = [];
  const stroke_paths = extractStrokes(paths, endpoints, bridges, log);
  const strokes = stroke_paths.map((x) => svg.convertPathsToSVGPath([x]));
  return {log: log, strokes: strokes};
}

stroke_extractor.handTunedClassifier = handTunedClassifier;

export {stroke_extractor};
