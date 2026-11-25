import { renderMotion, identity, translation, near } from './webgl-helpers.js';

function checkMotion(pixel, x, y) { near(pixel[0], x); near(pixel[1], y); }

export const tests = [
	['A1 rejects motion that overflows the production half-float target', async () => {
		const previousViewProjection = translation(1, 0, -0.25);
		previousViewProjection[15] = 0.000002;
		checkMotion((await renderMotion({ previousViewProjection, halfFloat: true }))[3], 0, 0);
	}],
	['A1 preserves large representable motion at production half-float precision', async () => {
		const previousViewProjection = translation(1, 0, -0.25);
		previousViewProjection[15] = 0.0001;
		// Half-float rounding of half*(1/32 - 1.03125/0.0001) and half*(1/32 - 0.03125/0.0001).
		checkMotion((await renderMotion({ previousViewProjection, halfFloat: true }))[3], -5156, -156.25);
	}],
	['A1 stationary geometry has zero motion', async () => {
		checkMotion((await renderMotion())[3], 0, 0);
	}],
	['A1 model translation has current-minus-previous UV sign and scale', async () => {
		checkMotion((await renderMotion({ previousModel: translation(-0.25, 0.5, 0) }))[3], 0.125, -0.25);
	}],
	['A1 camera translation contributes to motion', async () => {
		checkMotion((await renderMotion({ previousViewProjection: translation(-0.25, 0.5, -0.25) }))[3], 0.125, -0.25);
	}],
	['A1 previous model is applied before previous view-projection', async () => {
		const previousViewProjection = translation(0, 0, -0.25);
		previousViewProjection[0] = 2;
		// At x_ndc=1/32: previous x=2*(1/32-1/4)=-7/16; half the difference=15/64.
		checkMotion((await renderMotion({ previousModel: translation(-0.25, 0, 0), previousViewProjection }))[3], 0.234375, 0);
	}],
	['A1 current and previous projections divide by their own w', async () => {
		const previousViewProjection = translation(0, 0, -0.25);
		previousViewProjection[15] = 2;
		// Current NDC=1/32, previous NDC=1/64: UV difference=1/128.
		checkMotion((await renderMotion({ previousViewProjection }))[3], 0.0078125, 0.0078125);
	}],
	['A1 zero previous w produces finite zero motion', async () => {
		const previousViewProjection = identity(); previousViewProjection[15] = 0;
		checkMotion((await renderMotion({ previousViewProjection }))[3], 0, 0);
	}],
	['A1 current projection also performs its perspective divide', async () => {
		const projection = identity(); projection[15] = 2;
		// At the sampled pixel current NDC=1/32, but object/previous x=1/16.
		checkMotion((await renderMotion({ projection }))[3], -0.015625, -0.015625);
	}],
	['A1 previous position behind the camera produces zero motion', async () => {
		const previousViewProjection = identity(); previousViewProjection[15] = -1;
		checkMotion((await renderMotion({ previousViewProjection }))[3], 0, 0);
	}],
	['A1 preserves normal/depth, albedo/id, lighting, and mesh UV channels', async () => {
		const pixels = await renderMotion({ previousModel: translation(-0.25, 0, 0) });
		[0, 0, 1, 0.25].forEach((v, i) => near(pixels[0][i], v));
		[0.2, 0.4, 0.6, 7 / 255].forEach((v, i) => near(pixels[1][i], v));
		near(pixels[2][0], 1); near(pixels[2][3], 1);
		near(pixels[3][2], 0.515625); near(pixels[3][3], 0.515625);
	}],
];
