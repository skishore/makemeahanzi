var MIN_CORNER_ANGLE = 0.1*Math.PI;
var MIN_CORNER_TANGENT_DISTANCE = 4;

// Error out if the condition does not hold.
function assert(condition, message) {
  if (!condition) {
    console.error(message);
    throw new Error;
  }
}

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
  subtract: function(point1, point2) {
    return [point1[0] - point2[0], point1[1] - point2[1]];
  },
  valid: function(point) {
    return point[0] !== undefined && point[1] !== undefined;
  },
};

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

function Endpoint(paths, index) {
  this.index = index;
  var path = paths[index[0]];
  var n = path.length;
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

// Exports go below this fold.

this.get_glyph_render_data = function(glyph) {
  var paths = orient_paths(split_path(glyph.path));
  var endpoints = [];
  for (var i = 0; i < paths.length; i++) {
    for (var j = 0; j < paths[i].length; j++) {
      endpoints.push(new Endpoint(paths, [i, j]));
    }
  }
  return {d: Glyphs.get_svg_path(glyph), endpoints: endpoints};
}
