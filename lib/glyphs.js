Glyphs = new Mongo.Collection('glyphs');

Glyphs.get_svg_path = function(glyph) {
  var terms = [];
  for (var i = 0; i < glyph.path.length; i++) {
    var segment = glyph.path[i];
    terms.push(segment.type);
    if (segment.x1 !== undefined) {
      terms.push(segment.x1);
      terms.push(segment.y1);
    }
    terms.push(segment.x);
    terms.push(segment.y);
  }
  return terms.join(' ');
}

// Error out if the condition does not hold.
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(point) {
  return [point[0], point[1]];
}

// Takes a non-empty list of SVG commands that may contain multiple contours.
// Returns a list of lists of path segment objects that each form one contour.
// Each path segment has three keys: start, end, and control.
function split_path(path) {
  assert(path.length >= 2);
  assert(path[0].type === 'M', 'Path did not start with M!');
  assert(path[path.length - 1].type === 'Z', 'Path did not end with Z!');

  var result = [[]];
  var start = [path[0].x, path[0].y];
  var current = clone(start);

  for (var i = 1; i < path.length; i++) {
    var command = path[i];
    if (command.type === 'M' || command.type === 'Z') {
      assert(start.x === current.x && start.y === current.y, 'Open contour!');
      assert(result[result.length -1].length > 0, 'Empty contour!');
      if (command.type === 'Z') {
        assert(i === path.length - 1, 'Path ended early!');
        return result;
      }
      var start = {x: command.x, y: command.y};
      var current = {x: start_point.x, y: start_point.y};
      continue;
    }
    assert(command.type === 'Q', 'Got unexpected TTF command: ' + command.type);
    var segment = {
      'start': clone(current),
      'end': [command.x, command.y],
      'control': [command.x1, command.y1],
    };
    result[result.length - 1].push(segment);
    current = clone(segment.end);
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

split_and_orient_path = function(path) {
  return orient_paths(split_path(path));
}
