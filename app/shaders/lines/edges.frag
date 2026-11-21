// Image-space line detection (Track A), after Saito and Takahashi, "Comprehensible Rendering of
// 3-D Shapes", SIGGRAPH 1990. Full-screen pass over the G-buffer that writes the line mask:
// r = how much this pixel is covered by a line, in [0, 1]. The composite pass then draws the mask
// in ink color over any style.

#include "common/post_common.glsl"

uniform sampler2D tHull;          // r = inverted-hull outline mask from lines/hull.vert
uniform float uLineWidth;         // line width in pixels
uniform float uDepthThreshold;    // relative depth jump that counts as an edge
uniform float uNormalThreshold;   // normal change (1 - cos of the angle) that counts as an edge
uniform bool uUseDepth;
uniform bool uUseNormal;
uniform bool uUseHull;

// Part A2: Silhouette lines from discontinuities in depth. Returns line coverage in [0, 1].
float depthEdge(vec2 uv) {
	// A2: Two diagonal differences form a Roberts-cross depth gradient.
	// Keep a one-pixel footprint below 1px; nearest-filtered samples otherwise coincide.
	vec2 offset = 0.5 * max(uLineWidth, 1.0) * uTexel;
	vec4 depths = vec4(
		getDepth(uv + vec2(-offset.x, -offset.y)),
		getDepth(uv + vec2( offset.x, -offset.y)),
		getDepth(uv + vec2(-offset.x,  offset.y)),
		getDepth(uv + vec2( offset.x,  offset.y))
	);
	float center = getDepth(uv);
	float nearest = min(center, min(min(depths.x, depths.y), min(depths.z, depths.w)));
	float farthest = max(center, max(max(depths.x, depths.y), max(depths.z, depths.w)));
	float coverage = min(uLineWidth, 1.0);
	if (farthest <= 0.0) return 0.0;
	// Background is farther than any geometry, without choosing an arbitrary far depth.
	if (nearest <= 0.0) return coverage;
	vec2 gradient = vec2(depths.x - depths.w, depths.y - depths.z);
	float relativeChange = length(gradient) / center;
	return coverage * step(uDepthThreshold, relativeChange);
}

// Part A3: Crease lines from discontinuities in the normal. Returns line coverage in [0, 1].
float normalEdge(vec2 uv) {
	// TODO (Part A3): Same structure as depthEdge, but measure how much the normal changes between
	// neighbours (1 - dot(n1, n2)) and compare against uNormalThreshold. Optionally also draw a
	// line where the object id changes, which separates touching objects.
	return 0.0;
}

void main() {
	float line = 0.0;
	if (uUseDepth) line = max(line, depthEdge(vUv));
	if (uUseNormal) line = max(line, normalEdge(vUv));
	if (uUseHull) line = max(line, texture(tHull, vUv).r);
	outColor = vec4(line, 0.0, 0.0, 1.0);
}
