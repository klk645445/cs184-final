// Toon shading (Track B). Surface shader: runs per mesh, writes the toon-shaded color.
// Until the TODOs are filled in, this looks exactly like the Base style.

#include "common/surface_common.glsl"

uniform float uBands;         // number of flat diffuse bands
uniform bool uUseRamp;        // color the bands with tRamp instead of albedo * light
uniform sampler2D tRamp;      // 256 x 1 color ramp, dark (u = 0) to bright (u = 1)
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uRimWidth;      // how far the rim reaches in from the silhouette, in [0, 1]
uniform float uSpecStrength;
uniform float uShininess;
uniform float uSpecSize;      // threshold on the specular term, smaller = bigger highlight

// Part B1: Returns the diffuse light amount max(N.L, 0), quantized into uBands flat bands.
float toonDiffuse(Surface s) {
	// TODO (Part B1): Quantize the diffuse term into uBands levels, so that the shading changes in
	// hard steps instead of smoothly.
	return max(s.NdotL, 0.0);
}

// Part B2: Turns the quantized diffuse amount d into a color.
vec3 toonColor(Surface s, float d) {
	// TODO (Part B2): When uUseRamp is on, look the color up in tRamp using d (and the ambient term)
	// instead of multiplying the albedo by the light. Think about where to sample inside each band
	// so that every band gets one flat color from the ramp.
	return s.albedo * (uAmbient + uLightIntensity * d);
}

// Part B3: Rim light, a bright band along the silhouette where the surface turns away from the
// camera. Returns its strength in [0, 1].
float rimTerm(Surface s) {
	// TODO (Part B3): Use N.V, which goes to 0 at the silhouette. Make the rim a hard-edged band of
	// width uRimWidth, and optionally only on the lit side.
	return 0.0;
}

// Part B4: Stylized specular highlight, a flat, hard-edged blob instead of a smooth falloff.
// Returns its strength in [0, 1].
float toonSpecular(Surface s) {
	// TODO (Part B4): Start from the Blinn-Phong term pow(N.H, uShininess) and threshold it with
	// uSpecSize. Use a small smoothstep instead of step if the edge aliases.
	return 0.0;
}

void main() {
	Surface s = getSurface();
	float d = toonDiffuse(s);
	vec3 color = toonColor(s, d);
	color += uRimStrength * rimTerm(s) * uRimColor;
	color += uSpecStrength * toonSpecular(s) * vec3(uLightIntensity);
	outColor = vec4(color, 1.0);
}
