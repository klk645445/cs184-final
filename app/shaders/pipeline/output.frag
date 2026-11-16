// Output pass. Draws either the final image or one of the debug views onto the screen, and
// converts color views from linear RGB to sRGB.

#include "common/post_common.glsl"

uniform sampler2D tComposite;  // final image (style + lines)
uniform sampler2D tLineMask;
uniform sampler2D tTAM0;       // tonal art map, tones 0 to 2 in r, g, b
uniform sampler2D tTAM1;       // tonal art map, tones 3 to 5 in r, g, b
uniform int uView;
uniform float uDepthMin;
uniform float uDepthMax;
uniform float uMotionScale;

// Keep these in sync with VIEWS in src/core/Pipeline.js
const int VIEW_FINAL = 0;
const int VIEW_SURFACE = 1;
const int VIEW_NORMAL = 2;
const int VIEW_DEPTH = 3;
const int VIEW_ALBEDO = 4;
const int VIEW_NDOTL = 5;
const int VIEW_MOTION = 6;
const int VIEW_UV = 7;
const int VIEW_OBJECT_ID = 8;
const int VIEW_LINE_MASK = 9;
const int VIEW_TAM = 10;

vec3 idColor(float id) {
	if (id < 0.5) return vec3(0.0);
	return 0.25 + 0.75 * vec3(hash12(vec2(id, 1.0)), hash12(vec2(id, 2.0)), hash12(vec2(id, 3.0)));
}

// Shows the 6 tones of the tonal art map side by side, lightest on the left. The top half is
// sampled at full resolution and the bottom half at a smaller scale, so the mipmaps are used.
vec3 tamPreview(vec2 uv) {
	float tone = floor(uv.x * 6.0);
	float scale = uv.y > 0.5 ? 1.0 : 4.0;
	vec2 tuv = vec2(fract(uv.x * 6.0), fract(uv.y * 2.0)) * scale * vec2(1.0, uResolution.y / uResolution.x * 3.0);
	vec3 a = texture(tTAM0, tuv).rgb;
	vec3 b = texture(tTAM1, tuv).rgb;
	float v = tone < 1.0 ? a.r : tone < 2.0 ? a.g : tone < 3.0 ? a.b : tone < 4.0 ? b.r : tone < 5.0 ? b.g : b.b;
	return vec3(v);
}

void main() {
	vec3 c;
	bool isColor = false;
	bool bg = isBackground(vUv);

	if (uView == VIEW_FINAL) {
		c = texture(tComposite, vUv).rgb;
		isColor = true;
	} else if (uView == VIEW_SURFACE) {
		c = texture(tSurface, vUv).rgb;
		isColor = true;
	} else if (uView == VIEW_NORMAL) {
		c = bg ? vec3(0.0) : getNormal(vUv) * 0.5 + 0.5;
	} else if (uView == VIEW_DEPTH) {
		float d = getDepth(vUv);
		c = bg ? vec3(0.0) : vec3(1.0 - clamp((d - uDepthMin) / (uDepthMax - uDepthMin), 0.0, 1.0));
	} else if (uView == VIEW_ALBEDO) {
		c = getAlbedo(vUv);
		isColor = true;
	} else if (uView == VIEW_NDOTL) {
		// blue where the surface faces away from the light, yellow where it faces the light
		float ndl = getNdotL(vUv);
		c = bg ? vec3(0.0) : mix(vec3(0.15, 0.2, 0.6), vec3(1.0, 0.9, 0.6), ndl * 0.5 + 0.5);
	} else if (uView == VIEW_MOTION) {
		c = vec3(abs(getMotion(vUv)) * uMotionScale, 0.0);
	} else if (uView == VIEW_UV) {
		c = bg ? vec3(0.0) : vec3(fract(texture(tMotion, vUv).zw), 0.0);
	} else if (uView == VIEW_OBJECT_ID) {
		c = idColor(getObjectId(vUv));
	} else if (uView == VIEW_LINE_MASK) {
		c = vec3(1.0 - clamp(texture(tLineMask, vUv).r, 0.0, 1.0));
	} else {
		c = tamPreview(vUv);
	}

	outColor = vec4(isColor ? linearToSRGB(c) : clamp(c, 0.0, 1.0), 1.0);
}
