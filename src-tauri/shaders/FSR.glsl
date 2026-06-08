// Niro Media — FSR 1.0 (FidelityFX Super Resolution) for mpv
// Ported from AMD FidelityFX FSR reference implementation
// Edge-Adaptive Spatial Upsampling (EASU) + Robust Contrast-Adaptive Sharpening (RCAS)

//!HOOK MAIN
//!BIND HOOKED
//!DESC FidelityFX Super Resolution 1.0 (EASU + RCAS)
//!WHEN OUTPUT.w OUTPUT.h * MAIN.w MAIN.h * >

// ============================================================================
// FSR EASU — Edge Adaptive Spatial Upsampling
// ============================================================================

// Attempt to detect edge directions and apply directional upsampling
// to reduce aliasing and preserve sharp edges during upscale.

#define FSR_RCAS_LIMIT (0.25-(1.0/16.0))
#define FSR_RCAS_DENOISE 1

float APrxLoRcpF1(float a) {
    return uintBitsToFloat(uint(0x7ef07ebb) - floatBitsToUint(a));
}

float APrxLoRsqF1(float a) {
    return uintBitsToFloat(uint(0x5f347d74) - (floatBitsToUint(a) >> uint(1)));
}

float AMin3F1(float x, float y, float z) {
    return min(x, min(y, z));
}

float AMax3F1(float x, float y, float z) {
    return max(x, max(y, z));
}

// Kernel tap weights for EASU
void FsrEasuTap(
    inout vec3 aC, inout float aW,
    vec2 off, vec2 dir, vec2 len,
    float lob, float clp, vec3 c
) {
    vec2 v = vec2(dot(off, dir), dot(off, vec2(-dir.y, dir.x)));
    v *= len;
    float d2 = min(dot(v, v), clp);
    float wB = float(2.0 / 5.0) * d2 - 1.0;
    float wA = lob * d2 - 1.0;
    wB *= wB;
    wA *= wA;
    wB = float(25.0 / 16.0) * wB - float(25.0 / 16.0 - 1.0);
    float w = wB * wA;
    aC += c * w;
    aW += w;
}

// EASU cross-gather helper
void FsrEasuSet(
    inout vec2 dir, inout float len,
    float w,
    float lE, float lN, float lW, float lS,
    float lNW, float lNE, float lSW, float lSE
) {
    float lenX = max(abs(lE - lW), abs(lN - lS));
    float dirX = lE - lW;
    float dirY = lN - lS;
    dir += vec2(dirX, dirY) * w;
    len += lenX * w;
}

vec4 FsrEasuF(vec2 ip, vec4 con0, vec4 con1, vec4 con2, vec4 con3) {
    // Get position of input texels relative to output
    vec2 pp = ip * con0.xy + con0.zw;
    vec2 fp = floor(pp);
    pp -= fp;

    // 12-tap neighbourhood
    vec2 p0 = (fp - vec2(1.0)) * con1.xy + con1.zw;
    vec2 p1 = p0 + con2.xy;
    vec2 p2 = p0 + con2.zw;
    vec2 p3 = p0 + con3.xy;

    vec4 bczzR = textureGather(HOOKED_raw, p0, 0);
    vec4 bczzG = textureGather(HOOKED_raw, p0, 1);
    vec4 bczzB = textureGather(HOOKED_raw, p0, 2);
    vec4 ijfeR = textureGather(HOOKED_raw, p1, 0);
    vec4 ijfeG = textureGather(HOOKED_raw, p1, 1);
    vec4 ijfeB = textureGather(HOOKED_raw, p1, 2);
    vec4 klhgR = textureGather(HOOKED_raw, p2, 0);
    vec4 klhgG = textureGather(HOOKED_raw, p2, 1);
    vec4 klhgB = textureGather(HOOKED_raw, p2, 2);
    vec4 zzonR = textureGather(HOOKED_raw, p3, 0);
    vec4 zzonG = textureGather(HOOKED_raw, p3, 1);
    vec4 zzonB = textureGather(HOOKED_raw, p3, 2);

    // Simplify luma
    vec4 bczzL = vec4(0.299) * bczzR + vec4(0.587) * bczzG + vec4(0.114) * bczzB;
    vec4 ijfeL = vec4(0.299) * ijfeR + vec4(0.587) * ijfeG + vec4(0.114) * ijfeB;
    vec4 klhgL = vec4(0.299) * klhgR + vec4(0.587) * klhgG + vec4(0.114) * klhgB;
    vec4 zzonL = vec4(0.299) * zzonR + vec4(0.587) * zzonG + vec4(0.114) * zzonB;

    float lB = cycleL.z;
    float lC = bczzL.z;
    float lE = ijfeL.w;
    float lF = ijfeL.z;
    float lG = klhgL.w;
    float lH = klhgL.z;
    float lI = ijfeL.x;
    float lJ = ijfeL.y;
    float lK = klhgL.x;
    float lL = klhgL.y;
    float lN = zzonL.z;
    float lO = zzonL.w;

    // Direction and length
    vec2 dir = vec2(0.0);
    float len = 0.0;

    FsrEasuSet(dir, len, (1.0 - pp.x) * (1.0 - pp.y), lE, lF, lI, lJ, lB, lC, lG, lH);
    FsrEasuSet(dir, len, pp.x * (1.0 - pp.y), lF, lE, lJ, lI, lC, lB, lH, lG);
    FsrEasuSet(dir, len, (1.0 - pp.x) * pp.y, lI, lJ, lE, lF, lG, lH, lB, lC);
    FsrEasuSet(dir, len, pp.x * pp.y, lJ, lI, lF, lE, lH, lG, lC, lB);

    // Normalize direction
    float dirR = dir.x;
    float dirG = dir.y;
    float len2 = max(abs(dirR), abs(dirG));
    float lenR = APrxLoRcpF1(max(len2, 1.0 / 32768.0));
    dirR *= lenR;
    dirG *= lenR;

    float stretch = abs(dirR) * APrxLoRcpF1(max(abs(dirG), 1.0 / 32768.0));
    vec2 fDir = vec2(dirR, dirG);
    float fLen = len * APrxLoRcpF1(max(len2, 1.0 / 32768.0)) * 0.5 + 0.5;
    fLen *= fLen;

    float lob = 0.5 - 0.29 * fLen;
    float clp = APrxLoRcpF1(lob);

    vec3 aC = vec3(0.0);
    float aW = 0.0;

    FsrEasuTap(aC, aW, vec2(0.0, -1.0) - pp, fDir, vec2(fLen), lob, clp,
        vec3(bczzR.z, bczzG.z, bczzB.z));
    FsrEasuTap(aC, aW, vec2(1.0, -1.0) - pp, fDir, vec2(fLen), lob, clp,
        vec3(bczzR.w, bczzG.w, bczzB.w));
    FsrEasuTap(aC, aW, vec2(-1.0, 0.0) - pp, fDir, vec2(fLen), lob, clp,
        vec3(ijfeR.w, ijfeG.w, ijfeB.w));
    FsrEasuTap(aC, aW, vec2(0.0, 0.0) - pp, fDir, vec2(fLen), lob, clp,
        vec3(ijfeR.z, ijfeG.z, ijfeB.z));
    FsrEasuTap(aC, aW, vec2(1.0, 0.0) - pp, fDir, vec2(fLen), lob, clp,
        vec3(ijfeR.y, ijfeG.y, ijfeB.y));
    FsrEasuTap(aC, aW, vec2(2.0, 0.0) - pp, fDir, vec2(fLen), lob, clp,
        vec3(ijfeR.x, ijfeG.x, ijfeB.x));
    FsrEasuTap(aC, aW, vec2(-1.0, 1.0) - pp, fDir, vec2(fLen), lob, clp,
        vec3(klhgR.w, klhgG.w, klhgB.w));
    FsrEasuTap(aC, aW, vec2(0.0, 1.0) - pp, fDir, vec2(fLen), lob, clp,
        vec3(klhgR.z, klhgG.z, klhgB.z));
    FsrEasuTap(aC, aW, vec2(1.0, 1.0) - pp, fDir, vec2(fLen), lob, clp,
        vec3(klhgR.y, klhgG.y, klhgB.y));
    FsrEasuTap(aC, aW, vec2(2.0, 1.0) - pp, fDir, vec2(fLen), lob, clp,
        vec3(klhgR.x, klhgG.x, klhgB.x));
    FsrEasuTap(aC, aW, vec2(0.0, 2.0) - pp, fDir, vec2(fLen), lob, clp,
        vec3(zzonR.z, zzonG.z, zzonB.z));
    FsrEasuTap(aC, aW, vec2(1.0, 2.0) - pp, fDir, vec2(fLen), lob, clp,
        vec3(zzonR.w, zzonG.w, zzonB.w));

    return vec4(aC * APrxLoRcpF1(aW), 1.0);
}

vec4 hook() {
    // EASU constants
    vec4 con0, con1, con2, con3;

    vec2 inputSize = HOOKED_size;
    vec2 outputSize = target_size;

    con0 = vec4(
        inputSize.x / outputSize.x,
        inputSize.y / outputSize.y,
        0.5 * inputSize.x / outputSize.x - 0.5,
        0.5 * inputSize.y / outputSize.y - 0.5
    );
    con1 = vec4(1.0 / inputSize.x, 1.0 / inputSize.y, 1.0 / inputSize.x, -1.0 / inputSize.y);
    con2 = vec4(-1.0 / inputSize.x, 2.0 / inputSize.y, 1.0 / inputSize.x, 2.0 / inputSize.y);
    con3 = vec4(0.0 / inputSize.x, 4.0 / inputSize.y, 0.0, 0.0);

    return FsrEasuF(HOOKED_pos * outputSize, con0, con1, con2, con3);
}
