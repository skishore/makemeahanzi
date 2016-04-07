// Helper methods used by the handwriting class.
//
// TODO(skishore): Make the success fanfare more appealing.

const kCrossWidth = 2;
const kMinWidth = 8;
const kMaxWidth = 16;
const kOffset = 10;
const kMinDistance = 1 / 32;
const kPositiveDecay = 8;
const kNegativeDecay = 64;

const angle = (xs) => Math.atan2(xs[1][1] - xs[0][1], xs[1][0] - xs[0][0]);

const animate = (shape, size, rotate, source, target) => {
  shape.regX = size * (target[0][0] + target[1][0]) / 2;
  shape.regY = size * (target[0][1] + target[1][1]) / 2;
  shape.x = size * (source[0][0] + source[1][0]) / 2;
  shape.y = size * (source[0][1] + source[1][1]) / 2;
  const scale = distance(source) / (distance(target) + kMinDistance);
  shape.scaleX = scale;
  shape.scaleY = scale;
  if (rotate) {
    const rotation = (180 / Math.PI) * (angle(source) - angle(target));
    shape.rotation = ((Math.round(rotation) + 180) % 360) - 180;
  }
  return {rotation: 0, scaleX: 1, scaleY: 1, x: shape.regX, y: shape.regY};
}

const createSketch = (element, handwriting) => {
  let mousedown = false;
  Sketch.create({
    container: element[0],
    autoclear: false,
    fullscreen: false,
    width: element.width(),
    height: element.height(),
    mousedown(e) {
      mousedown = true;
      handwriting._pushPoint([e.x, e.y]);
    },
    mouseup(e) {
      mousedown = false;
      handwriting._endStroke();
    },
    touchmove() {
      if (mousedown && this.touches.length > 0) {
        const touch = this.touches[0];
        handwriting._maybePushPoint([touch.ox, touch.oy]);
        handwriting._pushPoint([touch.x, touch.y]);
      }
    }
  });
}

const distance = (xs) => {
  const diff = [xs[1][0] - xs[0][0], xs[1][1] - xs[0][1]];
  return Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1]);
}

const dottedLine = (x1, y1, x2, y2) => {
  const result = new createjs.Shape();
  result.graphics.setStrokeDash([kCrossWidth, kCrossWidth], 0);
  result.graphics.setStrokeStyle(kCrossWidth)
  result.graphics.beginStroke('#ccc');
  result.graphics.moveTo(x1, y1);
  result.graphics.lineTo(x2, y2);
  return result;
}

const midpoint = (point1, point2) => {
  return [(point1[0] + point2[0]) / 2, (point1[1] + point2[1]) / 2];
}

const pathToShape = (path, size, color) => {
  const scale = 1024 / size;
  const result = new createjs.Shape();
  const graphics = result.graphics;
  result.graphics.beginFill(color || 'black');
  const tokens = path.split(' ');
  let index = 0;
  const next = () => {
    index += 2;
    let result = [tokens[index - 2], tokens[index - 1]];
    result = result.map((x) => parseInt(x, 10));
    result[1] = 900 - result[1];
    return result.map((x) => Math.round(x / scale));
  }
  while (index < tokens.length - 2) {
    index += 1;
    const command = tokens[index - 1];
    const point = next();
    if (command === 'M') {
      graphics.moveTo(point[0], point[1]);
    } else if (command === 'L') {
      graphics.lineTo(point[0], point[1]);
    } else if (command === 'Q') {
      const end = next();
      graphics.curveTo(point[0], point[1], end[0], end[1]);
    } else {
      console.error(`Invalid command: ${command}`);
    }
  }
  return result;
}

const renderCross = (stage) => {
  const cross = new createjs.Container();
  const height = stage.canvas.height;
  const width = stage.canvas.width;
  cross.addChild(dottedLine(0, 0, width, height));
  cross.addChild(dottedLine(width, 0, 0, height));
  cross.addChild(dottedLine(width / 2, 0, width / 2, height));
  cross.addChild(dottedLine(0, height / 2, width, height / 2));
  cross.cache(0, 0, width, height);
  stage.addChild(cross);
}

// Methods for actually executing drawing commands.

this.makemeahanzi.Handwriting = class Handwriting {
  constructor(element, options) {
    this._onclick = options.onclick;
    this._onstroke = options.onstroke;
    this._zoom = options.zoom || 1;

    createSketch(element, this);
    this._animation = new createjs.Container();
    this._container = new createjs.Container();
    this._stage = new createjs.Stage(element.find('canvas')[0]);
    this._size = this._stage.canvas.width;

    renderCross(this._stage);
    this._stage.addChild(this._animation, this._container);
    this._reset();

    createjs.Ticker.setFPS(60);
    createjs.Ticker.removeAllEventListeners();
    createjs.Ticker.addEventListener('tick', this._stage);
  }
  clear() {
    createjs.Tween.removeAllTweens();
    this._animation.removeAllChildren();
    this._container.removeAllChildren();
    this._reset();
  }
  emplace(path, rotate, source, target) {
    const child = pathToShape(path, this._size);
    const endpoint = animate(child, this._size, rotate, source, target);
    this._container.removeChildAt(this._container.children.length - 1);
    this._animation.addChild(child);
    createjs.Tween.get(child).to(endpoint, 200)
                  .call(() => child.cache(0, 0, this._size, this._size));
  }
  fade() {
    const children = this._container.children;
    const child = children[children.length - 1];
    this._container.removeChildAt(children.length - 1);
    this._animation.addChild(child);
    createjs.Tween.get(child).to({alpha: 0}, 200)
                  .call(() => this._animation.removeChild(child));
  }
  flash(path) {
    const child = pathToShape(path, this._size, 'blue');
    this._container.removeChildAt(this._container.children.length - 1);
    this._animation.addChild(child);
    createjs.Tween.get(child).to({alpha: 0}, 800)
                  .call(() => this._animation.removeChild(child));
  }
  glow() {
    for (let child of this._animation.children) {
      child.shadow = new createjs.Shadow('#4f0', 0, 0, 64);
    }
  }
  undo() {
    this._container.removeChildAt(this._container.children.length - 1);
    this._reset();
  }
  _distance(point1, point2) {
    const diagonal = 2 * this._size * this._size;
    const diff = [point1[0] - point2[0], point1[1] - point2[1]];
    return (diff[0] * diff[0] + diff[1] * diff[1]) / diagonal;
  }
  _draw(point1, point2, control) {
    const graphics = this._shape.graphics;
    graphics.setStrokeStyle(this._width, 'round');
    graphics.beginStroke('black');
    graphics.moveTo(point1[0], point1[1]);
    if (control) {
      graphics.curveTo(control[0], control[1], point2[0], point2[1]);
    } else {
      graphics.lineTo(point2[0], point2[1]);
    }
    this._stage.update();
  }
  _endStroke() {
    if (this._shape) {
      this._shape.cache(0, 0, this._size, this._size);
      if (this._onstroke) {
        this._onstroke(this._stroke.map((x) => x.map((y) => y / this._size)));
      }
    } else if (this._onclick) {
      this._onclick();
    }
    this._reset();
  }
  _maybePushPoint(point) {
    if (this._stroke.length === 0) {
      this._pushPoint(point);
    }
  }
  _pushPoint(point) {
    if (point[0] != null && point[1] != null) {
      this._stroke.push(point.map((x) => Math.round(x / this._zoom)));
      this._refresh();
    }
  }
  _refresh() {
    if (this._stroke.length < 2) {
      return;
    }
    const i = this._stroke.length - 2;
    const last = this._midpoint;
    this._midpoint = midpoint(this._stroke[i], this._stroke[i + 1]);
    if (this._shape) {
      this._updateWidth(this._distance(this._stroke[i], this._stroke[i + 1]));
      this._draw(last, this._midpoint, this._stroke[i]);
    } else {
      this._shape = new createjs.Shape();
      this._container.addChild(this._shape);
      this._draw(this._stroke[i], this._midpoint);
    }
  }
  _reset() {
    this._midpoint = null;
    this._shape = null;
    this._stroke = [];
    this._width = kMaxWidth;
    this._stage.update();
  }
  _updateWidth(distance) {
    if (distance <= 0) return;
    let offset = (Math.log(distance) + kOffset);
    offset /= (offset > 0 ? kPositiveDecay : kNegativeDecay);
    this._width = Math.max(Math.min(
        this._width - offset, kMaxWidth), kMinWidth);
  }
}
