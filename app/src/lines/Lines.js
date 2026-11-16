import * as THREE from 'three';
import { loadShader } from '../core/ShaderLib.js';
import { FullscreenPass, makePassMaterial } from '../core/FullscreenPass.js';

// The line pass (Track A). Lines are drawn on top of any style. They come from two methods that
// can be combined:
//
//   image space    edge detection on the G-buffer depth and normals (shaders/lines/edges.frag)
//   inverted hull  back faces pushed outwards along the normal (shaders/lines/hull.vert)
//
// Both write into one line mask, which the composite pass draws in the ink color.

export const LINE_MODES = {
	'Off': { depth: false, normal: false, hull: false },
	'Depth edges': { depth: true, normal: false, hull: false },
	'Normal edges': { depth: false, normal: true, hull: false },
	'Depth + normal edges': { depth: true, normal: true, hull: false },
	'Inverted hull': { depth: false, normal: false, hull: true },
	'Inverted hull + normal edges': { depth: false, normal: true, hull: true },
};

export class Lines {
	constructor() {
		this.mode = 'Off';
		this.uniforms = {
			uLineWidth: { value: 2 },
			uDepthThreshold: { value: 0.02 },
			uNormalThreshold: { value: 0.3 },
			uUseDepth: { value: false },
			uUseNormal: { value: false },
			uUseHull: { value: false },
			uInkColor: { value: new THREE.Color('#1a1a1a') },
			uLineOpacity: { value: 1 },
			tHull: { value: null },
		};
		this.edgesPass = null;
		this.setMode(this.mode);
	}

	get enabled() {
		return this.mode !== 'Off';
	}

	get useHull() {
		return this.uniforms.uUseHull.value;
	}

	setMode(mode) {
		this.mode = mode;
		const m = LINE_MODES[mode];
		this.uniforms.uUseDepth.value = m.depth;
		this.uniforms.uUseNormal.value = m.normal;
		this.uniforms.uUseHull.value = m.hull;
	}

	async load(fullscreenVert, shared) {
		const [edges, hullVert, hullFrag] = await Promise.all([
			loadShader('lines/edges.frag'),
			loadShader('lines/hull.vert'),
			loadShader('lines/hull.frag'),
		]);
		this.hullVert = hullVert;
		this.hullFrag = hullFrag;
		this.edgesPass?.dispose();
		this.edgesPass = new FullscreenPass(makePassMaterial(fullscreenVert, edges, {
			...shared,
			tInput: { value: null },
			...this.uniforms,
		}));
	}

	buildGUI(folder, onModeChange) {
		const state = { mode: this.mode, ink: '#1a1a1a' };
		folder.add(state, 'mode', Object.keys(LINE_MODES)).name('Mode').onChange((v) => {
			this.setMode(v);
			onModeChange?.();
		});
		folder.add(this.uniforms.uLineWidth, 'value', 0.5, 10, 0.1).name('Width (px)');
		folder.add(this.uniforms.uDepthThreshold, 'value', 0.001, 0.2, 0.001).name('Depth threshold');
		folder.add(this.uniforms.uNormalThreshold, 'value', 0.01, 1, 0.01).name('Normal threshold');
		folder.addColor(state, 'ink').name('Ink').onChange((v) => this.uniforms.uInkColor.value.set(v));
		folder.add(this.uniforms.uLineOpacity, 'value', 0, 1, 0.01).name('Opacity');
		return state;
	}
}
