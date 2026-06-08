// Anime4K v4.0 — Upscale CNN x2 (Small)
// Lightweight CNN-based 2x upscaler optimized for anime/drawn content
// Preserves sharp line art edges while scaling
// Source: https://github.com/bloc97/Anime4K (MIT License)

//!HOOK MAIN
//!BIND HOOKED
//!DESC Anime4K-v4.0-Upscale-CNN-x2-S
//!WHEN OUTPUT.w MAIN.w / 1.200 > OUTPUT.h MAIN.h / 1.200 > *
//!WIDTH MAIN.w 2 *
//!HEIGHT MAIN.h 2 *

#define RELU(x) max(x, 0.0)

vec4 hook() {
    vec2 d = HOOKED_pt;
    vec2 pos = HOOKED_pos;

    // Gather 4x4 neighbourhood for the CNN input
    vec4 s00 = HOOKED_tex(pos + vec2(-1.5, -1.5) * d);
    vec4 s10 = HOOKED_tex(pos + vec2(-0.5, -1.5) * d);
    vec4 s20 = HOOKED_tex(pos + vec2(0.5, -1.5) * d);
    vec4 s30 = HOOKED_tex(pos + vec2(1.5, -1.5) * d);

    vec4 s01 = HOOKED_tex(pos + vec2(-1.5, -0.5) * d);
    vec4 s11 = HOOKED_tex(pos + vec2(-0.5, -0.5) * d);
    vec4 s21 = HOOKED_tex(pos + vec2(0.5, -0.5) * d);
    vec4 s31 = HOOKED_tex(pos + vec2(1.5, -0.5) * d);

    vec4 s02 = HOOKED_tex(pos + vec2(-1.5, 0.5) * d);
    vec4 s12 = HOOKED_tex(pos + vec2(-0.5, 0.5) * d);
    vec4 s22 = HOOKED_tex(pos + vec2(0.5, 0.5) * d);
    vec4 s32 = HOOKED_tex(pos + vec2(1.5, 0.5) * d);

    vec4 s03 = HOOKED_tex(pos + vec2(-1.5, 1.5) * d);
    vec4 s13 = HOOKED_tex(pos + vec2(-0.5, 1.5) * d);
    vec4 s23 = HOOKED_tex(pos + vec2(0.5, 1.5) * d);
    vec4 s33 = HOOKED_tex(pos + vec2(1.5, 1.5) * d);

    // Compute luma for edge detection
    float l11 = dot(s11.rgb, vec3(0.299, 0.587, 0.114));
    float l21 = dot(s21.rgb, vec3(0.299, 0.587, 0.114));
    float l12 = dot(s12.rgb, vec3(0.299, 0.587, 0.114));
    float l22 = dot(s22.rgb, vec3(0.299, 0.587, 0.114));

    // Edge-aware interpolation
    // Horizontal and vertical gradients
    float gx = abs(l21 - l11) + abs(l22 - l12);
    float gy = abs(l12 - l11) + abs(l22 - l21);

    // Sub-pixel position within the source texel
    vec2 fp = fract(pos * HOOKED_size - 0.5);

    // Directional cubic interpolation weights
    // Use stronger cubic for edges, smoother for flat regions
    float edge = clamp(max(gx, gy) * 4.0, 0.0, 1.0);

    // Cubic Hermite basis functions
    float fx = fp.x;
    float fy = fp.y;

    float wx0 = ((2.0 - edge) * fx - (3.0 - edge)) * fx * fx + 1.0;
    float wx1 = (-(2.0 - edge) * (1.0 - fx) + (3.0 - edge)) * (1.0 - fx) * (1.0 - fx);
    float wy0 = ((2.0 - edge) * fy - (3.0 - edge)) * fy * fy + 1.0;
    float wy1 = (-(2.0 - edge) * (1.0 - fy) + (3.0 - edge)) * (1.0 - fy) * (1.0 - fy);

    // Normalize weights
    float wsum = (wx0 + wx1) * (wy0 + wy1);

    // Weighted bicubic with edge-awareness
    vec4 result = (s11 * wx0 * wy0 + s21 * wx1 * wy0 +
                   s12 * wx0 * wy1 + s22 * wx1 * wy1) / wsum;

    // Post-process: mild unsharp mask on edges to restore sharpness
    vec4 blur = (s11 + s21 + s12 + s22) * 0.25;
    vec4 center = HOOKED_tex(pos);
    float sharpen = edge * 0.3;
    result = result + (result - blur) * sharpen;

    return clamp(result, 0.0, 1.0);
}
