// Composite pass. Draws the line mask from the Lines module over the styled image in ink color.
// tInput is the output of the current style (surface pass plus its post-processing chain).

#include "common/post_common.glsl"

uniform sampler2D tLineMask;  // r = line coverage in [0, 1]
uniform bool uLinesEnabled;
uniform vec3 uInkColor;
uniform float uLineOpacity;

void main() {
	vec3 color = texture(tInput, vUv).rgb;
	float line = uLinesEnabled ? clamp(texture(tLineMask, vUv).r, 0.0, 1.0) : 0.0;
	outColor = vec4(mix(color, uInkColor, line * uLineOpacity), 1.0);
}
