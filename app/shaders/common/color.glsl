// Small color helpers shared by every shader. All colors inside the pipeline are linear RGB;
// only the output pass converts to sRGB for the screen.
//
// (three.js already defines luminance() in every ShaderMaterial, so ours is called luma().)

float luma(vec3 c) {
	return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec3 linearToSRGB(vec3 c) {
	c = clamp(c, 0.0, 1.0);
	return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 srgbToLinear(vec3 c) {
	return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
