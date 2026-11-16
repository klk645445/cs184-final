// Depth-only pass, used before drawing the inverted hull so that the hull is hidden behind the
// front of the mesh. The material has colorWrite off, so only depth is written.

layout(location = 0) out vec4 outColor;

void main() {
	outColor = vec4(0.0);
}
