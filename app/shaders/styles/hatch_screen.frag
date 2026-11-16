// Screen-space hatching (Track C). Surface shader: parallel ink lines in screen space whose
// density follows the lighting. This is the "shower-door" baseline that object-space hatching is
// compared against, so the pattern intentionally stays fixed on the screen.

#include "common/surface_common.glsl"

uniform float uLineSpacing;  // distance between hatch lines, in pixels
uniform float uLineWidth;    // width of one hatch line, in pixels
uniform float uAngle;        // direction of the first hatching layer, in degrees
uniform bool uCrossHatch;    // add more layers at other angles in darker areas
uniform vec3 uInkColor;
uniform vec3 uPaperColor;

// Part C1: One layer of parallel lines. Returns ink coverage in [0, 1] for pixel p.
float hatchLayer(vec2 p, float angleDeg, float spacing, float width) {
	// TODO (Part C1): Rotate p by angleDeg, take the distance to the nearest line (lines are
	// `spacing` pixels apart), and return 1 inside a line of the given width, 0 outside.
	// Antialias the edge with fwidth or a 1-pixel smoothstep.
	return 0.0;
}

// Part C1: Combines hatching layers based on the tone. Returns ink coverage in [0, 1].
//   tone: 0 = darkest, 1 = brightest
float hatching(vec2 fragCoord, float tone) {
	// TODO (Part C1): Turn on more layers as the tone gets darker, for example the first layer
	// below tone 0.8, a second layer at another angle below 0.55 when uCrossHatch is on, and so
	// on. You can also vary the line width within a layer so the transition is smooth.
	return 1.0 - tone;
}

void main() {
	Surface s = getSurface();
	float tone = diffuseTone(s);
	float ink = hatching(gl_FragCoord.xy, tone);
	outColor = vec4(mix(uPaperColor, uInkColor, ink), 1.0);
}
