import { Style } from './Style.js';
import { makeRampTexture } from '../core/textures.js';

// Toon shading (Track B). Shader: shaders/styles/toon.frag

export class ToonStyle extends Style {
	constructor() {
		const params = {
			uBands: { value: 3, min: 1, max: 8, step: 1, label: 'Bands' },
			uUseRamp: { value: false, label: 'Use color ramp' },
			rampDark: { value: '#2b2140', color: true, label: 'Ramp dark' },
			rampMid: { value: '#b5546a', color: true, label: 'Ramp mid' },
			rampLight: { value: '#ffd9a8', color: true, label: 'Ramp light' },
			uRimColor: { value: '#ffffff', color: true, label: 'Rim color' },
			uRimStrength: { value: 0.6, min: 0, max: 1, step: 0.01, label: 'Rim strength' },
			uRimWidth: { value: 0.25, min: 0, max: 1, step: 0.01, label: 'Rim width' },
			uSpecStrength: { value: 0.8, min: 0, max: 1, step: 0.01, label: 'Specular strength' },
			uShininess: { value: 40, min: 1, max: 200, step: 1, label: 'Shininess' },
			uSpecSize: { value: 0.5, min: 0, max: 1, step: 0.01, label: 'Specular threshold' },
		};
		super({ id: 'toon', name: 'Toon', track: 'B', surface: 'styles/toon.frag', params });
		this.uniforms.tRamp = { value: makeRampTexture(this.rampStops()) };
	}

	rampStops() {
		return [this.params.rampDark.value, this.params.rampMid.value, this.params.rampLight.value];
	}

	onParamChange(key) {
		if (key.startsWith('ramp')) makeRampTexture(this.rampStops(), this.uniforms.tRamp.value);
	}
}
