import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function runStabilitySmoke(browser, base, artifactDir) {
	const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
	const errors = [], checks = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
	const check = (name, condition, data) => {
		if (!condition) throw new Error(`${name}: ${JSON.stringify(data)}`);
		console.log(`PASS app A6 ${name}`); checks.push({ name, data });
	};
	try {
		await page.goto(`${base}/app/`, { waitUntil: 'domcontentloaded' });
		await page.waitForFunction(() => window.app?.ui || document.querySelector('#errors .error'), null, { timeout: 60000 });
		const startup = await page.locator('#errors').innerText();
		if (startup) throw new Error(startup);
		if (artifactDir) await mkdir(artifactDir, { recursive: true });
		const observations = await page.evaluate(async () => {
			app.paused = true; app.controls.enabled = false;
			app.pipeline.setSize(320, 240);
			const { warpPrevious } = await import('/app/src/metrics/warp.js');
			const { lineStability } = await import('/app/src/metrics/lineStability.js');
			const { applyPath } = await import('/app/src/core/CameraPaths.js');
			const samples = [];
			for (const model of ['Bunny', 'Still life']) {
				await app.loadModel(model);
				for (const mode of ['Off', 'Depth edges', 'Normal edges', 'Depth + normal edges', 'Inverted hull', 'Inverted hull + normal edges']) {
					app.lines.setMode(mode);
					for (const cameraPath of ['Static', 'Orbit', 'Turntable']) {
						applyPath(cameraPath, 0, app.camera, app.sceneManager); app.pipeline.resetHistory(app.camera);
						let prev = null;
						for (const t of [0, 0.01, 0.02]) {
							applyPath(cameraPath, t, app.camera, app.sceneManager); app.updateLight();
							app.pipeline.render(app.camera, app.style, app.lines);
							const cur = app.pipeline.capture();
							if (prev) {
								const warped = warpPrevious(prev, cur), score = lineStability(prev, cur, warped);
								// Independent set-based oracle also exposes the denominator and coverage.
								const current = new Set(), previous = new Set(); let valid = 0;
								for (let i = 0; i < cur.lineMask.length; i++) if (warped.valid[i]) {
									valid++; if (cur.lineMask[i] > 0.5) current.add(i);
									if (warped.lineMask[i] > 0.5) previous.add(i);
								}
								const union = new Set([...current, ...previous]);
								const changed = [...union].filter((i) => current.has(i) !== previous.has(i)).length;
								const expected = union.size ? changed / union.size : NaN;
								if (!Object.is(score, expected)) throw new Error(`A6 disagrees with set oracle: ${score}, ${expected}`);
								samples.push({ model, mode, path: cameraPath, t, valid, eligibleLines: union.size,
									changed, score: Number.isNaN(score) ? null : score });
							}
							prev = cur;
						}
					}
				}
			}
			return samples;
		});
		for (const model of ['Bunny', 'Still life']) for (const mode of ['Off', 'Depth edges', 'Normal edges', 'Depth + normal edges', 'Inverted hull', 'Inverted hull + normal edges']) {
			const samples = observations.filter((s) => s.model === model && s.mode === mode);
			check(`${model}: ${mode}, Static/Orbit/Turntable membership and range`, samples.length === 6 &&
				samples.every((s) => s.valid > 0 && (s.eligibleLines ? Number.isFinite(s.score) && s.score >= 0 && s.score <= 1 : s.score === null)) &&
				samples.filter((s) => s.path === 'Static').every((s) => s.eligibleLines ? s.score === 0 : s.score === null) &&
				(mode === 'Off' ? samples.every((s) => s.eligibleLines === 0) :
					mode === 'Inverted hull' || samples.every((s) => s.eligibleLines > 0)), samples);
		}
		check('moving scenes exercise measured changes, not only zero/empty outputs',
			observations.some((s) => s.path === 'Orbit' && s.changed > 0) &&
			observations.some((s) => s.path === 'Turntable' && s.changed > 0),
			{ orbitMeasured: observations.filter((s) => s.path === 'Orbit' && s.eligibleLines > 0).length,
				turntableMeasured: observations.filter((s) => s.path === 'Turntable' && s.eligibleLines > 0).length });

		await page.evaluate(() => {
			app.lines.setMode('Depth + normal edges');
			Object.assign(app.ui.state, { measurePath: 'Static', measureFrames: 3, measurePerfFrames: 10,
				measureResolution: 'window', measureStyles: 'current' });
		});
		const ready = Promise.all([
			page.waitForEvent('download', { predicate: (d) => d.suggestedFilename().startsWith('inkwell-frames-') }),
			page.waitForEvent('download', { predicate: (d) => d.suggestedFilename().startsWith('inkwell-summary-') }),
		]);
		ready.catch(() => {});
		await page.getByRole('button').filter({ hasText: /^Measure$/ }).click();
		await page.getByRole('button').filter({ hasText: /^Run$/ }).click();
		const downloads = await ready;
		const exports = [];
		for (const d of downloads) {
			const csv = await readFile(await d.path(), 'utf8');
			if (artifactDir) await writeFile(path.join(artifactDir, `a6-${d.suggestedFilename()}`), csv);
			// This run uses Base and "Depth + normal edges", neither containing a comma.
			const [header, ...rows] = csv.trim().split('\n').map((row) => row.split(','));
			const index = header.indexOf('lineStability');
			const values = rows.map((row) => row[index]);
			const frames = d.suggestedFilename().startsWith('inkwell-frames-');
			check(`Measure Static ${frames ? 'frames' : 'summary'} exports measured stability`, index >= 0 &&
				(frames ? values.length === 3 && values[0] === '' && values.slice(1).every((v) => v !== '' && Number(v) === 0) :
					values.length === 1 && values[0] !== '' && Number(values[0]) === 0), { name: d.suggestedFilename(), values });
			exports.push({ name: d.suggestedFilename(), values });
		}
		const overlay = await page.locator('#errors').innerText();
		check('no shader/runtime errors', !overlay && !errors.length, { overlay, errors });
		if (artifactDir) await writeFile(path.join(artifactDir, 'app-stability-smoke.json'), JSON.stringify({ checks, observations, exports }, null, 2));
		console.log(`${checks.length}/${checks.length} A6 real-app checks passed`);
	} finally { await page.close(); }
}
