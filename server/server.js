const Issues = new Meteor.Collection('issues');

function Tuple(...args) {
  return Match.Where((x) => {
    if (!(x instanceof Array))
      return false;
    if (x.length !== args.length)
      return false;
    for (let i = 0; i < args.length; i++)
      check(x[i], args[i]);
    return true;
  });
}

const Character = Match.Where((x) => {
  check(x, String);
  return x.length === 1;
});

const Stroke = [Tuple(Number, Number)]

Meteor.methods({
  reportIssue: (charData, description, strokeData) => {
    // TODO(zhaizhai): validate charData
    check(description, String);

    strokeData = strokeData || [];
    check(strokeData, [Tuple(Stroke, Match.Integer)]);

    Issues.insert({
      charData: charData,
      description: description,
      strokeData: strokeData
    });
  },
});
