import test from 'node:test';
import assert from 'node:assert/strict';
import { coherence, INK_THRESHOLD } from '../app/src/metrics/coherence.js';
import { warpPrevious } from '../app/src/metrics/warp.js';

// Grey pixels: each value v becomes RGB (v, v, v), whose luminance is v.
const rgba = (values) => Float32Array.from(values.flatMap((v) => [v, v, v, 1]));

function run(current, previous, valid = current.map(() => 1), threshold) {
	const cur = { width: current.length, height: 1, color: rgba(current) };
	const warped = { color: rgba(previous), valid: Uint8Array.from(valid) };
	return coherence(null, cur, warped, threshold);
}

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test('C4 identical frames have zero incoherence', () => {
	assert.equal(run([0.9, 0.05, 0.05, 0.9], [0.9, 0.05, 0.05, 0.9]), 0);
});
test('C4 a stroke that moves one pixel is counted where it left and where it arrived', () => {
	// Stroke pixels are 1 and 2 (cur) or 0 and 1 (warped): the union is 0, 1, 2.
	close(run([0.9, 0.0, 0.0, 0.9], [0.0, 0.0, 0.9, 0.9]), (0.9 + 0 + 0.9) / 3);
});
test('C4 paper-only pixels do not dilute the average', () => {
	close(run([0.0, 0.9, 0.8, 0.95], [0.2, 0.85, 0.9, 0.95]), 0.2);
});
test('C4 invalid pixels are excluded from numerator and denominator', () => {
	close(run([0.0, 0.0, 0.9], [0.4, 0.9, 0.0], [1, 0, 0]), 0.4);
});
test('C4 the threshold is strict and applies to either frame', () => {
	close(run([INK_THRESHOLD, 0.9, 0.49], [0.9, INK_THRESHOLD, 0.9]), 0.41);
	close(run([0.6, 0.9], [0.9, 0.9], [1, 1], 0.7), 0.3);
});
test('C4 frames without strokes return NaN rather than a fabricated zero', () => {
	assert.ok(Number.isNaN(run([0.9, 0.8], [0.95, 0.7])));
	assert.ok(Number.isNaN(run([0.0, 0.0], [0.0, 0.0], [0, 0])));
	assert.ok(Number.isNaN(run([], [])));
});
test('C4 uses luminance weights, not the red channel alone', () => {
	const cur = { width: 1, height: 1, color: Float32Array.from([1, 0, 0, 1]) }; // luma 0.2126
	const warped = { color: Float32Array.from([0, 1, 0, 1]), valid: Uint8Array.from([1]) }; // luma 0.7152
	close(coherence(null, cur, warped), 0.7152 - 0.2126);
});
test('C4 composes with A5: a static frame warps onto itself with zero incoherence', () => {
	const w = 4, h = 3, n = w * h;
	const frame = {
		width: w, height: h,
		color: rgba(Array.from({ length: n }, (_, i) => (i % 3 === 0 ? 0.02 : 0.9))),
		lineMask: new Float32Array(n),
		motion: new Float32Array(n * 2),
		depth: new Float32Array(n).fill(2),
	};
	const warped = warpPrevious(frame, frame);
	assert.equal(coherence(frame, frame, warped), 0);
});
