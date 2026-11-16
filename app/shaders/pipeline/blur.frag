// Separable Gaussian blur of tInput along uDirection, a reusable post-processing pass.
// Use it twice in a style's chain, once with uDirection = (1, 0) and once with (0, 1).

#include "common/post_common.glsl"

uniform vec2 uDirection;   // (1, 0) for horizontal, (0, 1) for vertical
uniform float uBlurRadius; // in pixels, about 3 standard deviations

void main() {
	float sigma = max(uBlurRadius / 3.0, 0.001);
	int r = int(ceil(uBlurRadius));
	vec3 sum = vec3(0.0);
	float wsum = 0.0;
	for (int i = -32; i <= 32; i++) {
		if (i < -r || i > r) continue;
		float w = exp(-0.5 * float(i * i) / (sigma * sigma));
		sum += w * texture(tInput, vUv + uDirection * uTexel * float(i)).rgb;
		wsum += w;
	}
	outColor = vec4(sum / wsum, 1.0);
}
