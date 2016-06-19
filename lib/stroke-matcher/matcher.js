// This is the only file intended for use outside of the
// stroke-matcher directory.
import {assert} from '/lib/base'
import {recognize} from '/lib/stroke-matcher/recognizer'
import {findCorners} from '/lib/stroke-matcher/corners'
import {Shortstraw} from '/lib/stroke-matcher/external/shortstraw';

// A `Matcher` instance tries to match a user-generated stroke to one
// of the strokes of a character.
//
//  - char_data (Object): The full data of the character to be matched
//    as provided by lookup.js. This should include at minimum the
//    fields
//      - character (String): The length 1 character string.
//      - medians (Array of [Number, Number]): The medians of the character's strokes.
//
// TODO(zhaizhai): It will likely be beneficial to eventually also
// take into account the decomposition information, and possibly the
// full stroke paths (not just medians).
class Matcher {
  constructor(char_data) {
    this.character = char_data.character;

    // this gives a simplified version of the medians that only tracks
    // the corners
    this.medians = char_data.medians
      .map((x) => findCorners([x])[0]);
  }

  // Attempts to do the match.
  //
  //  - stroke (Array of [Number, Number]): The user-generated stroke.
  //  - missing (Array of [Integer]): The indices of the strokes that
  //    are still missing from the character, sorted in ascending
  //    order. This gives us useful context (e.g. we prefer to match
  //    to the next missing stroke).
  //
  //  - Returns an Object with the fields
  //    - index: The index of the suggested match, or -1 if no good
  //      match was found.
  //    - score: The closeness of the match (higher is closer).
  //    plus the additional fields if a match was found:
  //    - simplified_median: The simplified matched median.
  //    - source_segment: A line segment approximating the user's
  //      stroke.
  //    - target_segment: A line segment approximating the part of the matched median that the source_segment corresponds to.
  //    - warning: A message explaining any defects of the match
  //      (e.g. "Should hook").
  //    - penalties: A non-negative integer representing asuggested
  //      score penalty for any defects in the match. Zero means no
  //      defects.
  match(stroke, missing) {
    assert(missing.length > 0, "Must have at least one missing stroke!");
    // simplify stroke with corner detection
    stroke = (new Shortstraw).run(stroke);

    let best_result = {index: -1, score: -Infinity};
    for (let i = 0; i < this.medians.length; i++) {
      const median = this.medians[i];
      const offset = i - missing[0];
      const result = recognize(stroke, median, offset);
      if (result.score > best_result.score) {
        best_result = {
          score: result.score, index: i,
          simplified_median: median,
          source_segment: result.source,
          target_segment: result.target,
          warning: result.warning,
          penalties: result.penalties
        };
      }
    }
    return best_result;
  }
}

export {Matcher}