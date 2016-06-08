const character = new ReactiveVar();
const transform = new ReactiveVar();

class Answer {
  static hide() {
    transform.set();
  }
  static show(c) {
    character.set(c);
    transform.set('translateY(0)');
  }
}

window.Answer = Answer;

Template.answer.helpers({
  character: () => character.get(),
  transform: () => transform.get(),
});
