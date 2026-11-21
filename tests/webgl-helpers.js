// Test fixtures render the production GLSL; expected answers live in the test cases.
const size = 32;
const gl = document.createElement('canvas').getContext('webgl2', { antialias: false });
if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw new Error('WebGL2 float render targets are required');

export function assert(condition, message) {
	if (!condition) throw new Error(message);
}
export function near(actual, expected, tolerance = 1e-5) {
	assert(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
		`expected ${expected}, got ${actual} (tolerance ${tolerance})`);
}
export function identity() {
	return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
export function translation(x, y, z) {
	const matrix = identity();
	matrix[12] = x; matrix[13] = y; matrix[14] = z;
	return matrix;
}

async function source(path, seen = new Set()) {
	if (seen.has(path)) return '';
	seen.add(path);
	const response = await fetch(`/app/shaders/${path}`);
	if (!response.ok) throw new Error(`Shader HTTP ${response.status}: ${path}`);
	let text = await response.text();
	for (const match of [...text.matchAll(/^[ \t]*#include\s+"([^"]+)"[ \t]*$/gm)]) {
		text = text.replace(match[0], await source(match[1], seen));
	}
	return text;
}

const programs = new Map();
async function program(vertexPath, fragmentPath) {
	const key = `${vertexPath}:${fragmentPath}`;
	if (programs.has(key)) return programs.get(key);
	const vertexDeclarations = `
in vec3 position; in vec3 normal; in vec2 uv;
uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; uniform mat3 normalMatrix;
`;
	const compiled = [];
	for (const [type, path, declarations] of [
		[gl.VERTEX_SHADER, vertexPath, vertexDeclarations], [gl.FRAGMENT_SHADER, fragmentPath, ''],
	]) {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, `#version 300 es\nprecision highp float;\nprecision highp int;\n${declarations}\n${await source(path)}`);
		gl.compileShader(shader);
		assert(gl.getShaderParameter(shader, gl.COMPILE_STATUS), `${path}: ${gl.getShaderInfoLog(shader)}`);
		compiled.push(shader);
	}
	const result = gl.createProgram();
	compiled.forEach((shader) => gl.attachShader(result, shader));
	gl.linkProgram(result);
	assert(gl.getProgramParameter(result, gl.LINK_STATUS), gl.getProgramInfoLog(result));
	compiled.forEach((shader) => gl.deleteShader(shader));
	programs.set(key, result);
	return result;
}

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);
const vertices = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
	-1, -1, 0, 0, 0, 1, 0, 0,
	 3, -1, 0, 0, 0, 1, 2, 0,
	-1,  3, 0, 0, 0, 1, 0, 2,
]), gl.STATIC_DRAW);

function use(result) {
	gl.useProgram(result);
	gl.bindVertexArray(vao);
	gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
	for (const [name, count, offset] of [['position', 3, 0], ['normal', 3, 12], ['uv', 2, 24]]) {
		const index = gl.getAttribLocation(result, name);
		if (index < 0) continue;
		gl.enableVertexAttribArray(index);
		gl.vertexAttribPointer(index, count, gl.FLOAT, false, 32, offset);
	}
	gl.viewport(0, 0, size, size);
	gl.disable(gl.DEPTH_TEST);
}
function texture(data) {
	const result = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, result);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, size, 0, gl.RGBA, gl.FLOAT, data);
	return result;
}
function target(count) {
	const framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	const textures = [];
	for (let i = 0; i < count; i++) {
		textures.push(texture(null));
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, textures[i], 0);
	}
	gl.drawBuffers(textures.map((_, index) => gl.COLOR_ATTACHMENT0 + index));
	assert(gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE, 'Incomplete float framebuffer');
	return { dispose() { textures.forEach((t) => gl.deleteTexture(t)); gl.deleteFramebuffer(framebuffer); } };
}
function checkedDraw() {
	gl.drawArrays(gl.TRIANGLES, 0, 3);
	assert(gl.getError() === gl.NO_ERROR, 'WebGL error during draw');
}

export async function renderMotion({ previousModel = identity(), previousViewProjection = translation(0, 0, -0.25), projection = identity() } = {}) {
	const p = await program('pipeline/gbuffer.vert', 'pipeline/gbuffer.frag');
	use(p);
	const output = target(4);
	const mat = (name, value) => gl.uniformMatrix4fv(gl.getUniformLocation(p, name), false, value);
	mat('modelViewMatrix', translation(0, 0, -0.25));
	mat('projectionMatrix', projection);
	mat('uPrevModelMatrix', previousModel);
	mat('uPrevViewProjection', previousViewProjection);
	gl.uniformMatrix3fv(gl.getUniformLocation(p, 'normalMatrix'), false, new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
	gl.uniform3f(gl.getUniformLocation(p, 'uLightDirView'), 0, 0, 1);
	gl.uniform3f(gl.getUniformLocation(p, 'uAlbedo'), 0.2, 0.4, 0.6);
	gl.uniform1f(gl.getUniformLocation(p, 'uObjectId'), 7);
	checkedDraw();
	const pixels = [];
	for (let i = 0; i < 4; i++) {
		gl.readBuffer(gl.COLOR_ATTACHMENT0 + i);
		const pixel = new Float32Array(4);
		gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.FLOAT, pixel);
		pixels.push([...pixel]);
	}
	assert(gl.getError() === gl.NO_ERROR, 'WebGL error during readback');
	output.dispose();
	return pixels;
}

// Field fixtures return { depth, normal, id } at integer pixel coordinates.
export async function renderEdges(field, { width = 2, depth = true, normal = false, hull = 0,
	depthThreshold = 0.02, normalThreshold = 0.3 } = {}) {
	const p = await program('pipeline/fullscreen.vert', 'lines/edges.frag');
	use(p);
	const output = target(1);
	const normals = new Float32Array(size * size * 4);
	const albedo = new Float32Array(size * size * 4);
	const hullMask = new Float32Array(size * size * 4);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const value = field(x, y);
		const i = (y * size + x) * 4;
		normals.set([...(value.normal || [0, 0, 1]), value.depth], i);
		albedo[i + 3] = (value.id ?? (value.depth > 0 ? 1 : 0)) / 255;
		hullMask[i] = hull;
	}
	const inputs = [];
	for (const [unit, name, data] of [[0, 'tNormal', normals], [1, 'tAlbedo', albedo], [2, 'tHull', hullMask]]) {
		gl.activeTexture(gl.TEXTURE0 + unit);
		inputs.push(texture(data));
		gl.uniform1i(gl.getUniformLocation(p, name), unit);
	}
	gl.uniform2f(gl.getUniformLocation(p, 'uTexel'), 1 / size, 1 / size);
	gl.uniform2f(gl.getUniformLocation(p, 'uResolution'), size, size);
	for (const [name, value] of [['uLineWidth', width], ['uDepthThreshold', depthThreshold], ['uNormalThreshold', normalThreshold]]) {
		gl.uniform1f(gl.getUniformLocation(p, name), value);
	}
	for (const [name, value] of [['uUseDepth', depth], ['uUseNormal', normal], ['uUseHull', hull > 0]]) {
		gl.uniform1i(gl.getUniformLocation(p, name), Number(value));
	}
	checkedDraw();
	const pixels = new Float32Array(size * size * 4);
	gl.readPixels(0, 0, size, size, gl.RGBA, gl.FLOAT, pixels);
	assert(gl.getError() === gl.NO_ERROR, 'WebGL error during edge readback');
	inputs.forEach((t) => gl.deleteTexture(t));
	output.dispose();
	const mask = [];
	for (let i = 0; i < pixels.length; i += 4) {
		assert(Number.isFinite(pixels[i]) && pixels[i] >= 0 && pixels[i] <= 1, 'Invalid line coverage');
		near(pixels[i + 1], 0); near(pixels[i + 2], 0); near(pixels[i + 3], 1);
		mask.push(pixels[i]);
	}
	return { mask, at: (x, y) => mask[y * size + x], count: mask.filter((v) => v > 0).length };
}
