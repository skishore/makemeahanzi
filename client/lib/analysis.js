"use strict";

let stage = undefined;

const augmentTreeWithTemplateData = (tree, path) => {
  tree.path = path;
  const children = tree.children ? tree.children.length : 0;
  for (let i = 0; i < children; i++) {
    augmentTreeWithTemplateData(tree.children[i], path.concat([i]));
  }
  return tree;
}

const collectCharacters = (subtree, result) => {
  if (!subtree) {
    return [];
  }
  result = result || [];
  if (subtree.type === 'character' && subtree.value !== '?') {
    result.push(subtree.value);
  }
  for (let child of subtree.children || []) {
    collectCharacters(child, result);
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

const updateRadicalValue = (target, text) => {
  const value = text && text !== '?' ? text : undefined;
  if (value === stage.radical) {
    target.text(value || '?');
  } else {
    stage.radical = value;
    stage.forceRefresh();
  }
}

stages.analysis = class AnalysisStage extends stages.AbstractStage {
  constructor(glyph) {
    super('analysis');
    this.path = glyph.stages.path;
    const data = cjklib.getCharacterData(glyph.character);
    this.tree = parseDecomposition(data.decomposition);
    this.radical = undefined;
    if (cjklib.radicals.radical_to_index_map.hasOwnProperty(glyph.character)) {
      this.radical = glyph.character;
    } else if (data.kangxi_index) {
      const characters = collectCharacters(this.tree);
      const index = data.kangxi_index[0];
      const radicals = cjklib.radicals.index_to_radical_map[index];
      const included = radicals.filter((x) => characters.indexOf(x) >= 0);
      this.radical = included.length === 1 ? included[0] : radicals.join('');
    }
    this.etymology = {};
    stage = this;
    updateStatus();
  }
  refreshUI() {
    Session.set('stage.paths', [{d: this.path, fill: 'gray', stroke: 'gray'}]);
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
    result.type = result.type || 'ideographic';
    if (['ideographic', 'pictographic'].indexOf(result.type) >= 0) {
      result.value = result.value || '?';
    } else {
      result.phonetic = result.phonetic || '?';
      result.semantic = result.semantic || '?';
      result.sense = result.sense || '?';
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
  const characters = collectCharacters(Session.get('stages.analysis.tree'));
  const radical = Session.get('stages.analysis.radical');
  const missing = characters.filter((x) => !Glyphs.findOne({character: x}));
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
  } else if (characters.indexOf(radical) >= 0) {
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
    const characters = collectCharacters(Session.get('stages.analysis.tree'));
    for (let character of [].concat(characters)) {
      if (cjklib.radicals.radical_to_index_map.hasOwnProperty(character)) {
        const index = cjklib.radicals.radical_to_index_map[character];
        const primary = cjklib.radicals.primary_radical[index]
        if (primary !== character) {
          characters.push(primary);
        }
      }
    }
    Meteor.subscribe('getAllGlyphs', characters);
  })).catch(console.error.bind(console));
}, 0));
