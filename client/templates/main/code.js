// Simple helpers for interacting with reactive variables.
import {Settings} from '/model/settings';
import {Timing} from '/model/timing';

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
Router.route('teach', {
  onStop() {
    const card = Timing.getNextCard();
    if (card && card.deck !== 'errors') Timing.shuffle();
  },
});
['credits', 'help', 'lists', 'settings', 'stats'].map((x) => Router.route(x));

Transitioner.default({in: 'transition.fadeIn', out: 'transition.fadeOut'});

// Set up global template helpers.

Platform.isAndroid = () => false;
Platform.isIOS = () => true;

Template.layout.helpers({
  remainder: () => {
    const x = Timing.getRemainder();
    let left = '' + (x ? x.adds + x.extras + x.reviews : '?');
    if (Settings.get('settings.revisit_failures')) {
      left += ' + ' + (x ? x.failures : '?');
    }
    return left;
  },
  theme: () => {
    return Settings.get('settings.paper_filter') ? 'textured' : 'painterly';
  },
  time: () => {
    const time = Timing.getTimeLeft();
    if (time === undefined) return '?:?';
    const pad = (value) => value.length < 2 ? '0' + value : value;
    return [
      Math.floor(time / 3600),
      pad('' + (Math.floor(time / 60) % 60)),
    ].join(':');
  }
});
