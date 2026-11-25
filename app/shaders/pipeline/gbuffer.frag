// G-buffer pass, fragment shader. Writes four render targets at once (multiple render targets).
// Every image-space pass reads these through common/post_common.glsl.
//
//   target 0  tNormal   xyz = view-space normal, w = linear depth (distance along the view axis)
//   target 1  tAlbedo   rgb = albedo, a = object id / 255
//   target 2  tLight    x = N.L (signed), y = N.H, z = N.V, w = 1
//   target 3  tMotion   xy = screen-space motion in uv units (current - previous), zw = mesh uv
//
// The targets are cleared to 0 every frame, so background pixels have depth 0 and object id 0.

uniform vec3 uLightDirView;
uniform vec3 uAlbedo;
uniform float uObjectId;

in vec3 vViewPos;
in vec3 vViewNormal;
in vec2 vUv;
in vec4 vCurClip;
in vec4 vPrevClip;

layout(location = 0) out vec4 gNormal;
layout(location = 1) out vec4 gAlbedo;
layout(location = 2) out vec4 gLight;
layout(location = 3) out vec4 gMotion;

void main() {
	vec3 N = normalize(vViewNormal);
	vec3 V = normalize(-vViewPos);
	vec3 L = normalize(uLightDirView);
	vec3 H = normalize(L + V);

	gNormal = vec4(N, -vViewPos.z);
	gAlbedo = vec4(uAlbedo, uObjectId / 255.0);
	gLight = vec4(dot(N, L), max(dot(N, H), 0.0), max(dot(N, V), 0.0), 1.0);

	// A1: NDC spans [-1, 1], so half its displacement is displacement in texture UVs.
	// A point on/behind the previous camera plane has no usable previous projection.
	vec2 motion = vec2(0.0);
	if (vCurClip.w > 0.000001 && vPrevClip.w > 0.000001) {
		vec2 currentNdc = vCurClip.xy / vCurClip.w;
		vec2 previousNdc = vPrevClip.xy / vPrevClip.w;
		vec2 displacement = 0.5 * (currentNdc - previousNdc);
		// The G-buffer is half float: reject unusable history instead of storing Inf/NaN.
		if (all(lessThanEqual(abs(displacement), vec2(65504.0)))) motion = displacement;
	}

	gMotion = vec4(motion, vUv);
}
