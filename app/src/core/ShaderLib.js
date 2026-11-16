// Loads GLSL files from app/shaders/ and resolves our own include directive:
//
//     #include "common/post_common.glsl"
//
// Paths are relative to app/shaders/. Each file is included at most once per shader, so shared
// files do not need include guards. three.js's own `#include <chunk>` (angle brackets) is left
// alone for three.js to resolve.

const SHADER_ROOT = new URL('../../shaders/', import.meta.url);
const INCLUDE_RE = /^[ \t]*#include\s+"([^"]+)"[ \t]*$/gm;

const rawCache = new Map();

async function fetchRaw(path) {
	if (!rawCache.has(path)) {
		rawCache.set(path, (async () => {
			const res = await fetch(new URL(path, SHADER_ROOT), { cache: 'no-store' });
			if (!res.ok) throw new Error(`Could not load shader "${path}" (HTTP ${res.status})`);
			return res.text();
		})());
	}
	return rawCache.get(path);
}

async function resolve(path, seen) {
	const src = await fetchRaw(path);
	const parts = [];
	let last = 0;
	for (const m of src.matchAll(INCLUDE_RE)) {
		parts.push(src.slice(last, m.index));
		const inc = m[1];
		if (!seen.has(inc)) {
			seen.add(inc);
			parts.push(`// ---- begin ${inc} ----\n${await resolve(inc, seen)}\n// ---- end ${inc} ----`);
		}
		last = m.index + m[0].length;
	}
	parts.push(src.slice(last));
	return parts.join('');
}

// Returns the full source of a shader with all includes resolved.
export async function loadShader(path) {
	return resolve(path, new Set([path]));
}

// Forgets every loaded file, so the next loadShader() fetches fresh copies from disk.
export function clearShaderCache() {
	rawCache.clear();
}
