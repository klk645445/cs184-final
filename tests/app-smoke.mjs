import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Exercise the unchanged real app, including three.js material setup and matrix history.
export async function runAppSmoke(browser, base, artifactDir) {
	const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
	try {
		await page.goto(`${base}/app/`, { waitUntil: 'domcontentloaded' });
		await page.waitForFunction(() => window.app?.ui || document.querySelector('#errors .error'), null, { timeout: 60000 });
		const startupError = await page.locator('#errors').innerText();
		if (startupError) throw new Error(startupError);
		await page.evaluate(() => { app.paused = true; app.controls.enabled = false; });
		if (artifactDir) await mkdir(artifactDir, { recursive: true });
		const checks = [];
		const check = (name, condition, data) => {
			if (!condition) throw new Error(`${name}: ${JSON.stringify(data)}`);
			console.log(`PASS app ${name}`);
			checks.push({ name, data });
		};
		for (const model of ['Bunny', 'Still life']) {
			const motion = await page.evaluate(async (model) => {
				await app.loadModel(model);
				app.lines.setMode('Off');
				const draw = () => {
					app.updateLight();
					app.pipeline.render(app.camera, app.style, app.lines);
					const frame = app.pipeline.capture();
					let maxMotion = 0; let foreground = 0; let lines = 0;
					for (let i = 0; i < frame.depth.length; i++) {
						if (frame.depth[i] > 0) {
							foreground++;
							maxMotion = Math.max(maxMotion, Math.hypot(frame.motion[i * 2], frame.motion[i * 2 + 1]));
						}
						if (frame.lineMask[i] > 0) lines++;
					}
					return { maxMotion, foreground, lines };
				};
				const still = draw();
				app.camera.position.x += 0.25;
				app.camera.lookAt(0, 0, 0);
				const camera = draw();
				const settled = draw();
				app.sceneManager.root.rotation.y += 0.2;
				const turntable = draw();
				return { still, camera, settled, turntable };
			}, model);
			check(`${model}: static motion and disabled lines`, motion.still.foreground > 0 && motion.still.maxMotion < 0.0001 && motion.still.lines === 0, motion.still);
			check(`${model}: camera movement`, motion.camera.maxMotion > 0.001, motion.camera);
			check(`${model}: history settles after camera movement`, motion.settled.maxMotion < 0.0001, motion.settled);
			check(`${model}: turntable model movement`, motion.turntable.maxMotion > 0.001, motion.turntable);

			for (const mode of ['Depth edges', 'Normal edges', 'Depth + normal edges']) {
				const samples = await page.evaluate((mode) => {
					app.lines.setMode(mode);
					const measure = (width, threshold) => {
						app.lines.uniforms.uLineWidth.value = width;
						app.lines.uniforms.uDepthThreshold.value = threshold;
						app.lines.uniforms.uNormalThreshold.value = threshold;
						app.updateLight();
						app.pipeline.render(app.camera, app.style, app.lines);
						return app.pipeline.capture().lineMask.reduce((n, v) => n + Number(v > 0), 0);
					};
					const thin = measure(0.5, 0.02);
					const normal = measure(2, 0.02);
					const wide = measure(6, 0.02);
					const sensitive = measure(2, 0.001);
					const strict = measure(2, 0.2);
					// Restore the app's defaults for the saved scene, separately from the sweep.
					app.lines.uniforms.uLineWidth.value = 2;
					app.lines.uniforms.uDepthThreshold.value = 0.02;
					app.lines.uniforms.uNormalThreshold.value = 0.3;
					app.pipeline.render(app.camera, app.style, app.lines);
					return { thin, normal, wide, sensitive, strict };
				}, mode);
				check(`${model}: ${mode}, width and threshold parameters`, samples.thin > 0 && samples.normal > 0 && samples.wide > samples.normal && samples.sensitive >= samples.strict, samples);
				if (artifactDir) {
					await page.locator('#canvas').screenshot({
						path: path.join(artifactDir, `${model.toLowerCase().replaceAll(' ', '-')}-${mode.toLowerCase().replaceAll(' ', '-')}.png`),
						style: '#hud, .lil-gui, #drop-hint { visibility: hidden !important; }',
					});
				}
			}
		}
		const overlay = await page.locator('#errors').innerText();
		check('no shader/runtime errors', !overlay && !errors.length, { overlay, errors });
		if (artifactDir) await writeFile(path.join(artifactDir, 'app-smoke.json'), JSON.stringify(checks, null, 2));
		console.log(`${checks.length}/${checks.length} real-app checks passed`);
	} catch (error) {
		throw new Error(`${error.message}${errors.length ? `\nBrowser errors: ${errors.join('\n')}` : ''}`);
	} finally {
		await page.close();
	}
}
