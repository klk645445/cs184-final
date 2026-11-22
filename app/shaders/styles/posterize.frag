// Posterization to a fixed palette (Track D). Post-processing pass: replaces every color of the
// Base style image with the closest color of a small palette, like a screen print or poster.

#include "common/post_common.glsl"

uniform vec3 uPalette[8];   // palette colors (linear RGB); only the first uPaletteSize are used
uniform int uPaletteSize;
uniform float uLumaWeight;  // 0 = match colors in RGB, 1 = match mostly by brightness

// Part D1: Returns the palette color closest to c.
vec3 nearestPaletteColor(vec3 c) {
	float cLuma = luma(c);
	vec3 best = c;
	float bestDist = 1e20;

	// GLSL needs a constant loop bound, so loop to 8 and break at uPaletteSize.
	for (int i = 0; i < 8; i++) {
		if (i >= uPaletteSize) break;
		vec3 p = uPalette[i];

		// Two distances, both normalised to "per channel" so the mix is a fair blend.
		vec3 diff = c - p;
		float distRGB = dot(diff, diff) / 3.0;
		float dLuma = luma(p) - cLuma;
		float distLuma = dLuma * dLuma;

		float dist = mix(distRGB, distLuma, uLumaWeight);
		if (dist < bestDist) {
			bestDist = dist;
			best = p;
		}
	}
	return best;
}

void main() {
	vec3 c = texture(tInput, vUv).rgb;
	outColor = vec4(nearestPaletteColor(c), 1.0);
}
