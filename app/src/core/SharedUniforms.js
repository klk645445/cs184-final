import * as THREE from 'three';

// Uniforms shared by every material and pass. Each material is created with these objects spread
// into its uniforms ({ ...shared, ... }), so they all point at the same { value } objects and
// updating a value here updates it everywhere.

export function createSharedUniforms() {
	return {
		// Frame
		uResolution: { value: new THREE.Vector2(1, 1) },
		uTexel: { value: new THREE.Vector2(1, 1) },
		uTime: { value: 0 },
		uBackground: { value: new THREE.Color('#f4f1ea') },

		// Lighting (one directional light plus ambient)
		uLightDirView: { value: new THREE.Vector3(0, 0, 1) },
		uLightIntensity: { value: 0.9 },
		uAmbient: { value: 0.12 },

		// Previous frame, for motion vectors
		uPrevViewProjection: { value: new THREE.Matrix4() },

		// G-buffer and pipeline textures, assigned by the Pipeline after it creates its targets
		tNormal: { value: null },
		tAlbedo: { value: null },
		tLight: { value: null },
		tMotion: { value: null },
		tSurface: { value: null },
	};
}
