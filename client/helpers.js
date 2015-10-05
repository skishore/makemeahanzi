Handlebars.registerHelper('selected', (current, value) =>
  ({value: value, selected: current === value ? 'selected' : undefined}));

Handlebars.registerHelper('equals', (a, b) => a === b);
