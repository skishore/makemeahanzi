//Parses an SVG path into an object.
//Taken from https://github.com/jkroso/parse-svg-path
//Re-written so it can be used with rollup
var length = {a: 7, c: 6, h: 1, l: 2, m: 2, q: 4, s: 4, t: 2, v: 1, z: 0};
var segment = /([astvzqmhlc])([^astvzqmhlc]*)/ig;

export default function(path) {
  var data = [];
	path.replace(segment, function(_, command, args){
		var type = command.toLowerCase();
		args = parseValues(args);

		// overloaded moveTo
		if (type === 'm' && args.length > 2) {
			data.push([command].concat(args.splice(0, 2)));
			type = 'l';
			command = command === 'm' ? 'l' : 'L';
		}

		while (args.length >= 0) {
			if (args.length === length[type]) {
				args.unshift(command);
				return data.push(args);
			}
			if (args.length < length[type]) {
        throw new Error('malformed path data');
      }
			data.push([command].concat(args.splice(0, length[type])));
		}
	});
  return data;
}

var number = /-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/ig;

function parseValues(args) {
	var numbers = args.match(number);
	return numbers ? numbers.map(Number) : [];
}
