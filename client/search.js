const candidates = new ReactiveVar([]);
const strokes = new ReactiveVar([]);
const zoom = new ReactiveVar(1);

let container = null;
let current = null;
let stroke = [];
let stage = null;

makemeahanzi.mediansPromise.then((medians) => {
  const matcher = new makemeahanzi.Matcher(medians);
  Deps.autorun(() => candidates.set(matcher.match(strokes.get(), 8)));
}).catch(console.error.bind(console));

// Methods needed to initialize the drawing canvas.

const createSketch = function() {
  let mousedown = false;
  const element = $(this.firstNode).find('.handwriting');
  Sketch.create({
    container: element[0],
    autoclear: false,
    fullscreen: false,
    width: element.width(),
    height: element.height(),
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
  initializeStage(element);
}

const dottedLine = (x1, y1, x2, y2) => {
  const result = new createjs.Shape();
  result.graphics.setStrokeDash([2, 2], 0);
  result.graphics.setStrokeStyle(2)
  result.graphics.beginStroke('#ccc');
  result.graphics.moveTo(x1, y1);
  result.graphics.lineTo(x2, y2);
  return result;
}

const initializeStage = (element) => {
  container = new createjs.Container();
  stage = new createjs.Stage(element.find('canvas')[0]);

  const cross = new createjs.Container();
  const height = stage.canvas.height;
  const width = stage.canvas.width;
  cross.addChild(dottedLine(0, 0, width, height));
  cross.addChild(dottedLine(width, 0, 0, height));
  cross.addChild(dottedLine(width / 2, 0, width / 2, height));
  cross.addChild(dottedLine(0, height / 2, width, height / 2));
  cross.cache(0, 0, width, height);

  stage.addChild(cross, container);
  stage.update();
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
  strokes.set([]);
  container.removeAllChildren();
  clearCurrent();
}

const clearCurrent = () => {
  current = null;
  stroke = [];
  stage.update();
}

const distance = (point1, point2) => {
  const diagonal = stage.canvas.width * stage.canvas.width +
                   stage.canvas.height * stage.canvas.height;
  const diff = [point1[0] - point2[0], point1[1] - point2[1]];
  return (diff[0] * diff[0] + diff[1] * diff[1]) / diagonal;
}

const endStroke = () => {
  if (stroke.length >= 2) {
    strokes.push(stroke);
  }
  if (current) current.cache(0, 0, stage.canvas.width, stage.canvas.height);
  clearCurrent();
}

const maybePushPoint = (point) => {
  if (stroke.length === 0) {
    pushPoint(point);
  }
}

const pushPoint = (point) => {
  if (point[0] != null && point[1] != null) {
    stroke.push(point.map((x) => Math.round(x / zoom.get())));
    refreshStage();
  }
}

const refreshStage = () => {
  if (stroke.length < 2) {
    return;
  }
  if (!current) {
    current = new createjs.Shape();
    container.addChild(current);
  }
  const i = stroke.length - 2;
  const d = distance(stroke[i], stroke[i + 1]);
  current.graphics.setStrokeStyle(-Math.log(d), 'round');
  current.graphics.beginStroke('black');
  current.graphics.moveTo(stroke[i][0], stroke[i][1]);
  current.graphics.lineTo(stroke[i + 1][0], stroke[i + 1][1]);
  stage.update();
}

const undo = () => {
  strokes.pop();
  container.removeChildAt(container.children.length - 1);
  clearCurrent();
}

// Meteor template bindings.

const log = function() {
  Meteor.call('recordHandwriting', strokes.get(), candidates.get(), this[0],
              (error, result) => { if (error) console.error(error); });
}

Template.search.events({
  'click .controls .clear.button': clear,
  'click .controls .undo.button': undo,
  'click .candidate': log,
});

Template.search.helpers({
  candidates: () => candidates.get(),
  url: (character) => `#/codepoint/${character.charCodeAt(0)}`,
  zoom: () => zoom.get(),
});

Template.search.onRendered(createSketch);
Template.search.onRendered(resize);

window.addEventListener('hashchange', clear, false);
