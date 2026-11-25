// Part A6: Line stability. The fraction of line pixels that appear or disappear between the
// warped previous frame and the current frame. Lines that follow the surface smoothly give a low
// value; lines that flicker on and off give a high one.
//
//   prev, cur: captured frames (see Pipeline.capture())
//   warped:    the result of warpPrevious(prev, cur)
// Returns a number in [0, 1], or NaN if there are no line pixels.
// Only pixels accepted by A5 participate. In particular, rejected history and
// exterior hull strokes on background are not evidence of either stability or flicker.
export function lineStability(prev, cur, warped) {
	let union = 0;
	let changed = 0;
	for (let i = 0; i < cur.width * cur.height; i++) {
		if (!warped.valid[i]) continue;
		const currentLine = cur.lineMask[i] > 0.5;
		const previousLine = warped.lineMask[i] > 0.5;
		if (currentLine || previousLine) {
			union++;
			if (currentLine !== previousLine) changed++;
		}
	}
	return union ? changed / union : NaN;
}
