import * as THREE from 'three';
import { Style } from './Style.js';
import { makePaperTexture } from '../core/textures.js';

// Watercolor (Track D). Post chain: blur horizontal -> blur vertical -> shaders/styles/watercolor.frag

export class WatercolorStyle extends Style {
	constructor() {
		super({
			id: 'watercolor',
			name: 'Watercolor',
			track: 'D',
			post: [
				{ frag: 'pipeline/blur.frag', uniforms: { uDirection: { value: new THREE.Vector2(1, 0) } } },
				{ frag: 'pipeline/blur.frag', uniforms: { uDirection: { value: new THREE.Vector2(0, 1) } } },
				{ frag: 'styles/watercolor.frag' },
			],
			params: {
				uBlurRadius: { value: 4, min: 0, max: 30, step: 0.5, label: 'Abstraction blur (px)' },
				uWobble: { value: 3, min: 0, max: 15, step: 0.5, label: 'Wobble (px)' },
				uEdgeDarkening: { value: 1.5, min: 0, max: 5, step: 0.05, label: 'Edge darkening' },
				uGranulation: { value: 0.4, min: 0, max: 1.5, step: 0.01, label: 'Granulation' },
				uTurbulence: { value: 0.3, min: 0, max: 1.5, step: 0.01, label: 'Turbulence' },
				uPaperScale: { value: 3, min: 0.5, max: 10, step: 0.1, label: 'Paper scale' },
			},
		});
		this.uniforms.tPaper = { value: makePaperTexture() };
	}
}
