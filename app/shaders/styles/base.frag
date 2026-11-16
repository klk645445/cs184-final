// Base style: plain Lambertian shading with the object's albedo. This is the unstylized
// reference, and the input that the painterly post-processing styles start from.

#include "common/surface_common.glsl"

void main() {
	Surface s = getSurface();
	outColor = vec4(lambert(s), 1.0);
}
