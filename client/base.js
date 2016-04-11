// Simple helpers for interacting with reactive variables.

ReactiveVar.prototype.pop = function() {
  const value = this.get();
  value.pop();
  this.set(value);
}

ReactiveVar.prototype.push = function(element) {
  const value = this.get();
  value.push(element);
  this.set(value);
}

// Some code for dealing with common template logic.

Blaze.TemplateInstance.prototype.getZoom = function() {
  const element = $(this.find('.zoomable'));
  const x_zoom = element.parent().width() / element.outerWidth();
  const y_zoom = element.parent().height() / element.outerHeight();
  return Math.min(x_zoom, y_zoom);
}
