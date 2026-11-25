// Inverted-hull outline (Track A), vertex shader. The pipeline draws every mesh twice into the
// hull mask: first its front faces into the depth buffer only, then its back faces with this
// shader, pushed outwards. Only the parts of the back faces that stick out past the silhouette
// pass the depth test, and those form the outline.

uniform float uLineWidth;   // outline width in pixels
uniform vec2 uResolution;   // render target size in pixels

void main() {
	vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

	if (uLineWidth > 0.0 && clip.w > 0.0 && all(greaterThan(uResolution, vec2(0.0)))) {
		// normalMatrix is the inverse-transpose model-view transform, so nonuniform
		// scaling does not tilt the surface normal incorrectly.
		vec4 projectedNormal = projectionMatrix * vec4(normalMatrix * normal, 0.0);
		// Differentiate clip.xy / clip.w along that normal. Keeping the w term
		// matters off-axis, where even a view-z normal has a screen-space direction.
		vec2 pixelDirection = (projectedNormal.xy * clip.w - clip.xy * projectedNormal.w) * uResolution;
		float directionLength = length(pixelDirection);
		if (directionLength > 0.0) {
			// Normalize in pixels (not NDC) so nonsquare targets retain the same width.
			vec2 pixelOffset = pixelDirection / directionLength * uLineWidth;
			clip.xy += pixelOffset * (2.0 / uResolution) * clip.w;
		}
	}
	gl_Position = clip;
}
