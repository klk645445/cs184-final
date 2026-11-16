import * as THREE from 'three';

// Deterministic camera paths, used both for playback (videos) and for the measurements, so every
// style is measured on exactly the same frames. A path maps t in [0, 1] to a camera position
// (always looking at the origin, where the model is centered) and a rotation of the model
// around the vertical axis.

function spherical(azimuthDeg, elevationDeg, distance) {
	const az = THREE.MathUtils.degToRad(azimuthDeg);
	const el = THREE.MathUtils.degToRad(elevationDeg);
	return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(distance);
}

const smooth = (t) => 0.5 - 0.5 * Math.cos(2 * Math.PI * t); // 0 -> 1 -> 0

export const CAMERA_PATHS = {
	// Camera circles the model once.
	'Orbit': (t) => ({ position: spherical(360 * t, 15, 3.2), rotation: 0 }),
	// Camera moves straight towards the model and back. Use this for the stroke scale metric.
	'Dolly in and out': (t) => ({ position: spherical(30, 15, THREE.MathUtils.lerp(5.5, 1.7, smooth(t))), rotation: 0 }),
	// Camera stays still and the model spins, so all motion comes from the model matrix.
	'Turntable': (t) => ({ position: spherical(0, 15, 3.2), rotation: 2 * Math.PI * t }),
	// A bit of everything: sideways, closer and lower, then back.
	'Fly-by': (t) => ({
		position: spherical(THREE.MathUtils.lerp(-60, 60, t), THREE.MathUtils.lerp(30, 5, smooth(t)), THREE.MathUtils.lerp(4, 2.2, smooth(t))),
		rotation: 0,
	}),
	// Nothing moves. Every coherence and stability metric should be 0 here.
	'Static': () => ({ position: spherical(30, 15, 3.2), rotation: 0 }),
};

// Puts the camera and the model where `path` says they are at time t.
export function applyPath(pathName, t, camera, sceneManager) {
	const p = CAMERA_PATHS[pathName](t);
	camera.position.copy(p.position);
	camera.lookAt(0, 0, 0);
	camera.updateMatrixWorld();
	sceneManager.root.rotation.y = p.rotation;
	sceneManager.scene.updateMatrixWorld(true);
}
