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
	// x = 0 is blank paper, x = i + 1 is TAM tone i, so the brightest tone fades to plain paper
	// and the darkest tone uses tone 5
	float x = (1.0 - clamp(tone, 0.0, 1.0)) * 6.0;

	// Hat-function weights: only the two levels nearest to x are non-zero, and they sum to 1
	vec3 w0 = max(vec3(0.0), 1.0 - abs(x - vec3(1.0, 2.0, 3.0)));
	vec3 w1 = max(vec3(0.0), 1.0 - abs(x - vec3(4.0, 5.0, 6.0)));
	float wPaper = max(0.0, 1.0 - x);

	vec3 s0 = texture(tTAM0, uv).rgb;
	vec3 s1 = texture(tTAM1, uv).rgb;
	return wPaper + dot(s0, w0) + dot(s1, w1);
}

// Part C3: Object-space mapping. Most scanned models have no texture coordinates, so project the
// object-space position onto the three axis planes and blend the three samples by the normal.
//   p: object-space position, n: object-space unit normal
float tamTriplanar(vec3 p, vec3 n, float tone) {
	vec3 w = pow(abs(n), vec3(uTriplanarSharpness));
	w /= (w.x + w.y + w.z);

	vec3 q = p * uTAMScale;
	return w.x * tamSample(q.yz, tone)
	     + w.y * tamSample(q.xz, tone)
	     + w.z * tamSample(q.xy, tone);
}

void main() {
	Surface s = getSurface();
	float tone = diffuseTone(s);
	float paper = tamTriplanar(vObjectPos, normalize(vObjectNormal), tone);
	outColor = vec4(mix(uInkColor, uPaperColor, paper), 1.0);
}
