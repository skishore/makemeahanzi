[![Build Status](https://travis-ci.org/rveciana/svg-path-properties.svg?branch=master)](https://travis-ci.org/rveciana/svg-path-properties)
[![Coverage Status](https://coveralls.io/repos/github/rveciana/svg-path-properties/badge.svg?branch=master)](https://coveralls.io/github/rveciana/svg-path-properties?branch=master)

# svg-path-properties
Pure Javascript alternative to getPointAtLength(t) and getTotalLength() functions. Works with Canvas and Node

JavaScript can access to path elements properties in a browser, such as its length and the point at a given length. Unfortunately, this can't be achieved using a Canvas element or when working with node. This library can be used to replace this need. It has no dependencies on other JavaScript libraries.

INSTALL
=======

To use with npm, just type

  npm install svg-path-properties

USAGE
=====

    var path = require("svg-path-properties");
    var properties = path.svgPathProperties("M0,100 Q50,-50 100,100 T200,100");
    var length = properties.getTotalLength();
    var point = properties.getPointAtLength(200);
    var tangent = properties.getTangentAtLength(200);
    var allProperties = properties.getPropertiesAtLength(200);
    var parts = properties.getParts(); --> Gets an array with the different sections of the path, each element containing the initial and final points, the length and the curve function

[Check this block](http://bl.ocks.org/rveciana/209fa7efeb01f05fa4a544a76ac8ed91) to see how it works with the browser.

CREDITS
=======

Some parts of the code are taken from other libraries or questions at StackOverflow:

For Bézier curves:

* http://bl.ocks.org/hnakamur/e7efd0602bfc15f66fc5, https://gist.github.com/tunght13488/6744e77c242cc7a94859
* http://stackoverflow.com/questions/11854907/calculate-the-length-of-a-segment-of-a-quadratic-bezier
* http://pomax.github.io/bezierinfo

For path parsing:

* https://github.com/jkroso/parse-svg-path
