import * as THREE from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';

// Loads the built-in models and user files, and normalizes every model the same way:
// all transforms are baked into the geometry, and the whole model is centered and scaled to fit
// in the unit sphere. Object-space positions (vObjectPos) are therefore in about [-1, 1]^3 for
// every model, so object-space texture scales work the same on all of them.

const MODEL_DIR = new URL('../../models/', import.meta.url);

const PALETTE = ['#d9d4c7', '#c96f53', '#5b8bb5', '#e2b84a', '#7aa874', '#a77cc1'];

function geometryModel(geometry, color = PALETTE[0]) {
	const mesh = new THREE.Mesh(geometry);
	mesh.userData.color = color;
	return mesh;
}

function stillLife() {
	const group = new THREE.Group();
	const add = (geometry, color, x, y, z) => {
		const mesh = geometryModel(geometry, color);
		mesh.position.set(x, y, z);
		group.add(mesh);
		return mesh;
	};
	add(new THREE.PlaneGeometry(4, 4, 1, 1), '#e8e2d4', 0, 0, 0).rotation.x = -Math.PI / 2;
	add(new THREE.SphereGeometry(0.55, 96, 48), PALETTE[1], -0.9, 0.55, 0.2);
	add(new THREE.TorusKnotGeometry(0.4, 0.14, 200, 32), PALETTE[2], 0.6, 0.62, -0.5);
	add(new THREE.BoxGeometry(0.7, 0.7, 0.7), PALETTE[3], 0.7, 0.35, 0.8).rotation.y = 0.6;
	add(new THREE.CylinderGeometry(0.25, 0.3, 1.2, 64), PALETTE[4], -0.2, 0.6, -1.1);
	return group;
}

// name -> function returning a promise of an Object3D
export const BUILTIN_MODELS = {
	'Bunny': () => loadPLY('bunny.ply'),
	'Dragon': () => loadPLY('dragon.ply'),
	'Max Planck': () => loadPLY('maxplanck.ply', 180),
	'Beast': () => loadPLY('beast.ply', 180),
	'Cow': () => loadPLY('cow.ply', 180),
	'Teapot': () => loadPLY('teapot.ply'),
	'Sphere': async () => geometryModel(new THREE.SphereGeometry(1, 128, 64)),
	'Torus knot': async () => geometryModel(new THREE.TorusKnotGeometry(0.7, 0.25, 256, 32)),
	'Still life': async () => stillLife(),
	'Torus knot, 1M triangles': async () => geometryModel(new THREE.TorusKnotGeometry(0.7, 0.25, 4096, 128)),
};

// yawDeg turns the model around the vertical axis so it faces the default camera.
async function loadPLY(file, yawDeg = 0) {
	const res = await fetch(new URL(file, MODEL_DIR));
	if (!res.ok) throw new Error(`Could not load model "${file}" (HTTP ${res.status})`);
	const mesh = geometryModel(new PLYLoader().parse(await res.arrayBuffer()));
	mesh.rotation.y = THREE.MathUtils.degToRad(yawDeg);
	return mesh;
}

// Loads a model from a File (drag and drop or the file picker).
export async function loadModelFile(file) {
	const ext = file.name.split('.').pop().toLowerCase();
	switch (ext) {
		case 'ply':
			return geometryModel(new PLYLoader().parse(await file.arrayBuffer()));
		case 'stl':
			return geometryModel(new STLLoader().parse(await file.arrayBuffer()));
		case 'obj':
			return new OBJLoader().parse(await file.text());
		case 'glb':
		case 'gltf':
			return (await new GLTFLoader().parseAsync(await file.arrayBuffer(), '')).scene;
		case 'dae':
			return new ColladaLoader().parse(await file.text(), '').scene;
		default:
			throw new Error(`Unsupported model format ".${ext}"`);
	}
}

// Turns any loaded Object3D into a flat list of meshes with normalized geometry. Returns
// { group, meshes, triangles }. Each mesh gets userData.color (sRGB string) for its albedo.
export function normalizeModel(object) {
	object.updateMatrixWorld(true);

	const meshes = [];
	object.traverse((child) => {
		if (!child.isMesh) return;
		let geometry = child.geometry.clone();
		geometry.applyMatrix4(child.matrixWorld);
		// Keep only what the pipeline uses
		for (const name of Object.keys(geometry.attributes)) {
			if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
		}
		if (!geometry.attributes.normal) geometry.computeVertexNormals();

		let color = child.userData.color;
		if (!color && child.material && child.material.color) color = '#' + child.material.color.getHexString();
		const mesh = new THREE.Mesh(geometry);
		mesh.userData.color = color || PALETTE[meshes.length % PALETTE.length];
		mesh.name = child.name;
		meshes.push(mesh);
	});
	if (meshes.length === 0) throw new Error('The model does not contain any meshes');

	const box = new THREE.Box3();
	for (const m of meshes) {
		m.geometry.computeBoundingBox();
		box.union(m.geometry.boundingBox);
	}
	const center = box.getCenter(new THREE.Vector3());
	const sphere = new THREE.Sphere();
	box.getBoundingSphere(sphere);
	const scale = 1 / sphere.radius;
	const xf = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));

	const group = new THREE.Group();
	let triangles = 0;
	meshes.forEach((m, i) => {
		m.geometry.applyMatrix4(xf);
		m.geometry.computeBoundingSphere();
		m.geometry.computeBoundingBox();
		triangles += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
		m.userData.objectId = i + 1;
		group.add(m);
	});
	return { group, meshes, triangles };
}
