const candidates = new ReactiveVar([]);
const strokes = new ReactiveVar([]);
const zoom = new ReactiveVar(1);

let handwriting = null;

makemeahanzi.mediansPromise.then((medians) => {
  const matcher = new makemeahanzi.Matcher(medians, {min_width: 1 / 64});
  Deps.autorun(() => candidates.set(matcher.match(strokes.get(), 8)));
}).catch(console.error.bind(console));

const onRendered = function() {
  strokes.set([]);
  zoom.set(this.getZoom());
  const element = $(this.firstNode).find('.handwriting');
  const options = {
    zoom: zoom.get(),
    onstroke: strokes.push.bind(strokes),
  };
  handwriting = new makemeahanzi.Handwriting(element, options);
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
