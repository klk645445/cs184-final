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
// Missing/resized history returns all-invalid buffers. The depth gate is a conservative
// 3% consistency heuristic, not a proof of visibility: view-axis depth changes with the
// camera, and separate surfaces can share a depth. Background (including hull pixels
// outside the geometry) is intentionally excluded by the captured-frame contract.
export function warpPrevious(prev, cur) {
	const w = cur.width;
	const h = cur.height;
	const count = w * h;
	const color = new Float32Array(count * 4);
	const lineMask = new Float32Array(count);
	const valid = new Uint8Array(count);
	const result = { color, lineMask, valid };
	if (!prev || prev.width !== w || prev.height !== h) return result;

	const relativeDepthTolerance = 0.03;
	const motionNoisePixels = 0.001;
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const i = y * w + x;
		const depth = cur.depth[i];
		const mx = cur.motion[i * 2], my = cur.motion[i * 2 + 1];
		if (!(depth > 0) || !Number.isFinite(depth) || !Number.isFinite(mx) || !Number.isFinite(my)) continue;
		// Stationary GPU captures can contain tiny matrix/half-float roundoff.
		// Suppress sub-thousandth-pixel noise before it touches a different surface;
		// genuine fractional motion above this floor still uses bilinear sampling.
		const dxPixels = mx * w, dyPixels = my * h;
		const px = x + 0.5 - (Math.abs(dxPixels) < motionNoisePixels ? 0 : dxPixels);
		const py = y + 0.5 - (Math.abs(dyPixels) < motionNoisePixels ? 0 : dyPixels);
		if (px < 0 || px >= w || py < 0 || py >= h) continue;

		// Match bilinear()'s clamped pixel-center footprint. Check individual depth
		// contributors: averaging foreground/background depths could fake a match.
		const fx = Math.min(Math.max(px - 0.5, 0), w - 1);
		const fy = Math.min(Math.max(py - 0.5, 0), h - 1);
		const x0 = Math.floor(fx), y0 = Math.floor(fy);
		const tx = fx - x0, ty = fy - y0;
		let consistent = true;
		for (let dy = 0; dy < 2 && consistent; dy++) for (let dx = 0; dx < 2; dx++) {
			const weight = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty);
			if (weight === 0) continue;
			const d = prev.depth[Math.min(y0 + dy, h - 1) * w + Math.min(x0 + dx, w - 1)];
			if (!(d > 0) || !Number.isFinite(d) || Math.abs(d - depth) > relativeDepthTolerance * depth) {
				consistent = false; break;
			}
		}
		if (!consistent) continue;

		const r = bilinear(prev.color, w, h, 4, px, py, 0);
		const g = bilinear(prev.color, w, h, 4, px, py, 1);
		const b = bilinear(prev.color, w, h, 4, px, py, 2);
		const a = bilinear(prev.color, w, h, 4, px, py, 3);
		const line = bilinear(prev.lineMask, w, h, 1, px, py);
		if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) ||
			!Number.isFinite(a) || !Number.isFinite(line)) continue;
		color[i * 4] = r; color[i * 4 + 1] = g; color[i * 4 + 2] = b; color[i * 4 + 3] = a;
		lineMask[i] = line;
		valid[i] = 1;
	}
	return result;
}
