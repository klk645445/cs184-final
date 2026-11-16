import * as THREE from 'three';
import { loadShader } from './ShaderLib.js';
import { FullscreenPass, makePassMaterial } from './FullscreenPass.js';

// The render pipeline. Every frame runs these passes in order:
//
//   1. G-buffer    every mesh with its gbuffer material  -> gbuffer (4 targets)
//   2. Surface     every mesh with the style's surface    -> surface
//                  shader
//   3. Post        the style's full-screen passes, one     -> ping / pong
//                  after another (may be none)
//   4. Lines       (a) inverted hull: depth pre-pass,      -> hull
//                      then back faces pushed outwards
//                  (b) edge detection on the G-buffer,      -> lineMask
//                      combined with the hull mask
//   5. Composite   style output + lines in ink color       -> composite
//   6. Output      composite or a debug view, to sRGB      -> screen
//
// Every intermediate texture is available to later passes through the shared uniforms
// (tNormal, tAlbedo, tLight, tMotion, tSurface) or the pass's own uniforms.

// Debug views, in the same order as the VIEW_ constants in shaders/pipeline/output.frag
export const VIEWS = [
	'Final',
	'Surface (before post)',
	'Normals',
	'Depth',
	'Albedo',
	'N·L',
	'Motion vectors',
	'Mesh UV',
	'Object ID',
	'Line mask',
	'Tonal art map',
];

function target(w, h, options = {}) {
	return new THREE.WebGLRenderTarget(w, h, {
		type: THREE.HalfFloatType,
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		depthBuffer: false,
		...options,
	});
}

export class Pipeline {
	constructor(renderer, sceneManager, shared) {
		this.renderer = renderer;
		this.sceneManager = sceneManager;
		this.shared = shared;
		this.width = 0;
		this.height = 0;
		this.targets = null;
		this.view = 0;
		this.tam = null;
		this.styledTexture = null;
	}

	async load() {
		const [vert, composite, output, capture] = await Promise.all([
			loadShader('pipeline/fullscreen.vert'),
			loadShader('pipeline/composite.frag'),
			loadShader('pipeline/output.frag'),
			loadShader('pipeline/capture.frag'),
		]);
		this.fullscreenVert = vert;
		const s = this.shared;

		this.compositePass?.dispose();
		this.outputPass?.dispose();
		this.capturePass?.dispose();
		this.compositePass = new FullscreenPass(makePassMaterial(vert, composite, {
			...s,
			tInput: { value: null },
			tLineMask: { value: null },
			uLinesEnabled: { value: false },
			uInkColor: { value: new THREE.Color() },
			uLineOpacity: { value: 1 },
		}));
		this.outputPass = new FullscreenPass(makePassMaterial(vert, output, {
			...s,
			tInput: { value: null },
			tComposite: { value: null },
			tLineMask: { value: null },
			tTAM0: { value: null },
			tTAM1: { value: null },
			uView: { value: 0 },
			uDepthMin: { value: 1 },
			uDepthMax: { value: 5 },
			uMotionScale: { value: 50 },
		}));
		this.capturePass = new FullscreenPass(makePassMaterial(vert, capture, {
			...s,
			tInput: { value: null },
			tComposite: { value: null },
			tLineMask: { value: null },
			uMode: { value: 0 },
		}));
	}

	setSize(width, height) {
		if (width === this.width && height === this.height) return;
		this.width = width;
		this.height = height;
		if (this.targets) Object.values(this.targets).forEach((t) => t.dispose());

		const gbuffer = target(width, height, {
			count: 4,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			depthBuffer: true,
		});
		['gNormal', 'gAlbedo', 'gLight', 'gMotion'].forEach((name, i) => (gbuffer.textures[i].name = name));

		this.targets = {
			gbuffer,
			surface: target(width, height, { depthBuffer: true }),
			ping: target(width, height),
			pong: target(width, height),
			hull: target(width, height, { type: THREE.UnsignedByteType, depthBuffer: true }),
			lineMask: target(width, height),
			composite: target(width, height),
			capture: target(width, height, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }),
		};

		const s = this.shared;
		s.uResolution.value.set(width, height);
		s.uTexel.value.set(1 / width, 1 / height);
		s.tNormal.value = gbuffer.textures[0];
		s.tAlbedo.value = gbuffer.textures[1];
		s.tLight.value = gbuffer.textures[2];
		s.tMotion.value = gbuffer.textures[3];
		s.tSurface.value = this.targets.surface.texture;
	}

	// Renders one frame. style: the current Style, lines: the Lines module.
	render(camera, style, lines) {
		const r = this.renderer;
		const sm = this.sceneManager;
		const t = this.targets;
		const scene = sm.scene;
		r.autoClear = false;

		// 1. G-buffer
		sm.usePass('gbuffer');
		r.setRenderTarget(t.gbuffer);
		r.setClearColor(0x000000, 0);
		r.clear(true, true, false);
		r.render(scene, camera);

		// 2. Surface
		sm.usePass('surface');
		r.setRenderTarget(t.surface);
		r.setClearColor(this.shared.uBackground.value, 1);
		r.clear(true, true, false);
		r.render(scene, camera);

		// 3. Style post-processing chain
		let input = t.surface.texture;
		let out = t.ping;
		for (const pass of style.postPasses) {
			pass.uniforms.tInput.value = input;
			pass.render(r, out);
			input = out.texture;
			out = out === t.ping ? t.pong : t.ping;
		}
		this.styledTexture = input;

		// 4. Lines
		r.setRenderTarget(t.lineMask);
		r.setClearColor(0x000000, 0);
		r.clear(true, false, false);
		if (lines.enabled) {
			if (lines.useHull) {
				r.setRenderTarget(t.hull);
				r.clear(true, true, false);
				sm.usePass('depth');
				r.render(scene, camera);
				sm.usePass('hull');
				r.render(scene, camera);
			}
			lines.edgesPass.uniforms.tHull.value = t.hull.texture;
			lines.edgesPass.render(r, t.lineMask);
		}

		// 5. Composite
		const cu = this.compositePass.uniforms;
		cu.tInput.value = input;
		cu.tLineMask.value = t.lineMask.texture;
		cu.uLinesEnabled.value = lines.enabled;
		cu.uInkColor.value.copy(lines.uniforms.uInkColor.value);
		cu.uLineOpacity.value = lines.uniforms.uLineOpacity.value;
		this.compositePass.render(r, t.composite);

		// 6. Output (to the screen)
		const ou = this.outputPass.uniforms;
		ou.tComposite.value = t.composite.texture;
		ou.tLineMask.value = t.lineMask.texture;
		ou.tTAM0.value = this.tam?.textures[0] ?? null;
		ou.tTAM1.value = this.tam?.textures[1] ?? null;
		ou.uView.value = this.view;
		const dist = camera.position.length();
		ou.uDepthMin.value = Math.max(dist - 1.2, 0.01);
		ou.uDepthMax.value = dist + 1.2;
		this.outputPass.render(r, null);

		sm.usePass('surface');
		this.endFrame(camera);
	}

	// Stores this frame's matrices as the "previous frame" for the next frame's motion vectors.
	endFrame(camera) {
		this.shared.uPrevViewProjection.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
		this.sceneManager.storePrevious();
	}

	// Makes the next frame's motion vectors zero, e.g. after jumping the camera to a new place.
	resetHistory(camera) {
		camera.updateMatrixWorld();
		this.sceneManager.scene.updateMatrixWorld(true);
		this.endFrame(camera);
	}

	// Reads the last rendered frame back to JavaScript, for the metrics. Rows go from the bottom
	// of the image to the top, and pixel (x, y) is at index y * width + x.
	//   color:    Float32Array(w * h * 4), final image in linear RGB(A)
	//   lineMask: Float32Array(w * h), line coverage in [0, 1]
	//   motion:   Float32Array(w * h * 2), motion in uv units (current - previous)
	//   depth:    Float32Array(w * h), linear depth, 0 for background
	capture() {
		const w = this.width;
		const h = this.height;
		const t = this.targets;
		const cu = this.capturePass.uniforms;
		cu.tComposite.value = t.composite.texture;
		cu.tLineMask.value = t.lineMask.texture;

		const color = new Float32Array(w * h * 4);
		cu.uMode.value = 0;
		this.capturePass.render(this.renderer, t.capture);
		this.renderer.readRenderTargetPixels(t.capture, 0, 0, w, h, color);

		const aux = new Float32Array(w * h * 4);
		cu.uMode.value = 1;
		this.capturePass.render(this.renderer, t.capture);
		this.renderer.readRenderTargetPixels(t.capture, 0, 0, w, h, aux);

		const lineMask = new Float32Array(w * h);
		const motion = new Float32Array(w * h * 2);
		const depth = new Float32Array(w * h);
		for (let i = 0; i < w * h; i++) {
			lineMask[i] = aux[i * 4];
			motion[i * 2] = aux[i * 4 + 1];
			motion[i * 2 + 1] = aux[i * 4 + 2];
			depth[i] = aux[i * 4 + 3];
		}
		return { width: w, height: h, color, lineMask, motion, depth };
	}
}
