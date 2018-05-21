//Calculate ans Arc curve length and positionAtLength
//Definitions taken from https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths
import a2c from "./a2c";
import Bezier from "./bezier";


export default function(x0, y0, rx,ry, xAxisRotate, LargeArcFlag,SweepFlag, x,y) {
  return new Arc(x0, y0, rx,ry, xAxisRotate, LargeArcFlag,SweepFlag, x,y);
}

function Arc(x0, y0,rx,ry, xAxisRotate, LargeArcFlag,SweepFlag,x,y) {
    var length = 0;
    var partialLengths = [];
    var curves = [];
    var res = a2c(x0, y0,rx,ry, xAxisRotate, LargeArcFlag,SweepFlag,x,y);
    res.forEach(function(d){
        var curve = new Bezier(d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7]);
        var curveLength = curve.getTotalLength();
        length += curveLength;
        partialLengths.push(curveLength);
        curves.push(curve);
    });
    this.length = length;
    this.partialLengths = partialLengths;
    this.curves = curves;
}

Arc.prototype = {
  constructor: Arc,
  init: function() {

    
  },

  getTotalLength: function() {
    return this.length;
  },
  getPointAtLength: function(fractionLength) {
    
    if(fractionLength < 0){
      fractionLength = 0;
    } else if(fractionLength > this.length){
      fractionLength = this.length;
    }
    var i = this.partialLengths.length - 1;

    while(this.partialLengths[i] >= fractionLength && this.partialLengths[i] > 0){
      i--;
    }
    if(i<this.partialLengths.length-1){
        i++;
    }

    var lengthOffset = 0;
    for(var j=0; j<i; j++){
        lengthOffset += this.partialLengths[j];
    }

    return this.curves[i].getPointAtLength(fractionLength - lengthOffset);
  },
  getTangentAtLength: function(fractionLength) {
    if(fractionLength < 0){
        fractionLength = 0;
        } else if(fractionLength > this.length){
        fractionLength = this.length;
        }
        var i = this.partialLengths.length - 1;

        while(this.partialLengths[i] >= fractionLength && this.partialLengths[i] > 0){
        i--;
        }
        if(i<this.partialLengths.length-1){
            i++;
        }

        var lengthOffset = 0;
        for(var j=0; j<i; j++){
            lengthOffset += this.partialLengths[j];
        }

    return this.curves[i].getTangentAtLength(fractionLength - lengthOffset);
  },
  getPropertiesAtLength: function(fractionLength){
    var tangent = this.getTangentAtLength(fractionLength);
    var point = this.getPointAtLength(fractionLength);
    return {x: point.x, y: point.y, tangentX: tangent.x, tangentY: tangent.y};
  }
};