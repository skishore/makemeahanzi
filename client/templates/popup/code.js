const kDefaultOnClick = () => Popup.hide(50);

let on_backdrop_click = null;
let on_button_clicks = [];
let views = [];

class Popup {
  static hide(timeout) {
    const popup = $('.popup-container');
    popup.addClass('popup-hidden').removeClass('active');
    on_button_clicks.length = 0;
    Meteor.setTimeout(() => {
      $('body').removeClass('popup-open');
      views.map(Blaze.remove);
      views.length = 0;
    }, timeout);
  }
  static show(options) {
    const buttons = (options.buttons || []).map((button, i) => ({
      callback: button.callback || kDefaultOnClick,
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
    on_backdrop_click = options.on_backdrop_click || kDefaultOnClick;

    on_button_clicks.length = 0;
    views.map(Blaze.remove);
    views.length = 0;

    const element = $('body')[0];
    const view = Blaze.renderWithData(Template.popup, data, element);
    const backdrop = $(view.firstNode());
    backdrop.addClass('active visible');
    const popup = backdrop.find('.popup-container');
    popup.addClass('active popup-showing');

    $('body').addClass('popup-open');
    buttons.forEach((x, i) => on_button_clicks.push(x.callback));
    views.push(view);
  }
}

Template.popup.events({
  'click .popup': (event) => event.stopPropagation(),
  'click .popup-container': () => on_backdrop_click(),
  'click .popup > .popup-buttons > .button': function(event) {
    on_button_clicks[$(event.currentTarget).attr('data-index')]();
  },
});

export {Popup};
