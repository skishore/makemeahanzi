const defaultBackdropClick = () => Popup.hide(50);
let onBackdropClick = defaultBackdropClick;
let callbacks = [];
let views = [];

class Popup {
  static hide(timeout) {
    const popup = $('.popup-container');
    popup.addClass('popup-hidden').removeClass('active');
    callbacks.length = 0;
    Meteor.setTimeout(() => {
      $('body').removeClass('popup-open');
      views.map(Blaze.remove);
      views.length = 0;
    }, timeout);
  }
  static show(options) {
    const buttons = (options.buttons || []).map((button, i) => ({
      callback: button.callback,
      class: button.class,
      index: i,
      label: button.label,
    }));
    const data = {
      buttons: buttons,
      template: options.template,
      text: options.text,
      title: options.title,
    };
    onBackdropClick = options.onBackdropClick || defaultBackdropClick;

    callbacks.length = 0;
    views.map(Blaze.remove);
    views.length = 0;

    const element = $('body')[0];
    const view = Blaze.renderWithData(Template.popup, data, element);
    const backdrop = $(view.firstNode());
    backdrop.addClass('active visible');
    const popup = backdrop.find('.popup-container');
    popup.addClass('active popup-showing');

    $('body').addClass('popup-open');
    buttons.forEach((x, i) => callbacks.push(x.callback));
    views.push(view);
  }
}

Template.popup.events({
  'click .popup': (event) => event.stopPropagation(),
  'click .popup-container': () => onBackdropClick(),
  'click .popup > .popup-buttons > .button': function(event) {
    callbacks[$(event.currentTarget).attr('data-index')]();
  },
});

export {Popup};
