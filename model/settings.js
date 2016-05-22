// Schema: settings is a key-value store with records containing:
//  - key: string
//  - value: any
const settings = new Ground.Collection('settings', {connection: null});

const defaults = {
  'settings.double_tap_speed': 500,
  'settings.paper_filter': true,
  'settings.reveal_order': true,
  'settings.snap_strokes': true,
};

class Settings {
  static get(key) {
    const record = settings.findOne({key: key});
    return record ? record.value : defaults[key];
  }
  static set(key, value) {
    settings.upsert({key: key}, {$set: {key: key, value: value}});
  }
}

export {Settings};
