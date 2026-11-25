import * as THREE from 'three';
import { mulberry32 } from '../core/textures.js';

// Tonal art map (Track C), after Praun et al., "Real-Time Hatching", SIGGRAPH 2001.
//
// A tonal art map is a set of hatching textures: TONES tones (light to dark) at LEVELS resolutions
// (mip levels, 1024 x 1024 down to 32 x 32 by default). The two finest levels are there for
// close-ups: without them the GPU has to magnify the 256 x 256 level and the strokes go soft and
// wide. Two rules make it work in real time:
//
//   nesting in tone:        every stroke in a tone also appears in all darker tones, so blending
//                           between neighbouring tones never makes strokes pop in or out.
//   nesting in resolution:  every stroke in a level also appears in all finer levels of the same
//                           tone, drawn with the same width in pixels. When the object moves away
//                           and the GPU switches to a coarser mip level, the strokes keep the same
//                           width on screen instead of shrinking.
//
// images[tone][level] is a canvas of size (size >> level), white paper with black strokes.
// build() packs the tones into two RGBA textures with these canvases as hand-made mipmaps:
//   textures[0].r/g/b = tones 0/1/2, textures[1].r/g/b = tones 3/4/5.

export const TONES = 6;

export class TonalArtMap {
	constructor({ size = 1024, levels = 6, seed = 1 } = {}) {
		this.size = size;
		this.levels = levels;
		this.seed = seed;
		// Target fraction of ink for each tone, light to dark
		this.targetDarkness = [0.08, 0.2, 0.33, 0.47, 0.62, 0.78];
		// Stroke width in pixels, the same at every level
		this.strokeWidth = 1.5;
		this.strokes = [];
		this.images = [];
		this.textures = [null, null];
		this.clear();
	}

	// Resets every image to blank paper.
	clear() {
		this.images = [];
		for (let t = 0; t < TONES; t++) {
			const row = [];
			for (let l = 0; l < this.levels; l++) {
				const s = this.size >> l;
				const canvas = document.createElement('canvas');
				canvas.width = canvas.height = s;
				const ctx = canvas.getContext('2d', { willReadFrequently: true });
				ctx.fillStyle = '#fff';
				ctx.fillRect(0, 0, s, s);
				row.push(canvas);
			}
			this.images.push(row);
		}
	}

	// Part C2: Fills this.images with hatching strokes, following the two nesting rules above.
	generate() {
		this.clear();
		const rand = mulberry32(this.seed);
		this.strokes = [];

		for (let t = 0; t < TONES; t++) {
			// Tones 0 to 2 are single hatching, darker tones add strokes in the cross direction.
			// Strokes already in lighter tones are in images[t] too, because every stroke is drawn
			// into all darker tones when it is added (nesting in tone).
			const baseAngle = t < 3 ? 0 : Math.PI / 2;

			for (let level = this.levels - 1; level >= 0; level--) {
				const canvas = this.images[t][level];
				const s = canvas.width;
				// Reading a large canvas back is the slow part, so strokes are added in batches.
				// Each batch covers about half of the remaining ink, estimated from the average
				// stroke size (length 0.45 of the tile, strokeWidth pixels wide), and the darkness
				// is only measured again between batches.
				const inkPerStroke = (0.45 * s * this.strokeWidth) / (s * s);
				let guard = 0;
				for (;;) {
					const data = this.pixels(canvas);
					const deficit = this.targetDarkness[t] - this.darkness(canvas, data);
					if (deficit <= 0 || guard >= 4000) break;
					const batch = Math.max(1, Math.floor((0.5 * deficit) / inkPerStroke));
					for (let b = 0; b < batch && guard < 4000; b++, guard++) {
						const stroke = this.pickStroke(canvas, baseAngle, rand, 6, data);
						stroke.tone = t;
						stroke.level = level;
						this.strokes.push(stroke);
						// Let the next candidates in this batch see the new stroke, so they avoid it
						this.markStroke(data, s, stroke);
						// Nesting in resolution and tone: this level and every finer level, of this
						// tone and every darker one
						for (let tt = t; tt < TONES; tt++) {
							for (let l = level; l >= 0; l--) {
								this.drawStroke(this.images[tt][l], stroke.u, stroke.v, stroke.length, stroke.angle, this.strokeWidth);
							}
						}
					}
				}
			}
		}
	}

	// Picks the best of a few random candidate strokes: the one that passes over the least ink in
	// the current image, which keeps the hatching even (Praun et al. Section 3.2).
	//   data: optional pixels of the canvas (see pixels()), to avoid reading it back again
	pickStroke(canvas, baseAngle, rand, candidates = 6, data = this.pixels(canvas)) {
		const s = canvas.width;
		let best = null;
		let bestInk = Infinity;
		for (let c = 0; c < candidates; c++) {
			const stroke = {
				u: rand(),
				v: rand(),
				length: 0.3 + 0.3 * rand(),
				angle: baseAngle + (rand() - 0.5) * 0.15,
			};
			// Average ink along the stroke, sampled at a few points with wrap-around
			let ink = 0;
			const samples = 12;
			for (let i = 0; i < samples; i++) {
				const f = i / (samples - 1) - 0.5;
				const x = Math.floor((((stroke.u + Math.cos(stroke.angle) * stroke.length * f) % 1) + 1) % 1 * s);
				const y = Math.floor((((stroke.v + Math.sin(stroke.angle) * stroke.length * f) % 1) + 1) % 1 * s);
				ink += 1 - data[(y * s + x) * 4] / 255;
			}
			if (ink < bestInk) {
				bestInk = ink;
				best = stroke;
			}
		}
		return best;
	}

	// Draws one stroke into a canvas, wrapping around the edges so the texture tiles.
	//   u, v:     center of the stroke in [0, 1] texture coordinates
	//   length:   in [0, 1] texture units
	//   angle:    in radians
	//   widthPx:  in pixels of this canvas (keep it the same for every level)
	drawStroke(canvas, u, v, length, angle, widthPx = 1.5) {
		const s = canvas.width;
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		const dx = (Math.cos(angle) * length * s) / 2;
		const dy = (Math.sin(angle) * length * s) / 2;
		ctx.strokeStyle = '#000';
		ctx.lineWidth = widthPx;
		ctx.lineCap = 'round';
		for (const ox of [-s, 0, s]) {
			for (const oy of [-s, 0, s]) {
				const cx = u * s + ox;
				const cy = v * s + oy;
				ctx.beginPath();
				ctx.moveTo(cx - dx, cy - dy);
				ctx.lineTo(cx + dx, cy + dy);
				ctx.stroke();
			}
		}
	}

	// The RGBA pixels of a canvas.
	pixels(canvas) {
		const s = canvas.width;
		return canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, s, s).data;
	}

	// Marks the centre line of a stroke as ink in a pixel copy, so that pickStroke() can avoid it
	// before the canvas is read back again. Only the copy changes, not the canvas.
	markStroke(data, s, stroke) {
		const steps = Math.ceil(stroke.length * s);
		for (let i = 0; i <= steps; i++) {
			const f = i / steps - 0.5;
			const x = Math.floor((((stroke.u + Math.cos(stroke.angle) * stroke.length * f) % 1) + 1) % 1 * s);
			const y = Math.floor((((stroke.v + Math.sin(stroke.angle) * stroke.length * f) % 1) + 1) % 1 * s);
			data[(y * s + x) * 4] = 0;
		}
	}

	// Fraction of the canvas covered by ink, in [0, 1].
	//   data: optional pixels of the canvas (see pixels())
	darkness(canvas, data = this.pixels(canvas)) {
		const s = canvas.width;
		let ink = 0;
		for (let i = 0; i < data.length; i += 4) ink += 1 - data[i] / 255;
		return ink / (s * s);
	}

	// Packs the images into two RGBA textures with hand-made mipmaps. Levels below the coarsest
	// generated level are filled in by downsampling, because WebGL needs the full mip chain.
	build() {
		this.textures.forEach((t) => t?.dispose());
		this.textures = [0, 1].map((pack) => {
			const mips = [];
			for (let l = 0; l < this.levels; l++) {
				const s = this.size >> l;
				const canvas = document.createElement('canvas');
				canvas.width = canvas.height = s;
				const ctx = canvas.getContext('2d');
				const out = ctx.createImageData(s, s);
				for (let c = 0; c < 3; c++) {
					const src = this.images[pack * 3 + c][l].getContext('2d', { willReadFrequently: true }).getImageData(0, 0, s, s).data;
					for (let i = 0; i < s * s; i++) out.data[i * 4 + c] = src[i * 4];
				}
				for (let i = 0; i < s * s; i++) out.data[i * 4 + 3] = 255;
				ctx.putImageData(out, 0, 0);
				mips.push(canvas);
			}
			let s = this.size >> (this.levels - 1);
			while (s > 1) {
				s >>= 1;
				const canvas = document.createElement('canvas');
				canvas.width = canvas.height = s;
				const ctx = canvas.getContext('2d');
				ctx.imageSmoothingQuality = 'high';
				ctx.drawImage(mips[mips.length - 1], 0, 0, s, s);
				mips.push(canvas);
			}

			const tex = new THREE.Texture(mips[0]);
			tex.mipmaps = mips;
			tex.generateMipmaps = false;
			tex.flipY = false;
			tex.wrapS = THREE.RepeatWrapping;
			tex.wrapT = THREE.RepeatWrapping;
			tex.minFilter = THREE.LinearMipmapLinearFilter;
			tex.magFilter = THREE.LinearFilter;
			tex.anisotropy = 8;
			tex.colorSpace = THREE.NoColorSpace;
			tex.needsUpdate = true;
			return tex;
		});
		return this.textures;
	}
}
