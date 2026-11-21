import { renderEdges, assert, near } from './webgl-helpers.js';

const flat = () => ({ depth: 2 });
const step = (x) => ({ depth: x < 16 ? 2 : 2.2 });

export const tests = [
	['A2 flat foreground has no depth edges, including texture borders', async () => {
		near((await renderEdges(flat)).count, 0);
	}],
	['A2 background alone has no lines', async () => {
		near((await renderEdges(() => ({ depth: 0, normal: [0, 0, 0] }))).count, 0);
	}],
	['A2 foreground/background silhouettes draw on both sides', async () => {
		const image = await renderEdges((x) => ({ depth: x < 16 ? 0 : 2 }));
		near(image.at(15, 16), 1); near(image.at(16, 16), 1);
		near(image.at(4, 16), 0); near(image.at(24, 16), 0);
	}],
	['A2 background is farther than even very distant foreground', async () => {
		const image = await renderEdges((x) => ({ depth: x < 16 ? 0 : 5000000 }));
		near(image.at(15, 16), 1); near(image.at(16, 16), 1);
	}],
	['A2 vertical foreground depth discontinuity makes a line', async () => {
		const image = await renderEdges(step);
		near(image.at(15, 16), 1); near(image.at(16, 16), 1);
		near(image.at(8, 16), 0); near(image.at(24, 16), 0);
	}],
	['A2 horizontal depth discontinuity also makes a line', async () => {
		const image = await renderEdges((x, y) => ({ depth: y < 16 ? 2 : 2.2 }));
		near(image.at(16, 15), 1); near(image.at(16, 16), 1);
	}],
	['A2 depth comparison is relative, not tied to scene distance', async () => {
		const nearImage = await renderEdges(step);
		const farImage = await renderEdges((x) => ({ depth: x < 16 ? 20 : 22 }));
		assert(nearImage.count > 0, 'Fixture must contain a detected edge');
		nearImage.mask.forEach((v, i) => near(farImage.mask[i], v));
	}],
	['A2 raising the threshold suppresses a small depth jump', async () => {
		near((await renderEdges(step)).at(15, 16), 1);
		near((await renderEdges(step, { depthThreshold: 0.2 })).count, 0);
	}],
	['A2 line width expands the depth edge footprint', async () => {
		near((await renderEdges(step, { width: 2 })).count, 64);
		near((await renderEdges(step, { width: 6 })).count, 192);
	}],
	['A2 subpixel widths retain a thin partially covered line', async () => {
		const image = await renderEdges(step, { width: 0.5 });
		near(image.at(15, 16), 0.5);
		assert(image.count > 0, 'Subpixel width must not disappear');
	}],
];
