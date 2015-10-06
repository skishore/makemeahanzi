Handlebars.registerHelper('selected', (current, value) =>
  ({value: value, selected: current === value ? 'selected' : undefined}));

Handlebars.registerHelper('equals', (a, b) => a === b);

Handlebars.registerHelper('editable', (field, value) =>
  `<div class="value" contenteditable="true" ` +
       `data-field="${field}">${value}</div>`);
