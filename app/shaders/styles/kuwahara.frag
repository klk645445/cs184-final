// Kuwahara filter (Track D). Post-processing pass: an edge-preserving smoothing filter that makes
// the image look painted with flat brush strokes.

#include "common/post_common.glsl"

uniform float uRadius;  // size of each of the four regions, in pixels

// Part D2: The classic Kuwahara filter. For the 4 square regions that share the pixel at uv as a
// corner (top-left, top-right, bottom-left, bottom-right), compute the mean color and its
// variance, and return the mean of the region with the smallest variance.
vec3 kuwahara(vec2 uv) {
	const int MAX_R = 12;
	int r = int(uRadius);

	// The four regions, as the sign of the offset from the center pixel.
	const vec2 quadrant[4] = vec2[4](
		vec2(-1.0, -1.0), vec2(1.0, -1.0),
		vec2(-1.0,  1.0), vec2(1.0,  1.0)
	);

	vec3 best = texture(tInput, uv).rgb;
	float bestVariance = 1e20;

	for (int q = 0; q < 4; q++) {
		vec3 sum = vec3(0.0);
		vec3 sumSq = vec3(0.0);
		float n = 0.0;

		for (int y = 0; y <= MAX_R; y++) {
			if (y > r) break;
			for (int x = 0; x <= MAX_R; x++) {
				if (x > r) break;
				vec2 offset = vec2(float(x), float(y)) * quadrant[q] * uTexel;
				vec3 c = texture(tInput, uv + offset).rgb;
				sum += c;
				sumSq += c * c;
				n += 1.0;
			}
		}

		vec3 m = sum / n;
		vec3 variance = max(sumSq / n - m * m, vec3(0.0));
		float score = variance.r + variance.g + variance.b;

		if (score < bestVariance) {
			bestVariance = score;
			best = m;
		}
	}
	return best;
}

void main() {
	outColor = vec4(kuwahara(vUv), 1.0);
}
