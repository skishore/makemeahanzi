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

// Set up the routing table and transitioner.

Router.configure({layoutTemplate: 'layout'});
Router.route('index', {path: '/'});
['help', 'lists', 'settings', 'teach'].map((x) => Router.route(x));

Transitioner.default({in: 'transition.fadeIn', out: 'transition.fadeOut'});

// Set up global template helpers.

Platform.isAndroid = () => false;
Platform.isIOS = () => true;

Session.setDefault('theme', 'textured');

Template.registerHelper('theme', () => Session.get('theme'));
