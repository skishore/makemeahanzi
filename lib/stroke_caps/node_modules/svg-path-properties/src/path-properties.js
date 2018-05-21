import parse from "./parse";
import Bezier from "./bezier";
import Arc from "./arc";
import LinearPosition from "./linear";

export default function(svgString) {
  var length = 0;
  var partial_lengths = [];
  var functions = [];

  function svgProperties(string){
    if(!string){return null;}
    var parsed = parse(string);
    var cur = [0, 0];
    var prev_point = [0, 0];
    var curve;
    var ringStart;
    for (var i = 0; i < parsed.length; i++){
      //moveTo
      if(parsed[i][0] === "M"){
        cur = [parsed[i][1], parsed[i][2]];
        ringStart = [cur[0], cur[1]];
        functions.push(null);
      } else if(parsed[i][0] === "m"){
        cur = [parsed[i][1] + cur[0], parsed[i][2] + cur[1]];
        ringStart = [cur[0], cur[1]];
        functions.push(null);
      }
      //lineTo
      else if(parsed[i][0] === "L"){
        length = length + Math.sqrt(Math.pow(cur[0] - parsed[i][1], 2) + Math.pow(cur[1] - parsed[i][2], 2));
        functions.push(new LinearPosition(cur[0], parsed[i][1], cur[1], parsed[i][2]));
        cur = [parsed[i][1], parsed[i][2]];
      } else if(parsed[i][0] === "l"){
        length = length + Math.sqrt(Math.pow(parsed[i][1], 2) + Math.pow(parsed[i][2], 2));
        functions.push(new LinearPosition(cur[0], parsed[i][1] + cur[0], cur[1], parsed[i][2] + cur[1]));
        cur = [parsed[i][1] + cur[0], parsed[i][2] + cur[1]];
      } else if(parsed[i][0] === "H"){
        length = length + Math.abs(cur[0] - parsed[i][1]);
        functions.push(new LinearPosition(cur[0], parsed[i][1], cur[1], cur[1]));
        cur[0] = parsed[i][1];
      } else if(parsed[i][0] === "h"){
        length = length + Math.abs(parsed[i][1]);
        functions.push(new LinearPosition(cur[0], cur[0] + parsed[i][1], cur[1], cur[1]));
        cur[0] = parsed[i][1] + cur[0];
      } else if(parsed[i][0] === "V"){
        length = length + Math.abs(cur[1] - parsed[i][1]);
        functions.push(new LinearPosition(cur[0], cur[0], cur[1], parsed[i][1]));
        cur[1] = parsed[i][1];
      } else if(parsed[i][0] === "v"){
        length = length + Math.abs(parsed[i][1]);
        functions.push(new LinearPosition(cur[0], cur[0], cur[1], cur[1] + parsed[i][1]));
        cur[1] = parsed[i][1] + cur[1];
      //Close path
      }  else if(parsed[i][0] === "z" || parsed[i][0] === "Z"){
        length = length + Math.sqrt(Math.pow(ringStart[0] - cur[0], 2) + Math.pow(ringStart[1] - cur[1], 2));
        functions.push(new LinearPosition(cur[0], ringStart[0], cur[1], ringStart[1]));
        cur = [ringStart[0], ringStart[1]];
      }
      //Cubic Bezier curves
      else if(parsed[i][0] === "C"){
        curve = new Bezier(cur[0], cur[1] , parsed[i][1], parsed[i][2] , parsed[i][3], parsed[i][4] , parsed[i][5], parsed[i][6]);
        length = length + curve.getTotalLength();
        cur = [parsed[i][5], parsed[i][6]];
        functions.push(curve);
      } else if(parsed[i][0] === "c"){
        curve = new Bezier(cur[0], cur[1] , cur[0] + parsed[i][1], cur[1] + parsed[i][2] , cur[0] + parsed[i][3], cur[1] + parsed[i][4] , cur[0] + parsed[i][5], cur[1] + parsed[i][6]);
        length = length + curve.getTotalLength();
        cur = [parsed[i][5] + cur[0], parsed[i][6] + cur[1]];
        functions.push(curve);
      } else if(parsed[i][0] === "S"){
        if(i>0 && ["C","c","S","s"].indexOf(parsed[i-1][0]) > -1){
          curve = new Bezier(cur[0], cur[1] , 2*cur[0] - parsed[i-1][parsed[i-1].length - 4], 2*cur[1] - parsed[i-1][parsed[i-1].length - 3], parsed[i][1], parsed[i][2] , parsed[i][3], parsed[i][4]);
        } else {
          curve = new Bezier(cur[0], cur[1] , cur[0], cur[1], parsed[i][1], parsed[i][2] , parsed[i][3], parsed[i][4]);
        }
        length = length + curve.getTotalLength();
        cur = [parsed[i][3], parsed[i][4]];
        functions.push(curve);
      }  else if(parsed[i][0] === "s"){ //240 225
        if(i>0 && ["C","c","S","s"].indexOf(parsed[i-1][0]) > -1){
          curve = new Bezier(cur[0], cur[1] , cur[0] + curve.d.x - curve.c.x, cur[1] + curve.d.y - curve.c.y, cur[0] + parsed[i][1], cur[1] + parsed[i][2] , cur[0] + parsed[i][3], cur[1] + parsed[i][4]);
        } else {
          curve = new Bezier(cur[0], cur[1] , cur[0], cur[1], cur[0] + parsed[i][1], cur[1] + parsed[i][2] , cur[0] + parsed[i][3], cur[1] + parsed[i][4]);
        }
        length = length + curve.getTotalLength();
        cur = [parsed[i][3] + cur[0], parsed[i][4] + cur[1]];
        functions.push(curve);
      }
      //Quadratic Bezier curves
      else if(parsed[i][0] === "Q"){
        if(cur[0] == parsed[i][1] && cur[1] == parsed[i][2]){
          curve = new LinearPosition(parsed[i][1], parsed[i][3], parsed[i][2], parsed[i][4]);
        } else {
          curve = new Bezier(cur[0], cur[1] , parsed[i][1], parsed[i][2] , parsed[i][3], parsed[i][4]);
        }
        length = length + curve.getTotalLength();
        functions.push(curve);
        cur = [parsed[i][3], parsed[i][4]];
        prev_point = [parsed[i][1], parsed[i][2]];

      }  else if(parsed[i][0] === "q"){
        if(!(parsed[i][1] == 0 && parsed[i][2] == 0)){
          curve = new Bezier(cur[0], cur[1] , cur[0] + parsed[i][1], cur[1] + parsed[i][2] , cur[0] + parsed[i][3], cur[1] + parsed[i][4]);
        } else {
          curve = new LinearPosition(cur[0] + parsed[i][1], cur[0] + parsed[i][3], cur[1] + parsed[i][2], cur[1] + parsed[i][4]);
        }
        length = length + curve.getTotalLength();
        prev_point = [cur[0] + parsed[i][1], cur[1] + parsed[i][2]];
        cur = [parsed[i][3] + cur[0], parsed[i][4] + cur[1]];
        functions.push(curve);
      } else if(parsed[i][0] === "T"){
        if(i>0 && ["Q","q","T","t"].indexOf(parsed[i-1][0]) > -1){
          curve = new Bezier(cur[0], cur[1] , 2 * cur[0] - prev_point[0] , 2 * cur[1] - prev_point[1] , parsed[i][1], parsed[i][2]);
        } else {
          curve = new LinearPosition(cur[0], parsed[i][1], cur[1], parsed[i][2]);
        }
        functions.push(curve);
        length = length + curve.getTotalLength();
        prev_point = [2 * cur[0] - prev_point[0] , 2 * cur[1] - prev_point[1]];
        cur = [parsed[i][1], parsed[i][2]];

      } else if(parsed[i][0] === "t"){
        if(i>0 && ["Q","q","T","t"].indexOf(parsed[i-1][0]) > -1){
          curve = new Bezier(cur[0], cur[1] , 2 * cur[0] - prev_point[0] , 2 * cur[1] - prev_point[1] , cur[0] + parsed[i][1], cur[1] + parsed[i][2]);
        } else {
          curve = new LinearPosition(cur[0], cur[0] + parsed[i][1], cur[1], cur[1] + parsed[i][2]);
        }
        length = length + curve.getTotalLength();
        prev_point = [2 * cur[0] - prev_point[0] , 2 * cur[1] - prev_point[1]];
        cur = [parsed[i][1] + cur[0], parsed[i][2] + cur[0]];
        functions.push(curve);
      } else if(parsed[i][0] === "A"){
        curve = new Arc(cur[0], cur[1], parsed[i][1], parsed[i][2], parsed[i][3], parsed[i][4], parsed[i][5], parsed[i][6], parsed[i][7]);

        length = length + curve.getTotalLength();
        cur = [parsed[i][6], parsed[i][7]];
        functions.push(curve);
      } else if(parsed[i][0] === "a"){
        curve = new Arc(cur[0], cur[1], parsed[i][1], parsed[i][2], parsed[i][3], parsed[i][4], parsed[i][5], cur[0] + parsed[i][6], cur[1] + parsed[i][7]);

        length = length + curve.getTotalLength();
        cur = [cur[0] + parsed[i][6], cur[1] + parsed[i][7]];
        functions.push(curve);
      }
      partial_lengths.push(length);

    }
    return svgProperties;
  }

 svgProperties.getTotalLength = function(){
    return length;
  };

  svgProperties.getPointAtLength = function(fractionLength){
    var fractionPart = getPartAtLength(fractionLength);
    return functions[fractionPart.i].getPointAtLength(fractionPart.fraction);
  };

  svgProperties.getTangentAtLength = function(fractionLength){
    var fractionPart = getPartAtLength(fractionLength);
    return functions[fractionPart.i].getTangentAtLength(fractionPart.fraction);
  };

  svgProperties.getPropertiesAtLength = function(fractionLength){
    var fractionPart = getPartAtLength(fractionLength);
    return functions[fractionPart.i].getPropertiesAtLength(fractionPart.fraction);
  };

  svgProperties.getParts = function(){
    var parts = [];
    for(var i = 0; i< functions.length; i++){
      if(functions[i] != null){
        var properties = {};
        properties['start'] = functions[i].getPointAtLength(0);
        properties['end'] = functions[i].getPointAtLength(partial_lengths[i] - partial_lengths[i-1]);
        properties['length'] = partial_lengths[i] - partial_lengths[i-1];
        (function(func){
          properties['getPointAtLength'] = function(d){return func.getPointAtLength(d);};
          properties['getTangentAtLength'] = function(d){return func.getTangentAtLength(d);};
          properties['getPropertiesAtLength'] = function(d){return func.getPropertiesAtLength(d);};
        })(functions[i]);
        
        parts.push(properties);
      }
    }
  
    return parts;
  };

  var getPartAtLength = function(fractionLength){
    if(fractionLength < 0){
      fractionLength = 0;
    } else if(fractionLength > length){
      fractionLength = length;
    }

    var i = partial_lengths.length - 1;

    while(partial_lengths[i] >= fractionLength && partial_lengths[i] > 0){
      i--;
    }
    i++;
    return {fraction: fractionLength-partial_lengths[i-1], i: i};
  };

  return svgProperties(svgString);
}
