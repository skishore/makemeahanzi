Session.setDefault('settings.double_tap_speed', 500);
Session.setDefault('settings.paper_filter', true);
Session.setDefault('settings.reveal_mode', 'guide');
Session.setDefault('settings.snap_strokes', true);

Template.settings.helpers({
  getRevealModes: () => [
    {label: 'Guide', value: 'guide'},
    {label: 'Show', value: 'show'},
    {label: 'Fade', value: 'fade'},
  ],
});
