import {Settings} from '../../model/settings';
import {Vocabulary} from '../../model/vocabulary';
import {Backdrop} from './backdrop';

const kBackdropTimeout = 500;
const kListColumns = ['word', '', '', 'pinyin', 'definition'];

const characters = {};

// TODO(skishore): The list metadata should go in the model, not here.
const groups = [
  {
    label: 'General',
    lists: [
      {label: '100 Common Radicals', list: '100cr'},
    ],
  },
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

const enableList = (list, callback) => {
  Backdrop.show();
  loadList(list).then((rows) => {
    rows.map((row) => {
      // TODO(skishore): Get multiple-character words working.
      if (row.word.length === 1) return;
      if (!_.all(row.word, (x) => characters[x])) return;
      Vocabulary.addItem(row.word, list);
    });
    Backdrop.hide(kBackdropTimeout);
    callback();
  }).catch((error) => {
    Backdrop.hide(kBackdropTimeout);
    console.error(error);
  });
}

const loadList = (list) => {
  return new Promise((resolve, reject) => {
    $.get(`lists/${list}.list`, (data, code) => {
      if (code !== 'success') throw new Error(code);
      const result = [];
      data.split('\n').map((line) => {
        const values = line.split('\t');
        if (values.length != kListColumns.length) return;
        const row = {};
        kListColumns.map((column, i) => {
          if (column !== '') row[column] = values[i];
        });
        result.push(row);
      });
      resolve(result);
    });
  });
}

const toggleListState = (list) => {
  const key = `lists.${list}`;
  const state = Settings.get(key);
  if (state) {
    Vocabulary.dropList(list);
    Settings.set(key, false);
  } else {
    enableList(list, () => Settings.set(key, true));
  }
}

// Meteor template helpers and one-time functions to prepare data follow.

$.get('characters/all.txt', (data, code) => {
  if (code !== 'success') throw new Error(code);
  for (let character of data) characters[character] = true;
});

groups.map((x) => x.lists.map((y) => y.variable = `lists.${y.list}`));

Template.lists.helpers({groups: () => groups});

export {loadList, toggleListState};
