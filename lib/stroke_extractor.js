var MAX_BRIDGE_DISTANCE = 64;
var MIN_CORNER_ANGLE = 0.1*Math.PI;
var MIN_CORNER_TANGENT_DISTANCE = 4;
var REVERSAL_PENALTY = 0.5;

// Error out if the condition does not hold.
function assert(condition, message) {
  if (!condition) {
    console.error(message);
    throw new Error;
  }
}

// Helper methods for use with angles, which are floats in [-pi, pi).
var Angle = {
  subtract: function(angle1, angle2) {
    var result = angle1 - angle2;
    if (result < -Math.PI) {
      result += 2*Math.PI;
    }
    if (result >= Math.PI) {
      result -= 2*Math.PI;
    }
    return result;
  },
  penalty: function(diff) {
    return diff*diff;
  },
};

// Helper methods for use with "points", which are just pairs of integers.
var Point = {
  angle: function(point) {
    return Math.atan2(point[1], point[0]);
  },
  clone: function(point) {
    return [point[0], point[1]];
  },
  distance2: function(point1, point2) {
    var diff = Point.subtract(point1, point2);
    return Math.pow(diff[0], 2) + Math.pow(diff[1], 2);
  },
  equal: function(point1, point2) {
    return point1[0] === point2[0] && point1[1] === point2[1];
  },
  key: function(point) {
    return point.join(',');
  },
  subtract: function(point1, point2) {
    return [point1[0] - point2[0], point1[1] - point2[1]];
  },
  valid: function(point) {
    return point[0] !== undefined && point[1] !== undefined;
  },
};

// Takes a non-empty list of SVG commands that may contain multiple contours.
// Returns a list of lists of path segment objects that each form one contour.
// Each path segment has three keys: start, end, and control.
function split_path(path) {
  assert(path.length >= 2);
  assert(path[0].type === 'M', 'Path did not start with M!');
  assert(path[path.length - 1].type === 'Z', 'Path did not end with Z!');

  var result = [[]];
  var start = [path[0].x, path[0].y];
  var current = Point.clone(start);
  assert(Point.valid(current));

  for (var i = 1; i < path.length; i++) {
    var command = path[i];
    if (command.type === 'M' || command.type === 'Z') {
      assert(start.x === current.x && start.y === current.y, 'Open contour!');
      assert(result[result.length -1].length > 0, 'Empty contour!');
      if (command.type === 'Z') {
        assert(i === path.length - 1, 'Path ended early!');
        return result;
      }
      result.push([]);
      var start = [command.x, command.y];
      var current = Point.clone(start);
      assert(Point.valid(current));
      continue;
    }
    assert(command.type === 'Q' || command.type === 'L',
           'Got unexpected TTF command: ' + command.type);
    var segment = {
      'start': Point.clone(current),
      'end': [command.x, command.y],
      'control': [command.x1, command.y1],
    };
    assert(Point.valid(segment.end));
    if (Point.equal(segment.start, segment.end)) {
      continue;
    }
    if (!Point.valid(segment.control) ||
        Point.equal(segment.start, segment.control) ||
        Point.equal(segment.end, segment.control)) {
      delete segment.control;
    }
    result[result.length - 1].push(segment);
    current = Point.clone(segment.end);
  }
}

// Takes a list of paths. Returns them oriented the way a TTF glyph should be:
// exterior contours counter-clockwise and interior contours clockwise.
function orient_paths(paths) {
  var max_area = 0;
  for (var i = 0; i < paths.length; i++) {
    var area = get_2x_area(paths[i]);
    if (Math.abs(area) > max_area) {
      max_area = area;
    }
  }
  if (max_area < 0) {
    // The paths are reversed. Flip each one.
    var result = [];
    for (var i = 0; i < paths.length; i++) {
      var path = paths[i];
      for (var j = 0; j < paths.length; j++) {
        var ref = [path[j].start, path[j].end];
        path[j].start = ref[1];
        path[j].end = ref[0];
      }
      path[j].reverse();
    }
  }
  return paths;
}

// Returns twice the area contained in the path. The result is positive iff the
// path winds in the counter-clockwise direction.
function get_2x_area(path) {
  var area = 0;
  for (var i = 0; i < path.length; i++) {
    var segment = path[i];
    area += (segment.end.x - segment.start.x)*(segment.end.y + segment.start.y);
  }
  return area;
}

// Code for the actual corners-and-bridges algorithm follows.

// Errors out if the bridges are invalid in some gross way.
function check_bridge(bridge) {
  assert(Point.valid(bridge[0]) && Point.valid(bridge[1]));
  assert(!Point.equal(bridge[0], bridge[1]));
}

// Returns the list of bridges on the path with the given endpoints. We strip
// nearly all of the metadata out of this list to make it easy to hand-correct.
// The list that we return is simply a list of pairs of points.
function get_bridges(endpoints) {
  var result = [];
  var corners = endpoints.filter(function(x) { return x.corner; });
  var matching = match_corners(corners);
  for (var i = 0; i < corners.length; i++) {
    var j = matching[i];
    if (j <= i && matching[j] === i) {
      continue;
    }
    result.push([Point.clone(corners[i].point), Point.clone(corners[j].point)]);
  }
  result.map(check_bridge);
  return result;
}

// Takes a list of corners and returns a bipartite matching between them.
// If matching[i] === j, then corners[i] is matched with corners[j] - that is,
// we should construct a bridge from corners[i].point to corners[j].point.
function match_corners(corners) {
  var matrix = [];
  for (var i = 0; i < corners.length; i++) {
    matrix.push([]);
    for (var j = 0; j < corners.length; j++) {
      matrix[i].push(score_corners(corners[i], corners[j]));
    }
  }
  for (var i = 0; i < corners.length; i++) {
    for (var j = 0; j < corners.length; j++) {
      var reversed_score = matrix[j][i] - REVERSAL_PENALTY;
      if (reversed_score > matrix[i][j]) {
        matrix[i][j] = reversed_score;
      }
    }
  }
  return (new Hungarian(matrix)).x_match;
}

// Returns a score for whether the two corners should be connected by a bridge.
// TODO(skishore): Replace this classifier with a machine-learned classifier.
// Note that we're throwing out almost all the features here and still getting
// reasonable results...
function run_classifier(features) {
  var angle_penalty = Angle.penalty(features[0]) + Angle.penalty(features[1]);
  var distance_penalty = features[6]/MAX_BRIDGE_DISTANCE;
  if (features[0] > 0 && features[1] > 0 &&
      features[2] + features[3] < -0.5*Math.PI) {
    angle_penalty = angle_penalty/16;
  }
  return -(angle_penalty + distance_penalty);
}

// Takes two corners and returns the score assigned to constructing a bridge
// from one corner to the other. The score is directed: the bridge from ins to
// out may be weighted higher than from out to ins.
function score_corners(ins, out) {
  var diff = Point.subtract(out.point, ins.point);
  if (Point.equal(diff, [0, 0])) {
    return -Angle.penalty(Angle.subtract(out.angles[1], ins.angles[0]));
  }
  var angle = Math.atan2(diff[1], diff[0]);
  var distance = Math.sqrt(Point.distance2(out.point, ins.point));
  var features = [
    Angle.subtract(angle, ins.angles[0]),
    Angle.subtract(out.angles[1], angle),
    Angle.subtract(ins.angles[1], angle),
    Angle.subtract(angle, out.angles[0]),
    Angle.subtract(ins.angles[1], ins.angles[0]),
    Angle.subtract(out.angles[1], out.angles[0]),
    distance,
  ];
  return run_classifier(features);
}

// Stores angle and distance metadata around an SVG path segment's start point.
// This endpoint may be a 'corner', which is true if the path bends sharply in
// the negative (clockwise) direction at that point.
function Endpoint(paths, index) {
  this.index = index;
  var path = paths[index[0]];
  var n = path.length;
  this.indices = [[index[0], (index[1] + n - 1) % n], index];
  this.segments = [path[(index[1] + n - 1) % n], path[index[1]]];
  this.point = this.segments[0].end;
  assert(Point.valid(this.point), this.point);
  assert(Point.equal(this.point, this.segments[1].start), path);
  this.tangents = [
    Point.subtract(this.segments[0].end, this.segments[0].start),
    Point.subtract(this.segments[1].end, this.segments[1].start),
  ];
  var threshold = Math.pow(MIN_CORNER_TANGENT_DISTANCE, 2);
  if (this.segments[0].control !== undefined &&
      Point.distance2(this.point, this.segments[0].control) > threshold) {
    this.tangents[0] = Point.subtract(this.point, this.segments[0].control);
  }
  if (this.segments[1].control !== undefined &&
      Point.distance2(this.point, this.segments[1].control) > threshold) {
    this.tangents[1] = Point.subtract(this.segments[1].control, this.point);
  }
  this.angles = this.tangents.map(Point.angle);
  var diff = Angle.subtract(this.angles[1], this.angles[0]);
  this.corner = diff < -MIN_CORNER_ANGLE;
  return this;
}

// Code for the stroke extraction step follows.

function add_edge_to_adjacency(edge, adjacency) {
  assert(edge.length === 2);
  adjacency[edge[0]] = adjacency[edge[0]] || [];
  if (adjacency[edge[0]].indexOf(edge[1]) < 0) {
    adjacency[edge[0]].push(edge[1]);
  }
}

function get_svg_path(stroke) {
  assert(stroke.length > 0);
  var terms = ['M', stroke[0].start[0], stroke[0].start[1]];
  for (var i = 0; i < stroke.length; i++) {
    var segment = stroke[i];
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
  terms.push('Z');
  return terms.join(' ');
}

function extract_stroke(paths, endpoint_map, bridge_adjacency, log,
                        extracted_indices, start, attempt_one) {
  var current = start;
  var result = [];
  var visited = {};

  // A list of line segments that were added to the path but that were not
  // part of the original stroke data. None of these should intersect.
  var line_segments = [];
  var self_intersecting = false;

  function advance(index) {
    return [index[0], (index[1] + 1) % paths[index[0]].length];
  }

  function angle(index1, index2) {
    var diff = Point.subtract(endpoint_map[Point.key(index2)].point,
                              endpoint_map[Point.key(index1)].point);
    assert(diff[0] !== 0 || diff[1] !== 0);
    var angle = Math.atan2(diff[1], diff[0]);
    return Angle.subtract(angle, endpoint.angles[0]);
  }

  function get_intersection(segment1, segment2) {
    var diff1 = Point.subtract(segment1[1], segment1[0]);
    var diff2 = Point.subtract(segment2[1], segment2[0]);
    var cross = diff1[0]*diff2[1] - diff1[1]*diff2[0];
    if (cross === 0) {
      return undefined;
    }
    var v = Point.subtract(segment1[0], segment2[0]);
    var s = (diff1[0]*v[1] - diff1[1]*v[0])/cross;
    var t = (diff2[0]*v[1] - diff2[1]*v[0])/cross;
    if (0 < s && s < 1 && 0 < t && t < 1) {
      return [segment1[0][0] + t*diff1[0], segment1[0][1] + t*diff1[1]];
    }
    return undefined;
  }

  function index_to_point(index) {
    return endpoint_map[Point.key(index)].point;
  }

  function push_line_segments(points) {
    var old_lines = line_segments.length;
    for (var i = 0; i < points.length - 1; i++) {
      line_segments.push([points[i], points[i + 1]]);
      result.push({
        start: Point.clone(points[i]),
        end: Point.clone(points[i + 1]),
        control: undefined,
      });
    }
    // Log an error if this stroke is self-intersecting.
    if (!self_intersecting) {
      for (var i = 0; i < old_lines; i++) {
        for (var j = old_lines; j < line_segments.length; j++) {
          if (get_intersection(line_segments[i], line_segments[j])) {
            self_intersecting = true;
            return;
          }
        }
      }
    }
  }

  // Here there be dragons!
  // TODO(skishore): Document the point of the geometry in this function.
  function select_bridge(endpoint, options) {
    if (options.length === 1) {
      // Handle star-shaped strokes where one stroke ends at the intersection
      // of the bridges used by two other strokes.
      var indices1 = [endpoint.index, options[0]];
      var segment1 = indices1.map(index_to_point);
      for (var key in bridge_adjacency) {
        if (Point.equal(endpoint_map[key].index, indices1[0])) {
          continue;
        }
        for (var i = 0; i < bridge_adjacency[key].length; i++) {
          if (Point.equal(bridge_adjacency[key][i], segment1[0])) {
            continue;
          }
          // Compute the other bridge segment and check if it intersects.
          var indices2 = [endpoint_map[key].index, bridge_adjacency[key][i]];
          var segment2 = indices2.map(index_to_point);
          if (Point.equal(indices2[0], indices1[1]) &&
              !extracted_indices[Point.key(indices2[1])]) {
            push_line_segments([segment1[0], segment1[1], segment2[1]]);
            return indices2[1];
          } else if (Point.equal(indices2[1], indices1[1]) &&
                     !extracted_indices[Point.key(indices2[0])]) {
            push_line_segments([segment1[0], segment1[1], segment2[0]]);
            return indices2[0];
          }
          var intersection = get_intersection(segment1, segment2);
          if (intersection !== undefined) {
            var angle1 = angle(indices1[0], indices1[1]);
            var angle2 = angle(indices2[0], indices2[1]);
            if (Angle.subtract(angle2, angle1) < 0) {
              indices2.reverse();
              segment2.reverse();
            }
            push_line_segments([segment1[0], intersection, segment2[1]]);
            return indices2[1];
          }
        }
      }
    } else {
      // Handle segments where the correct path is to follow a dead-end bridge,
      // even if there is another bridge that is more aligned with the stroke.
      for (var i = 0; i < options.length; i++) {
        var key = Point.key(options[i]);
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
    var key = Point.key(current);
    if (bridge_adjacency.hasOwnProperty(key)) {
      var endpoint = endpoint_map[key];
      var options = bridge_adjacency[key].sort(function(a, b) {
        return angle(endpoint.index, a) - angle(endpoint.index, b);
      });
      // HACK(skishore): The call to select_bridge may update the result.
      // When a stroke is formed by computing a bridge intersection, then the
      // two bridge fragments are added in select_bridge.
      var result_length = result.length;
      var next = (attempt_one ? options[0] : select_bridge(endpoint, options));
      if (result.length === result_length) {
        push_line_segments(
            [endpoint.point, endpoint_map[Point.key(next)].point]);
      }
      current = next;
    }
    // Check if we have either closed the loop or hit an extracted segment.
    var key = Point.key(current);
    if (Point.equal(current, start)) {
      if (self_intersecting) {
        log.push(['error', 'Extracted a self-intersecting stroke.']);
      }
      for (var index in visited) {
        extracted_indices[index] = true;
      }
      return result;
    } else if (extracted_indices[key] || visited[key]) {
      return undefined;
    }
  }
}

function extract_strokes(paths, endpoints, bridges, log) {
  // Build up the necessary hash tables and adjacency lists needed to run the
  // stroke extraction loop.
  var endpoint_map = {};
  var endpoint_position_map = {};
  for (var i = 0; i < endpoints.length; i++) {
    var endpoint = endpoints[i];
    endpoint_map[Point.key(endpoint.index)] = endpoint;
    endpoint_position_map[Point.key(endpoint.point)] = endpoint;
  }
  bridges.map(check_bridge);
  var bridge_adjacency = {};
  for (var i = 0; i < bridges.length; i++) {
    var keys = bridges[i].map(Point.key);
    assert(endpoint_position_map.hasOwnProperty(keys[0]));
    assert(endpoint_position_map.hasOwnProperty(keys[1]));
    var xs = keys.map(function(x) { return endpoint_position_map[x].index; });
    add_edge_to_adjacency([Point.key(xs[0]), xs[1]], bridge_adjacency);
    add_edge_to_adjacency([Point.key(xs[1]), xs[0]], bridge_adjacency);
  }
  // Actually extract strokes. Any given path segment index should appear on
  // exactly one stroke; if it is not on a stroke, we log a warning.
  var extracted_indices = {};
  var strokes = [];
  for (var attempt = 0; attempt < 3; attempt++) {
    var missed = false;
    for (var i = 0; i < paths.length; i++) {
      for (var j = 0; j < paths[i].length; j++) {
        var index = [i, j];
        if (extracted_indices[Point.key(index)]) {
          continue;
        }
        var attempt_one = attempt === 0;
        var stroke = extract_stroke(paths, endpoint_map, bridge_adjacency, log,
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
  log.push(['error', 'Stroke extraction missed some path segments.']);
  return strokes;
}

// Exports go below this fold.

this.get_glyph_render_data = function(glyph, manual_bridges) {
  var paths = orient_paths(split_path(glyph.path));
  var endpoints = [];
  for (var i = 0; i < paths.length; i++) {
    for (var j = 0; j < paths[i].length; j++) {
      endpoints.push(new Endpoint(paths, [i, j]));
    }
  }
  var log = [];
  var bridges = get_bridges(endpoints);
  var strokes = extract_strokes(
      paths, endpoints, manual_bridges || bridges, log);
  var expected = UNIHAN_STROKE_COUNTS[glyph.name];
  if (strokes.length === expected) {
    log.push(['success', 'Extracted ' + strokes.length + ' stroke' +
              (strokes.length > 1 ? 's' : '') + '.']);
  } else {
    log.push(['error', 'Extracted ' + strokes.length + ' stroke' +
              (strokes.length > 1 ? 's' : '') + ', but expected ' +
              expected + '.']);
  }
  return {
    bridges: bridges,
    d: Glyphs.get_svg_path(glyph),
    endpoints: endpoints,
    strokes: strokes.map(get_svg_path),
    log: log,
  };
}
