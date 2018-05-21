var parse = require('parse-svg-path');
var isarray = require('isarray');
var abs = require('abs-svg-path');

module.exports = Points;

function Points (path) {
    if (!(this instanceof Points)) return new Points(path);
    this._path = isarray(path) ? path : parse(path);
    this._path = abs(this._path);
    this._path = zvhToL(this._path);
    this._path = longhand(this._path);
}

Points.prototype.at = function (pos, opts) {
    return this._walk(pos, opts).pos;
};

Points.prototype.length = function () {
    return this._walk(null).length;
};

Points.prototype._walk = function (pos, opts) {
    var cur = [ 0, 0 ];
    var prev = [ 0, 0, 0 ];
    var p0 = [ 0, 0 ];
    var len = 0;

    for (var i = 0; i < this._path.length; i++) {
        var p = this._path[i];
        if (p[0] === 'M') {
            cur[0] = p[1];
            cur[1] = p[2];
            if (pos === 0) {
                return { length: len, pos: cur };
            }
        }
        else if (p[0] === 'C') {
            prev[0] = p0[0] = cur[0];
            prev[1] = p0[1] = cur[1];
            prev[2] = len;

            var n = 100;
            for (var j = 0; j <= n; j++) {
                var t = j / n;
                var x = xof_C(p, t);
                var y = yof_C(p, t);
                len += dist(cur[0], cur[1], x, y);

                cur[0] = x;
                cur[1] = y;

                if (typeof pos === 'number' && len >= pos) {
                    var dv = (len - pos) / (len - prev[2]);

                    var npos = [
                        cur[0] * (1 - dv) + prev[0] * dv,
                        cur[1] * (1 - dv) + prev[1] * dv
                    ];
                    return { length: len, pos: npos };
                }
                prev[0] = cur[0];
                prev[1] = cur[1];
                prev[2] = len;
            }
        }
        else if (p[0] === 'Q') {
            prev[0] = p0[0] = cur[0];
            prev[1] = p0[1] = cur[1];
            prev[2] = len;

            var n = 100;
            for (var j = 0; j <= n; j++) {
                var t = j / n;
                var x = xof_Q(p, t);
                var y = yof_Q(p, t);
                len += dist(cur[0], cur[1], x, y);

                cur[0] = x;
                cur[1] = y;

                if (typeof pos === 'number' && len >= pos) {
                    var dv = (len - pos) / (len - prev[2]);

                    var npos = [
                        cur[0] * (1 - dv) + prev[0] * dv,
                        cur[1] * (1 - dv) + prev[1] * dv
                    ];
                    return { length: len, pos: npos };
                }
                prev[0] = cur[0];
                prev[1] = cur[1];
                prev[2] = len;
            }
        }
        else if (p[0] === 'L') {
            prev[0] = cur[0];
            prev[1] = cur[1];
            prev[2] = len;

            len   += dist(cur[0], cur[1], p[1], p[2]);
            cur[0] = p[1];
            cur[1] = p[2];

            if (typeof pos === 'number' && len >= pos) {
                var dv = (len - pos) / (len - prev[2]);
                var npos = [
                    cur[0] * (1 - dv) + prev[0] * dv,
                    cur[1] * (1 - dv) + prev[1] * dv
                ];
                return { length: len, pos: npos };
            }
            prev[0] = cur[0];
            prev[1] = cur[1];
            prev[2] = len;
        }
    }

    return { length: len, pos: cur };
    function xof_C (p, t) {
        return Math.pow((1-t), 3) * p0[0]
            + 3 * Math.pow((1-t), 2) * t * p[1]
            + 3 * (1-t) * Math.pow(t, 2) * p[3]
            + Math.pow(t, 3) * p[5]
        ;
    }
    function yof_C (p, t) {
        return Math.pow((1-t), 3) * p0[1]
            + 3 * Math.pow((1-t), 2) * t * p[2]
            + 3 * (1-t) * Math.pow(t, 2) * p[4]
            + Math.pow(t, 3) * p[6]
        ;
    }

    function xof_Q (p, t) {
        return Math.pow((1-t), 2) * p0[0]
            + 2 * (1-t) * t * p[1]
            + Math.pow(t, 2) * p[3]
        ;
    }
    function yof_Q (p, t) {
        return Math.pow((1-t), 2) * p0[1]
            + 2 * (1-t) * t * p[2]
            + Math.pow(t, 2) * p[4]
        ;
    }
};

function dist (ax, ay, bx, by) {
    var x = ax - bx;
    var y = ay - by;
    return Math.sqrt(x*x + y*y);
}

// Expand shorthand curve commands to full versions; mutates the path in place for efficiency
// Requires commands have already been converted to absolute versions
function longhand(path){
    var prev,x1=0,y1=0;
    var conversion = { S:{to:'C',x:3}, T:{to:'Q',x:1} };
    for(var i=0, len=path.length; i<len; i++){
        var cmd = path[i];
        var convert = conversion[cmd[0]];

        if (convert) {
            cmd[0] = convert.to;
            if (prev) {
                if (prev[0] === convert.to) {
                    x1 = 2*prev[convert.x+2]-prev[convert.x  ];
                    y1 = 2*prev[convert.x+3]-prev[convert.x+1];
                } else {
                    x1 = prev[prev.length-2];
                    y1 = prev[prev.length-1];
                }
            }
            cmd.splice(1,0,x1,y1);
        }
        prev=cmd;
    }
    return path;
}

// Convert 'Z', 'V' and 'H' segments to 'L' segments
function zvhToL(path){
    var ret = [];
    var startPoint = ['L',0,0];
    var last_point;

    for(var i=0, len=path.length; i<len; i++){
        var pt = path[i];
        switch(pt[0]){
            case 'M':
                startPoint = ['L', pt[1], pt[2]];
                ret.push(pt);
                break;
            case 'Z':
                ret.push(startPoint);
                break;
            case 'H':
                last_point = ret[ret.length - 1] || ['L',0,0];
                ret.push( ['L', pt[1], last_point[last_point.length - 1]] );
                break;
            case 'V':
                last_point = ret[ret.length - 1] || ['L',0,0];
                ret.push( ['L', last_point[last_point.length - 2], pt[1]] );
                break;
            default:
                ret.push(pt);
        }
    }
    return ret;
}
