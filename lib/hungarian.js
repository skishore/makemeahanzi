// This algorithm was pulled from another one of my projects. -skishore
//   https://github.com/skishore/tesseract/blob/master/coffee/hungarian.coffee

var bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

const Hungarian = (function() {
  function Hungarian(cost_matrix) {
    var i, j, last_matched, len, ref, ref1, results, row, x, y;
    this.cost_matrix = cost_matrix;
    this.get_final_score = bind(this.get_final_score, this);
    this.update_labels = bind(this.update_labels, this);
    this.find_root_and_slacks = bind(this.find_root_and_slacks, this);
    this.augment = bind(this.augment, this);
    this.match = bind(this.match, this);
    this.cost = bind(this.cost, this);
    this.find_greedy_solution = bind(this.find_greedy_solution, this);
    this.reduce_cost_matrix = bind(this.reduce_cost_matrix, this);
    this.n = this.cost_matrix.length;
    ref = this.cost_matrix;
    for (i = 0, len = ref.length; i < len; i++) {
      row = ref[i];
      if (row.length !== this.n) {
        throw new Error("Malforrmed cost_matrix: " + this.cost_matrix);
      }
    }
    this.range = (function() {
      results = [];
      for (var j = 0, ref1 = this.n; 0 <= ref1 ? j < ref1 : j > ref1; 0 <= ref1 ? j++ : j--){ results.push(j); }
      return results;
    }).apply(this);
    this.matched = 0;
    this.x_label = (function() {
      var k, len1, ref2, results1;
      ref2 = this.range;
      results1 = [];
      for (k = 0, len1 = ref2.length; k < len1; k++) {
        x = ref2[k];
        results1.push(0);
      }
      return results1;
    }).call(this);
    this.y_label = (function() {
      var k, len1, ref2, results1;
      ref2 = this.range;
      results1 = [];
      for (k = 0, len1 = ref2.length; k < len1; k++) {
        y = ref2[k];
        results1.push(0);
      }
      return results1;
    }).call(this);
    this.x_match = (function() {
      var k, len1, ref2, results1;
      ref2 = this.range;
      results1 = [];
      for (k = 0, len1 = ref2.length; k < len1; k++) {
        x = ref2[k];
        results1.push(-1);
      }
      return results1;
    }).call(this);
    this.y_match = (function() {
      var k, len1, ref2, results1;
      ref2 = this.range;
      results1 = [];
      for (k = 0, len1 = ref2.length; k < len1; k++) {
        y = ref2[k];
        results1.push(-1);
      }
      return results1;
    }).call(this);
    this.reduce_cost_matrix();
    this.find_greedy_solution();
    while (this.matched < this.n) {
      last_matched = this.matched;
      this.augment();
      if (this.matched <= last_matched) {
        throw new Error("Augmentation round did not increase matched!");
      }
    }
  }

  Hungarian.prototype.reduce_cost_matrix = function() {
    var i, j, k, l, len, len1, len2, len3, max_cost, ref, ref1, ref2, ref3, row, x, y;
    this.cost_matrix = (function() {
      var i, len, ref, results;
      ref = this.cost_matrix;
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        row = ref[i];
        results.push(row.slice());
      }
      return results;
    }).call(this);
    ref = this.range;
    for (i = 0, len = ref.length; i < len; i++) {
      x = ref[i];
      max_cost = Math.max.apply(0, (function() {
        var j, len1, ref1, results;
        ref1 = this.range;
        results = [];
        for (j = 0, len1 = ref1.length; j < len1; j++) {
          y = ref1[j];
          results.push(this.cost_matrix[x][y]);
        }
        return results;
      }).call(this));
      ref1 = this.range;
      for (j = 0, len1 = ref1.length; j < len1; j++) {
        y = ref1[j];
        this.cost_matrix[x][y] -= max_cost;
      }
      this.x_label[x] = 0;
    }
    ref2 = this.range;
    for (k = 0, len2 = ref2.length; k < len2; k++) {
      y = ref2[k];
      max_cost = Math.max.apply(0, (function() {
        var l, len3, ref3, results;
        ref3 = this.range;
        results = [];
        for (l = 0, len3 = ref3.length; l < len3; l++) {
          x = ref3[l];
          results.push(this.cost_matrix[x][y]);
        }
        return results;
      }).call(this));
      ref3 = this.range;
      for (l = 0, len3 = ref3.length; l < len3; l++) {
        x = ref3[l];
        this.cost_matrix[x][y] -= max_cost;
      }
      this.y_label[y] = 0;
    }
  };

  Hungarian.prototype.find_greedy_solution = function() {
    var i, len, ref, results, x, y;
    ref = this.range;
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      x = ref[i];
      results.push((function() {
        var j, len1, ref1, results1;
        ref1 = this.range;
        results1 = [];
        for (j = 0, len1 = ref1.length; j < len1; j++) {
          y = ref1[j];
          if (this.x_match[x] === -1 && this.y_match[y] === -1 && (this.cost(x, y)) === 0) {
            this.match(x, y);
            results1.push(this.matched += 1);
          } else {
            results1.push(void 0);
          }
        }
        return results1;
      }).call(this));
    }
    return results;
  };

  Hungarian.prototype.cost = function(x, y) {
    return this.cost_matrix[x][y] - this.x_label[x] - this.y_label[y];
  };

  Hungarian.prototype.match = function(x, y) {
    this.x_match[x] = y;
    return this.y_match[y] = x;
  };

  Hungarian.prototype.augment = function() {
    var cur_x, cur_y, delta, delta_x, delta_y, i, j, len, len1, new_slack, next_y, ref, ref1, ref2, root, slack, slack_x, x, x_in_tree, y, y_parent;
    x_in_tree = (function() {
      var i, len, ref, results;
      ref = this.range;
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        x = ref[i];
        results.push(false);
      }
      return results;
    }).call(this);
    y_parent = (function() {
      var i, len, ref, results;
      ref = this.range;
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        y = ref[i];
        results.push(-1);
      }
      return results;
    }).call(this);
    ref = this.find_root_and_slacks(), root = ref[0], slack = ref[1], slack_x = ref[2];
    x_in_tree[root] = true;
    while (true) {
      delta = Infinity;
      ref1 = this.range;
      for (i = 0, len = ref1.length; i < len; i++) {
        y = ref1[i];
        if (y_parent[y] < 0 && slack[y] < delta) {
          delta = slack[y];
          delta_x = slack_x[y];
          delta_y = y;
        }
      }
      this.update_labels(delta, x_in_tree, y_parent, slack);
      y_parent[delta_y] = delta_x;
      if (this.y_match[delta_y] < 0) {
        cur_y = delta_y;
        while (cur_y >= 0) {
          cur_x = y_parent[cur_y];
          next_y = this.x_match[cur_x];
          this.match(cur_x, cur_y);
          cur_y = next_y;
        }
        this.matched += 1;
        return;
      }
      x = this.y_match[delta_y];
      x_in_tree[x] = true;
      ref2 = this.range;
      for (j = 0, len1 = ref2.length; j < len1; j++) {
        y = ref2[j];
        if (y_parent[y] < 0) {
          new_slack = -(this.cost(x, y));
          if (slack[y] > new_slack) {
            slack[y] = new_slack;
            slack_x[y] = x;
          }
        }
      }
    }
  };

  Hungarian.prototype.find_root_and_slacks = function() {
    var i, len, ref, x, y;
    ref = this.range;
    for (i = 0, len = ref.length; i < len; i++) {
      x = ref[i];
      if (this.x_match[x] < 0) {
        return [
          x, (function() {
            var j, len1, ref1, results;
            ref1 = this.range;
            results = [];
            for (j = 0, len1 = ref1.length; j < len1; j++) {
              y = ref1[j];
              results.push(-(this.cost(x, y)));
            }
            return results;
          }).call(this), (function() {
            var j, len1, ref1, results;
            ref1 = this.range;
            results = [];
            for (j = 0, len1 = ref1.length; j < len1; j++) {
              y = ref1[j];
              results.push(x);
            }
            return results;
          }).call(this)
        ];
      }
    }
  };

  Hungarian.prototype.update_labels = function(delta, x_in_tree, y_parent, slack) {
    var i, j, len, len1, ref, ref1, results, x, y;
    ref = this.range;
    for (i = 0, len = ref.length; i < len; i++) {
      x = ref[i];
      if (x_in_tree[x]) {
        this.x_label[x] -= delta;
      }
    }
    ref1 = this.range;
    results = [];
    for (j = 0, len1 = ref1.length; j < len1; j++) {
      y = ref1[j];
      if (y_parent[y] < 0) {
        results.push(slack[y] -= delta);
      } else {
        results.push(this.y_label[y] += delta);
      }
    }
    return results;
  };

  Hungarian.prototype.get_final_score = function(original_matrix) {
    var x;
    return Util.sum((function() {
      var i, len, ref, results;
      ref = this.range;
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        x = ref[i];
        results.push(original_matrix[x][this.x_match[x]]);
      }
      return results;
    }).call(this));
  };

  return Hungarian;

})();

export {Hungarian};
