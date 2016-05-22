import {Settings} from '../../model/settings';
import {toggleListState} from './lists';

Template.ionRange.events({
  'change input[type="range"]': function(event) {
    Settings.set(this.variable, parseInt(event.target.value, 10));
  },
});

Template.ionRange.helpers({
  get: (variable) => Settings.get(variable),
});

Template.ionSelect.events({
  'change select': function(event) {
    const target = event.target;
    Settings.set(this.variable, target.options[target.selectedIndex].value);
  },
});

Template.ionSelect.helpers({
  get: (variable, value) => {
    return Settings.get(variable) === value ? 'true' : undefined;
  },
});

Template.ionToggle.events({
  'change input[type="checkbox"]': function(event) {
    const prefix = 'lists.';
    if (this.variable.startsWith(prefix)) {
      toggleListState(this.variable.substr(prefix.length));
    } else {
      Settings.set(this.variable, event.target.checked);
    }
  }
});

Template.ionToggle.helpers({
  get: (variable) => Settings.get(variable) ? 'true' : undefined,
});
