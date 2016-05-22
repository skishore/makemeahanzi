const characters = {};

const groups = [
  {
    label: 'Hanyu Shuiping Kaoshi',
    lists: [
      {label: 'HSK Level 1', list: 'nhsk1'},
      {label: 'HSK Level 2', list: 'nhsk2'},
      {label: 'HSK Level 3', list: 'nhsk3'},
      {label: 'HSK Level 4', list: 'nhsk4'},
      {label: 'HSK Level 5', list: 'nhsk5'},
      {label: 'HSK Level 6', list: 'nhsk6'},
    ],
  },
];

$.get('characters/all.txt', (data, code) => {
  if (code !== 'success') throw new Error(code);
  for (let character of data) characters[character] = true;
});

Template.lists.helpers({groups: () => groups});
