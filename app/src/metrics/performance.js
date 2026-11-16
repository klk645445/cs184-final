import { mean, percentile } from './image.js';

// Part D4: Performance. Measures how long the pipeline takes to render a frame.
//
//   renderer:    the THREE.WebGLRenderer
//   renderFrame: function(i) that renders frame i of the camera path
//   frames:      how many frames to time
// Returns { meanMs, p95Ms, fps }.
export async function measureFrameTimes(renderer, renderFrame, frames) {
	const gl = renderer.getContext();
	const times = [];

	// TODO (Part D4): Time `frames` calls of renderFrame(i). GPU work is asynchronous, so timing
	// the JavaScript call alone only measures how long it takes to submit the commands. Either:
	//   - read back one pixel with gl.readPixels after each frame and time with performance.now(),
	//     which forces the wait for the GPU (gl.finish() does not reliably wait in Chrome), or
	//   - use the EXT_disjoint_timer_query_webgl2 extension (gl.getExtension) to measure GPU time
	//     directly; it is not available in every browser, so fall back to the first method.
	// Render a few warm-up frames first, since the first frames include shader compilation.
	// Push each frame's time in milliseconds into `times`.

	const meanMs = mean(times);
	return { meanMs, p95Ms: percentile(times, 0.95), fps: 1000 / meanMs };
}
