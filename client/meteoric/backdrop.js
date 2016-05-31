let holds = 0;
let views = [];

const render = (template) => {
  const view = Blaze.renderWithData(template, {}, $('.ionic-body').get(0));
  const element = $(view.firstNode());
  element.addClass('active visible');
  return view;
}

class Backdrop {
  static hide(timeout) {
    holds -= 1;
    if (holds === 0) {
      Meteor.setTimeout(() => {
        views.map(Blaze.remove);
        views.length = 0;
      }, timeout);
    }
  }
  static show() {
    holds += 1;
    if (holds === 1) {
      views.push(render(Template.ionBackdrop));
      views.push(render(Template.ionLoading));
    }
  }
}

export {Backdrop};
