import * as THREE from 'three';
import { MaterialFactory } from './Materials.js';

// Owns the three.js scene: the current model's meshes, their materials, and the turntable
// rotation. The pipeline draws the same meshes several times per frame, switching every mesh to
// the material for that pass with usePass().

export class SceneManager {
	constructor(factory) {
		this.factory = factory;
		this.scene = new THREE.Scene();
		this.root = new THREE.Group();
		this.scene.add(this.root);
		this.meshes = [];
		this.triangles = 0;
		this.modelGroup = null;
	}

	// model: the result of normalizeModel()
	setModel(model, style, lines) {
		if (this.modelGroup) {
			this.root.remove(this.modelGroup);
			for (const m of this.meshes) {
				m.geometry.dispose();
				Object.values(m.userData.materials).forEach((mat) => mat.dispose());
			}
		}
		this.modelGroup = model.group;
		this.meshes = model.meshes;
		this.triangles = model.triangles;
		this.root.rotation.set(0, 0, 0);
		this.root.add(model.group);

		for (const mesh of this.meshes) {
			const u = MaterialFactory.meshUniforms(mesh);
			u.uAlbedo.value.set(mesh.userData.color);
			u.uObjectId.value = mesh.userData.objectId;
			this.factory.build(mesh, style, lines);
		}
		this.scene.updateMatrixWorld(true);
		this.storePrevious();
	}

	// Rebuilds every material, after the shaders were reloaded.
	rebuildAll(style, lines) {
		for (const mesh of this.meshes) this.factory.build(mesh, style, lines);
	}

	// Rebuilds the surface materials, after the style changed.
	rebuildSurface(style) {
		for (const mesh of this.meshes) this.factory.buildSurface(mesh, style);
	}

	// Switches every mesh to its material for a pass: 'gbuffer', 'surface', 'depth' or 'hull'.
	usePass(pass) {
		for (const mesh of this.meshes) mesh.material = mesh.userData.materials[pass];
	}

	// Sets the albedo of every mesh (sRGB color string).
	setColor(color) {
		for (const mesh of this.meshes) mesh.userData.uniforms.uAlbedo.value.set(color);
	}

	// Remembers this frame's model matrices, for next frame's motion vectors.
	storePrevious() {
		for (const mesh of this.meshes) mesh.userData.uniforms.uPrevModelMatrix.value.copy(mesh.matrixWorld);
	}
}
