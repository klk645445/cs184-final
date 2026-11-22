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
	// Match the paper's aspect correction so the noise is isotropic on screen.
	vec2 aspect = vec2(1.0, uResolution.y / uResolution.x);
	vec2 p = uv * aspect * uPaperScale * 2.0;

	// Two decorrelated fbm lookups give a smooth 2D displacement field in [-0.5, 0.5].
	float nx = fbm(p, 3) - 0.5;
	float ny = fbm(p + vec2(37.2, 11.7), 3) - 0.5;

	return uv + vec2(nx, ny) * 2.0 * uWobble * uTexel;
}

// Part D3: Edge darkening. Pigment collects at the edges of a wet area, so the color gets darker
// where it changes. Returns a density in [1, ...).
float edgeDensity(vec2 uv) {
	vec3 sharp = texture(tSurface, uv).rgb;
	vec3 blurred = texture(tInput, uv).rgb;

	// Difference of Gaussians: ~0 in flat areas, large wherever the image has detail.
	float edge = length(sharp - blurred);

	return 1.0 + uEdgeDarkening * clamp(edge * 4.0, 0.0, 1.0);
}

// Part D3: Granulation and turbulence. Pigment settles in the valleys of the paper and varies in
// large blotches across the page. Returns a density around 1.
float textureDensity(vec2 uv) {
	// Paper grain: high frequency, straight from the paper texture.
	float paper = paperHeight(uv);
	float granulation = 1.0 + uGranulation * (paper - 0.5) * 2.0;

	// Turbulence: large blotches, so a much lower frequency than the paper.
	vec2 aspect = vec2(1.0, uResolution.y / uResolution.x);
	float turb = fbm(uv * aspect * 2.0, 4);
	float turbulence = 1.0 + uTurbulence * (turb - 0.5) * 2.0;

	return granulation * turbulence;
}

void main() {
	vec2 uv = wobble(vUv);
	vec3 color = texture(tInput, uv).rgb;
	float d = edgeDensity(uv) * textureDensity(vUv);
	outColor = vec4(applyDensity(color, d), 1.0);
}
