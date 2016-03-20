const character = new ReactiveVar();
const definition = new ReactiveVar();
const pinyin = new ReactiveVar();
const zoom = new ReactiveVar(1);

let handwriting = null;

const getZoom = (outer) => {
  const inner = outer.children();
  const x_zoom = outer.width() / inner.outerWidth();
  const y_zoom = outer.height() / inner.outerHeight();
  return Math.min(x_zoom, y_zoom);
}

const onRendered = function() {
  const outer = $(this.firstNode);
  const element = outer.find('.handwriting');
  const callback = (() => _);
  zoom.set(getZoom(outer));
  handwriting = new makemeahanzi.Handwriting(element, callback, zoom.get());
}

// Meteor template bindings.

Template.teach.helpers({
  zoom: () => zoom.get(),
});

Template.teach.onRendered(onRendered);

const hashchange = () => {
  if (Session.get('route') === 'teach') {
    const hash = window.location.hash;
    const codepoint = parseInt(hash.slice(hash.lastIndexOf('/') + 1), 10);
    character.set(String.fromCharCode(codepoint));
    [definition, pinyin].map((x) => x.set(null));
  } else {
    character.set(null);
  }
}

window.addEventListener('hashchange', hashchange, false);
