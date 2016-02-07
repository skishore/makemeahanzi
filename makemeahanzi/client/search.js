const candidates = new ReactiveVar([]);
const paths = new ReactiveVar([]);
const stroke = new ReactiveVar([]);
const strokes = new ReactiveVar([]);
const zoom = new ReactiveVar(1);

let matcher = null;
makemeahanzi.mediansPromise.then((medians) => {
  matcher = new makemeahanzi.Matcher(medians);
  Deps.autorun(refreshCandidates);
}).catch(console.error.bind(console));

// Simple helpers for interacting with reactive variables.

const pop = (variable) => {
  const value = variable.get();
  value.pop();
  variable.set(value);
}

const push = (variable, element) => {
  const value = variable.get();
  value.push(element);
  variable.set(value);
}

// Methods needed to initialize the drawing canvas.

const createSketch = function() {
  let mousedown = false;
  const element = $(this.firstNode);
  const canvas = element.find('.handwriting .input');
  const svg = element.find('.handwriting svg');
  Sketch.create({
    container: canvas[0],
    autoclear: false,
    fullscreen: false,
    width: svg.width(),
    height: svg.height(),
    mousedown(e) {
      mousedown = true;
      pushPoint([e.x, e.y]);
    },
    mouseup(e) {
      mousedown = false;
      endStroke();
    },
    touchmove() {
      if (mousedown && this.touches.length > 0) {
        const touch = this.touches[0];
        maybePushPoint([touch.ox, touch.oy]);
        pushPoint([touch.x, touch.y]);
      }
    }
  });
}

const resize = function() {
  const outer = $(this.firstNode);
  const inner = outer.children();
  const x_zoom = outer.width() / inner.outerWidth();
  const y_zoom = outer.height() / inner.outerHeight();
  zoom.set(Math.min(x_zoom, y_zoom));
}

// Methods for actually executing drawing commands.

const clear = () => {
  paths.set([]);
  stroke.set([]);
  strokes.set([]);
}

const d = (path) => {
  if (path.length < 2) {
    return '';
  }
  const result = [];
  const point = (i) => `${path[i][0]} ${path[i][1]}`;
  const midpoint = (i) => `${(path[i][0] + path[i + 1][0])/2} ` +
                          `${(path[i][1] + path[i + 1][1])/2}`;
  const push = (x) => result.push(x);
  ['M', point(0), 'L', midpoint(0)].map(push);
  for (var i = 1; i < path.length - 1; i++) {
    ['Q', point(i), midpoint(i)].map(push);
  }
  ['L', point(path.length - 1)].map(push);
  return result.join(' ');
}

const endStroke = () => {
  const new_path = d(stroke.get());
  if (new_path.length > 0) {
    push(paths, new_path);
    push(strokes, stroke.get());
  }
  stroke.set([]);
}

const maybePushPoint = (point) => {
  if (stroke.get().length === 0) {
    pushPoint(point);
  }
}

const pushPoint = (point) => {
  if (point[0] != null && point[1] != null) {
    push(stroke, point.map((x) => x / zoom.get()));
  }
}

const refreshCandidates = () => {
  const data = strokes.get();
  candidates.set(data.length > 0 ? matcher.match(data, 8) : []);
}

const undo = () => {
  pop(paths);
  pop(strokes);
  stroke.set([]);
}

// Meteor template bindings.

Template.search.events({
  'click .controls .clear.button': clear,
  'click .controls .undo.button': undo,
});

Template.search.helpers({
  candidates: () => candidates.get(),
  current: () => d(stroke.get()),
  paths: () => paths.get(),
  zoom: () => zoom.get(),
});

Template.search.onRendered(clear);
Template.search.onRendered(createSketch);
Template.search.onRendered(resize);

const SearchController = function() {
  this.getURL = (character) => `#/codepoint/${character.charCodeAt(0)}`;
}
