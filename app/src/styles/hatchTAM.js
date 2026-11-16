import { Style } from './Style.js';

// Object-space hatching with a tonal art map (Track C). Shader: shaders/styles/hatch_tam.frag
// The textures come from src/tam/TonalArtMap.js.

export class HatchTAMStyle extends Style {
	constructor(tam) {
		super({
			id: 'hatch-tam',
			name: 'Hatching (object space, TAM)',
			track: 'C',
			surface: 'styles/hatch_tam.frag',
			params: {
				uTAMScale: { value: 2, min: 0.25, max: 10, step: 0.05, label: 'TAM scale' },
				uTriplanarSharpness: { value: 4, min: 1, max: 16, step: 0.5, label: 'Triplanar sharpness' },
				uInkColor: { value: '#1a1a1a', color: true, label: 'Ink' },
				uPaperColor: { value: '#f4f1ea', color: true, label: 'Paper' },
			},
		});
		this.tam = tam;
		this.uniforms.tTAM0 = { value: tam.textures[0] };
		this.uniforms.tTAM1 = { value: tam.textures[1] };
	}

	// The tonal art map rebuilds its textures when regenerated, so point the uniforms at them again.
	refreshTextures() {
		this.uniforms.tTAM0.value = this.tam.textures[0];
		this.uniforms.tTAM1.value = this.tam.textures[1];
	}
}
