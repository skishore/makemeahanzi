import {assert} from '/lib/base';
import {Glyphs} from '/lib/glyphs';

function evaluate(glyphs, classifier) {
  var num_correct = 0;
  for (var i = 0; i < glyphs.length; i++) {
    if (check_classifier_on_glyph(glyphs[i], classifier)) {
      num_correct += 1;
    }
  }
  return num_correct/glyphs.length;
}

function train_neural_net() {
  var glyphs = Glyphs.find({'manual.verified': true}).fetch();
  var sample = _.sample(glyphs, 400);
  console.log('Hand-tuned accuracy:', evaluate(sample, hand_tuned_classifier));

  var training_data = [];
  for (var i = 0; i < glyphs.length; i++) {
    var glyph_data = get_glyph_training_data(glyphs[i]);
    var positive_data = glyph_data.filter(function(x) { return x[1] > 0; });
    var negative_data = glyph_data.filter(function(x) { return x[1] === 0; });
    if (positive_data.length > negative_data.length) {
      positive_data = _.sample(positive_data, negative_data.length);
    } else {
      negative_data = _.sample(negative_data, positive_data.length);
    }
    glyph_data = negative_data.concat(positive_data);
    for (var j = 0; j < glyph_data.length; j++) {
      training_data.push(glyph_data[j]);
    }
  }
  console.log('Got ' + training_data.length + ' rows of training data.');

  var net = new convnetjs.Net();
  net.makeLayers([
    {type: 'input', out_sx: 1, out_sy: 1, out_depth: 8},
    {type: 'fc', num_neurons: 8, activation: 'tanh'},
    {type: 'fc', num_neurons: 8, activation: 'tanh'},
    {type: 'softmax', num_classes: 2},
  ]);
  var trainer = new convnetjs.Trainer(
      net, {method: 'adadelta', l2_decay: 0.001, batch_size: 10});
  var input = new convnetjs.Vol(1, 1, 8);
  for (var iteration = 0; iteration < 10; iteration++) {
    var loss = 0;
    var round_data = _.sample(training_data, 4000);
    for (var i = 0; i < round_data.length; i++) {
      assert(input.w.length === round_data[i][0].length);
      input.w = round_data[i][0];
      var stats = trainer.train(input, round_data[i][1]);
      assert(!isNaN(stats.loss))
      loss += stats.loss;
    }
    console.log('Iteration', iteration, 'mean loss:', loss/round_data.length);
  }
  console.log('Trained neural network:', JSON.stringify(net.toJSON()));

  function net_classifier(features) {
    assert(input.w.length === features.length);
    input.w = features;
    var softmax = net.forward(input).w;
    assert(softmax.length === 2);
    return softmax[1] - softmax[0];
  }
  console.log('Neural-net accuracy:', evaluate(sample, net_classifier));

  function combined_classifier(weight) {
    return function(features) {
      return hand_tuned_classifier(features) + weight*net_classifier(features);
    }
  }
  var weights = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  for (var i = 0; i < weights.length; i++) {
    console.log('Weight',  weights[i], 'combined accuracy:',
                evaluate(sample, combined_classifier(weights[i])));
  }
}
