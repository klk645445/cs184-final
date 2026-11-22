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
	float a = radians(angleDeg);
	// Signed distance across the lines (perpendicular to the line direction)
	float d = dot(p, vec2(-sin(a), cos(a)));
	// Distance in pixels from the center of the nearest line
	float dist = abs(fract(d / spacing) - 0.5) * spacing;
	// 1 inside the line, 0 outside, with a 1-pixel antialiased edge
	float halfWidth = 0.5 * width;
	return 1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, dist);
}

// Part C1: Combines hatching layers based on the tone. Returns ink coverage in [0, 1].
//   tone: 0 = darkest, 1 = brightest
float hatching(vec2 fragCoord, float tone) {
	if (!uCrossHatch) {
		// One layer whose lines get thicker as the tone gets darker
		float t = smoothstep(0.9, 0.0, tone);
		float width = mix(uLineWidth * 0.5, uLineSpacing * 0.85, t);
		return hatchLayer(fragCoord, uAngle, uLineSpacing, width) * smoothstep(0.9, 0.8, tone);
	}

	// Each layer fades in below its threshold tone and thickens a little as the tone darkens
	const int LAYERS = 4;
	float thresholds[LAYERS] = float[](0.8, 0.55, 0.35, 0.18);
	float angles[LAYERS] = float[](0.0, 90.0, 45.0, -45.0);

	float ink = 0.0;
	for (int i = 0; i < LAYERS; i++) {
		float t0 = thresholds[i];
		float fade = smoothstep(t0, t0 - 0.1, tone);
		if (fade <= 0.0) continue;
		float width = uLineWidth * mix(0.75, 1.25, smoothstep(t0, 0.0, tone));
		// Offset each layer by a fraction of the spacing so the lines do not all cross at one point
		vec2 offset = vec2(float(i) * 0.37 * uLineSpacing);
		float layer = hatchLayer(fragCoord + offset, uAngle + angles[i], uLineSpacing, width) * fade;
		ink = max(ink, layer);
	}
	return ink;
}

void main() {
	Surface s = getSurface();
	float tone = diffuseTone(s);
	float ink = hatching(gl_FragCoord.xy, tone);
	outColor = vec4(mix(uPaperColor, uInkColor, ink), 1.0);
}
