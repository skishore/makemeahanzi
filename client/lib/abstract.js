if (this.stages !== undefined) throw new Error('Redifining stages global!');
this.stages = {};

// Each stage is supposed to compute a particular field for the glyph.
// It computes an initial value for this field based only on previous stages,
// then exposes a UI for manual correction of its output.
//
// NOTE: No stage methods should update the glyph. The framework will do so by
// calling getStageOutput when appropriate.
stages.AbstractStage = class AbstractStage {
  // Initialize this stage's values based only off previous stages. Then, if the
  // glyph already has a value for this stage's field and it is possible to set
  // up the internal state of this stage to achieve that value, set that state.
  // This piece allows the user to resume editing a glyph.
  //
  // Typically, a stage will maintain a 'this.original' variable containing the
  // value without any manual edits and a 'this.adjusted' variable containing
  // the value with manual edits.
  constructor(glyph) {
    // The super constructor should be passed a type, but subclass constructors
    // will be passed a glyph instead, hence the variable name discrepancy.
    this.type = glyph;
    this.colors = ['#0074D9', '#2ECC40', '#FFDC00', '#FF4136', '#7FDBFF',
                   '#001F3F', '#39CCCC', '#3D9970', '#01FF70', '#FF851B'];
    // Session variables the interface by which the stage interacts with UI:
    //   - type - String type of this stage.
    //   - paths - list of dicts with keys in [cls, d, fill, stroke].
    //   - lines - list of dicts with keys in [cls, stroke, x1, y1, x2, y2].
    //   - points - list of dicts with keys in [cls, cx, cy, fill, stroke].
    //   - status - list of dicts with keys in [cls, message] to log.
    //
    // The class name 'selectable' is special for paths, lines, and points.
    // Including this class in cls for those objects will make them interactive
    // and will trigger the onClick callback when they are clicked.
    Session.set('stage.type', this.type);
    Session.set('stage.paths', undefined);
    Session.set('stage.lines', undefined);
    Session.set('stage.points', undefined);
    Session.set('stage.status', undefined);
  }
  // Return this stage's value based on current internal state. The default
  // implementation works for stages that follow the 'original/adjusted'
  // convention described in the constructor.
  getStageOutput() {
    return this.adjusted;
  }
  // Update the stage's internal state based on the event.
  handleEvent(event, template) {
    assert(false, 'handleEvent was not implemented!');
  }
  // Refresh the stage UI based on the current state of this stage and the
  // glyph's character and current metadata.
  refreshUI(character, metadata) {
    assert(false, 'refresh was not implemented!');
  }
  // Throws an error if there is an issue with this stage's output. The default
  // implementation simply checks that none of the log lines are errors.
  validate() {
    const log = Session.get('stage.status');
    assert(log && log.filter((x) => x.cls === 'error').length === 0);
  }
}
