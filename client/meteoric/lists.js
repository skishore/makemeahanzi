// TODO(skishore): The list logic should go in the model, not here.
import {Settings} from '../../model/settings';
import {Vocabulary} from '../../model/vocabulary';
import {Backdrop} from './backdrop';

const kBackdropTimeout = 500;

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

groups.map((x) => x.lists.map((y) => y.variable = `lists.${y.list}`));

const enableList = (list, callback) => {
  Backdrop.show();
  $.get(`lists/${list}.list`, (data, code) => {
    if (code !== 'success') {
      Backdrop.hide(kBackdropTimeout);
      throw new Error(code);
    }
    data.split('\n').map((row) => {
      const columns = row.split('\t');
      if (columns.length !== 5) return;
      if (columns[0].length !== 1) return;
      Vocabulary.addItem(columns[0], list);
    });
    callback();
    Backdrop.hide(kBackdropTimeout);
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

$.get('characters/all.txt', (data, code) => {
  if (code !== 'success') throw new Error(code);
  for (let character of data) characters[character] = true;
});

Template.lists.helpers({groups: () => groups});

export {toggleListState};
