const candidates = new ReactiveVar([]);
const stroke = new ReactiveVar([]);
const strokes = new ReactiveVar([]);
const zoom = new ReactiveVar(1);

let matcher = null;

let current = null;
let stage = null;

makemeahanzi.mediansPromise.then((medians) => {
  matcher = new makemeahanzi.Matcher(medians);
  Deps.autorun(refreshCandidates);
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
  stage = new createjs.Stage(element.find('canvas')[0]);
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
  stroke.set([]);
  strokes.set([]);
  current = null;
  stage.removeAllChildren();
  stage.update();
}

const endStroke = () => {
  if (stroke.get().length >= 2) {
    strokes.push(stroke.get());
  }
  stroke.set([]);
  current = null;
}

const maybePushPoint = (point) => {
  if (stroke.get().length === 0) {
    pushPoint(point);
  }
}

const pushPoint = (point) => {
  if (point[0] != null && point[1] != null) {
    stroke.push(point.map((x) => Math.round(x / zoom.get())));
    refreshStage();
  }
}

const refreshCandidates = () => {
  const value = strokes.get();
  candidates.set(value.length > 0 ? matcher.match(value, 8) : []);
}

const refreshStage = () => {
  const value = stroke.get();
  if (value.length < 2) {
    return;
  }
  if (!current) {
    current = new createjs.Shape();
    current.graphics.setStrokeStyle(4, 'round');
    current.graphics.beginStroke('black');
    current.graphics.moveTo(value[0][0], value[0][1]);
    stage.addChild(current);
  }
  const last = value[value.length - 1];
  current.graphics.lineTo(last[0], last[1]);
  current.draw(stage.canvas.getContext('2d'));
}

const undo = () => {
  stroke.set([]);
  strokes.pop();
  current = null;
  stage.removeChildAt(stage.children.length - 1);
  stage.update();
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
