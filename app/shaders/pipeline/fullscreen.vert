// Vertex shader for every full-screen pass. The geometry is one triangle that covers the screen
// (see src/core/FullscreenPass.js), so this only passes the uv through.

out vec2 vUv;

void main() {
	vUv = uv;
	gl_Position = vec4(position.xy, 0.0, 1.0);
}
