import { assert, identity, near } from './webgl-helpers.js';

// Transform feedback captures the actual production vertex shader's clip position,
// before rasterization can hide subpixel displacement or distance errors.
const gl = document.createElement('canvas').getContext('webgl2');
let program;
async function hullClip({ position = [0, 0, -2], normal = [1, 0, 0],
	modelView = identity(), projection = perspective(), normalMatrix = [1, 0, 0, 0, 1, 0, 0, 0, 1],
	resolution = [640, 480], width = 4 } = {}) {
	if (!program) {
		assert(gl, 'WebGL2 required');
		const response = await fetch('/app/shaders/lines/hull.vert');
		assert(response.ok, 'Production hull shader must load');
		const vertex = `#version 300 es
precision highp float;
in vec3 position; in vec3 normal;
uniform mat4 modelViewMatrix, projectionMatrix;
uniform mat3 normalMatrix;
out vec4 capturedClip;
#define main productionMain
${await response.text()}
#undef main
void main() { productionMain(); capturedClip = gl_Position; }
`;
		program = gl.createProgram();
		for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER,
			'#version 300 es\nprecision highp float; out vec4 color; void main() { color = vec4(1); }']]) {
			const shader = gl.createShader(type);
			gl.shaderSource(shader, source); gl.compileShader(shader);
			assert(gl.getShaderParameter(shader, gl.COMPILE_STATUS), gl.getShaderInfoLog(shader));
			gl.attachShader(program, shader); gl.deleteShader(shader);
		}
		gl.transformFeedbackVaryings(program, ['capturedClip'], gl.INTERLEAVED_ATTRIBS);
		gl.linkProgram(program);
		assert(gl.getProgramParameter(program, gl.LINK_STATUS), gl.getProgramInfoLog(program));
	}
	gl.useProgram(program);
	for (const [name, vector] of [['position', position], ['normal', normal]]) {
		const index = gl.getAttribLocation(program, name);
		if (index >= 0) { gl.disableVertexAttribArray(index); gl.vertexAttrib3fv(index, vector); }
	}
	gl.uniformMatrix4fv(gl.getUniformLocation(program, 'modelViewMatrix'), false, modelView);
	gl.uniformMatrix4fv(gl.getUniformLocation(program, 'projectionMatrix'), false, projection);
	gl.uniformMatrix3fv(gl.getUniformLocation(program, 'normalMatrix'), false, normalMatrix);
	gl.uniform2fv(gl.getUniformLocation(program, 'uResolution'), resolution);
	gl.uniform1f(gl.getUniformLocation(program, 'uLineWidth'), width);
	const output = gl.createBuffer();
	gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, output);
	gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, 16, gl.STREAM_READ);
	gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, output);
	gl.enable(gl.RASTERIZER_DISCARD);
	gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, 1); gl.endTransformFeedback();
	gl.disable(gl.RASTERIZER_DISCARD);
	const clip = new Float32Array(4);
	gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, clip);
	gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
	gl.deleteBuffer(output);
	assert(gl.getError() === gl.NO_ERROR, 'Hull transform-feedback WebGL error');
	assert(clip.every(Number.isFinite), `Nonfinite clip position: ${clip}`);
	return [...clip];
}

// Simple symmetric perspective with near=1, far=9; xy scale controls zoom.
function perspective(zoom = 1) {
	return new Float32Array([zoom, 0, 0, 0, 0, zoom, 0, 0, 0, 0, -1.25, -1, 0, 0, -2.25, 0]);
}
async function displacement(options) {
	const before = await hullClip({ ...options, width: 0 });
	const after = await hullClip(options);
	near(after[2], before[2]); near(after[3], before[3]);
	const [w, h] = options.resolution || [640, 480];
	return [(after[0] / after[3] - before[0] / before[3]) * w / 2,
		(after[1] / after[3] - before[1] / before[3]) * h / 2];
}

export const tests = [
	['A4 hull width remains four pixels at three camera distances', async () => {
		for (const z of [-2, -4, -8]) {
			const [x, y] = await displacement({ position: [0, 0, z] });
			near(x, 4); near(y, 0);
		}
	}],
	['A4 camera zoom does not scale outline width', async () => {
		for (const zoom of [0.5, 1, 3]) near((await displacement({ projection: perspective(zoom) }))[0], 4);
	}],
	['A4 diagonal normals normalize in pixel space on a nonsquare target', async () => {
		const [x, y] = await displacement({ normal: [1, 1, 0], resolution: [800, 400] });
		near(x, 8 / Math.sqrt(5)); near(y, 4 / Math.sqrt(5));
	}],
	['A4 inverse-transpose normal transform handles nonuniform scale', async () => {
		const [x, y] = await displacement({ normal: [1, 1, 0], resolution: [400, 400],
			normalMatrix: [0.5, 0, 0, 0, 2, 0, 0, 0, 1] });
		near(x, 4 / Math.sqrt(17)); near(y, 16 / Math.sqrt(17));
	}],
	['A4 view-space normal rotation controls extrusion direction', async () => {
		const [x, y] = await displacement({ normalMatrix: [0, 1, 0, -1, 0, 0, 0, 0, 1] });
		near(x, 0); near(y, 4);
	}],
	['A4 off-axis perspective includes change of homogeneous w', async () => {
		// Moving (1,0,-2) towards the eye increases projected x even for a pure z normal.
		const [x, y] = await displacement({ position: [1, 0, -2], normal: [0, 0, 1] });
		near(x, 4, 0.0001); near(y, 0);
	}],
	['A4 orthographic extrusion preserves width and clip depth', async () => {
		const [x, y] = await displacement({ position: [0, 0, -0.5], normal: [0, -1, 0], projection: identity() });
		near(x, 0); near(y, -4);
	}],
	['A4 line-width control includes half-pixel and wide lines', async () => {
		for (const width of [0.5, 2, 10]) near((await displacement({ width }))[0], width);
	}],
	['A4 zero and negative widths leave clip position unchanged', async () => {
		for (const width of [0, -2]) near((await displacement({ width }))[0], 0);
	}],
	['A4 zero and view-aligned normals remain finite without arbitrary extrusion', async () => {
		for (const normal of [[0, 0, 0], [0, 0, 1]]) {
			const [x, y] = await displacement({ normal }); near(x, 0); near(y, 0);
		}
	}],
	['A4 invalid resolution and nonpositive clip w do not extrude', async () => {
		for (const options of [{ resolution: [0, 480] }, { resolution: [640, -1] },
			{ position: [0.25, 0, 0] }, { position: [0.25, 0, 1] }]) {
			const a = await hullClip(options), b = await hullClip({ ...options, width: 0 });
			a.forEach((v, i) => near(v, b[i]));
		}
	}],
];
