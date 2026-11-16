import { bilinear } from './image.js';

// Part A5: Warps the previous frame onto the current frame using the current frame's motion
// vectors. This is the shared building block of the temporal coherence (Part C4) and line
// stability (Part A6) metrics.
//
// For every pixel of `cur`, the motion vector says where the same surface point was in the
// previous frame: prevUv = uv - motion. Sampling `prev` there gives what this pixel "should"
// look like if the image stuck to the surface.
//
// Returns {
//   color:    Float32Array(w*h*4)  prev.color sampled at each pixel's previous position
//   lineMask: Float32Array(w*h)    prev.lineMask sampled the same way
//   valid:    Uint8Array(w*h)      1 where the warp is trustworthy, 0 otherwise
// }
// or null while this is not implemented (the harness then skips the metrics that need it).
export function warpPrevious(prev, cur) {
	const w = cur.width;
	const h = cur.height;

	// TODO (Part A5): For every pixel (x, y) of cur:
	//   - skip background pixels (cur.depth == 0) and mark them invalid
	//   - compute the previous position in pixels from cur.motion (uv units, so scale by w and h)
	//   - mark the pixel invalid if that position is outside the image, or if it was hidden in the
	//     previous frame (disocclusion): compare the depth stored in prev at that position with
	//     this pixel's depth, and reject it when they differ by more than a few percent
	//   - otherwise sample prev.color (4 channels) and prev.lineMask (1 channel) there with
	//     bilinear() and store them
	// Then remove the `return null` below and return { color, lineMask, valid }.
	return null;
}
