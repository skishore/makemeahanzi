import {AbstractStage} from '/client/lib/abstract';
import {Point} from '/lib/base';
import {stroke_extractor} from '/lib/stroke_extractor';

const bridgeKey = (bridge) => bridge.map(Point.key).join('-');

const removeBridge = (bridges, bridge) => {
  const keys = {};
  keys[bridgeKey(bridge)] = true;
  keys[bridgeKey([bridge[1], bridge[0]])] = true;
  return bridges.filter((bridge) => !keys[bridgeKey(bridge)]);
}

class BridgesStage extends AbstractStage {
  constructor(glyph) {
    super('bridges');
    const bridges = stroke_extractor.getBridges(glyph.stages.path);
    this.original = bridges.bridges;
    this.adjusted = glyph.stages.bridges || this.original;
    this.endpoints = bridges.endpoints.reduce((x, y) => x.concat(y), []);
    this.path = glyph.stages.path;
    this.selected_point = undefined;
  }
  handleClickOnBridge(bridge) {
    this.adjusted = removeBridge(this.adjusted, bridge);
  }
  handleClickOnPoint(point) {
    if (this.selected_point === undefined) {
      this.selected_point = point;
      return;
    } else if (Point.equal(point, this.selected_point)) {
      this.selected_point = undefined;
      return;
    }
    const bridge = [point, this.selected_point];
    this.selected_point = undefined;
    const without = removeBridge(this.adjusted, bridge);
    if (without.length < this.adjusted.length) {
      return;
    }
    this.adjusted.push(bridge);
  }
  handleEvent(event, template) {
    if (template.x1 !== undefined) {
      const bridge = [[template.x1, template.y1], [template.x2, template.y2]];
      this.handleClickOnBridge(bridge);
    } else if (template.cx !== undefined) {
      this.handleClickOnPoint([template.cx, template.cy]);
    }
  }
  refreshUI() {
    Session.set('stage.paths', [{d: this.path, fill: 'gray', stroke: 'gray'}]);
    const keys = {};
    this.original.map((bridge) => {
      keys[bridgeKey(bridge)] = true;
      keys[bridgeKey([bridge[1], bridge[0]])] = true;
    });
    Session.set('stage.lines', this.adjusted.map((bridge) => ({
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
    const strokes = stroke_extractor.getStrokes(this.path, this.adjusted);
    const n = strokes.strokes.length;
    const message = `Extracted ${n} stroke${n == 1 ? '' : 's'}.`;
    const entry = {cls: 'success', message: message};
    Session.set('stage.status', strokes.log.concat([entry]));
  }
}

export {BridgesStage};
