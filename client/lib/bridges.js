"use strict";

const bridgeKey = (bridge) => bridge.map(Point.key).join('-');

const removeBridge = (bridges, bridge) => {
  const keys = {};
  keys[bridgeKey(bridge)] = true;
  keys[bridgeKey(bridge.reverse())] = true;
  return bridges.filter((bridge) => !keys[bridgeKey(bridge)]);
}

stages.bridges = class BridgesStage extends stages.AbstractStage {
  constructor(glyph) {
    super();
    Session.set('stage.type', 'bridges');
    Session.set('stage.instructions',
                'Connect each pair of points on the glyph outline such that ' +
                'the segment connecting those points is part of some stroke ' +
                'outline. Click on a bridge to drop it.');
    const bridges = stroke_extractor.getBridges(glyph);
    this.bridges = bridges.bridges;
    this.endpoints = [];
    bridges.endpoints.map(
        (path) => this.endpoints = this.endpoints.concat(path));
    this.selected_point = undefined;
    glyph.stages.strokes = glyph.stages.strokes || this.bridges;
  }
  handleClickOnBridge(glyph, bridge) {
    glyph.stages.bridges = removeBridge(glyph.stages.bridges, bridge);
    Session.set('editor.glyph', glyph);
  }
  handleClickOnPoint(glyph, point) {
    if (this.selected_point === undefined) {
      this.selected_point = point;
      this.refresh(glyph);
      return;
    } else if (Point.equal(point, this.selected_point)) {
      this.selected_point = undefined;
      this.refresh(glyph);
      return;
    }
    const bridge = [point, this.selected_point];
    this.selected_point = undefined;
    const without = removeBridge(glyph.stages.bridges, bridge);
    if (without.length < glyph.stages.bridges.length) {
      this.refresh(glyph);
      return;
    }
    glyph.stages.bridges.push(bridge);
    Session.set('editor.glyph', glyph);
  }
  handleEvent(glyph, event, template) {
    if (template.x1 !== undefined) {
      this.handleClickOnBridge(
          glyph, [[template.x1, template.y1], [template.x2, template.y2]]);
    } else if (template.cx !== undefined) {
      this.handleClickOnPoint(glyph, [template.cx, template.cy]);
    }
  }
  refresh(glyph) {
    Session.set('stage.paths',
                [{d: glyph.stages.path, fill: 'gray', stroke: 'gray'}]);
    const keys = {};
    this.bridges.map((bridge) => {
      keys[bridgeKey(bridge)] = true;
      keys[bridgeKey(bridge.reverse())] = true;
    });
    Session.set('stage.lines', glyph.stages.bridges.map((bridge) => ({
      cls: 'selectable',
      stroke: keys[bridgeKey(bridge)] ? 'red' : 'purple',
      x1: bridge[0][0],
      y1: bridge[0][1],
      x2: bridge[1][0],
      y2: bridge[1][1],
    })));
    Session.set('stage.points', this.endpoints.map((endpoint) => {
      let color = endpoint.corner ? 'red' : 'black';
      if (this.selected_point &&
          Point.equal(endpoint.point, this.selected_point)) {
        color = 'purple';
      }
      return {
        cls: 'selectable',
        cx: endpoint.point[0],
        cy: endpoint.point[1],
        fill: color,
        stroke: color,
      }
    }));
    const strokes = stroke_extractor.getStrokes(glyph);
    const n = strokes.strokes.length;
    const message = `Extracted ${n} stroke${n == 1 ? '' : 's'}.`;
    Session.set('stage.status', strokes.log.concat([{message: message}]));
  }
}
