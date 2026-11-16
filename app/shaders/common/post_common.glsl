// Shared declarations for full-screen (image-space) passes: post-processing styles, edge
// detection, compositing and output. Include this at the top of every post-processing shader:
//
//     #include "common/post_common.glsl"
//
// All textures are sampled with uv in [0, 1]^2, with (0, 0) at the bottom-left of the image.

#include "common/color.glsl"
#include "common/noise.glsl"

in vec2 vUv;
layout(location = 0) out vec4 outColor;

// Chain inputs
uniform sampler2D tInput;    // output of the previous pass in this style's chain
                             // (for the first pass, this is the surface pass)
uniform sampler2D tSurface;  // the surface pass, before any post-processing

// G-buffer (see pipeline/gbuffer.frag for the exact layout)
uniform sampler2D tNormal;   // xyz = view-space normal, w = linear depth (0 = background)
uniform sampler2D tAlbedo;   // rgb = albedo, a = object id / 255 (0 = background)
uniform sampler2D tLight;    // x = N.L (signed), y = N.H, z = N.V, w = 1
uniform sampler2D tMotion;   // xy = screen-space motion in uv units (current - previous), zw = mesh uv

uniform vec2 uResolution;    // render target size in pixels
uniform vec2 uTexel;         // 1.0 / uResolution, the size of one pixel in uv units
uniform float uTime;
uniform vec3 uBackground;

vec3 getNormal(vec2 uv) {
	return texture(tNormal, uv).xyz;
}

// Linear depth, the distance along the view direction. 0 for background pixels.
float getDepth(vec2 uv) {
	return texture(tNormal, uv).w;
}

bool isBackground(vec2 uv) {
	return texture(tNormal, uv).w <= 0.0;
}

vec3 getAlbedo(vec2 uv) {
	return texture(tAlbedo, uv).rgb;
}

// 1, 2, 3, ... for each mesh, 0 for background.
float getObjectId(vec2 uv) {
	return floor(texture(tAlbedo, uv).a * 255.0 + 0.5);
}

float getNdotL(vec2 uv) {
	return texture(tLight, uv).x;
}

// Motion of this pixel since the previous frame, in uv units. The same surface point was at
// uv - getMotion(uv) in the previous frame.
vec2 getMotion(vec2 uv) {
	return texture(tMotion, uv).xy;
}
