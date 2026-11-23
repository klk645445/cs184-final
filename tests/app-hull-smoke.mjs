import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// The real pipeline supplies three.js normal matrices, depth prepass, back-face
// culling, hull render target and composite. No test substitute for those passes.
export async function runHullSmoke(browser, base, artifactDir) {
	const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
	const errors = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
	const checks = [];
	const check = (name, condition, data) => {
		if (!condition) throw new Error(`${name}: ${JSON.stringify(data)}`);
		console.log(`PASS app A4 ${name}`);
		checks.push({ name, data });
	};
	try {
		await page.goto(`${base}/app/`, { waitUntil: 'domcontentloaded' });
		await page.waitForFunction(() => window.app?.ui || document.querySelector('#errors .error'), null, { timeout: 60000 });
		const startup = await page.locator('#errors').innerText();
		if (startup) throw new Error(startup);
		await page.evaluate(() => { app.paused = true; app.controls.enabled = false; });
		if (artifactDir) await mkdir(artifactDir, { recursive: true });
		for (const model of ['Bunny', 'Still life']) {
			await page.evaluate(async (model) => { await app.loadModel(model); }, model);
			for (const mode of ['Inverted hull', 'Inverted hull + normal edges']) {
				const result = await page.evaluate(({ mode }) => {
					app.lines.setMode(mode);
					const count = (width) => {
						app.lines.uniforms.uLineWidth.value = width;
						app.updateLight();
						app.pipeline.render(app.camera, app.style, app.lines);
						const frame = app.pipeline.capture();
						if (!frame.lineMask.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) throw new Error('Invalid hull mask');
						return frame.lineMask.reduce((n, v) => n + Number(v > 0.5), 0);
					};
					const zero = count(0), thin = count(2), wide = count(6);
					count(2);
					return { zero, thin, wide };
				}, { mode });
				// Bunny's starter depth/back-face pass already has one pixel at width=0;
				// compare growth over that baseline rather than claiming the mesh is watertight.
				check(`${model}: ${mode} visible and width responds`, result.thin > result.zero && result.wide > result.thin, result);
				if (artifactDir) await page.locator('#canvas').screenshot({
					path: path.join(artifactDir, `${model.toLowerCase().replaceAll(' ', '-')}-${mode.toLowerCase().replaceAll(' ', '-')}.png`),
					style: '#hud, .lil-gui, #drop-hint { visibility: hidden !important; }',
				});
			}
			const views = await page.evaluate(() => {
				app.lines.setMode('Inverted hull');
				const samples = [];
				const direction = app.camera.position.clone().normalize();
				for (const [distance, zoom] of [[3.2, 1], [5, 1], [5, 1.6]]) {
					app.camera.position.copy(direction).multiplyScalar(distance);
					app.camera.zoom = zoom; app.camera.updateProjectionMatrix();
					app.camera.lookAt(0, 0, 0); app.camera.updateMatrixWorld();
					app.pipeline.render(app.camera, app.style, app.lines);
					const frame = app.pipeline.capture();
					samples.push({ distance, zoom, count: frame.lineMask.reduce((n, v) => n + Number(v > 0.5), 0) });
				}
				app.camera.zoom = 1; app.camera.updateProjectionMatrix();
				return samples;
			});
			check(`${model}: hull survives distance and zoom changes`, views.every((v) => v.count > 0), views);
		}

		// A smooth sphere yields two measurable silhouette bands on the center scanline.
		// Actual geometry shrinks with distance/zoom, but the requested band width must not.
		const bands = await page.evaluate(async () => {
			await app.loadModel('Sphere');
			app.lines.setMode('Inverted hull');
			const samples = [];
			for (const [distance, zoom] of [[3.2, 1], [5, 1], [5, 1.6]]) {
				app.camera.position.set(0, 0, distance); app.camera.lookAt(0, 0, 0);
				app.camera.zoom = zoom; app.camera.updateProjectionMatrix(); app.camera.updateMatrixWorld();
				for (const width of [2, 6]) {
					app.lines.uniforms.uLineWidth.value = width;
					app.pipeline.render(app.camera, app.style, app.lines);
					const frame = app.pipeline.capture(), w = frame.width, row = Math.floor(frame.height / 2) * w;
					const left = [], right = [], foreground = [];
					for (let x = 0; x < w; x++) {
						if (frame.lineMask[row + x] > 0.5) (x < w / 2 ? left : right).push(x);
						if (frame.depth[row + x] > 0) foreground.push(x);
					}
					samples.push({ distance, zoom, width, left: left.length, right: right.length,
						foreground: foreground.length, center: frame.lineMask[row + Math.floor(w / 2)],
						leftOutside: left.every((x) => x < foreground[0]),
						rightOutside: right.every((x) => x > foreground.at(-1)) });
				}
			}
			return samples;
		});
		for (const sample of bands) check(`sphere: ${sample.width}px at distance ${sample.distance}, zoom ${sample.zoom}`,
			Math.abs(sample.left - sample.width) <= 1 && Math.abs(sample.right - sample.width) <= 1 &&
			sample.center === 0 && sample.leftOutside && sample.rightOutside && sample.foreground > 0, sample);
		const overlay = await page.locator('#errors').innerText();
		check('no shader/runtime errors', !overlay && !errors.length, { overlay, errors });
		if (artifactDir) await writeFile(path.join(artifactDir, 'app-hull-smoke.json'), JSON.stringify(checks, null, 2));
		console.log(`${checks.length}/${checks.length} A4 real-app checks passed`);
	} catch (error) {
		throw new Error(`${error.message}${errors.length ? `\nBrowser errors: ${errors.join('\n')}` : ''}`);
	} finally {
		await page.close();
	}
}
