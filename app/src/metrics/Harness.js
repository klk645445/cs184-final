import { applyPath } from '../core/CameraPaths.js';
import { download, timestamp } from '../core/Recorder.js';
import { mean } from './image.js';
import { warpPrevious } from './warp.js';
import { coherence } from './coherence.js';
import { lineStability } from './lineStability.js';
import { strokeSpacing } from './strokeScale.js';
import { measureFrameTimes } from './performance.js';

// Runs the measurements from the "Measure" panel. For every selected style, it renders the camera
// path frame by frame at a fixed resolution, reads every frame back (Pipeline.capture), and calls
// the metric functions. The results go to the console, the HUD, and two CSV downloads:
//   inkwell-frames-*.csv   one row per style and frame
//   inkwell-summary-*.csv  one row per style, with averages and the frame time
//
// The metric functions themselves are the TODOs in this folder:
//   warp.js (A5), lineStability.js (A6), strokeScale.js (B6), coherence.js (C4), performance.js (D4)

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function toCSV(rows) {
	if (!rows.length) return '';
	const keys = Object.keys(rows[0]);
	const fmt = (v) => (typeof v === 'number' ? (Number.isFinite(v) ? v.toPrecision(6) : '') : `"${String(v).replace(/"/g, '""')}"`);
	return [keys.join(','), ...rows.map((r) => keys.map((k) => fmt(r[k])).join(','))].join('\n');
}

export async function runMeasurement(app, { path, frames, perfFrames, width, height, styleIds, onProgress }) {
	const { pipeline, camera, sceneManager, renderer } = app;
	const saved = {
		style: app.style.id,
		position: camera.position.clone(),
		rotation: sceneManager.root.rotation.y,
		aspect: camera.aspect,
	};
	app.paused = true;

	const frameRows = [];
	const summaryRows = [];
	let warnedWarp = false;

	try {
		pipeline.setSize(width, height);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();

		for (const id of styleIds) {
			await app.setStyle(id);
			const style = app.style;
			let prev = null;
			const rows = [];

			for (let i = 0; i < frames; i++) {
				const t = frames > 1 ? i / (frames - 1) : 0;
				applyPath(path, t, camera, sceneManager);
				if (i === 0) pipeline.resetHistory(camera);
				pipeline.render(camera, style, app.lines);
				const cur = pipeline.capture();

				const row = { style: style.name, lines: app.lines.mode, path, frame: i, t, coherence: NaN, lineStability: NaN, strokeSpacing: strokeSpacing(cur) };
				if (prev) {
					const warped = warpPrevious(prev, cur);
					if (warped) {
						row.coherence = coherence(prev, cur, warped);
						row.lineStability = lineStability(prev, cur, warped);
					} else if (!warnedWarp) {
						console.warn('warpPrevious() is not implemented yet (Part A5), skipping coherence and line stability');
						warnedWarp = true;
					}
				}
				rows.push(row);
				prev = cur;
				onProgress?.(`Measuring ${style.name}: frame ${i + 1} / ${frames}`);
				if (i % 4 === 0) await nextFrame();
			}

			onProgress?.(`Timing ${style.name}...`);
			await nextFrame();
			const perf = await measureFrameTimes(renderer, (i) => {
				applyPath(path, (i % frames) / Math.max(frames - 1, 1), camera, sceneManager);
				pipeline.render(camera, style, app.lines);
			}, perfFrames);

			frameRows.push(...rows);
			summaryRows.push({
				style: style.name,
				lines: app.lines.mode,
				path,
				width,
				height,
				triangles: sceneManager.triangles,
				coherence: mean(rows.map((r) => r.coherence)),
				lineStability: mean(rows.map((r) => r.lineStability)),
				strokeSpacingMean: mean(rows.map((r) => r.strokeSpacing)),
				strokeSpacingMin: Math.min(...rows.map((r) => r.strokeSpacing).filter(Number.isFinite)),
				strokeSpacingMax: Math.max(...rows.map((r) => r.strokeSpacing).filter(Number.isFinite)),
				frameMs: perf.meanMs,
				frameMsP95: perf.p95Ms,
				fps: perf.fps,
			});
		}
	} finally {
		await app.setStyle(saved.style);
		camera.position.copy(saved.position);
		camera.aspect = saved.aspect;
		camera.updateProjectionMatrix();
		camera.lookAt(app.controls.target);
		sceneManager.root.rotation.y = saved.rotation;
		app.resize();
		pipeline.resetHistory(camera);
		app.paused = false;
	}

	console.table(summaryRows);
	const stamp = timestamp();
	download(new Blob([toCSV(frameRows)], { type: 'text/csv' }), `inkwell-frames-${stamp}.csv`);
	download(new Blob([toCSV(summaryRows)], { type: 'text/csv' }), `inkwell-summary-${stamp}.csv`);
	return summaryRows;
}
