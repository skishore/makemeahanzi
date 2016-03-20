const character = new ReactiveVar();
const definition = new ReactiveVar();
const pinyin = new ReactiveVar();
const zoom = new ReactiveVar(1);

let handwriting = null;

const onRendered = function() {
  zoom.set(this.getZoom());
  const element = $(this.firstNode).find('.handwriting');
  handwriting = new makemeahanzi.Handwriting(element, (() => _), zoom.get());
}

const updateCharacter = () => {
  makemeahanzi.lookupCharacter(character.get(), (row) => {
    if (row.character === character.get()) {
      definition.set(row.definition);
      pinyin.set(row.pinyin.join(', '));
    }
  });
}

// Meteor template bindings.

Template.teach.helpers({
  zoom: () => zoom.get(),
});

Template.teach.onRendered(onRendered);

Meteor.startup(() => Deps.autorun(updateCharacter));
