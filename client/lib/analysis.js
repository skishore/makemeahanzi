"use strict";

let stage = undefined;

const etymology_fields = ['hint', 'phonetic', 'semantic']

// Methods for querying and modifying decomposition trees.

const augmentTreeWithTemplateData = (tree, path) => {
  tree.path = path;
  const children = tree.children ? tree.children.length : 0;
  for (let i = 0; i < children; i++) {
    augmentTreeWithTemplateData(tree.children[i], path.concat([i]));
  }
  return tree;
}

const collectComponents = (subtree, result) => {
  if (!subtree) {
    return [];
  }
  result = result || [];
  if (subtree.type === 'character' && subtree.value !== '?') {
    result.push(subtree.value);
  }
  for (let child of subtree.children || []) {
    collectComponents(child, result);
  }
  return result;
}

const fixSubtreeChildrenLength = (subtree) => {
  const data = decomposition_util.ids_data[subtree.value];
  assert(data, `Invalid ideograph description character: ${subtree.value}`);
  subtree.children.length = data.arity;
  for (let i = 0; i < subtree.children.length; i++) {
    subtree.children[i] =
        subtree.children[i] || {type: 'character', value: '?'};
  }
  augmentTreeWithTemplateData(subtree, subtree.path);
}

const getSubtree = (tree, path) => {
  let subtree = tree;
  for (let index of path) {
    assert(0 <= index && index < subtree.children.length);
    subtree = subtree.children[index];
  }
  return subtree;
}

const parseDecomposition = (decomposition) => {
  const tree = decomposition ?
      decomposition_util.convertDecompositionToTree(decomposition) :
      {type: 'character', value: '?'};
  return augmentTreeWithTemplateData(tree, []);
}

const setSubtreeType = (subtree, type) => {
  if (subtree.type === type) {
    return;
  }
  if (type === 'character') {
    subtree.value = '?';
    delete subtree.children;
  } else if (type === 'compound') {
    subtree.value = decomposition_util.ideograph_description_characters[0];
    subtree.children = [];
    fixSubtreeChildrenLength(subtree);
  } else {
    assert(false, `Unexpected subtree type: ${type}`);
  }
  subtree.type = type;
}

// Methods for handling updates to various non-decomposition analysis fields.

const updateCharacterValue = (target, text, path) => {
  const subtree = getSubtree(stage.tree, path);
  if (text === subtree.value || subtree.type !== 'character') {
    return;
  }
  const value = text.length === 1 ? text : '?';
  if (value === subtree.value) {
    target.text(value);
  } else {
    subtree.value = text.length === 1 ? text : '?';
    stage.forceRefresh();
  }
}

const updateEtymology = (target, text, type) => {
  const value = text && text !== '?' ? text : undefined;
  if (value === stage.etymology[type]) {
    target.text(value || '?');
  } else {
    stage.etymology[type] = value;
    stage.forceRefresh();
  }
}

const updateRadicalValue = (target, text) => {
  const value = text && text !== '?' ? text : undefined;
  if (value === stage.radical) {
    target.text(value || '?');
  } else {
    stage.radical = value;
    stage.forceRefresh();
  }
}

// Methods for initializing different fields of the analysis.

const initializeDecompositionTree = (character) => {
  const data = cjklib.getCharacterData(character);
  return parseDecomposition(data.decomposition);
}

const initializeRadical = (character, components) => {
  if (cjklib.radicals.radical_to_index_map.hasOwnProperty(character)) {
    return character;
  }
  const data = cjklib.getCharacterData(character);
  if (data.kangxi_index) {
    const index = data.kangxi_index[0];
    const radicals = cjklib.radicals.index_to_radical_map[index];
    const included = radicals.filter((x) => components.indexOf(x) >= 0);
    return included.length === 1 ? included[0] : radicals.join('');
  }
  return undefined;
}

const initializeEtymology = (glyph, components) => {
  const data = cjklib.getCharacterData(glyph.character);
  const target = pinyin_util.dropTones(glyph.pinyin || data.pinyin || '');
  const phonetic_match = (component) => {
    const component_data = cjklib.getCharacterData(component);
    const attempt = pinyin_util.dropTones(component_data.pinyin || '');
    return attempt && attempt === target;
  }
  const phonetic = components.filter(phonetic_match);
  if (phonetic.length === 1) {
    const result = {type: 'pictophonetic', phonetic: phonetic[0]};
    const semantic = components.filter((x) => !phonetic_match(x));
    if (semantic.length === 1) {
      result.semantic = semantic[0];
    }
    return result;
  }
  return {type: 'ideographic'};
}

stages.analysis = class AnalysisStage extends stages.AbstractStage {
  constructor(glyph) {
    super('analysis');
    this.strokes = glyph.stages.strokes;
    this.tree = initializeDecompositionTree(glyph.character);
    const components = collectComponents(this.tree);
    this.radical = initializeRadical(glyph.character, components);
    this.etymology = initializeEtymology(glyph, components);
    stage = this;
    updateStatus();
  }
  getStageOutput() {
    return {
      decomposition: decomposition_util.convertTreeToDecomposition(this.tree),
      etymology: _.extend({}, this.etymology),
      radical: this.radical,
    }
  }
  refreshUI() {
    const to_path = (x) => ({d: x, fill: 'gray', stroke: 'gray'});
    Session.set('stage.paths', this.strokes.map(to_path));
    Session.set('stages.analysis.tree', this.tree);
    Session.set('stages.analysis.radical', this.radical);
    Session.set('stages.analysis.etymology', this.etymology);
  }
}

Template.analysis_stage.events({
  'keypress .value': function(event) {
    if (event.which === 13 /* \n */) {
      $(event.target).trigger('blur');
      event.preventDefault();
    }
    event.stopPropagation();
  },
  'blur .value': function(event) {
    // This line is not needed for correctness, so we ignore any errors in it.
    try { window.getSelection().removeAllRanges(); } catch (e) { }
    const target = $(event.target);
    const field = target.attr('data-field');
    const text = target.text();
    if (field === 'character') {
      updateCharacterValue(target, text, this.path);
    } else if (field === 'radical') {
      updateRadicalValue(target, text);
    } else if (etymology_fields.indexOf(field) >= 0) {
      updateEtymology(target, text, field);
    } else {
      assert(false, `Unexpected editable field: ${field}`);
    }
  },
  'click .value': function(event) {
    if ($(event.target).text().length !== 1) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(event.target);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  },
  'click .link': function(event) {
    window.location.hash = $(event.target).attr('data-value');
  },
  'change .compound-type': function(event) {
    const type = $(event.target).val();
    const subtree = getSubtree(stage.tree, this.path);
    if (type === subtree.value || subtree.type != 'compound') {
      return;
    }
    subtree.value = type;
    fixSubtreeChildrenLength(subtree);
    stage.forceRefresh();
  },
  'change .etymology-type': function(event) {
    const type = $(event.target).val();
    etymology_fields.map((x) => delete stage.etymology[x]);
    stage.etymology.type = type;
    stage.forceRefresh();
  },
  'change .subtree-type': function(event) {
    const type = $(event.target).val();
    const subtree = getSubtree(stage.tree, this.path);
    setSubtreeType(subtree, type);
    stage.forceRefresh();
  },
});

Template.analysis_stage.helpers({
  decomposition_data: () => {
    return Session.get('stages.analysis.tree');
  },
  etymology_data: () => {
    const result = Session.get('stages.analysis.etymology');
    result.hint = result.hint || '?';
    if (result.type === 'pictophonetic') {
      result.phonetic = result.phonetic || '?';
      result.semantic = result.semantic || '?';
    }
    return result;
  },
  radical: () => {
    return Session.get('stages.analysis.radical') || '?';
  },
});

Template.tree.helpers({
  compounds: (value) => {
    return decomposition_util.ideograph_description_characters.map( (x) => ({
      compound: x,
      label: `${x} - ${decomposition_util.ids_data[x].label}`,
      value: value,
    }));
  },
  details: (character) => {
    const glyph = Glyphs.get(character);
    const data = cjklib.getCharacterData(character);
    let definition = glyph.metadata.definition || data.definition;
    let pinyin = glyph.metadata.pinyin || data.pinyin;
    let radical = '';
    if (cjklib.radicals.radical_to_index_map.hasOwnProperty(character)) {
      const index = cjklib.radicals.radical_to_index_map[character];
      const primary = cjklib.radicals.primary_radical[index];
      const variant = primary !== character;
      radical = `; ${variant ? 'variant of ' : ''}` +
                `Kangxi radical ${index} ${variant ? primary : ''}`;
      if (variant && Glyphs.get(primary)) {
        const glyph = Glyphs.get(primary);
        const data = cjklib.getCharacterData(primary);
        definition = definition || glyph.definition || data.definition;
        pinyin = pinyin || glyph.pinyin || data.pinyin;
      }
    }
    definition = definition || '(unknown)';
    return `${pinyin ? pinyin + ' - ' : ''}${definition}${radical}`;
  },
});

const updateStatus = () => {
  const components = collectComponents(Session.get('stages.analysis.tree'));
  const radical = Session.get('stages.analysis.radical');
  const missing = components.filter((x) => !Glyphs.findOne({character: x}));
  const log = [];
  if (missing.length === 0) {
    log.push({cls: 'success', message: 'All components available.'});
  } else {
    const error = `Missing components: ${missing.join(' ')}`;
    log.push({cls: 'error', message: error});
  }
  if (!radical || radical.length === 0) {
    log.push({cls: 'error', message: 'No radical selected.'});
  } else if (radical.length > 1) {
    log.push({cls: 'error', message: 'Multiple radicals selected.'});
  } else if (components.indexOf(radical) >= 0) {
    log.push({cls: 'success',
              message: `Radical ${radical} found in decomposition.`});
  }
  const nonradicals = (Array.from(radical || '')).filter(
      (x) => !cjklib.radicals.radical_to_index_map.hasOwnProperty(x));
  if (nonradicals.length > 0) {
    log.push({cls: 'error', message: 'Radical field includes non-radicals: ' +
                                     nonradicals.join(' ')});
  }
  if (stage && stage.type === 'analysis') {
    Session.set('stage.status', log);
  }
}

// We need to add the setTimeout here because client/lib is loaded before lib.
// TODO(skishore): Find a better way to handle this load-order issue.
Meteor.startup(() => Meteor.setTimeout(() => {
  Tracker.autorun(updateStatus);
  cjklib.promise.then(() => Tracker.autorun(() => {
    const components = collectComponents(Session.get('stages.analysis.tree'));
    for (let component of [].concat(components)) {
      if (cjklib.radicals.radical_to_index_map.hasOwnProperty(component)) {
        const index = cjklib.radicals.radical_to_index_map[component];
        const primary = cjklib.radicals.primary_radical[index]
        if (primary !== component) {
          components.push(primary);
        }
      }
    }
    Meteor.subscribe('getAllGlyphs', components);
  })).catch(console.error.bind(console));
}, 0));
