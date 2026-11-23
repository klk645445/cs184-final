#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// No application dependencies or build step: serve the checkout only for this test run.
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
	'.css': 'text/css', '.glsl': 'text/plain', '.vert': 'text/plain', '.frag': 'text/plain' };
const server = createServer(async (request, response) => {
	try {
		const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
		const file = path.resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
		if (!file.startsWith(`${root}${path.sep}`)) throw new Error('Invalid path');
		response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
		response.end(await readFile(file));
	} catch {
		response.writeHead(404).end('Not found');
	}
});
let browser;
try {
	const modulePath = process.env.PLAYWRIGHT_MODULE;
	const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	browser = await chromium.launch({
		channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true,
		args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], timeout: 60000,
	});
	const page = await browser.newPage();
	const pageErrors = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));
	const base = `http://127.0.0.1:${server.address().port}`;
	const response = await page.goto(`${base}/tests/webgl.html?suite=${encodeURIComponent(process.argv[2] || 'all')}`);
	if (!response.ok()) throw new Error(`Test page HTTP ${response.status()}`);
	await page.waitForFunction(() => window.testResults, null, { timeout: 60000 });
	const results = await page.evaluate(() => window.testResults);
	for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}${result.error ? `: ${result.error}` : ''}`);
	const failed = results.filter((result) => !result.ok).length + pageErrors.length;
	for (const error of pageErrors) console.error(error);
	console.log(`${results.length - results.filter((result) => !result.ok).length}/${results.length} shader checks passed`);
	if (failed || !results.length) process.exitCode = 1;
	if (!process.exitCode && process.env.APP_SMOKE === '1') {
		const { runAppSmoke } = await import('./app-smoke.mjs');
		await runAppSmoke(browser, base, process.env.TEST_ARTIFACT_DIR);
		const { runHullSmoke } = await import('./app-hull-smoke.mjs');
		await runHullSmoke(browser, base, process.env.TEST_ARTIFACT_DIR);
	}
} catch (error) {
	console.error(error.stack || error);
	process.exitCode = 1;
} finally {
	await browser?.close();
	await new Promise((resolve) => server.close(resolve));
}
