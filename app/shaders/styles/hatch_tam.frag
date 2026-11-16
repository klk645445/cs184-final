// Object-space hatching with a tonal art map (Track C), after Praun et al., "Real-Time Hatching",
// SIGGRAPH 2001. Surface shader: the strokes are attached to the surface, so they move with the
// object instead of staying fixed on the screen.
//
// The tonal art map (see src/tam/TonalArtMap.js) has 6 stroke textures, tone 0 (fewest strokes,
// lightest) to tone 5 (most strokes, darkest), packed into two RGBA textures:
//   tTAM0.r = tone 0, tTAM0.g = tone 1, tTAM0.b = tone 2
//   tTAM1.r = tone 3, tTAM1.g = tone 4, tTAM1.b = tone 5
// A value of 1 is paper and 0 is ink. Each texture has hand-built mipmaps, so strokes keep a
// similar width on screen as the object moves closer or further away.

#include "common/surface_common.glsl"

uniform sampler2D tTAM0;
uniform sampler2D tTAM1;
uniform float uTAMScale;            // how many times the texture repeats across the object
uniform float uTriplanarSharpness;  // higher = sharper transitions between the three projections
uniform vec3 uInkColor;
uniform vec3 uPaperColor;

// Part C3: Samples the tonal art map at texture coordinate uv for a given tone and returns the
// paper value in [0, 1] (1 = paper, 0 = ink).
//   tone: 0 = darkest, 1 = brightest (as returned by diffuseTone)
float tamSample(vec2 uv, float tone) {
	// TODO (Part C3): Map the tone onto the 6 TAM levels (a bright tone should use tone 0) and
	// blend the two nearest levels, as in Praun et al. Section 4. With the levels packed into
	// channels, this can be done with two dot products of the samples with blend weight vectors.
	return tone;
}

// Part C3: Object-space mapping. Most scanned models have no texture coordinates, so project the
// object-space position onto the three axis planes and blend the three samples by the normal.
//   p: object-space position, n: object-space unit normal
float tamTriplanar(vec3 p, vec3 n, float tone) {
	// TODO (Part C3): Sample tamSample with p.yz, p.xz and p.xy (scaled by uTAMScale), and blend
	// the results with weights from abs(n) raised to uTriplanarSharpness and normalized to sum to 1.
	return tamSample(p.xy * uTAMScale, tone);
}

void main() {
	Surface s = getSurface();
	float tone = diffuseTone(s);
	float paper = tamTriplanar(vObjectPos, normalize(vObjectNormal), tone);
	outColor = vec4(mix(uInkColor, uPaperColor, paper), 1.0);
}
