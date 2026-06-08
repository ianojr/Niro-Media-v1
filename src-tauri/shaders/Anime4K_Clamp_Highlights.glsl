// Anime4K v4.0 — Clamp Highlights
// Prevents ringing artifacts from subsequent upscaling passes
// Source: https://github.com/bloc97/Anime4K (MIT License)

//!HOOK MAIN
//!BIND HOOKED
//!DESC Anime4K-v4.0-Clamp-Highlights

vec4 hook() {
    vec2 d = HOOKED_pt;

    vec4 c0 = HOOKED_texOff(vec2(0.0, 0.0));

    vec4 cN = HOOKED_texOff(vec2(0.0, -1.0));
    vec4 cS = HOOKED_texOff(vec2(0.0, 1.0));
    vec4 cE = HOOKED_texOff(vec2(1.0, 0.0));
    vec4 cW = HOOKED_texOff(vec2(-1.0, 0.0));

    vec4 cNW = HOOKED_texOff(vec2(-1.0, -1.0));
    vec4 cNE = HOOKED_texOff(vec2(1.0, -1.0));
    vec4 cSW = HOOKED_texOff(vec2(-1.0, 1.0));
    vec4 cSE = HOOKED_texOff(vec2(1.0, 1.0));

    vec4 lo = min(min(min(cN, cS), min(cE, cW)), min(min(cNW, cNE), min(cSW, cSE)));
    vec4 hi = max(max(max(cN, cS), max(cE, cW)), max(max(cNW, cNE), max(cSW, cSE)));

    return clamp(c0, lo, hi);
}
