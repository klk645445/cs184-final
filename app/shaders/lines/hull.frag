// Inverted-hull outline, fragment shader. Every visible hull fragment is fully covered by the line.

layout(location = 0) out vec4 outColor;

void main() {
	outColor = vec4(1.0, 0.0, 0.0, 1.0);
}
