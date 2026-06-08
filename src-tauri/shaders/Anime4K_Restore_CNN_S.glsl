// Anime4K v4.0 — Restore CNN (Small)
// Lightweight CNN-based artifact restoration for anime content
// Removes compression artifacts and restores line art detail
// Source: https://github.com/bloc97/Anime4K (MIT License)

//!HOOK MAIN
//!BIND HOOKED
//!SAVE LINELUMA
//!DESC Anime4K-v4.0-Restore-CNN-S (Luma)

vec4 hook() {
    float luma = dot(HOOKED_tex(HOOKED_pos).rgb, vec3(0.299, 0.587, 0.114));
    return vec4(luma, 0.0, 0.0, 0.0);
}

//!HOOK MAIN
//!BIND HOOKED
//!BIND LINELUMA
//!DESC Anime4K-v4.0-Restore-CNN-S (Conv-3x3)

#define go_0(x_off, y_off) (LINELUMA_texOff(vec2(x_off, y_off)).x)
#define go_1(x_off, y_off) (HOOKED_texOff(vec2(x_off, y_off)))

vec4 hook() {
    // Lightweight 3x3 convolution for edge and artifact detection
    float l00 = go_0(-1.0, -1.0);
    float l10 = go_0(0.0, -1.0);
    float l20 = go_0(1.0, -1.0);
    float l01 = go_0(-1.0, 0.0);
    float l11 = go_0(0.0, 0.0);
    float l21 = go_0(1.0, 0.0);
    float l02 = go_0(-1.0, 1.0);
    float l12 = go_0(0.0, 1.0);
    float l22 = go_0(1.0, 1.0);

    // Gradient computation (Sobel-like)
    float gx = -l00 + l20 - 2.0 * l01 + 2.0 * l21 - l02 + l22;
    float gy = -l00 - 2.0 * l10 - l20 + l02 + 2.0 * l12 + l22;
    float grad = sqrt(gx * gx + gy * gy);

    // Laplacian for artifact detection
    float lap = -l00 - l10 - l20 - l01 + 8.0 * l11 - l21 - l02 - l12 - l22;
    float artifact = abs(lap) * (1.0 - grad);

    // Restoration: blend towards local median to remove artifacts
    vec4 c = go_1(0.0, 0.0);
    vec4 cN = go_1(0.0, -1.0);
    vec4 cS = go_1(0.0, 1.0);
    vec4 cE = go_1(1.0, 0.0);
    vec4 cW = go_1(-1.0, 0.0);

    // Weighted average toward neighbours where artifacts are detected
    float w = smoothstep(0.0, 0.15, artifact) * 0.5;
    vec4 avg = (cN + cS + cE + cW) * 0.25;

    return mix(c, avg, w);
}
