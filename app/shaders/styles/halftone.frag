// Screen-space halftone dots (Track B). Surface shader: dots on a regular screen grid whose size
// follows the lighting, like a printed comic.

#include "common/surface_common.glsl"

uniform float uDotSpacing;  // distance between dot centers, in pixels
uniform float uAngle;       // rotation of the dot grid, in degrees
uniform vec3 uInkColor;
uniform vec3 uPaperColor;
uniform bool uUseAlbedo;    // use the object's albedo as the paper color

// Part B5: Returns how much ink covers this pixel, in [0, 1].
//   fragCoord: pixel position (gl_FragCoord.xy)
//   tone:      how bright the surface is, 0 = darkest, 1 = brightest
float halftone(vec2 fragCoord, float tone) {
	// TODO (Part B5): Rotate fragCoord by uAngle, find the center of the nearest grid cell
	// (cells are uDotSpacing pixels wide), and cover the pixel with ink if it is inside a dot
	// around that center. Choose the dot radius from the tone so that the fraction of the cell
	// covered by ink is about (1 - tone). Antialias the dot edge with fwidth.
	return 1.0 - tone;
}

void main() {
	Surface s = getSurface();
	float tone = diffuseTone(s);
	float ink = halftone(gl_FragCoord.xy, tone);
	vec3 paper = uUseAlbedo ? s.albedo : uPaperColor;
	outColor = vec4(mix(paper, uInkColor, ink), 1.0);
}
