const Corrections = new Meteor.Collection('corrections');
const Handwriting = new Meteor.Collection('handwriting');

const Character = Match.Where((x) => {
  check(x, String);
  return x.length === 1;
});

Meteor.methods({
  recordHandwriting: (strokes, candidates, click) => {
    // Check that strokes is a list of lists of pairs of integers.
    check(strokes, [[Match.Where((x) => {
      check(x[0], Match.Integer);
      check(x[1], Match.Integer);
      return x.length === 2;
    })]]);
    check(candidates, [Character]);
    check(click, Character);
    Handwriting.insert({
      strokes: strokes,
      candidates: candidates,
      click: click,
    });
  },
  reportError: (character, description) => {
    check(character, Character);
    check(description, String);
    check(description, Match.Where((x) => x.length > 0));
    Corrections.insert({character: character, description: description});
  },
});
