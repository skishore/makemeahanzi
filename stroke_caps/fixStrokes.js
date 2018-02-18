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

const getPossibleClipPoints = (pathString) => {
  const pointStringParts = pathString.match(/-?\d+(?:\.\d+)? -?\d+(?:\.\d+)? L/ig);
  if (!pointStringParts) return [];
  return pointStringParts.map(pointStringPart => {
    const fullPointStringRegex = new RegExp(`${pointStringPart} -?\\d+(?:\\.\\d+)? -?\\d+(?:\\.\\d+)?`);
    const pointString = pathString.match(fullPointStringRegex)[0];
    const parts = pointString.split(/\sL?\s?/).map(num => parseFloat(num));
    const clipPoints = [{x: parts[0], y: parts[1]}, {x: parts[2], y: parts[3]}];
    return {
      clipPoints,
      pointString,
    };
  });
};

const CLIP_THRESH = 2;
const COS_SIM_THRESH = 0.95;

const getCharClipData = (strokes) => {
  const outlines = strokes.map(stroke => getOutlinePoints(stroke));
  const clipData = {
    strokes,
    clipped: [],
  };

  strokes.forEach((stroke, i) => {
    const strokeOutline = outlines[i];
    const possibleClipPoints = getPossibleClipPoints(stroke);
    possibleClipPoints.forEach(clipPointData => {
      const clipPoints = clipPointData.clipPoints;
      // this clip point is super tiny, it's probably just a glitch, skip it
      if (dist(clipPoints[0], clipPoints[1]) < 1) return;
      const clipPoint = clipPointData.clipPoints;
      const cosSim0 = getCosSimAroundPoint(clipPoint[0], strokeOutline);
      const cosSim1 = getCosSimAroundPoint(clipPoint[1], strokeOutline);
      // The angle around this clip point is flat, skip it
      if (cosSim0 > COS_SIM_THRESH && cosSim1 > COS_SIM_THRESH) return;
      outlines.forEach((otherOutline, j) => {
        if (i === j) return;
        const dist0 = distToPath(clipPoint[0], otherOutline);
        const dist1 = distToPath(clipPoint[1], otherOutline);
        if (
          dist0 <= CLIP_THRESH && dist1 <= CLIP_THRESH
        ) {
          clipPointData.estTanPoints = estimateTanPoints(strokeOutline, clipPoints); // eslint-disable-line no-param-reassign
          // figure out if this stroke is clipped by 2 strokes
          let isDoubleClipped = false;
          clipData.clipped.forEach(existingData => {
            if (existingData.stroke === i && ptEq(existingData.at.clipPoints[1], clipPoints[0])) {
              isDoubleClipped = true;
              existingData.isDouble = true; // eslint-disable-line no-param-reassign
              existingData.clippedBy = [existingData.stroke, j]; // eslint-disable-line no-param-reassign
              existingData.middlePoint = clipPoints[0]; // eslint-disable-line no-param-reassign
              existingData.at.estTanPoints = [existingData.at.estTanPoints[0], clipPointData.estTanPoints[1]]; // eslint-disable-line no-param-reassign
              existingData.at.clipPoints = [existingData.at.clipPoints[0], clipPoints[1]]; // eslint-disable-line no-param-reassign
              existingData.pointString += clipPointData.pointString.replace(/.*L/, ' L'); // eslint-disable-line no-param-reassign
            }
          });
          if (!isDoubleClipped) {
            clipData.clipped.push({
              stroke: i,
              clippedBy: j,
              at: clipPointData,
            });
          }
        }
      });
    });
  });

  return clipData;
};

const getNewStrokeTip = (strokeClipData) => {
  const clipPointData = strokeClipData.at;
  const { clipPoints, estTanPoints } = clipPointData;
  const tanPoints = estTanPoints;
  const maxControlPoint = getLinesIntersectPoint(
    tanPoints[0],
    clipPoints[0],
    tanPoints[1],
    clipPoints[1],
  );

  const maxDistControl0 = dist(maxControlPoint, clipPoints[0]);
  const maxDistControl1 = dist(maxControlPoint, clipPoints[1]);
  let distControl0 = Math.min(maxDistControl0, 30);
  let distControl1 = Math.min(maxDistControl1, 30);

  if (strokeClipData.isDouble) {
    const midDist0 = dist(strokeClipData.middlePoint, clipPoints[0]);
    const midDist1 = dist(strokeClipData.middlePoint, clipPoints[1]);
    distControl0 = Math.max(midDist0 * 1.4, distControl0);
    distControl1 = Math.max(midDist1 * 1.4, distControl1);
  }


  const controlPoint0 = extendPointOnLine(tanPoints[0], clipPoints[0], distControl0);
  const controlPoint1 = extendPointOnLine(tanPoints[1], clipPoints[1], distControl1);

  const pString = point => `${Math.round(point.x)} ${Math.round(point.y)}`;

  return `${pString(clipPoints[0])} C ${pString(controlPoint0)} ${pString(controlPoint1)} ${pString(clipPoints[1])}`;
};

const fixStrokes = (strokes) => {
  const summary = {
    modified: false,
    hasDoubleClippedStroke: false,
    modifiedStrokes: [],
  };
  const fixedStrokes = strokes.slice(0);
  const charClipData = getCharClipData(strokes);
  charClipData.clipped.forEach(strokeClipData => {
    summary.modified = true;
    const clipPointData = strokeClipData.at;
    const strokeNum = strokeClipData.stroke;
    const newTip = getNewStrokeTip(strokeClipData);
    fixedStrokes[strokeNum] = roundPathPoints(fixedStrokes[strokeNum].replace(clipPointData.pointString, newTip));
    if (strokeClipData.isDouble) summary.hasDoubleClippedStroke = true;
    summary.modifiedStrokes.push(strokeNum);
  });
  summary.strokes = fixedStrokes;
  return summary;
};

module.exports = fixStrokes;
