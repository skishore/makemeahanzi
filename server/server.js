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
  reportIssue: (charDataString, description, strokeData) => {
    check(charDataString, String);
    check(description, String);

    strokeData = strokeData || [];
    check(strokeData, [Match.Where((x) => {
      check(x, Tuple(String, Match.Any));
      if (x[0] === 'user') {
        check(x[1], Stroke);
        return true;
      } else if (x[0] === 'match') {
        check(x[1], Match.Integer);
        return true;
      }
      return false;
    })]);

    Issues.insert({
      charDataString: charDataString,
      description: description,
      strokeData: strokeData
    });
  },
});
