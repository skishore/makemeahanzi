let holds = 0;
let view = null;

class Backdrop {
  static hide(timeout) {
    holds -= 1;
    if (holds === 0) {
      Meteor.setTimeout(() => {
        Blaze.remove(view);
      }, timeout);
    }
  }
  static show() {
    holds += 1;
    if (holds === 1) {
      view = Blaze.renderWithData(
          Template.ionBackdrop, {}, $('.ionic-body').get(0));
      const element = $(view.firstNode());
      element.addClass('active visible');
    }
  }
}

window.Backdrop = Backdrop;

export {Backdrop};
