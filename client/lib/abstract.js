if (this.stages !== undefined) throw new Error('Redifining stages global!');
this.stages = {};

stages.AbstractStage = class AbstractStage {
  // This method should fill in this stage's field in glyph.stages. The glyph
  // may already have a value for this stage set. If so, this stage's internal
  // state should be initialized in such a way to achieve that output, if that
  // is possible; doing so allows users to make some edits, switch to another
  // glyph, and then switch back and continue where they left off.
  constructor(glyph) {
    // Session variables the interface by which the stage interacts with UI:
    //   - type - String type of this stage.
    //   - paths - list of dicts with keys in [cls, d, fill, stroke].
    //   - lines - list of dicts with keys in [cls, stroke, x1, y1, x2, y2].
    //   - points - list of dicts with keys in [cls, cx, cy, fill, stroke].
    //   - instructions - String instructions for the user
    //   - status - list of dicts with keys in [cls, message] to log.
    //
    // The class name 'selectable' is special for paths, lines, and points.
    // Including this class in cls for those objects will make them interactive
    // and will trigger the onClick callback when they are clicked.
    Session.set('stage.type', undefined);
    Session.set('stage.paths', undefined);
    Session.set('stage.lines', undefined);
    Session.set('stage.points', undefined);
    Session.set('stage.instructions', undefined);
    Session.set('stage.status', undefined);
    this.colors = ['#0074D9', '#2ECC40', '#FFDC00', '#FF4136', '#7FDBFF',
                   '#001F3F', '#39CCCC', '#3D9970', '#01FF70', '#FF851B'];
  }
  // Update the stage's internal state and possibly update this stage's field
  // in glyph.stages based on the event.
  handleEvent(glyph, event, template) {
    assert(false, 'handleEvent was not implemented!');
  }
  // Refresh the stage UI based on the current state of this stage.
  refresh(glyph) {
    assert(false, 'refresh was not implemented!');
  }
}
