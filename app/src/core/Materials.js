import * as THREE from 'three';
import { loadShader } from './ShaderLib.js';

// Builds the materials every mesh needs. Each mesh is drawn several times per frame with a
// different material (see SceneManager.usePass):
//
//   gbuffer  writes the G-buffer (pipeline/gbuffer.vert + gbuffer.frag)
//   surface  the current style's surface shader (pipeline/surface.vert + the style's .frag)
//   depth    depth only, used before the inverted hull (pipeline/surface.vert + depth.frag)
//   hull     the inverted-hull outline (lines/hull.vert + lines/hull.frag)
//
// Per-mesh values (albedo, object id, previous model matrix) live in mesh.userData.uniforms and
// are shared by all four materials of that mesh.

export class MaterialFactory {
	constructor(shared) {
		this.shared = shared;
		this.src = null;
	}

	async load() {
		const [surfaceVert, gbufferVert, gbufferFrag, depthFrag] = await Promise.all([
			loadShader('pipeline/surface.vert'),
			loadShader('pipeline/gbuffer.vert'),
			loadShader('pipeline/gbuffer.frag'),
			loadShader('pipeline/depth.frag'),
		]);
		this.src = { surfaceVert, gbufferVert, gbufferFrag, depthFrag };
	}

	static meshUniforms(mesh) {
		if (!mesh.userData.uniforms) {
			mesh.userData.uniforms = {
				uAlbedo: { value: new THREE.Color('#d9d4c7') },
				uObjectId: { value: 1 },
				uPrevModelMatrix: { value: new THREE.Matrix4() },
			};
		}
		return mesh.userData.uniforms;
	}

	// (Re)builds all four materials of a mesh for the given style and line settings.
	build(mesh, style, lines) {
		const old = mesh.userData.materials;
		if (old) Object.values(old).forEach((m) => m.dispose());

		const per = MaterialFactory.meshUniforms(mesh);
		const shared = this.shared;

		mesh.userData.materials = {
			gbuffer: new THREE.ShaderMaterial({
				name: 'gbuffer',
				glslVersion: THREE.GLSL3,
				vertexShader: this.src.gbufferVert,
				fragmentShader: this.src.gbufferFrag,
				uniforms: { ...shared, ...per },
			}),
			surface: new THREE.ShaderMaterial({
				name: `surface:${style.id}`,
				glslVersion: THREE.GLSL3,
				vertexShader: this.src.surfaceVert,
				fragmentShader: style.surfaceSource,
				uniforms: { ...shared, ...per, ...style.uniforms },
			}),
			depth: new THREE.ShaderMaterial({
				name: 'depth',
				glslVersion: THREE.GLSL3,
				vertexShader: this.src.surfaceVert,
				fragmentShader: this.src.depthFrag,
				uniforms: { ...shared, ...per },
				colorWrite: false,
			}),
			hull: new THREE.ShaderMaterial({
				name: 'hull',
				glslVersion: THREE.GLSL3,
				vertexShader: lines.hullVert,
				fragmentShader: lines.hullFrag,
				uniforms: { ...shared, ...per, ...lines.uniforms },
				side: THREE.BackSide,
				depthFunc: THREE.LessDepth,
			}),
		};
		mesh.material = mesh.userData.materials.surface;
	}

	// Rebuilds only the surface material, when the style changes.
	buildSurface(mesh, style) {
		const mats = mesh.userData.materials;
		mats.surface.dispose();
		mats.surface = new THREE.ShaderMaterial({
			name: `surface:${style.id}`,
			glslVersion: THREE.GLSL3,
			vertexShader: this.src.surfaceVert,
			fragmentShader: style.surfaceSource,
			uniforms: { ...this.shared, ...mesh.userData.uniforms, ...style.uniforms },
		});
	}
}
