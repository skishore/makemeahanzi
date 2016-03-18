// Helper methods used by the handwriting class.

const kCrossWidth = 2;
const kMinWidth = 8;
const kMaxWidth = 12;
const kOffset = 8;
const kPositiveDecay = 4;
const kNegativeDecay = 64;

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
  constructor(element, callback, zoom) {
    this._callback = callback;
    this._zoom = zoom;

    createSketch(element, this);
    this._container = new createjs.Container();
    this._stage = new createjs.Stage(element.find('canvas')[0]);

    renderCross(this._stage);
    this._stage.addChild(this._container);
    this._reset();
  }
  clear() {
    this._container.removeAllChildren();
    this._reset();
  }
  undo() {
    this._container.removeChildAt(this._container.children.length - 1);
    this._reset();
  }
  _distance(point1, point2) {
    const diagonal = this._stage.canvas.width * this._stage.canvas.width +
                     this._stage.canvas.height * this._stage.canvas.height;
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
      this._callback(this._stroke);
      this._shape.cache(0, 0, this._stage.canvas.width,
                        this._stage.canvas.height);
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
