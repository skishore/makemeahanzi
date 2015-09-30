if (this.stages !== undefined) throw new Error('Redifining stages global!');
this.stages = {};

stages.AbstractStage = class AbstractStage {
  // Initialize this stage's internal state. The glyph may already include
  // output from this stage. If the internal state can be initialized in such
  // a way to achieve that output, it should be; doing so allows users to make
  // some edits, switch to another glyph, and later resume where they left off.
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
    this.glyph = glyph;
  }
  // Update the stage's internal state and the editor.glyph Session variable
  // based on the event.
  handleEvent(event, template) {
    assert(false, 'handleEvent was not implemented!');
  }
  // Refresh the stage UI based on the current state of this stage.
  refresh() {
    assert(false, 'refresh was not implemented!');
  }
}
