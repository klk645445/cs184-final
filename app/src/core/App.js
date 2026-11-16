import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSharedUniforms } from './SharedUniforms.js';
import { MaterialFactory } from './Materials.js';
import { SceneManager } from './SceneManager.js';
import { Pipeline, VIEWS } from './Pipeline.js';
import { BUILTIN_MODELS, loadModelFile, normalizeModel } from './ModelLoader.js';
import { applyPath } from './CameraPaths.js';
import { screenshot, VideoRecorder } from './Recorder.js';
import { clearShaderCache } from './ShaderLib.js';
import { installErrorHandlers, showError, clearErrors } from './ErrorOverlay.js';
import { Lines } from '../lines/Lines.js';
import { TonalArtMap } from '../tam/TonalArtMap.js';
import { createStyles } from '../styles/index.js';
import { runMeasurement } from '../metrics/Harness.js';
import { UI } from './UI.js';

// The application: owns the renderer, camera, scene, pipeline, styles and GUI, and runs the
// render loop.

export class App {
	constructor(canvas) {
		this.canvas = canvas;
		this.paused = false;
		this.status = '';
		this.modelName = '';
		this.light = { azimuth: 40, elevation: 45, followCamera: false };
		this.turntable = { enabled: false, speed: 30 };
		this.playback = { path: 'Orbit', duration: 8, record: false, playing: false, start: 0 };
		this.fps = 0;
	}

	async init() {
		const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
		renderer.setPixelRatio(1);
		this.renderer = renderer;
		installErrorHandlers(renderer);

		this.shared = createSharedUniforms();
		this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
		this.camera.position.set(1.4, 0.9, 2.6);
		this.controls = new OrbitControls(this.camera, this.canvas);
		this.controls.enableDamping = true;
		this.controls.target.set(0, 0, 0);

		this.factory = new MaterialFactory(this.shared);
		this.sceneManager = new SceneManager(this.factory);
		this.pipeline = new Pipeline(renderer, this.sceneManager, this.shared);
		this.lines = new Lines();
		this.tam = new TonalArtMap();
		this.styles = createStyles(this.tam);
		this.recorder = new VideoRecorder(this.canvas);

		await Promise.all([this.factory.load(), this.pipeline.load()]);
		await this.lines.load(this.pipeline.fullscreenVert, this.shared);
		this.generateTAM();

		this.style = this.styles[0];
		await this.style.load(this.pipeline.fullscreenVert, this.shared);
		this.style.loaded = true;

		this.resize();
		await this.loadModel('Bunny');

		this.ui = new UI(this);
		this.installEvents();
		this.lastTime = performance.now();
		this.lastHud = 0;
		this.frames = 0;
		requestAnimationFrame((t) => this.animate(t));
	}

	// ---------------------------------------------------------------- styles, models, shaders

	async setStyle(id) {
		const style = this.styles.find((s) => s.id === id);
		if (!style.loaded) {
			await style.load(this.pipeline.fullscreenVert, this.shared);
			style.loaded = true;
		}
		this.sceneManager.rebuildSurface(style);
		this.style = style;
		this.ui?.onStyleChanged();
	}

	// name: a key of BUILTIN_MODELS, or a File
	async loadModel(nameOrFile) {
		try {
			const isFile = typeof nameOrFile !== 'string';
			const object = isFile ? await loadModelFile(nameOrFile) : await BUILTIN_MODELS[nameOrFile]();
			const model = normalizeModel(object);
			this.sceneManager.setModel(model, this.style, this.lines);
			this.modelName = isFile ? nameOrFile.name : nameOrFile;
			this.pipeline.resetHistory(this.camera);
		} catch (e) {
			showError(`Could not load model: ${e.stack || e}`);
		}
	}

	// Re-reads every shader from disk and rebuilds all materials, keeping the camera and settings.
	async reloadShaders() {
		clearShaderCache();
		clearErrors();
		await Promise.all([this.factory.load(), this.pipeline.load()]);
		await this.lines.load(this.pipeline.fullscreenVert, this.shared);
		for (const s of this.styles) s.loaded = false;
		await this.style.load(this.pipeline.fullscreenVert, this.shared);
		this.style.loaded = true;
		this.sceneManager.rebuildAll(this.style, this.lines);
		this.status = 'Shaders reloaded';
	}

	// Runs TonalArtMap.generate() (Part C2) and uploads the result.
	generateTAM() {
		try {
			this.tam.generate();
		} catch (e) {
			showError(`TonalArtMap.generate() failed: ${e.stack || e}`);
		}
		this.tam.build();
		this.pipeline.tam = this.tam;
		this.styles.find((s) => s.id === 'hatch-tam')?.refreshTextures();
	}

	// ---------------------------------------------------------------- playback and measurement

	togglePlayback() {
		const p = this.playback;
		if (p.playing) {
			this.stopPlayback();
			return;
		}
		p.playing = true;
		p.start = performance.now();
		this.controls.enabled = false;
		applyPath(p.path, 0, this.camera, this.sceneManager);
		this.pipeline.resetHistory(this.camera);
		if (p.record) {
			try {
				this.recorder.start();
			} catch (e) {
				showError(e.message);
			}
		}
	}

	stopPlayback() {
		const p = this.playback;
		p.playing = false;
		this.controls.enabled = true;
		this.controls.target.set(0, 0, 0);
		if (this.recorder.recording) this.recorder.stop(`inkwell-${this.style.id}`);
	}

	async measure(options) {
		if (this.playback.playing) this.stopPlayback();
		try {
			const summary = await runMeasurement(this, {
				...options,
				onProgress: (msg) => (this.status = msg),
			});
			this.status = 'Measurement done, see the console and the downloaded CSV files';
			return summary;
		} catch (e) {
			showError(`Measurement failed: ${e.stack || e}`);
		}
	}

	// ---------------------------------------------------------------- frame loop

	resize() {
		const w = this.canvas.clientWidth;
		const h = this.canvas.clientHeight;
		if (!w || !h) return;
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
		const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
		this.pipeline.setSize(size.x, size.y);
	}

	updateLight() {
		const az = THREE.MathUtils.degToRad(this.light.azimuth);
		const el = THREE.MathUtils.degToRad(this.light.elevation);
		const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
		this.camera.updateMatrixWorld();
		if (this.light.followCamera) {
			this.shared.uLightDirView.value.copy(dir);
		} else {
			this.shared.uLightDirView.value.copy(dir).transformDirection(this.camera.matrixWorldInverse);
		}
	}

	animate(now) {
		requestAnimationFrame((t) => this.animate(t));
		if (this.paused) return;
		const dt = Math.min((now - this.lastTime) / 1000, 0.1);
		this.lastTime = now;

		const p = this.playback;
		if (p.playing) {
			const t = (now - p.start) / 1000 / p.duration;
			applyPath(p.path, Math.min(t, 1), this.camera, this.sceneManager);
			if (t >= 1) this.stopPlayback();
		} else {
			this.controls.update();
			if (this.turntable.enabled) this.sceneManager.root.rotation.y += THREE.MathUtils.degToRad(this.turntable.speed) * dt;
		}

		this.shared.uTime.value = now / 1000;
		this.updateLight();
		this.pipeline.view = this.ui.state.view;
		this.pipeline.render(this.camera, this.style, this.lines);

		if (this.screenshotRequested) {
			this.screenshotRequested = false;
			screenshot(this.canvas, `inkwell-${this.style.id}`);
		}

		this.frames++;
		if (now - this.lastHud > 500) {
			this.fps = (this.frames * 1000) / (now - this.lastHud);
			this.frames = 0;
			this.lastHud = now;
			this.updateHud();
		}
	}

	updateHud() {
		const lines = [
			`${this.style.name}${this.lines.enabled ? ` + lines (${this.lines.mode})` : ''}`,
			`View: ${VIEWS[this.ui.state.view]}`,
			`Model: ${this.modelName} (${Math.round(this.sceneManager.triangles).toLocaleString()} triangles)`,
			`${this.pipeline.width} x ${this.pipeline.height}, ${this.fps.toFixed(0)} fps`,
		];
		if (this.recorder.recording) lines.push('Recording video');
		if (this.status) lines.push(this.status);
		document.getElementById('hud').textContent = lines.join('\n');
	}

	installEvents() {
		window.addEventListener('resize', () => this.resize());

		window.addEventListener('keydown', (e) => {
			if (e.target.closest && e.target.closest('input, textarea, select')) return;
			if (e.key === 's' || e.key === 'S') this.screenshotRequested = true;
			else if (e.key === 'r' || e.key === 'R') this.reloadShaders();
			else if (e.key === ' ') {
				e.preventDefault();
				this.togglePlayback();
			}
		});

		const body = document.body;
		window.addEventListener('dragover', (e) => {
			e.preventDefault();
			body.classList.add('dragging');
		});
		window.addEventListener('dragleave', (e) => {
			if (!e.relatedTarget) body.classList.remove('dragging');
		});
		window.addEventListener('drop', (e) => {
			e.preventDefault();
			body.classList.remove('dragging');
			const file = e.dataTransfer.files[0];
			if (file) this.loadModel(file);
		});
	}
}
