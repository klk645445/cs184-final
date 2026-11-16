// Shows errors on the page (top-left, in red), including GLSL compile errors with the offending
// source lines, so a broken shader is obvious without opening the console. Click an error to
// dismiss it. Reloading the shaders (R) clears all errors.

const box = () => document.getElementById('errors');

export function showError(message) {
	console.error(message);
	const el = document.createElement('div');
	el.className = 'error';
	el.textContent = message;
	el.title = 'Click to dismiss';
	el.onclick = () => el.remove();
	box().appendChild(el);
}

export function clearErrors() {
	box().replaceChildren();
}

function annotate(gl, shader, kind) {
	if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return '';
	const log = gl.getShaderInfoLog(shader).trim();
	const lines = gl.getShaderSource(shader).split('\n');
	const out = [`${kind} shader failed to compile:`, log];
	const seen = new Set();
	for (const m of log.matchAll(/ERROR: \d+:(\d+):/g)) {
		const n = Number(m[1]);
		if (seen.has(n)) continue;
		seen.add(n);
		// Show the line with some context. The source includes three.js's prefix, so these line
		// numbers do not match the .glsl file; search for the code instead.
		for (let i = Math.max(1, n - 2); i <= Math.min(lines.length, n + 2); i++) {
			out.push(`${i === n ? '>' : ' '} ${String(i).padStart(4)} | ${lines[i - 1]}`);
		}
	}
	return out.join('\n');
}

export function installErrorHandlers(renderer) {
	renderer.debug.onShaderError = (gl, program, vs, fs) => {
		const parts = [annotate(gl, vs, 'Vertex'), annotate(gl, fs, 'Fragment')].filter(Boolean);
		if (!parts.length) parts.push(`Shader program failed to link:\n${gl.getProgramInfoLog(program)}`);
		showError(parts.join('\n\n'));
	};
	window.addEventListener('error', (e) => showError(e.error?.stack || e.message));
	window.addEventListener('unhandledrejection', (e) => showError(e.reason?.stack || String(e.reason)));
}
