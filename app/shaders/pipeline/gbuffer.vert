// G-buffer pass, vertex shader. Runs once per mesh at the start of every frame.

uniform mat4 uPrevModelMatrix;     // this mesh's modelMatrix in the previous frame
uniform mat4 uPrevViewProjection;  // projectionMatrix * viewMatrix in the previous frame

out vec3 vViewPos;
out vec3 vViewNormal;
out vec2 vUv;
out vec4 vCurClip;   // clip-space position in this frame
out vec4 vPrevClip;  // clip-space position of the same vertex in the previous frame

void main() {
	vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
	vViewPos = viewPos.xyz;
	vViewNormal = normalize(normalMatrix * normal);
	vUv = uv;

	gl_Position = projectionMatrix * viewPos;
	vCurClip = gl_Position;

	// A1: Follow the same surface point through the previous model and camera transforms.
	vPrevClip = uPrevViewProjection * uPrevModelMatrix * vec4(position, 1.0);
}
