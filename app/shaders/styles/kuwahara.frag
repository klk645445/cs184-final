// Kuwahara filter (Track D). Post-processing pass: an edge-preserving smoothing filter that makes
// the image look painted with flat brush strokes.

#include "common/post_common.glsl"

uniform float uRadius;  // size of each of the four regions, in pixels

// Part D2: The classic Kuwahara filter. For the 4 square regions that share the pixel at uv as a
// corner (top-left, top-right, bottom-left, bottom-right), compute the mean color and its
// variance, and return the mean of the region with the smallest variance.
vec3 kuwahara(vec2 uv) {
	// TODO (Part D2): Sample tInput over each region (offsets of uTexel), accumulating the sum and
	// the sum of squares, so that the variance is E[c^2] - E[c]^2. Compare the regions by the
	// variance of the luminance (or the sum of the per-channel variances).
	// GLSL needs constant loop bounds, so loop to a fixed maximum and skip offsets beyond uRadius.
	return texture(tInput, uv).rgb;
}

void main() {
	outColor = vec4(kuwahara(vUv), 1.0);
}
