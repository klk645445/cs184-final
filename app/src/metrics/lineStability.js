// Part A6: Line stability. The fraction of line pixels that appear or disappear between the
// warped previous frame and the current frame. Lines that follow the surface smoothly give a low
// value; lines that flicker on and off give a high one.
//
//   prev, cur: captured frames (see Pipeline.capture())
//   warped:    the result of warpPrevious(prev, cur)
// Returns a number in [0, 1], or NaN if there are no line pixels.
export function lineStability(prev, cur, warped) {
	// TODO (Part A6): Over the valid pixels, count the pixels that are a line (mask > 0.5) in either
	// cur.lineMask or warped.lineMask, and how many of those are a line in only one of the two.
	// Return the ratio.
	return NaN;
}
