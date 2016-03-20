// Simple helpers for interacting with reactive variables.

ReactiveVar.prototype.pop = function() {
  const value = this.get();
  value.pop();
  this.set(value);
}

ReactiveVar.prototype.push = function(element) {
  const value = this.get();
  value.push(element);
  this.set(value);
}

// Our hacky implementation of a routing table. Iron Router is too slow...

Session.setDefault('route', null);

Handlebars.registerHelper('route', () => Session.get('route'));

const hashchange = () => {
  const hash = window.location.hash;
  if (hash.startsWith('#/codepoint/')) {
    Session.set('route', 'character');
  } else if (hash.startsWith('#/teach/')) {
    Session.set('route', 'teach');
  } else {
    Session.set('route', 'search');
  }
}

window.addEventListener('hashchange', hashchange, false);
Meteor.startup(hashchange);
