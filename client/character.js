const animations = new ReactiveVar();
const character = new ReactiveVar();
const metadata = new ReactiveVar();
const strokes = new ReactiveVar();
const tree = new ReactiveVar();

let animation = null;

const orientation = new ReactiveVar('horizontal');
const short = new ReactiveVar(false);

// Methods used to render all the various pieces of character metadata.

const augmentTreeWithLabels = (node, dependencies) => {
  const value = node.value;
  if (node.type === 'compound') {
    node.label = lower(makemeahanzi.Decomposition.ids_data[value].label);
    node.children.map((child) => augmentTreeWithLabels(child, dependencies));
  } else {
    node.label = dependencies[node.value] || '(unknown)';
    if (dependencies[node.value]) {
      node.link = `#/codepoint/${node.value.charCodeAt(0)}`;
    }
  }
}

const constructTree = (row) => {
  const util = makemeahanzi.Decomposition;
  const tree = util.convertDecompositionToTree(row.decomposition);
  augmentTreeWithLabels(tree, row.dependencies);
  return tree;
}

const formatEtymology = (etymology) => {
  const result = [etymology.type];
  if (etymology.type === 'ideographic' ||
      etymology.type === 'pictographic') {
    if (etymology.hint) {
      result.push(`- ${lower(etymology.hint)}`);
    }
  } else {
    result.push('-');
    result.push(etymology.semantic || '?');
    if (etymology.hint) {
      result.push(`(${lower(etymology.hint)})`);
    }
    result.push('provides the meaning while');
    result.push(etymology.phonetic || '?');
    result.push('provides the pronunciation.');
  }
  return result.join(' ');
}

const lower = (string) => {
  if (string.length === 0) return string;
  return string[0].toLowerCase() + string.substr(1);
}

const refreshMetadata = (row) => {
  const options = {delay: 0.3, speed: 0.02};
  animation = new makemeahanzi.Animation(options, row.strokes, row.medians);
  animate(advanceAnimation);
  metadata.set([
    {label: 'Definition:', value: row.definition},
    {label: 'Pinyin:', value: row.pinyin.join(', ')},
    {label: 'Radical:', value: row.radical},
  ]);
  if (row.etymology) {
    metadata.push({
      label: 'Formation:',
      value: formatEtymology(row.etymology),
    });
  }
  strokes.set(row.strokes.map((d) => ({d: d, class: 'incomplete'})));
  tree.set(constructTree(row));
}

const updateCharacter = () => {
  makemeahanzi.lookupCharacter(character.get(), (row) => {
      if (row.character === character.get()) refreshMetadata(row); });
}

// Methods for running the stroke-order animation.

const animate = window.requestAnimationFrame ||
                ((callback) => setTimeout(callback, 1000 / 60));

const advanceAnimation = () => {
  if (animation == null) {
    return;
  }
  const step = animation.step();
  const complete = step.animations.length - (step.complete ? 0 : 1);

  if (complete > 0 && strokes.get()[complete - 1].class !== 'complete') {
    const current = strokes.get();
    for (let i = 0; i < complete ; i++) {
      current[i].class = 'complete';
    }
    strokes.set(current);
  }
  animations.set(step.animations.slice(complete));
  if (!step.complete) {
    animate(advanceAnimation);
  }
}

const resize = () => {
  short.set(window.innerWidth <= 480 ? 'short ' : '');
  orientation.set(window.innerWidth < window.innerHeight ?
                  'vertical' : 'horizontal');
}

// Various event handlers and other helpers.

const linkify = (value) => {
  const result = [];
  for (let character of value) {
    if (character.match(/[\u3400-\u9FBF]/)) {
      result.push(`<a href="#/codepoint/${character.charCodeAt(0)}" ` +
                     `class="link">${character}</a>`);
    } else {
      result.push(character);
    }
  }
  return result.join('');
}

const showModal = () => {
  // TODO(skishore): Maybe rewrite these jQuery hax in idiomatic Meteor.
  const element = $('.modal');
  const value = character.get();
  element.find('.modal-title').text(`Report an error with ${value}`);
  element.find('.form-control, .status')
         .text('').val('').removeClass('error success');
  element.unbind('shown.bs.modal').on('shown.bs.modal', function() {
    $(this).find('.form-control:first').focus();
  });
  element.find('.submit.btn').unbind('click').on('click', () => {
    const description = element.find('.description.form-control').val();
    if (description.length === 0) {
      element.find('.status').addClass('error').removeClass('success')
             .text('You must enter a description of the problem.');
      return;
    }
    element.find('.status').removeClass('error success')
           .text('Submitting feedback...');
    Meteor.call('reportError', value, description, (error, result) => {
      if (error) {
        element.find('.status').addClass('error').removeClass('success')
               .text('There was an error in submitting your feedback.');
        return;
      }
      element.find('.status').addClass('success').removeClass('error')
             .text('Feedback submitted!');
      element.modal('hide');
    });
  });
  element.modal('show');
}

// Meteor template bindings.

Template.character.events({'click .panel-title-right': showModal});

Template.character.helpers({
  character: () => character.get(),
  metadata: () => metadata.get(),
  tree: () => tree.get(),

  linkify: linkify,

  orientation: () => orientation.get(),
  short: () => short.get(),

  format: (label) => (short.get() ? label.slice(0, 3) + ':' : label),
  horizontal: () => orientation.get() === 'horizontal',
  vertical: () => orientation.get() === 'vertical',
});

Template.order.helpers({
  animations: () => animations.get(),
  strokes: () => (strokes.get() || []).slice().reverse(),
});

Meteor.startup(() => {
  Deps.autorun(updateCharacter)
  hashchange();
  resize();
});

const hashchange = () => {
  if (Session.get('route') === 'character') {
    const hash = window.location.hash;
    const codepoint = parseInt(hash.slice(hash.lastIndexOf('/') + 1), 10);
    character.set(String.fromCharCode(codepoint));
    [animations, metadata, strokes, tree].map((x) => x.set(null));
    animation = null;
  } else {
    character.set(null);
  }
}

window.addEventListener('hashchange', hashchange, false);
