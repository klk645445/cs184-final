import * as THREE from 'three';
import { loadShader } from '../core/ShaderLib.js';
import { FullscreenPass, makePassMaterial } from '../core/FullscreenPass.js';

// A rendering style. A style is made of:
//
//   surface   a surface shader (path under shaders/), run per mesh in the surface pass.
//             Defaults to the Base style's Lambertian shading.
//   post      a list of full-screen passes run on the surface image, one after another.
//             Each entry is { frag: 'path/to/shader.frag', uniforms: { ... } }, where the
//             uniforms are only for that pass (e.g. the blur direction).
//   params    the style's tweakable uniforms. Each entry becomes a uniform with that name,
//             shared by the surface shader and every post pass, and a control in the GUI:
//               { value: 4, min: 1, max: 8, step: 1, label: 'Bands' }   number slider
//               { value: true, label: 'Cross-hatching' }                checkbox
//               { value: '#1a1a1a', color: true, label: 'Ink' }          color (sRGB string)
//               { value: 0, options: { A: 0, B: 1 }, label: 'Mode' }     dropdown
//               { value: someTexture, gui: false }                      texture, no control
//
// To add a style, create a file in src/styles/ like the existing ones and add it to the list in
// src/styles/index.js.

export class Style {
	constructor({ id, name, track, surface = 'styles/base.frag', post = [], params = {} }) {
		this.id = id;
		this.name = name;
		this.track = track;
		this.surface = surface;
		this.post = post;
		this.params = params;
		this.postPasses = [];
		this.surfaceSource = null;

		// One uniform per param. Colors become THREE.Color (converted from sRGB to linear).
		this.uniforms = {};
		for (const [key, p] of Object.entries(params)) {
			this.uniforms[key] = { value: p.color ? new THREE.Color(p.value) : p.value };
		}
	}

	// Loads (or reloads) the shaders and builds the post-processing passes.
	async load(fullscreenVert, shared) {
		const [surfaceSource, ...postSources] = await Promise.all([
			loadShader(this.surface),
			...this.post.map((p) => loadShader(p.frag)),
		]);
		this.surfaceSource = surfaceSource;
		this.postPasses.forEach((p) => p.dispose());
		this.postPasses = this.post.map((p, i) => new FullscreenPass(makePassMaterial(fullscreenVert, postSources[i], {
			...shared,
			tInput: { value: null },
			...this.uniforms,
			...(p.uniforms ?? {}),
		})));
	}

	// Adds this style's controls to a lil-gui folder.
	buildGUI(folder) {
		for (const [key, p] of Object.entries(this.params)) {
			if (p.gui === false) continue;
			const label = p.label ?? key;
			let ctrl;
			if (p.color) {
				const proxy = { color: p.value };
				ctrl = folder.addColor(proxy, 'color').name(label).onChange((v) => {
					p.value = v;
					this.uniforms[key].value.set(v);
					this.onParamChange(key);
				});
			} else if (p.options) {
				ctrl = folder.add(this.uniforms[key], 'value', p.options).name(label).onChange(() => this.onParamChange(key));
			} else if (typeof p.value === 'boolean') {
				ctrl = folder.add(this.uniforms[key], 'value').name(label).onChange(() => this.onParamChange(key));
			} else {
				ctrl = folder.add(this.uniforms[key], 'value', p.min, p.max, p.step).name(label).onChange(() => this.onParamChange(key));
			}
			if (p.title) ctrl.domElement.title = p.title;
		}
	}

	// Called after a GUI control changes. Override for params that need more than a uniform
	// update (e.g. rebuilding a texture).
	onParamChange(key) {}
}
