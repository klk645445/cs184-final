import { lumaAt } from './image.js';

// Part C4: Temporal coherence. The average difference in the stroke regions between the warped
// previous frame and the current frame. Strokes attached to the surface give a low value;
// strokes fixed on the screen (the shower-door effect) give a high one.
//
// A plain difference between consecutive frames would not work, because a pattern that stays
// fixed on the screen barely changes from frame to frame. Warping first asks "did the pattern
// move with the surface?" instead.
//
//   prev, cur: captured frames (see Pipeline.capture())
//   warped:    the result of warpPrevious(prev, cur)
// Returns the mean absolute luminance difference over stroke pixels, or NaN if there are none.
export function coherence(prev, cur, warped) {
	// TODO (Part C4): Over the valid pixels, find the stroke pixels: pixels that are darker than a
	// threshold (ink) in either cur.color or warped.color. Use lumaAt() for the luminance.
	// Average |luma(cur) - luma(warped)| over those pixels and return it.
	return NaN;
}
