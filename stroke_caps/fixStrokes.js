const {
  distToPath,
  getCosSimAroundPoint,
  getLinesIntersectPoint,
  getOutlinePoints,
  extendPointOnLine,
  estimateTanPoints,
  roundPathPoints,
  ptEq,
  dist,
} = require('./utils');


CLIP_THRESH = 2;
LOWER_COS_SIM_THRESH = 0.89;
UPPER_COS_SIM_THRESH = 0.97;

// A bridge is a place in the pathstring where 2 strokes intersect. It can either be 1 stroke clipping
// another, or it can be strokes passing through each other. In the pathstring from makemeahanzi, any
// L # # in the pathstring is a 
class Bridge {
  constructor(points, pointString, stroke) {
    this.points = points;
    this.pointString = pointString;
    this.stroke = stroke;
    this.estTanPoints = estimateTanPoints(stroke.outline, points);
  }

  getClips() {
    // this clip point is super tiny, it's probably just a glitch, skip it
    if (dist(this.points[0], this.points[1]) < 3.1) return [];
    const cosSim0 = getCosSimAroundPoint(this.points[0], this.stroke.outline);
    const cosSim1 = getCosSimAroundPoint(this.points[1], this.stroke.outline);
    // If the angle around the bridge points looks flat, it's probably an intersection.
    if (Math.min(cosSim0, cosSim1) > LOWER_COS_SIM_THRESH && Math.max(cosSim0, cosSim1) > UPPER_COS_SIM_THRESH) {
      return [];
    }
    return this.stroke.character.strokes.filter(stroke => {
      if (stroke === this.stroke) return false;
      const dist0 = distToPath(this.points[0], stroke.outline);
      const dist1 = distToPath(this.points[1], stroke.outline);
      return dist0 <= CLIP_THRESH && dist1 <= CLIP_THRESH;
    }).map(clippingStroke => new Clip(this, clippingStroke));
  }
}

class Clip {
  constructor(bridge, clippingStroke) {
    this.points = bridge.points;
    this.estTanPoints = bridge.estTanPoints;
    this.pointString = bridge.pointString;
    this.clippedBy = [clippingStroke];
    this.isDouble = false;
  }

  canMerge(otherClip) {
    return ptEq(this.points[1], otherClip.points[0]);
  }

  mergeIntoDouble(otherClip) {
    this.isDouble = true;
    this.clippedBy = this.clippedBy.concat(otherClip.clippedBy);
    this.middlePoint = otherClip.points[0];
    this.points[1] = otherClip.points[1];
    this.estTanPoints[1] = otherClip.estTanPoints[1];
    this.pointString += otherClip.pointString.replace(/.*L/, ' L');
  }

  getNewStrokeTip() {
    const maxControlPoint = getLinesIntersectPoint(
      this.estTanPoints[0],
      this.points[0],
      this.estTanPoints[1],
      this.points[1],
    );

    const maxDistControl0 = dist(maxControlPoint, this.points[0]);
    const maxDistControl1 = dist(maxControlPoint, this.points[1]);
    let distControl0 = Math.min(maxDistControl0, 30);
    let distControl1 = Math.min(maxDistControl1, 30);

    // if the 2 lines are parallel, there will be no intersection point. Just use 30 in that case.
    if (isNaN(distControl0)) distControl0 = 30;
    if (isNaN(distControl1)) distControl1 = 30;

    if (this.isDouble) {
      const midDist0 = dist(this.middlePoint, this.points[0]);
      const midDist1 = dist(this.middlePoint, this.points[1]);
      distControl0 = Math.max(midDist0 * 1.4, distControl0);
      distControl1 = Math.max(midDist1 * 1.4, distControl1);
    }

    const controlPoint0 = extendPointOnLine(this.estTanPoints[0], this.points[0], distControl0);
    const controlPoint1 = extendPointOnLine(this.estTanPoints[1], this.points[1], distControl1);

    const pString = point => `${Math.round(point.x)} ${Math.round(point.y)}`;

    return `${pString(this.points[0])} C ${pString(controlPoint0)} ${pString(controlPoint1)} ${pString(this.points[1])}`;
  }
}

class Stroke {
  constructor(pathString, character, strokeNum) {
    this.pathString = pathString;
    this.outline = getOutlinePoints(pathString);
    this.character = character;
    this.strokeNum = strokeNum;
  }

  getBridges() {
    const pointStringParts = this.pathString.match(/-?\d+(?:\.\d+)? -?\d+(?:\.\d+)? L/ig);
    if (!pointStringParts) return [];
    return pointStringParts.map(pointStringPart => {
      const fullPointStringRegex = new RegExp(`${pointStringPart} -?\\d+(?:\\.\\d+)? -?\\d+(?:\\.\\d+)?`);
      const pointString = this.pathString.match(fullPointStringRegex)[0];
      const parts = pointString.split(/\sL?\s?/).map(num => parseFloat(num));
      const points = [{x: parts[0], y: parts[1]}, {x: parts[2], y: parts[3]}];
      return new Bridge(points, pointString, this);
    });
  }

  fixPathString() {
    const bridges = this.getBridges();
    let clips = [];
    bridges.forEach(bridge => {
      bridge.getClips().forEach(clip => {
        const lastClip = clips[clips.length - 1];
        if (lastClip && lastClip.canMerge(clip)) {
          lastClip.mergeIntoDouble(clip);
        } else {
          clips.push(clip);
        }
      });
    });

    let modifiedPathString = this.pathString;
    clips.forEach(clip => {
      const newTip = clip.getNewStrokeTip();
      modifiedPathString = roundPathPoints(modifiedPathString.replace(clip.pointString, newTip));
    });

    return {
      isModified: clips.length > 0,
      isDoubleClipped: !!clips.find(clip => clip.isDouble),
      pathString: modifiedPathString,
      strokeNum: this.strokeNum,
    };
  }
}

class Character {
  constructor(pathStrings) {
    this.strokes = pathStrings.map((path, i) => new Stroke(path, this, i));
  }
}

const fixStrokes = (strokePathStrings) => {
  const character = new Character(strokePathStrings);
  const fixedStrokesInfo = character.strokes.map(stroke => stroke.fixPathString());

  return {
    modified: !!fixedStrokesInfo.find(summary => summary.isModified),
    hasDoubleClippedStroke: !!fixedStrokesInfo.find(summary => summary.isDoubleClipped),
    modifiedStrokes: fixedStrokesInfo.filter(summary => summary.isModified).map(summary => summary.strokeNum),
    strokes: fixedStrokesInfo.map(summary => summary.pathString),
  };
};

module.exports = fixStrokes;
