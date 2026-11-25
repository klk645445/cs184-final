import test from 'node:test';
import assert from 'node:assert/strict';
import { lineStability } from '../app/src/metrics/lineStability.js';
import { warpPrevious } from '../app/src/metrics/warp.js';

function run(current, previous, valid = current.map(() => 1), rawPrevious = []) {
	const cur = { width: current.length, height: 1, lineMask: Float32Array.from(current) };
	const prev = { lineMask: Float32Array.from(rawPrevious) };
	const warped = { lineMask: Float32Array.from(previous), valid: Uint8Array.from(valid) };
	return lineStability(prev, cur, warped);
}
test('A6 identical nonempty lines have zero instability', () => {
	assert.equal(run([0, 1, 1, 0], [0, 1, 1, 0]), 0);
});
test('A6 entirely appearing lines have instability one', () => {
	assert.equal(run([0, 1, 1], [0, 0, 0]), 1);
});
test('A6 entirely disappearing lines have instability one', () => {
	assert.equal(run([0, 0, 0], [0, 1, 1]), 1);
});
test('A6 divides changed membership by union, not frame size or sum', () => {
	assert.equal(run([1, 1, 0, 0, 0, 0], [0, 1, 1, 0, 0, 0]), 2 / 3);
});
test('A6 invalid pixels are excluded from both numerator and denominator', () => {
	assert.equal(run([1, 1, 0, 1], [1, 0, 1, 0], [1, 0, 0, 1]), 0.5);
});
test('A6 threshold is strictly greater than half for both masks', () => {
	assert.equal(run([0.5, 0.5001, 0.2, 0.9], [0.5, 0.9, 0.6, 0.5001]), 1 / 3);
});
test('A6 all-background masks return NaN rather than a fabricated zero', () => {
	assert.ok(Number.isNaN(run([0, 0.5, 0], [0.5, 0, 0])));
});
test('A6 all-invalid line pixels return NaN', () => {
	assert.ok(Number.isNaN(run([1, 1], [1, 0], [0, 0])));
});
test('A6 zero-sized masks return NaN', () => {
	assert.ok(Number.isNaN(run([], [])));
});
test('A6 uses warped history instead of the unwarped previous mask', () => {
	assert.equal(run([1, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 0]), 0);
});
test('A6 changes are symmetric and nonline pixels do not dilute the score', () => {
	assert.equal(run([1, 0, 0, 0], [0, 1, 0, 0]), 1);
	assert.equal(run([0, 1, 0, 0], [1, 0, 0, 0]), 1);
});
test('A6 skips invalid garbage masks before classification', () => {
	assert.equal(run([1, NaN, Infinity], [1, Infinity, NaN], [1, 0, 0]), 0);
});
test('A6 processes all captured rows and does not mutate input buffers', () => {
	const prev = { lineMask: new Float32Array(6) };
	const cur = { width: 3, height: 2, lineMask: Float32Array.from([0, 0, 0, 1, 1, 0]) };
	const warped = { valid: new Uint8Array(6).fill(1), lineMask: Float32Array.from([0, 0, 0, 1, 0, 1]) };
	const before = structuredClone({ prev, cur, warped });
	assert.equal(lineStability(prev, cur, warped), 2 / 3);
	assert.deepEqual({ prev, cur, warped }, before);
});
test('A6 accepts actual A5 output for a known one-pixel translating line', () => {
	const make = (mask) => ({ width: 4, height: 1, lineMask: Float32Array.from(mask),
		color: new Float32Array(16), depth: new Float32Array(4).fill(2), motion: new Float32Array(8) });
	const prev = make([0, 1, 0, 0]), cur = make([0, 0, 1, 0]);
	for (let i = 0; i < 4; i++) cur.motion[i * 2] = 0.25;
	assert.equal(lineStability(prev, cur, warpPrevious(prev, cur)), 0);
});
