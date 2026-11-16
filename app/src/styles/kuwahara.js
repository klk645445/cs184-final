import { Style } from './Style.js';

// Kuwahara filter (Track D). Post pass: shaders/styles/kuwahara.frag

export function kuwaharaStyle() {
	return new Style({
		id: 'kuwahara',
		name: 'Kuwahara (painted)',
		track: 'D',
		post: [{ frag: 'styles/kuwahara.frag' }],
		params: {
			uRadius: { value: 5, min: 1, max: 12, step: 1, label: 'Radius (px)' },
		},
	});
}
