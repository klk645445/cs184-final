import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function runWarpSmoke(browser, base, artifactDir) {
	const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
	const errors = [], warnings = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => {
		if (m.type() === 'error') errors.push(m.text());
		if (m.type() === 'warning') warnings.push(m.text());
	});
	const checks = [];
	const check = (name, condition, data) => {
		if (!condition) throw new Error(`${name}: ${JSON.stringify(data)}`);
		console.log(`PASS app A5 ${name}`); checks.push({ name, data });
	};
	try {
		await page.goto(`${base}/app/`, { waitUntil: 'domcontentloaded' });
		await page.waitForFunction(() => window.app?.ui || document.querySelector('#errors .error'), null, { timeout: 60000 });
		const startup = await page.locator('#errors').innerText();
		if (startup) throw new Error(startup);
		if (artifactDir) await mkdir(artifactDir, { recursive: true });
		const observations = await page.evaluate(async () => {
			app.paused = true; app.controls.enabled = false;
			const { warpPrevious } = await import('/app/src/metrics/warp.js');
			const draw = () => {
				app.updateLight(); app.pipeline.render(app.camera, app.style, app.lines);
				return app.pipeline.capture();
			};
			const compare = (prev, cur) => {
				const warped = warpPrevious(prev, cur);
				if (!warped) throw new Error('A5 still returns its placeholder');
				let foreground = 0, valid = 0, backgroundValid = 0, invalidNonzero = 0;
				let maxColor = 0, maxLine = 0, warpedError = 0, unwarpedError = 0, maxMotion = 0;
				for (let i = 0; i < cur.depth.length; i++) {
					if (cur.depth[i] > 0) {
						foreground++; maxMotion = Math.max(maxMotion, Math.hypot(cur.motion[2*i], cur.motion[2*i+1]));
					}
					if (warped.valid[i]) {
						valid++; if (!cur.depth[i]) backgroundValid++;
						maxLine = Math.max(maxLine, Math.abs(warped.lineMask[i] - cur.lineMask[i]));
						for (let c = 0; c < 4; c++) {
							const error = Math.abs(warped.color[4*i+c] - cur.color[4*i+c]);
							maxColor = Math.max(maxColor, error);
							if (c < 3) { warpedError += error; unwarpedError += Math.abs(prev.color[4*i+c] - cur.color[4*i+c]); }
						}
					} else if (warped.lineMask[i] !== 0 || warped.color.subarray(4*i, 4*i+4).some((v) => v !== 0)) invalidNonzero++;
				}
				if (!warped.color.every(Number.isFinite) || !warped.lineMask.every(Number.isFinite)) throw new Error('Nonfinite warp');
				return { foreground, valid, backgroundValid, invalidNonzero, maxColor, maxLine, maxMotion,
					warpedError: warpedError / Math.max(1, valid*3), unwarpedError: unwarpedError / Math.max(1, valid*3) };
			};
			const models = [];
			for (const model of ['Bunny', 'Still life']) {
				await app.loadModel(model); app.lines.setMode('Depth + normal edges');
				app.camera.position.set(1.4, 0.9, 2.6); app.camera.zoom = 1;
				app.camera.updateProjectionMatrix(); app.camera.lookAt(0, 0, 0);
				app.pipeline.resetHistory(app.camera);
				const prev = draw(), cur = draw();
				const stationary = compare(prev, cur);
				app.camera.position.x += 0.15; app.camera.lookAt(0, 0, 0);
				const moved = draw(), camera = compare(cur, moved);
				app.sceneManager.root.rotation.y = 0.12;
				const turned = draw(), turntable = compare(moved, turned);
				models.push({ model, stationary, camera, turntable });
			}
			// A stationary floor newly exposed by a translated sphere has zero motion,
			// but its previous location held a closer surface. It must not borrow that history.
			await app.loadModel('Still life'); app.pipeline.resetHistory(app.camera);
			const prev = draw();
			app.sceneManager.meshes[1].position.x += 0.45;
			const cur = draw(), warped = warpPrevious(prev, cur);
			let exposed = 0, rejected = 0;
			for (let i = 0; i < cur.depth.length; i++) {
				if (cur.depth[i] > 0 && prev.depth[i] > 0 && cur.depth[i] > prev.depth[i] * 1.1 &&
					Math.hypot(cur.motion[2*i], cur.motion[2*i+1]) < 1e-6) {
					exposed++; if (!warped.valid[i]) rejected++;
				}
			}
			return { models, disocclusion: { exposed, rejected } };
		});
		for (const { model, stationary, camera, turntable } of observations.models) {
			check(`${model}: static identity`, stationary.foreground > 0 && stationary.valid === stationary.foreground &&
				stationary.maxColor < 1e-6 && stationary.maxLine < 1e-6 && stationary.backgroundValid === 0 && stationary.invalidNonzero === 0, stationary);
			for (const [name, data] of [['camera', camera], ['turntable', turntable]]) {
				check(`${model}: ${name} reprojection`, data.maxMotion > 0.001 && data.valid > data.foreground * 0.4 &&
					data.warpedError < data.unwarpedError && data.backgroundValid === 0 && data.invalidNonzero === 0, data);
			}
		}
		check('newly exposed stationary floor rejects closer history', observations.disocclusion.exposed > 0 &&
			observations.disocclusion.rejected === observations.disocclusion.exposed, observations.disocclusion);

		// Use the actual GUI Run button and read both exported CSVs. This checks
		// A5 integration, not acceptance of the separate C4/A6 metric values.
		const exportsReady = Promise.all([
			page.waitForEvent('download', { predicate: (d) => d.suggestedFilename().startsWith('inkwell-frames-'), timeout: 60000 }),
			page.waitForEvent('download', { predicate: (d) => d.suggestedFilename().startsWith('inkwell-summary-'), timeout: 60000 }),
		]);
		// A GUI error can close the page before the downloads arrive. Keep that
		// rejection handled so it does not mask the original test failure.
		exportsReady.catch(() => {});
		await page.evaluate(() => {
			Object.assign(app.ui.state, { measurePath: 'Static', measureFrames: 3, measurePerfFrames: 10,
				measureResolution: 'window', measureStyles: 'current' });
		});
		// Folder buttons have an accessibility label beyond their visible title.
		await page.getByRole('button').filter({ hasText: /^Measure$/ }).click();
		await page.getByRole('button').filter({ hasText: /^Run$/ }).click();
		await page.waitForFunction(() => app.status === 'Measurement done, see the console and the downloaded CSV files' ||
			document.querySelector('#errors .error'), null, { timeout: 60000 });
		const downloads = await exportsReady;
		const exports = [];
		for (const download of downloads) {
			const file = await download.path();
			const csv = await readFile(file, 'utf8');
			if (artifactDir) await writeFile(path.join(artifactDir, download.suggestedFilename()), csv);
			exports.push({ name: download.suggestedFilename(), rows: csv.trim().split('\n').length - 1 });
		}
		check('Measure Static path exports frames and summary without A5 skip warning',
			exports.some((f) => f.name.startsWith('inkwell-frames-') && f.rows === 3) &&
			exports.some((f) => f.name.startsWith('inkwell-summary-') && f.rows === 1) &&
			!warnings.some((w) => w.includes('warpPrevious() is not implemented')), { exports });
		const overlay = await page.locator('#errors').innerText();
		check('no shader/runtime errors', !overlay && !errors.length, { overlay, errors });
		if (artifactDir) await writeFile(path.join(artifactDir, 'app-warp-smoke.json'), JSON.stringify(checks, null, 2));
		console.log(`${checks.length}/${checks.length} A5 real-app checks passed`);
	} catch (error) {
		const buttons = await page.getByRole('button').allTextContents();
		throw new Error(`${error.message}\nAvailable buttons: ${JSON.stringify(buttons)}`);
	} finally {
		await page.close();
	}
}
