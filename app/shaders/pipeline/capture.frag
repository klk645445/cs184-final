// Capture pass, used by the measurement harness to read frames back to JavaScript. Renders into
// a 32-bit float target so the values arrive unchanged.
//
//   uMode 0  rgb = final image (linear RGB, before sRGB conversion), a = 1
//   uMode 1  r = line mask, gb = motion (uv units), a = linear depth (0 = background)

#include "common/post_common.glsl"

uniform sampler2D tComposite;
uniform sampler2D tLineMask;
uniform int uMode;

void main() {
	if (uMode == 0) {
		outColor = vec4(texture(tComposite, vUv).rgb, 1.0);
	} else {
		outColor = vec4(texture(tLineMask, vUv).r, getMotion(vUv), getDepth(vUv));
	}
}
