let views = [];

class Popup {
  static hide(timeout) {
    const popup = $('.popup-container');
    popup.addClass('popup-hidden').removeClass('active');
    Meteor.setTimeout(() => {
      $('body').removeClass('popup-open');
      views.map(Blaze.remove);
      views.length = 0;
    }, timeout);
  }
  static show(options) {
    const buttons = (options.buttons || []).map((button, i) => ({
      index: i,
      text: button.text,
      type: button.type,
    }));
    const data = {
      buttons: buttons,
      template: options.template,
      title: options.title,
    };

    const element = $('body')[0];
    const view = Blaze.renderWithData(Template.popup, data, element);
    const backdrop = $(view.firstNode());
    backdrop.addClass('active visible');
    const popup = backdrop.find('.popup-container');
    popup.addClass('active popup-showing');

    $('body').addClass('popup-open');
    views.push(view);
  }
}

Template.popup.events({
  'click .popup': (event) => event.stopPropagation(),
  'click .popup-container': () => Popup.hide(50),
});

export {Popup};
