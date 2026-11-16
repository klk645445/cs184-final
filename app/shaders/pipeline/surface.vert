// Vertex shader for the surface pass (every style's surface shader) and the depth pre-pass.
// The varyings are declared in common/surface_common.glsl on the fragment side.

out vec3 vViewPos;
out vec3 vViewNormal;
out vec3 vWorldPos;
out vec3 vObjectPos;
out vec3 vObjectNormal;
out vec2 vUv;

void main() {
	vec4 worldPos = modelMatrix * vec4(position, 1.0);
	vec4 viewPos = viewMatrix * worldPos;

	vWorldPos = worldPos.xyz;
	vViewPos = viewPos.xyz;
	vViewNormal = normalize(normalMatrix * normal);
	vObjectPos = position;
	vObjectNormal = normal;
	vUv = uv;

	gl_Position = projectionMatrix * viewPos;
}
