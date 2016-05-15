// Schema: settings is a key-value store with records containing:
//  - key: string
//  - value: any
const settings = new Ground.Collection('settings', {connection: null});

class Settings {
  static get(key) {
    const record = settings.findOne({key: key});
    return record ? record.value : undefined;
  }
  static set(key, value) {
    settings.upsert({key: key}, {$set: {key: key, value: value}});
  }
  static setDefault(key, value) {
    settings.upsert({key: key}, {$setOnInsert: {key: key, value: value}});
  }
}

Meteor.startup(() => Tracker.autorun(() => {
  if (Meteor.isClient && Ground.ready()) {
    Settings.setDefault('settings.double_tap_speed', 500);
    Settings.setDefault('settings.paper_filter', true);
    Settings.setDefault('settings.reveal_order', true);
    Settings.setDefault('settings.snap_strokes', true);
  }
}));

export {Settings};
