import {NEURAL_NET_TRAINED_FOR_STROKE_EXTRACTION} from '/lib/net';
import {stroke_extractor} from '/lib/stroke_extractor';

Meteor.startup(() => {
  const input = new convnetjs.Vol(1, 1, 8 /* feature vector dimensions */);
  const net = new convnetjs.Net();
  net.fromJSON(NEURAL_NET_TRAINED_FOR_STROKE_EXTRACTION);
  const weight = 0.8;

  const trainedClassifier = (features) => {
    input.w = features;
    const softmax = net.forward(input).w;
    return softmax[1] - softmax[0];
  }

  stroke_extractor.combinedClassifier = (features) => {
    return stroke_extractor.handTunedClassifier(features) +
           weight*trainedClassifier(features);
  }
});
