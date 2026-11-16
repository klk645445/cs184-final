import { Style } from './Style.js';

// Screen-space halftone dots (Track B). Shader: shaders/styles/halftone.frag

export function halftoneStyle() {
	return new Style({
		id: 'halftone',
		name: 'Halftone (screen space)',
		track: 'B',
		surface: 'styles/halftone.frag',
		params: {
			uDotSpacing: { value: 8, min: 3, max: 30, step: 0.5, label: 'Dot spacing (px)' },
			uAngle: { value: 45, min: 0, max: 90, step: 1, label: 'Grid angle' },
			uUseAlbedo: { value: true, label: 'Albedo as paper' },
			uInkColor: { value: '#1d1b2e', color: true, label: 'Ink' },
			uPaperColor: { value: '#f4f1ea', color: true, label: 'Paper' },
		},
	});
}
