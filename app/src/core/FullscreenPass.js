import * as THREE from 'three';

// One full-screen triangle that covers the viewport. Every image-space pass in the pipeline
// (post-processing, edge detection, compositing, output) is a FullscreenPass with its own
// ShaderMaterial, rendered into a render target or onto the screen.

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export class FullscreenPass {
	constructor(material) {
		this.mesh = new THREE.Mesh(geometry, material);
		this.mesh.frustumCulled = false;
	}

	get material() {
		return this.mesh.material;
	}

	get uniforms() {
		return this.mesh.material.uniforms;
	}

	// Renders the pass into `target` (or the screen when target is null).
	render(renderer, target) {
		renderer.setRenderTarget(target);
		renderer.render(this.mesh, camera);
	}

	dispose() {
		this.mesh.material.dispose();
	}
}

// Builds a ShaderMaterial for a full-screen pass. All of our shaders use GLSL 3 (WebGL 2), so a
// fragment shader declares its own output, e.g. `layout(location = 0) out vec4 outColor;`.
export function makePassMaterial(vertexShader, fragmentShader, uniforms) {
	return new THREE.ShaderMaterial({
		glslVersion: THREE.GLSL3,
		vertexShader,
		fragmentShader,
		uniforms,
		depthTest: false,
		depthWrite: false,
	});
}
