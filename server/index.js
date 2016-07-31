import {Glyphs} from '/lib/glyphs';

Meteor.publish('index', Glyphs.findGlyphsForRadical);
