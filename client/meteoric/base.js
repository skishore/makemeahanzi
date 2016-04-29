Template.ionRange.events({
  'change input[type="range"]': function(event) {
    Session.set(this.variable, parseInt(event.target.value, 10));
  },
});

Template.ionRange.helpers({
  get: (variable) => Session.get(variable),
});

Template.ionSelect.events({
  'change select': function(event) {
    const target = event.target;
    Session.set(this.variable, target.options[target.selectedIndex].value);
  },
});

Template.ionSelect.helpers({
  get: (variable, value) => {
    return Session.get(variable) === value ? 'true' : undefined;
  },
});

Template.ionToggle.events({
  'change input[type="checkbox"]': function(event) {
    Session.set(this.variable, event.target.checked);
  }
});

Template.ionToggle.helpers({
  get: (variable) => Session.get(variable) ? 'true' : undefined,
});
