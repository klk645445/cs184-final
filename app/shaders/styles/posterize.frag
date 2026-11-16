// Posterization to a fixed palette (Track D). Post-processing pass: replaces every color of the
// Base style image with the closest color of a small palette, like a screen print or poster.

#include "common/post_common.glsl"

uniform vec3 uPalette[8];   // palette colors (linear RGB); only the first uPaletteSize are used
uniform int uPaletteSize;
uniform float uLumaWeight;  // 0 = match colors in RGB, 1 = match mostly by brightness

// Part D1: Returns the palette color closest to c.
vec3 nearestPaletteColor(vec3 c) {
	// TODO (Part D1): Loop over the first uPaletteSize entries of uPalette and return the closest
	// one. Plain RGB distance works, but matching in a perceptual space (or giving the brightness
	// difference extra weight with uLumaWeight) gives much better results for shaded objects.
	// GLSL needs a constant loop bound, so loop to 8 and break at uPaletteSize.
	return c;
}

void main() {
	vec3 c = texture(tInput, vUv).rgb;
	outColor = vec4(nearestPaletteColor(c), 1.0);
}
