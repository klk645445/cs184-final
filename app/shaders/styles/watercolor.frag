// Watercolor (Track D), after Bousseau et al., "Interactive Watercolor Rendering with Temporal
// Coherence and Abstraction", NPAR 2006. Last pass of the Watercolor style's chain:
//
//   surface (Base) -> blur horizontal -> blur vertical -> watercolor (this pass)
//
// so tInput is the blurred image and tSurface is the original, unblurred one.
//
// The paper models every effect as a change of pigment density d at each pixel, applied to the
// color with applyDensity() below: d = 1 leaves the color unchanged, d > 1 darkens it like more
// pigment, and d < 1 lightens it.

#include "common/post_common.glsl"

uniform sampler2D tPaper;       // tileable paper height texture, values in [0, 1]
uniform float uPaperScale;      // how many paper texture tiles fit across the screen width
uniform float uWobble;          // how far edges are displaced, in pixels
uniform float uEdgeDarkening;   // strength of the dark pigment rim at color edges
uniform float uGranulation;     // strength of pigment collecting in the paper grain
uniform float uTurbulence;      // strength of low-frequency pigment density variation

// Color modification from Bousseau et al., Section 3: darkens (d > 1) or lightens (d < 1) c.
vec3 applyDensity(vec3 c, float d) {
	return clamp(c - (c - c * c) * (d - 1.0), 0.0, 1.0);
}

// Paper height at uv, in [0, 1].
float paperHeight(vec2 uv) {
	vec2 aspect = vec2(1.0, uResolution.y / uResolution.x);
	return texture(tPaper, uv * aspect * uPaperScale).r;
}

// Part D3: Hand-drawn wobble. Returns the uv to sample the image at, displaced so that edges are
// slightly irregular, like paint that did not follow the outline exactly.
vec2 wobble(vec2 uv) {
	// TODO (Part D3): Offset uv by up to uWobble pixels using the gradient of the paper texture or
	// a low-frequency noise. Use a fixed pattern (not uTime) so that it does not flicker.
	return uv;
}

// Part D3: Edge darkening. Pigment collects at the edges of a wet area, so the color gets darker
// where it changes. Returns a density in [1, ...).
float edgeDensity(vec2 uv) {
	// TODO (Part D3): Measure how much the color changes around uv, for example the difference
	// between the original (tSurface) and the blurred image (tInput), or a gradient of tInput,
	// and turn it into a density above 1 scaled by uEdgeDarkening.
	return 1.0;
}

// Part D3: Granulation and turbulence. Pigment settles in the valleys of the paper and varies in
// large blotches across the page. Returns a density around 1.
float textureDensity(vec2 uv) {
	// TODO (Part D3): Combine the paper height (scaled by uGranulation) and a low-frequency fbm
	// noise (scaled by uTurbulence) into a density around 1.
	return 1.0;
}

void main() {
	vec2 uv = wobble(vUv);
	vec3 color = texture(tInput, uv).rgb;
	float d = edgeDensity(uv) * textureDensity(vUv);
	outColor = vec4(applyDensity(color, d), 1.0);
}
