import * as THREE from 'three';
import { Style } from './Style.js';

// Posterization to a fixed palette (Track D). Post pass: shaders/styles/posterize.frag

export const PALETTES = {
	'Obey poster': ['#0f2a3a', '#d6332a', '#77a6b0', '#f2e6c2'],
	'Gameboy': ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
	'Sunset': ['#2b1b3d', '#6b2d5c', '#c0504d', '#f0a35e', '#fbe3b0'],
	'Ink and paper': ['#1a1a1a', '#6e6a62', '#bdb6a6', '#f4f1ea'],
	'Pastel': ['#3d405b', '#81b29a', '#f2cc8f', '#e07a5f', '#f4f1de'],
};

export function posterizeStyle() {
	const style = new Style({
		id: 'posterize',
		name: 'Posterize',
		track: 'D',
		post: [{ frag: 'styles/posterize.frag' }],
		params: {
			palette: { value: 'Obey poster', options: Object.keys(PALETTES), label: 'Palette' },
			uLumaWeight: { value: 0.7, min: 0, max: 1, step: 0.01, label: 'Brightness weight' },
		},
	});

	// The palette dropdown fills the uPalette array uniform.
	style.uniforms.uPalette = { value: Array.from({ length: 8 }, () => new THREE.Color()) };
	style.uniforms.uPaletteSize = { value: 0 };
	const applyPalette = () => {
		const colors = PALETTES[style.uniforms.palette.value];
		colors.forEach((c, i) => style.uniforms.uPalette.value[i].set(c));
		style.uniforms.uPaletteSize.value = colors.length;
	};
	style.onParamChange = (key) => {
		if (key === 'palette') applyPalette();
	};
	applyPalette();
	return style;
}
