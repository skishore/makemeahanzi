const groups = [
  {
    label: 'Hanyu Shuiping Kaoshi',
    lists: [
      {label: 'HSK Level 1', list: 'New HSK Level 1'},
      {label: 'HSK Level 2', list: 'New HSK Level 2'},
      {label: 'HSK Level 3', list: 'New HSK Level 3'},
      {label: 'HSK Level 4', list: 'New HSK Level 4'},
      {label: 'HSK Level 5', list: 'New HSK Level 5'},
      {label: 'HSK Level 6', list: 'New HSK Level 6'},
    ],
  },
];

const variables = {};
for (let group of groups) {
  for (let list of group.lists) {
    const variable = 'lists.' + list.list.replace(/ /g, '_').toLowerCase();
    if (variables[variable]) throw new Error(`Duplicate list: ${variable}`);
    list.variable = variable;
  }
}

Template.lists.helpers({groups: () => groups});
