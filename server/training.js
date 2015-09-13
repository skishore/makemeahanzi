function evaluate(glyphs, classifier) {
  var num_correct = 0;
  for (var i = 0; i < glyphs.length; i++) {
    if (check_classifier_on_glyph(glyphs[i], classifier)) {
      num_correct += 1;
    }
  }
  return num_correct/glyphs.length;
}

Meteor.startup(function() {
  var glyphs = Glyphs.find({'manual.verified': true}).fetch();
  var glyphs = glyphs.slice(0, 100);
  console.log('Hand-tuned accuracy:', evaluate(glyphs, hand_tuned_classifier));

  var training_data = [];
  var training_labels = [];
  for (var i = 0; i < glyphs.length; i++) {
    var glyph_data = get_glyph_training_data(glyphs[i]);
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
    {type: 'regression', num_neurons: 1},
  ]);
  var trainer = new convnetjs.Trainer(
      net, {method: 'adadelta', l2_decay: 0.001, batch_size: 10});
  var input = new convnetjs.Vol(1, 1, 8);
  for (var iteration = 0; iteration < 10; iteration++) {
    var loss = 0;
    for (var i = 0; i < training_data.length; i++) {
      assert(input.w.length === training_data[i][0].length);
      input.w = training_data[i][0];
      var stats = trainer.train(input, [training_data[i][1]]);
      assert(!isNaN(stats.loss))
      loss += stats.loss;
    }
    console.log('Iteration', iteration, 'loss:', loss/training_data.length);
  }
  console.log('Trained neural network.');

  function net_classifier(features) {
    assert(input.w.length === features.length);
    input.w = features;
    return net.forward(input).w[0] || 0;
  }
  console.log('Neural-net accuracy:', evaluate(glyphs, net_classifier));
});
