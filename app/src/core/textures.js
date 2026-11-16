import * as THREE from 'three';

// Procedural textures used by the styles, generated in JavaScript so the repo has no image assets.

// A 256 x 1 color ramp from a list of sRGB color strings, evenly spaced from u = 0 to u = 1.
// Colors are stored in linear RGB, like every other color in the pipeline.
export function makeRampTexture(stops, texture = null) {
	const size = 256;
	const data = new Uint8Array(size * 4);
	const colors = stops.map((s) => new THREE.Color(s));
	const c = new THREE.Color();
	for (let i = 0; i < size; i++) {
		const t = (i / (size - 1)) * (colors.length - 1);
		const k = Math.min(Math.floor(t), colors.length - 2);
		c.copy(colors[k]).lerp(colors[k + 1], t - k);
		data[i * 4 + 0] = Math.round(c.r * 255);
		data[i * 4 + 1] = Math.round(c.g * 255);
		data[i * 4 + 2] = Math.round(c.b * 255);
		data[i * 4 + 3] = 255;
	}
	if (texture) {
		texture.image.data.set(data);
		texture.needsUpdate = true;
		return texture;
	}
	const tex = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat);
	tex.magFilter = THREE.LinearFilter;
	tex.minFilter = THREE.LinearFilter;
	tex.wrapS = THREE.ClampToEdgeWrapping;
	tex.wrapT = THREE.ClampToEdgeWrapping;
	tex.needsUpdate = true;
	return tex;
}

// Seeded random number generator, so generated textures look the same on every run.
export function mulberry32(seed) {
	return function () {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// A tileable paper texture: several octaves of value noise plus fine fibers, values in [0, 1].
export function makePaperTexture(size = 512, seed = 7) {
	const rand = mulberry32(seed);
	const field = new Float32Array(size * size);

	const octave = (cells, amp) => {
		const lattice = new Float32Array(cells * cells).map(() => rand());
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const fx = (x / size) * cells;
				const fy = (y / size) * cells;
				const x0 = Math.floor(fx);
				const y0 = Math.floor(fy);
				const tx = fx - x0;
				const ty = fy - y0;
				const sx = tx * tx * (3 - 2 * tx);
				const sy = ty * ty * (3 - 2 * ty);
				const at = (i, j) => lattice[((j % cells) * cells) + (i % cells)];
				const a = at(x0, y0);
				const b = at(x0 + 1, y0);
				const c = at(x0, y0 + 1);
				const d = at(x0 + 1, y0 + 1);
				field[y * size + x] += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy);
			}
		}
	};
	octave(8, 0.35);
	octave(32, 0.3);
	octave(128, 0.25);
	octave(256, 0.1);

	// Short random fibers
	for (let f = 0; f < 1500; f++) {
		const x = rand() * size;
		const y = rand() * size;
		const a = rand() * Math.PI;
		const len = 4 + rand() * 12;
		for (let s = 0; s < len; s++) {
			const px = Math.floor(x + Math.cos(a) * s + size) % size;
			const py = Math.floor(y + Math.sin(a) * s + size) % size;
			field[py * size + px] += 0.08;
		}
	}

	let min = Infinity;
	let max = -Infinity;
	for (const v of field) {
		min = Math.min(min, v);
		max = Math.max(max, v);
	}
	const data = new Uint8Array(size * size * 4);
	for (let i = 0; i < size * size; i++) {
		const v = Math.round(((field[i] - min) / (max - min)) * 255);
		data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
		data[i * 4 + 3] = 255;
	}
	const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
	tex.wrapS = THREE.RepeatWrapping;
	tex.wrapT = THREE.RepeatWrapping;
	tex.magFilter = THREE.LinearFilter;
	tex.minFilter = THREE.LinearMipmapLinearFilter;
	tex.generateMipmaps = true;
	tex.needsUpdate = true;
	return tex;
}
