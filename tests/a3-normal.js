import { renderEdges, assert, near } from './webgl-helpers.js';

const normalOnly = { depth: false, normal: true };
const crease = (x) => ({ depth: 2, normal: x < 16 ? [0, 0, 1] : [1, 0, 0] });

export const tests = [
	['A3 thin creases have a stable one-pixel stencil on odd viewport sizes', async () => {
		for (const width of [0.5, 1]) for (const boundary of [12, 6, 7]) for (const horizontal of [false, true]) {
			const image = await renderEdges((x, y) => ({ depth: 2, normal: (horizontal ? y : x) < boundary ? [0, 0, 1] : [1, 0, 0] }), { ...normalOnly, width, size: 37 });
			near(image.count, 37);
			near(horizontal ? image.at(18, boundary - 1) : image.at(boundary - 1, 18), Math.min(width, 1));
		}
	}],
	['A3 object boundaries use the same odd-size thin-line stencil', async () => {
		for (const width of [0.5, 1]) for (const boundary of [12, 6, 7]) {
			const image = await renderEdges((x) => ({ depth: 2, id: x < boundary ? 1 : 2 }), { ...normalOnly, width, size: 37 });
			near(image.count, 37); near(image.at(boundary - 1, 18), Math.min(width, 1));
		}
	}],
	['A3 equal normals on one object stay clear, including image borders', async () => {
		near((await renderEdges(() => ({ depth: 2 }), normalOnly)).count, 0);
	}],
	['A3 a vertical 90-degree crease draws a line', async () => {
		const image = await renderEdges(crease, normalOnly);
		near(image.at(15, 16), 1); near(image.at(16, 16), 1);
		near(image.at(8, 16), 0); near(image.at(24, 16), 0);
	}],
	['A3 a horizontal crease is also detected', async () => {
		const image = await renderEdges((x, y) => crease(y), normalOnly);
		near(image.at(16, 15), 1); near(image.at(16, 16), 1);
	}],
	['A3 normal length differences alone do not create a crease', async () => {
		const image = await renderEdges((x) => ({ depth: 2, normal: [0, 0, x < 16 ? 0.25 : 2] }), normalOnly);
		near(image.count, 0);
	}],
	['A3 touching object IDs separate even with identical normals and depth', async () => {
		const image = await renderEdges((x) => ({ depth: 2, id: x < 16 ? 1 : 2 }), { ...normalOnly, normalThreshold: 1 });
		near(image.at(15, 16), 1); near(image.at(16, 16), 1);
		near(image.at(8, 16), 0); near(image.at(24, 16), 0);
	}],
	['A3 background zero normals stay empty and finite', async () => {
		near((await renderEdges(() => ({ depth: 0, normal: [0, 0, 0] }), normalOnly)).count, 0);
	}],
	['A3 silhouettes handle background before normalizing', async () => {
		const image = await renderEdges((x) => ({ depth: x < 16 ? 0 : 2, normal: x < 16 ? [0, 0, 0] : [0, 0, 1] }), normalOnly);
		near(image.at(15, 16), 1); near(image.at(16, 16), 1);
		near(image.at(4, 16), 0);
	}],
	['A3 threshold changes reject or accept a shallow angle', async () => {
		const shallow = (x) => ({ depth: 2, normal: x < 16 ? [0, 0, 1] : [0.6, 0, 0.8] });
		near((await renderEdges(shallow, normalOnly)).count, 0);
		near((await renderEdges(shallow, { ...normalOnly, normalThreshold: 0.1 })).at(15, 16), 1);
	}],
	['A3 width expands the crease footprint', async () => {
		near((await renderEdges(crease, { ...normalOnly, width: 2 })).count, 64);
		near((await renderEdges(crease, { ...normalOnly, width: 6 })).count, 192);
	}],
	['A3 half-pixel width retains partial line coverage', async () => {
		near((await renderEdges(crease, { ...normalOnly, width: 0.5 })).at(15, 16), 0.5);
	}],
	['A3 disabling all line modes leaves no line mask', async () => {
		near((await renderEdges(crease, { depth: false, normal: false })).count, 0);
	}],
	['A3 combined mode retains both independent depth and normal edges', async () => {
		const field = (x) => ({ depth: x < 8 ? 2 : 2.2, normal: x < 24 ? [0, 0, 1] : [1, 0, 0] });
		const combined = await renderEdges(field, { depth: true, normal: true });
		near(combined.at(7, 16), 1); near(combined.at(23, 16), 1); near(combined.at(16, 16), 0);
		const d = await renderEdges(field);
		const n = await renderEdges(field, normalOnly);
		combined.mask.forEach((v, i) => near(v, Math.max(d.mask[i], n.mask[i])));
	}],
	['A3 hull coverage still composes by maximum with crease lines', async () => {
		const image = await renderEdges(crease, { ...normalOnly, hull: 0.4 });
		near(image.at(8, 16), 0.4); near(image.at(15, 16), 1);
		assert(image.mask.every((v) => v >= 0.4 - 1e-5), 'Hull mask must be preserved');
	}],
];
