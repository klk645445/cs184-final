// Helpers for working with captured frames (see Pipeline.capture()). A frame is
//   { width, height, color: Float32Array(w*h*4), lineMask: Float32Array(w*h),
//     motion: Float32Array(w*h*2), depth: Float32Array(w*h) }
// with pixel (x, y) at index y * width + x and y = 0 at the bottom row.

export function luminance(r, g, b) {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Luminance of pixel i of a frame's color buffer.
export function lumaAt(color, i) {
	return luminance(color[i * 4], color[i * 4 + 1], color[i * 4 + 2]);
}

// Bilinear sample of channel c of an image with `channels` values per pixel, at continuous pixel
// coordinates (x, y), where pixel centers are at integer + 0.5. Clamps at the borders.
export function bilinear(data, width, height, channels, x, y, c = 0) {
	const fx = Math.min(Math.max(x - 0.5, 0), width - 1);
	const fy = Math.min(Math.max(y - 0.5, 0), height - 1);
	const x0 = Math.floor(fx);
	const y0 = Math.floor(fy);
	const x1 = Math.min(x0 + 1, width - 1);
	const y1 = Math.min(y0 + 1, height - 1);
	const tx = fx - x0;
	const ty = fy - y0;
	const at = (xx, yy) => data[(yy * width + xx) * channels + c];
	return (at(x0, y0) * (1 - tx) + at(x1, y0) * tx) * (1 - ty) + (at(x0, y1) * (1 - tx) + at(x1, y1) * tx) * ty;
}

export function mean(values) {
	const v = values.filter((x) => Number.isFinite(x));
	return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
}

export function percentile(values, p) {
	const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
	if (!v.length) return NaN;
	return v[Math.min(v.length - 1, Math.floor(p * v.length))];
}
