Meteor.startup(function() {
  var weight = 0.8;
  var dimensions = 8;
  var input = new convnetjs.Vol(1, 1, dimensions);
  var net = new convnetjs.Net();
  net.fromJSON(TRAINED_NEURAL_NET);

  function net_classifier(features) {
    input.w = features;
    var softmax = net.forward(input).w;
    return softmax[1] - softmax[0];
  }

  this.combined_classifier = function(features) {
    return hand_tuned_classifier(features) + weight*net_classifier(features);
  }
});
