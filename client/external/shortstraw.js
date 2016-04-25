// ShortStrawJS, a javascript implementation
// http://www.lab4games.net/zz85/blog/2010/01/21/geeknotes-shortstrawjs-fast-and-simple-corner-detection/
//
// Derived heavily from the AS3 implementation of the ShortStraw Corner Finder (Wolin et al. 2008)
// by Felix Raab. 21 July 2009.
// http://www.betriebsraum.de/blog/2009/07/21/efficient-gesture-recognition-and-corner-finding-in-as3/
//
// Based on the paper ShortStraw: A Simple and Effective Corner Finder for Polylines
// http://srlweb.cs.tamu.edu/srlng_media/content/objects/object-1246294647-350817e4b0870da27e16472ed36475db/Wolin_SBIM08.pdf
//
// For comments on this JS port, email Joshua Koo (zz85nus @ gmail.com)
//
// Released under MIT license: http://www.opensource.org/licenses/mit-license.php
"use strict";

class Shortstraw {
  constructor() {
    this.DIAGONAL_INTERVAL = 100;
    this.STRAW_WINDOW = 3;
    this.MEDIAN_THRESHOLD = 0.95;
    this.LINE_THRESHOLDS = [0.95, 0.90, 0.80];
  }
  run(points) {
    points = points.map((x) => ({x: x[0], y: x[1]}));
    const spacing = this._determineResampleSpacing(points);
    const resampled = this._resamplePoints(points, spacing);
    const corners = this._getCorners(resampled);
    return corners.map((i) => [resampled[i].x, resampled[i].y]);
  }
  _addAcuteAngles(points, corners) {
    const temp = corners.slice();
    corners.length = 1;
    for (let i = 1; i < temp.length; i++) {
      let best_index = null;
      let best_angle = Math.PI / 2;
      const cutoff = Math.max(1, Math.round(0.1 * (temp[i] - temp[i - 1])));
      for (let j = temp[i - 1] + cutoff; j <= temp[i] - cutoff; j++) {
        const angle = Math.abs(this._getAngle(
            points, temp[i - 1], j, temp[i]));
        if (angle > best_angle) {
          best_angle = angle;
          best_index = j;
        }
      }
      if (best_index !== null) {
        corners.push(best_index);
      }
      corners.push(temp[i]);
    }
  }
  _determineResampleSpacing(points) {
    const box = this._getBoundingBox(points);
    const p1 = {x: box.x, y: box.y};
    const p2 = {x: box.x + box.w, y: box.y + box.h};
    const d = this._getDistance(p1, p2);
    return d / this.DIAGONAL_INTERVAL;
  }
  _getAngle(points, i, j, k) {
    const d1 = [points[j].x - points[i].x, points[j].y - points[i].y];
    const d2 = [points[k].x - points[j].x, points[k].y - points[j].y];
    const a1 = Math.atan2(d1[1], d1[0]);
    const a2 = Math.atan2(d2[1], d2[0]);
    const a = Math.abs(a2 - a1);
    if (a < -Math.PI) return a + 2 * Math.PI;
    if (a >= Math.PI) return a - 2 * Math.PI;
    return a;
  }
  _getBoundingBox(points) {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    points.map((point) => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });
    return {x: minX, y: minY, w: maxX - minX, h: maxY - minY};
  }
  _getCorners(points) {
    const corners = [0];
    const straws = new Array(points.length);
    const w = this.STRAW_WINDOW;
    for (let i = w; i < points.length - w; i++) {
      straws[i] = (this._getDistance(points[i - w], points[i + w]));
    }
    const t = this._median(straws) * this.MEDIAN_THRESHOLD;
    for (let i = w; i < points.length - w; i++) {
      if (straws[i] < t) {
        let localMin = Number.POSITIVE_INFINITY;
        let localMinIndex;
        while (i < straws.length && straws[i] < t) {
          if (straws[i] < localMin) {
            localMin = straws[i];
            localMinIndex = i;
          }
          i++;
        }
        corners.push(localMinIndex);
      }
    }
    corners.push(points.length - 1);
    this.LINE_THRESHOLDS.map((threshold) => {
      this._postProcessCorners(points, corners, straws, threshold);
    });
    this._addAcuteAngles(points, corners);
    return corners;
  }
  _getDistance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  _halfwayCorner(straws, a, b) {
    const quarter = (b - a) / 4;
    let minValue = Number.POSITIVE_INFINITY;
    let minIndex;
    for (var i = a + quarter; i < (b - quarter); i++) {
      if (straws[i] < minValue) {
        minValue = straws[i];
        minIndex = i;
      }
    }
    return minIndex;
  }
  _isLine(points, a, b, threshold) {
    const distance = this._getDistance(points[a], points[b]);
    const pathDistance = this._pathDistance(points, a, b);
    return (distance / pathDistance) > threshold;
  }
  _median(values) {
    const sorted = values.concat().sort();
    const i = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[i - 1] + sorted[i]) / 2;
    }
    return sorted[i];
  }
  _pathDistance(points, a, b) {
    let d = 0;
    for (let i = a; i < b; i++) {
      d += this._getDistance(points[i], points[i + 1]);
    }
    return d;
  }
  _postProcessCorners(points, corners, straws, threshold) {
    let go = false;
    let c1, c2;
    while (!go) {
      go = true;
      for (let i = 1; i < corners.length; i++) {
        c1 = corners[i - 1];
        c2 = corners[i];
        if (!this._isLine(points, c1, c2, threshold)) {
          const newCorner = this._halfwayCorner(straws, c1, c2);
          if (newCorner > c1 && newCorner < c2) {
            corners.splice(i, 0, newCorner);
            go = false;
          }
        }
      }
    }
    for (let i = 1; i < corners.length - 1; i++) {
      c1 = corners[i - 1];
      c2 = corners[i + 1];
      if (this._isLine(points, c1, c2, threshold)) {
        corners.splice(i, 1);
        i--;
      }
    }
  }
  _resamplePoints(points, spacing) {
    const resampled = [points[0]];
    let distance = 0;
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const d2 = this._getDistance(p1, p2);
      if ((distance + d2) >= spacing) {
        const qx = p1.x + ((spacing - distance) / d2) * (p2.x - p1.x);
        const qy = p1.y + ((spacing - distance) / d2) * (p2.y - p1.y);
        const q = {x: qx, y: qy};
        resampled.push(q);
        points.splice(i, 0, q);
        distance = 0;
      } else {
        distance += d2;
      }
    }
    resampled.push(points[points.length - 1]);
    return resampled;
  }
}

export {Shortstraw};
