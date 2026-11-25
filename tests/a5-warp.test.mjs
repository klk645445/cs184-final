import test from 'node:test';
import assert from 'node:assert/strict';
import { warpPrevious } from '../app/src/metrics/warp.js';

function frame(width = 4, height = 2) {
	const n = width * height;
	const f = { width, height, color: new Float32Array(n * 4), lineMask: new Float32Array(n),
		depth: new Float32Array(n).fill(2), motion: new Float32Array(n * 2) };
	for (let i = 0; i < n; i++) {
		const value = i % width + 10 * Math.floor(i / width);
		f.color.set([value, value + 20, value + 40, 1], i * 4);
		f.lineMask[i] = i % 2;
	}
	return f;
}
function near(a, b, tolerance = 1e-5) { assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${a} != ${b}`); }
function result(prev, cur) {
	const r = warpPrevious(prev, cur);
	assert.ok(r, 'A5 must return a warp instead of its null placeholder');
	assert.ok(r.color instanceof Float32Array);
	assert.ok(r.lineMask instanceof Float32Array);
	assert.ok(r.valid instanceof Uint8Array);
	assert.equal(r.color.length, cur.width * cur.height * 4);
	assert.equal(r.lineMask.length, cur.width * cur.height);
	assert.equal(r.valid.length, cur.width * cur.height);
	return r;
}
function invalidAt(r, i) {
	assert.equal(r.valid[i], 0); assert.equal(r.lineMask[i], 0);
	assert.deepEqual([...r.color.subarray(i * 4, i * 4 + 4)], [0, 0, 0, 0]);
}

test('A5 static foreground is exact identity including first/last rows and columns', () => {
	const prev = frame(), cur = frame(), r = result(prev, cur);
	assert.deepEqual([...r.valid], Array(8).fill(1));
	assert.deepEqual(r.color, prev.color); assert.deepEqual(r.lineMask, prev.lineMask);
});
test('A5 sub-thousandth-pixel motion roundoff does not reject static depth boundaries', () => {
	const prev = frame(), cur = frame(); prev.depth[0] = 0;
	cur.motion[2] = 0.0002 / 4; // actual stationary GPU capture showed ~0.00023px residual
	const r = result(prev, cur);
	assert.equal(r.valid[1], 1); assert.equal(r.color[4], 1); assert.equal(r.lineMask[1], 1);
});
test('A5 preserves real subpixel motion above the numerical noise floor', () => {
	const prev = frame(), cur = frame(); cur.motion[4] = 0.01 / 4;
	const r = result(prev, cur); assert.equal(r.valid[2], 1); near(r.color[8], 1.99);
});
test('A5 subtracts x/y UV motion with bottom-up rows and width/height scaling', () => {
	const prev = frame(), cur = frame();
	for (let i = 0; i < 8; i++) cur.motion.set([0.25, 0.5], i * 2); // one pixel right/up
	const r = result(prev, cur);
	for (let i = 0; i < 8; i++) {
		const x = i % 4, y = Math.floor(i / 4);
		if (!x || !y) invalidAt(r, i);
		else {
			assert.equal(r.valid[i], 1);
			assert.deepEqual(r.color.subarray(i * 4, i * 4 + 4), prev.color.subarray((i - 5) * 4, (i - 5) * 4 + 4));
			assert.equal(r.lineMask[i], prev.lineMask[i - 5]);
		}
	}
});
test('A5 fractional reprojection bilinearly samples RGBA and line coverage', () => {
	const prev = frame(), cur = frame(), i = 6;
	cur.motion.set([0.125, 0.25], i * 2); // half a pixel in each axis
	prev.color[1 * 4 + 3] = 0; prev.color[2 * 4 + 3] = 0.25;
	prev.color[5 * 4 + 3] = 0.5; prev.color[6 * 4 + 3] = 0.75;
	const r = result(prev, cur);
	assert.equal(r.valid[i], 1);
	[6.5, 26.5, 46.5, 0.375].forEach((v, c) => near(r.color[i * 4 + c], v));
	near(r.lineMask[i], 0.5);
});
test('A5 border positions inside the image clamp; positions outside are invalid', () => {
	for (const x of [-0.25, 0, 0.25, 3.75, 4, 4.25]) {
		const prev = frame(), cur = frame();
		cur.motion[0] = (0.5 - x) / 4;
		const r = result(prev, cur);
		if (x < 0 || x >= 4) invalidAt(r, 0);
		else { assert.equal(r.valid[0], 1); near(r.color[0], x <= 0.5 ? 0 : 3); }
	}
});
test('A5 current background and previous background are rejected', () => {
	const prev = frame(), cur = frame(); cur.depth[0] = 0; prev.depth[1] = 0;
	const r = result(prev, cur); invalidAt(r, 0); invalidAt(r, 1); assert.equal(r.valid[2], 1);
});
test('A5 depth gate is relative to current depth and accepts small differences only', () => {
	for (const depth of [0.2, 2, 200]) {
		const prev = frame(), cur = frame(); cur.depth.fill(depth); prev.depth.fill(depth);
		prev.depth[0] = depth * 1.029; prev.depth[1] = depth * 1.031;
		prev.depth[2] = depth * 0.971; prev.depth[3] = depth * 0.969;
		const r = result(prev, cur);
		assert.equal(r.valid[0], 1); invalidAt(r, 1); assert.equal(r.valid[2], 1); invalidAt(r, 3);
	}
});
test('A5 rejects a depth discontinuity even if its interpolated mean matches', () => {
	const prev = frame(), cur = frame(); cur.motion[4] = 0.125;
	prev.depth[1] = 1; prev.depth[2] = 3; // mean=2, but neither tap is the current surface
	invalidAt(result(prev, cur), 2);
});
test('A5 a fractional previous-background footprint is invalid', () => {
	const prev = frame(), cur = frame(); cur.motion[4] = 0.125;
	prev.depth[1] = 0; prev.depth[2] = 4;
	invalidAt(result(prev, cur), 2);
});
test('A5 zero-weight depth neighbors do not reject a static pixel', () => {
	const prev = frame(), cur = frame(); prev.depth[1] = 0; prev.depth[4] = 10; prev.depth[5] = NaN;
	const r = result(prev, cur); assert.equal(r.valid[0], 1); assert.equal(r.color[0], 0);
});
test('A5 nonfinite motion or nonpositive/nonfinite current depth is invalid', () => {
	for (const value of [NaN, Infinity, -Infinity]) for (const channel of [0, 1]) {
		const prev = frame(), cur = frame(); cur.motion[channel] = value;
		invalidAt(result(prev, cur), 0);
	}
	for (const value of [NaN, Infinity, -Infinity, -1, 0]) {
		const prev = frame(), cur = frame(); cur.depth[0] = value;
		invalidAt(result(prev, cur), 0);
	}
});
test('A5 nonpositive/nonfinite previous depth is invalid', () => {
	for (const value of [NaN, Infinity, -Infinity, -1, 0]) {
		const prev = frame(), cur = frame(); prev.depth[0] = value;
		invalidAt(result(prev, cur), 0);
	}
});
test('A5 nonfinite sampled color or line coverage leaves output invalid and zero', () => {
	for (const channel of [0, 1, 2, 3, 4]) {
		const prev = frame(), cur = frame();
		if (channel === 4) prev.lineMask[0] = NaN; else prev.color[channel] = Infinity;
		invalidAt(result(prev, cur), 0);
	}
});
test('A5 resized or missing history returns correctly sized all-invalid buffers', () => {
	for (const prev of [frame(2, 4), frame(2, 2), null]) {
		const cur = frame(), r = result(prev, cur);
		for (let i = 0; i < 8; i++) invalidAt(r, i);
	}
});
test('A5 one-pixel capture uses its sole sample without accessing outside arrays', () => {
	const prev = frame(1, 1), cur = frame(1, 1), r = result(prev, cur);
	assert.equal(r.valid[0], 1); assert.deepEqual(r.color, prev.color);
});
test('A5 does not mutate inputs or reuse output buffers across calls', () => {
	const prev = frame(), cur = frame(), before = structuredClone({ prev, cur });
	const a = result(prev, cur), b = result(prev, cur);
	assert.deepEqual({ prev, cur }, before);
	assert.notEqual(a.color.buffer, prev.color.buffer); assert.notEqual(a.color.buffer, cur.color.buffer);
	a.valid.fill(0); a.color.fill(-100); a.lineMask.fill(-100);
	assert.deepEqual([...b.valid], Array(8).fill(1)); assert.deepEqual(b.color, prev.color);
});
