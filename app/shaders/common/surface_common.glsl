// Shared declarations for surface shaders. A surface shader runs once per mesh in the surface
// pass, like a normal material, and writes the stylized color of each visible fragment.
// Include this at the top of every style's surface shader:
//
//     #include "common/surface_common.glsl"

#include "common/color.glsl"
#include "common/noise.glsl"

// Varyings from pipeline/surface.vert
in vec3 vViewPos;       // position in view (camera) space
in vec3 vViewNormal;    // normal in view space (re-normalize before use)
in vec3 vWorldPos;      // position in world space
in vec3 vObjectPos;     // position in object space. Every model is normalized to fit in the unit sphere,
                        // so this is roughly in [-1, 1]^3 and does not change when the model moves.
in vec3 vObjectNormal;  // normal in object space (re-normalize before use)
in vec2 vUv;            // mesh texture coordinates, (0, 0) if the mesh has none

// Scene uniforms, shared by every material (see src/core/SharedUniforms.js)
uniform vec3 uLightDirView;    // unit vector from the surface towards the light, in view space
uniform float uLightIntensity; // strength of the directional light
uniform float uAmbient;        // constant ambient term
uniform vec2 uResolution;      // size of the render target in pixels
uniform float uTime;           // seconds since the app started
uniform vec3 uBackground;      // background / paper color (linear RGB)

// Per-object uniforms (see src/core/Materials.js)
uniform vec3 uAlbedo;          // base color of this object (linear RGB)
uniform float uObjectId;       // 1, 2, 3, ... for each mesh in the scene

layout(location = 0) out vec4 outColor;

struct Surface {
	vec3 N;        // unit normal, view space
	vec3 V;        // unit vector towards the camera, view space
	vec3 L;        // unit vector towards the light, view space
	vec3 H;        // half vector between L and V
	float NdotL;   // signed, in [-1, 1]
	float NdotH;   // clamped to [0, 1]
	float NdotV;   // clamped to [0, 1]
	vec3 albedo;
};

Surface getSurface() {
	Surface s;
	s.N = normalize(vViewNormal);
	s.V = normalize(-vViewPos);
	s.L = normalize(uLightDirView);
	s.H = normalize(s.L + s.V);
	s.NdotL = dot(s.N, s.L);
	s.NdotH = max(dot(s.N, s.H), 0.0);
	s.NdotV = max(dot(s.N, s.V), 0.0);
	s.albedo = uAlbedo;
	return s;
}

// Plain Lambertian shading, the "photo" look every style starts from.
vec3 lambert(Surface s) {
	return s.albedo * (uAmbient + uLightIntensity * max(s.NdotL, 0.0));
}

// How bright the surface is lit, in [0, 1] (0 = darkest, 1 = fully lit). Tone-based styles
// (halftone, hatching) use this to decide how much ink to put down.
float diffuseTone(Surface s) {
	return clamp(uAmbient + uLightIntensity * max(s.NdotL, 0.0), 0.0, 1.0);
}
