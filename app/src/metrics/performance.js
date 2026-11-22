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

	const pixel = new Uint8Array(4);
	const syncWithGPU = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

	// Give the browser a turn so a long measurement does not look like a hang.
	const yieldToBrowser = () => new Promise((resolve) => requestAnimationFrame(resolve));

	// Warm-up. The first frames of a style include shader compilation, texture uploads and render
	// target allocation, which would otherwise land entirely in frame 0.
	const WARMUP_FRAMES = 8;
	for (let i = 0; i < WARMUP_FRAMES; i++) renderFrame(i);
	syncWithGPU();
	await yieldToBrowser();

	for (let i = 0; i < frames; i++) {
		const start = performance.now();
		renderFrame(i);
		syncWithGPU();
		times.push(performance.now() - start);

		// Yield occasionally. Timing is taken around renderFrame + sync only, so this does not enter the measurement.
		if (i % 15 === 14) await yieldToBrowser();
	}

	const meanMs = mean(times);
	return { meanMs, p95Ms: percentile(times, 0.95), fps: 1000 / meanMs };
}
