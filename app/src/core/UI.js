import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { VIEWS } from './Pipeline.js';
import { BUILTIN_MODELS } from './ModelLoader.js';
import { CAMERA_PATHS } from './CameraPaths.js';

// The control panel (lil-gui). Style-specific controls come from each style's params, so a new
// style or parameter does not need any changes here.

const RESOLUTIONS = { 'Window size': 'window', '1280 x 720': '1280x720', '1920 x 1080': '1920x1080' };

export class UI {
	constructor(app) {
		this.app = app;
		const gui = new GUI({ title: 'Inkwell' });
		this.gui = gui;
		this.state = {
			style: app.style.id,
			view: 0,
			model: 'Bunny',
			color: '#d9d4c7',
			background: '#f4f1ea',
			pixelRatio: 1,
			seed: app.tam.seed,
			measurePath: 'Orbit',
			measureFrames: 60,
			measurePerfFrames: 120,
			measureResolution: 'window',
			measureStyles: 'current',
		};
		const s = this.state;

		// Style
		const styleOptions = {};
		for (const style of app.styles) styleOptions[style.track === 'Starter' ? style.name : `${style.name}  [${style.track}]`] = style.id;
		this.styleCtrl = gui.add(s, 'style', styleOptions).name('Style').onChange((id) => app.setStyle(id));
		this.styleFolder = gui.addFolder('Style settings');
		app.style.buildGUI(this.styleFolder);

		// Lines
		const lines = gui.addFolder('Lines  [A]');
		app.lines.buildGUI(lines);

		// View
		const view = gui.addFolder('View');
		view.add(s, 'view', Object.fromEntries(VIEWS.map((v, i) => [v, i]))).name('Debug view');
		view.add(s, 'pixelRatio', [1, 1.5, 2]).name('Pixel ratio').onChange((v) => {
			app.renderer.setPixelRatio(v);
			app.resize();
		});

		// Scene
		const scene = gui.addFolder('Scene');
		scene.add(s, 'model', Object.keys(BUILTIN_MODELS)).name('Model').onChange((name) => app.loadModel(name));
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.accept = '.ply,.obj,.stl,.glb,.gltf,.dae';
		fileInput.onchange = () => fileInput.files[0] && app.loadModel(fileInput.files[0]);
		scene.add({ load: () => fileInput.click() }, 'load').name('Load model file...');
		scene.addColor(s, 'color').name('Object color').onChange((c) => app.sceneManager.setColor(c));
		scene.addColor(s, 'background').name('Background').onChange((c) => app.shared.uBackground.value.set(c));
		scene.add(app.turntable, 'enabled').name('Turntable');
		scene.add(app.turntable, 'speed', -180, 180, 1).name('Turntable deg/s');

		// Light
		const light = gui.addFolder('Light');
		light.add(app.light, 'azimuth', -180, 180, 1).name('Azimuth');
		light.add(app.light, 'elevation', -89, 89, 1).name('Elevation');
		light.add(app.light, 'followCamera').name('Follow camera');
		light.add(app.shared.uLightIntensity, 'value', 0, 2, 0.01).name('Intensity');
		light.add(app.shared.uAmbient, 'value', 0, 1, 0.01).name('Ambient');

		// Tonal art map
		const tam = gui.addFolder('Tonal art map  [C]');
		tam.add(s, 'seed', 1, 1000, 1).name('Seed');
		tam.add({ regenerate: () => {
			app.tam.seed = s.seed;
			app.generateTAM();
		} }, 'regenerate').name('Regenerate');
		tam.close();

		// Camera paths
		const path = gui.addFolder('Camera path');
		path.add(app.playback, 'path', Object.keys(CAMERA_PATHS)).name('Path');
		path.add(app.playback, 'duration', 1, 30, 0.5).name('Duration (s)');
		path.add(app.playback, 'record').name('Record video');
		path.add({ play: () => app.togglePlayback() }, 'play').name('Play / stop  (Space)');
		path.close();

		// Measurements
		const measure = gui.addFolder('Measure');
		measure.add(s, 'measurePath', Object.keys(CAMERA_PATHS)).name('Path');
		measure.add(s, 'measureFrames', 2, 300, 1).name('Frames');
		measure.add(s, 'measurePerfFrames', 10, 600, 1).name('Timing frames');
		measure.add(s, 'measureResolution', RESOLUTIONS).name('Resolution');
		measure.add(s, 'measureStyles', { 'Current style': 'current', 'Both hatching styles': 'hatching', 'All styles': 'all' }).name('Styles');
		measure.add({ run: () => this.runMeasurement() }, 'run').name('Run');
		measure.close();

		// Tools
		const tools = gui.addFolder('Tools');
		tools.add({ shot: () => (app.screenshotRequested = true) }, 'shot').name('Screenshot  (S)');
		tools.add({ reload: () => app.reloadShaders() }, 'reload').name('Reload shaders  (R)');
	}

	// Rebuilds the "Style settings" folder for the current style.
	onStyleChanged() {
		const folder = this.styleFolder;
		[...folder.controllers].forEach((c) => c.destroy());
		[...folder.folders].forEach((f) => f.destroy());
		this.app.style.buildGUI(folder);
		this.state.style = this.app.style.id;
		this.styleCtrl.updateDisplay();
	}

	runMeasurement() {
		const s = this.state;
		const app = this.app;
		let width = app.pipeline.width;
		let height = app.pipeline.height;
		if (s.measureResolution !== 'window') [width, height] = s.measureResolution.split('x').map(Number);
		const styleIds = s.measureStyles === 'current' ? [app.style.id]
			: s.measureStyles === 'hatching' ? ['hatch-screen', 'hatch-tam']
				: app.styles.map((st) => st.id);
		app.measure({ path: s.measurePath, frames: s.measureFrames, perfFrames: s.measurePerfFrames, width, height, styleIds });
	}
}
