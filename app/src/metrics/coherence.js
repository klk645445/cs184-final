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
//
// Stroke pixels are those with linear luminance below `inkThreshold` in either frame, so a stroke
// that slid away from a pixel (ink before, paper now) counts as much as one that slid onto it.
// The default of 0.5 linear (about 0.73 in sRGB) sits between the paper and the ink of the
// hatching styles. Only pixels accepted by the A5 warp take part.
export const INK_THRESHOLD = 0.5;

export function coherence(prev, cur, warped, inkThreshold = INK_THRESHOLD) {
	let strokes = 0;
	let sum = 0;
	for (let i = 0; i < cur.width * cur.height; i++) {
		if (!warped.valid[i]) continue;
		const current = lumaAt(cur.color, i);
		const previous = lumaAt(warped.color, i);
		if (current < inkThreshold || previous < inkThreshold) {
			strokes++;
			sum += Math.abs(current - previous);
		}
	}
	return strokes ? sum / strokes : NaN;
}
