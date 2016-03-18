const candidates = new ReactiveVar([]);
const strokes = new ReactiveVar([]);
const zoom = new ReactiveVar(1);

let handwriting = null;

makemeahanzi.mediansPromise.then((medians) => {
  const matcher = new makemeahanzi.Matcher(medians);
  Deps.autorun(() => candidates.set(matcher.match(strokes.get(), 8)));
}).catch(console.error.bind(console));

const getZoom = (outer) => {
  const inner = outer.children();
  const x_zoom = outer.width() / inner.outerWidth();
  const y_zoom = outer.height() / inner.outerHeight();
  return Math.min(x_zoom, y_zoom);
}

const onRendered = function() {
  const outer = $(this.firstNode);
  const element = outer.find('.handwriting');
  const callback = strokes.push.bind(strokes);
  strokes.set([]);
  zoom.set(getZoom(outer));
  handwriting = new makemeahanzi.Handwriting(element, callback, zoom.get());
}

// Meteor template bindings.

Template.search.events({
  'click .controls .clear.button': () => {
    strokes.set([]);
    handwriting.clear();
  },
  'click .controls .undo.button': () => {
    strokes.pop();
    handwriting.undo();
  },
  'click .candidate': function() {
    Meteor.call('recordHandwriting', strokes.get(), candidates.get(), this[0],
                (error, result) => { if (error) console.error(error); });
  },
});

Template.search.helpers({
  candidates: () => candidates.get(),
  url: (character) => `#/codepoint/${character.charCodeAt(0)}`,
  zoom: () => zoom.get(),
});

Template.search.onRendered(onRendered);
