// Inverted-hull outline (Track A), vertex shader. The pipeline draws every mesh twice into the
// hull mask: first its front faces into the depth buffer only, then its back faces with this
// shader, pushed outwards. Only the parts of the back faces that stick out past the silhouette
// pass the depth test, and those form the outline.

uniform float uLineWidth;   // outline width in pixels
uniform vec2 uResolution;   // render target size in pixels

void main() {
	vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

	// TODO (Part A4): Push the vertex outwards along its normal so that the back faces stick out
	// past the silhouette by about uLineWidth pixels. Extruding in object space gives lines that
	// get thinner with distance; for a constant width on screen, transform the normal into clip
	// space, take its screen-space direction, and offset clip.xy by a number of pixels converted to
	// clip units (pixels * 2 / uResolution, times clip.w to undo the perspective divide).
	gl_Position = clip;
}
