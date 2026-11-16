import { Style } from './Style.js';

// Screen-space hatching (Track C), the baseline for the coherence comparison.
// Shader: shaders/styles/hatch_screen.frag

export function hatchScreenStyle() {
	return new Style({
		id: 'hatch-screen',
		name: 'Hatching (screen space)',
		track: 'C',
		surface: 'styles/hatch_screen.frag',
		params: {
			uLineSpacing: { value: 7, min: 2, max: 30, step: 0.5, label: 'Line spacing (px)' },
			uLineWidth: { value: 1.5, min: 0.5, max: 10, step: 0.1, label: 'Line width (px)' },
			uAngle: { value: 45, min: 0, max: 180, step: 1, label: 'Angle' },
			uCrossHatch: { value: true, label: 'Cross-hatching' },
			uInkColor: { value: '#1a1a1a', color: true, label: 'Ink' },
			uPaperColor: { value: '#f4f1ea', color: true, label: 'Paper' },
		},
	});
}
