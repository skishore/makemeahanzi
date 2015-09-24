"use strict";

Meteor.publish('index', Glyphs.findGlyphsForRadical);
