Handlebars.registerHelper('selected', (current, value) =>
  ({value: value, selected: current === value ? 'selected' : undefined}));

Handlebars.registerHelper('equals', (a, b) => a === b);

Handlebars.registerHelper('editable', (field, value) =>
  `<div class="value" contenteditable="true" ` +
       `data-field="${field}">${value}</div>`);

Template.body.events({
  'click div.value[contenteditable="true"]': function(event) {
    if ($(event.target).text().length !== 1) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(event.target);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  },
  'keypress div.value[contenteditable="true"]': function(event) {
    if (event.which === 13 /* \n */) {
      $(event.target).trigger('blur');
      event.preventDefault();
    }
    event.stopPropagation();
  },
});
