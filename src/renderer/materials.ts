import * as THREE from 'three';
import { PresetMaterialType } from '../types/crystal';
import {createExtendedMaterial, type MaterialContext} from './extendedMaterials';
import {createSurfaceMaterial} from './surfaceMaterials';
import {retiredMaterialFallback} from '../materialCatalog';

// Cache for toon gradient map to avoid re-generating
let toonGradientMap: THREE.DataTexture | null = null;
let toonOutlineMaterial: THREE.MeshBasicMaterial | null = null;
let sketchOutlineMaterial: THREE.MeshBasicMaterial | null = null;

// Material instance cache to minimize WebGL state changes and shaders
const materialCache = new Map<string, THREE.Material>();

export function getToonGradientMap(): THREE.DataTexture {
  if (!toonGradientMap) {
    // 3-tone discrete step gradient for anime / cel-shaded look
    const colors = new Uint8Array([
      80, 80, 80, 255,      // Shadow band
      185, 185, 185, 255,   // Midtone band
      255, 255, 255, 255    // Specular highlight band
    ]);
    toonGradientMap = new THREE.DataTexture(colors, 3, 1, THREE.RGBAFormat);
    toonGradientMap.minFilter = THREE.NearestFilter;
    toonGradientMap.magFilter = THREE.NearestFilter;
    toonGradientMap.needsUpdate = true;
  }
  return toonGradientMap;
}

// Inverted Hull Outline Material for Cartoon / Cel-shaded silhouette
export function getToonOutlineMaterial(): THREE.MeshBasicMaterial {
  if (!toonOutlineMaterial) {
    toonOutlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x09090b, // Deep crisp ink black outline
      side: THREE.BackSide
    });
  }
  return toonOutlineMaterial;
}

export function getOutlineMaterial(style: PresetMaterialType, cache?: Map<string, THREE.Material>): THREE.MeshBasicMaterial {
  if (cache) {
    const key = `outline_${style === 'handdrawn' ? 'sketch' : style === 'candy' ? 'candy' : 'toon'}`;
    if (!cache.has(key)) cache.set(key, new THREE.MeshBasicMaterial({
      color: style === 'handdrawn' ? 0x1e293b : style === 'candy' ? 0x334155 : 0x09090b,
      side: THREE.BackSide
    }));
    return cache.get(key) as THREE.MeshBasicMaterial;
  }
  if (style === 'handdrawn') {
    if (!sketchOutlineMaterial) {
      sketchOutlineMaterial = new THREE.MeshBasicMaterial({
        color: 0x1e293b, // Dark charcoal pencil outline
        side: THREE.BackSide
      });
    }
    return sketchOutlineMaterial;
  }
  if (style === 'candy') {
    return new THREE.MeshBasicMaterial({
      color: 0x334155, // Soft slate charcoal outline for editorial illustration
      side: THREE.BackSide
    });
  }
  return getToonOutlineMaterial();
}

// Dynamic light direction shared across custom shader materials
export const globalLightingUniforms = {
  uLightDir: { value: new THREE.Vector3(-0.45, 0.70, 0.55).normalize() },
  uLightAngle: { value: 2.20 }
};

export function updateGlobalLightDir(dir: THREE.Vector3) {
  globalLightingUniforms.uLightDir.value.copy(dir).normalize();
  const angle = Math.atan2(dir.y, dir.x);
  globalLightingUniforms.uLightAngle.value = angle;
}

/**
 * 漫画 / 赛璐珞风格材质 (Comic / Manga / LightCone Cel-Shading)
 * 特性:
 * 1. 视点空间 3-阶梯离散阴影过渡 (Shadow, Midtone, Highlight)
 * 2. 左上方经典纯白新月/圆形高光光斑 (Anime Crescent Glint)
 * 3. 柔和边缘外轮廓菲涅尔光
 */
function createComicMaterial(color: THREE.Color, selected: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: color },
      uLightDir: globalLightingUniforms.uLightDir,
      uGlintThreshold: { value: 0.88 },
      uIsSelected: { value: selected ? 1.0 : 0.0 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uLightDir;
      uniform float uGlintThreshold;
      uniform float uIsSelected;

      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(vViewPosition);
        vec3 l = normalize(uLightDir);
        vec3 h = normalize(l + v);

        // 3-band stepped cel-shading
        float NdotL = dot(n, l);
        float stepShadow = smoothstep(0.04, 0.09, NdotL);
        float stepHighlight = smoothstep(0.52, 0.57, NdotL);

        vec3 shadowCol = uBaseColor * 0.62;
        vec3 midCol = uBaseColor * 0.92;
        vec3 litCol = uBaseColor * 1.08;

        vec3 diffuseCol = mix(shadowCol, midCol, stepShadow);
        diffuseCol = mix(diffuseCol, litCol, stepHighlight);

        // Crisp anime specular glint (pure white circle / crescent)
        float NdotH = max(0.0, dot(n, h));
        float glint = smoothstep(uGlintThreshold - 0.02, uGlintThreshold + 0.01, NdotH);

        // Subtle edge rim light
        float rim = 1.0 - max(0.0, dot(n, v));
        float rimStep = smoothstep(0.85, 0.96, rim) * 0.18;

        vec3 finalCol = mix(diffuseCol + rimStep * vec3(1.0), vec3(1.0), glint * 0.96);

        if (uIsSelected > 0.5) {
          finalCol = mix(finalCol, vec3(1.0, 0.12, 0.38), 0.55);
        }

        gl_FragColor = vec4(finalCol, 1.0);
      }
    `
  });
}

/**
 * 手绘 / 素描风格材质 (Hand-Drawn / Sketch / Cross-Hatching)
 * 特性:
 * 1. 暖调纸张质感底色 (Paper Tone)
 * 2. 阴影区域程序化交叉排线阴影 (Cross-Hatch lines)
 * 3. 模拟石墨铅笔速写质感
 */
function createHandDrawnMaterial(color: THREE.Color, selected: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: color },
      uLightDir: globalLightingUniforms.uLightDir,
      uIsSelected: { value: selected ? 1.0 : 0.0 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uLightDir;
      uniform float uIsSelected;

      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 n = normalize(vNormal);
        vec3 l = normalize(uLightDir);
        float NdotL = dot(n, l);

        // Screen-space hatching pattern
        vec2 coord = gl_FragCoord.xy;
        float hatch1 = mod(coord.x + coord.y, 8.0);
        float hatch2 = mod(coord.x - coord.y, 8.0);

        // Warm paper tone & pencil graphite
        vec3 paperTone = uBaseColor * 0.94 + vec3(0.06, 0.05, 0.03);
        vec3 pencilDark = uBaseColor * 0.32;

        vec3 col = paperTone;

        if (NdotL < 0.45 && hatch1 < 1.4) {
          col = mix(col, pencilDark, 0.65);
        }
        if (NdotL < 0.15 && hatch2 < 1.4) {
          col = mix(col, pencilDark, 0.85);
        }
        if (NdotL < -0.20) {
          col = mix(col, pencilDark * 0.65, 0.90);
        }

        if (uIsSelected > 0.5) {
          col = mix(col, vec3(1.0, 0.12, 0.38), 0.55);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}

/**
 * 2D 平面矢量插画材质 (2D Vector Flat)
 * 特性:
 * 1. 极简扁平化明暗分割 (Clean Graphic Cut)
 * 2. 现代科技期刊矢量插画风格
 */
function createFlat2DMaterial(color: THREE.Color, selected: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: color },
      uLightDir: globalLightingUniforms.uLightDir,
      uIsSelected: { value: selected ? 1.0 : 0.0 }
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uLightDir;
      uniform float uIsSelected;

      varying vec3 vNormal;

      void main() {
        vec3 n = normalize(vNormal);
        vec3 l = normalize(uLightDir);
        float NdotL = dot(n, l);

        vec3 lit = uBaseColor;
        vec3 shadow = uBaseColor * 0.76;
        vec3 col = (NdotL > 0.12) ? lit : shadow;

        if (uIsSelected > 0.5) {
          col = mix(col, vec3(1.0, 0.15, 0.4), 0.6);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}

/**
 * 潮玩矢量 / 双重高光风格 (Pop Art Dual Glint)
 * 特性:
 * 1. 粗重黑色边缘轮廓线 (Bold Contour)
 * 2. 左上方经典主高光光斑 (Primary kidney/pill specular glint)
 * 3. 右下方对称反向辅助高光光斑 (Secondary rim specular glint)
 * 4. 高饱和度鲜艳双阶卡通底色
 */
function createPopArtMaterial(color: THREE.Color, selected: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: color },
      uLightAngle: globalLightingUniforms.uLightAngle,
      uIsSelected: { value: selected ? 1.0 : 0.0 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform float uLightAngle;
      uniform float uIsSelected;

      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 n = normalize(vNormal);
        vec2 p = vec2(n.x, n.y); // View-space projected 2D coordinates on the sphere disk
        float r = length(p);

        // 1. Saturated base color with smooth outer contour rim
        float outerVignette = smoothstep(0.70, 0.98, r);
        vec3 col = mix(uBaseColor * 1.05, uBaseColor * 0.62, outerVignette);

        // 2. Harmonious inner luminous glow disc (pure tonal boost without yellow cast)
        float dInner = length(p - vec2(0.08, -0.08));
        float innerDisc = smoothstep(0.68, 0.44, dInner);
        vec3 brightTone = min(vec3(1.0), uBaseColor * 1.25 + vec3(0.08));
        col = mix(col, brightTone, innerDisc * 0.65);

        // 3. Graceful Single Curved Crescent Highlight (优雅单弯月弧光 - 沿球体肩部轮廓优美贴合弯曲)
        // Polar-based analytical crescent: radius R ~ 0.63, dynamically follows light angle
        float angle = atan(p.y, p.x); // [-PI, PI]
        float targetAngle = uLightAngle; // dynamically follows directional light
        float angleDiff = abs(angle - targetAngle);
        if (angleDiff > 3.14159) angleDiff = 6.28318 - angleDiff;

        // Arc span: half-width 0.45 radians (~26 degrees), with parabolic tip taper
        float arcSpan = 0.46;
        float t = clamp(angleDiff / arcSpan, 0.0, 1.0);
        float localThick = 0.046 * (1.0 - t * t); // 自然两头收尖的水滴弯月弧

        float dArc = abs(r - 0.63);
        float crescentGlint = (angleDiff < arcSpan)
          ? smoothstep(localThick, localThick - 0.012, dArc) * smoothstep(1.0, 0.85, t)
          : 0.0;

        // 4. Subtle, delicate bottom-right ambient rim sheen
        float dRim = length(p - vec2(0.50, -0.50));
        float rimShine = smoothstep(0.36, 0.18, dRim) * 0.20;

        // Composite clean highlights: pure, refined, zero clutter
        col = mix(col, vec3(1.0), crescentGlint);
        col = mix(col, vec3(1.0), rimShine);

        if (uIsSelected > 0.5) {
          col = mix(col, vec3(1.0, 0.12, 0.38), 0.55);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}

/**
 * 顶刊封面 / 软陶黏土柔光材质 (Editorial Soft Clay / Subsurface Scattering)
 * 特性:
 * 1. 模拟三维封面插画的半透次表面微散射 (Subsurface Wrap Light)
 * 2. 温暖丝绒漫反射 (Velvety Rim & Contact Occlusion)
 * 3. 细腻微粒质感，无刺眼尖锐高光，无粗黑描边
 */
function createClayMaterial(color: THREE.Color, selected: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: color },
      uLightDir: globalLightingUniforms.uLightDir,
      uIsSelected: { value: selected ? 1.0 : 0.0 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uLightDir;
      uniform float uIsSelected;

      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(vViewPosition);
        vec3 l = normalize(uLightDir);
        vec3 h = normalize(l + v);

        // Half-Lambert Subsurface Wrap Lighting (Nature Cover Illustration)
        float NdotL = dot(n, l);
        float wrap = max(0.0, (NdotL + 0.42) / 1.42);
        float softDiffuse = pow(wrap, 1.30);

        // Warm directional sunlight & cool ambient fill
        vec3 sunColor = vec3(1.0, 0.97, 0.93);
        vec3 ambientColor = vec3(0.72, 0.76, 0.82);

        vec3 lit = uBaseColor * sunColor * 1.18 + vec3(0.05, 0.04, 0.03);
        vec3 amb = uBaseColor * ambientColor * 0.42 + vec3(0.03, 0.04, 0.05);
        vec3 col = mix(amb, lit, softDiffuse);

        // Subsurface Scattering (SSS) warm peach glow across terminator
        float sssTerm = smoothstep(0.35, 0.0, abs(NdotL)) * 0.28;
        col += sssTerm * vec3(1.0, 0.48, 0.25) * uBaseColor;

        // Velvety peach-fuzz rim light (soft grazing angle glow)
        float rim = pow(1.0 - max(0.0, dot(n, v)), 2.8) * 0.32;
        col += rim * vec3(1.0, 0.98, 0.95);

        // Soft matte porcelain sheen (diffuse highlight without sharp plastic specular)
        float matteSheen = pow(max(0.0, dot(n, h)), 14.0) * 0.16;
        col += matteSheen * vec3(1.0);

        if (uIsSelected > 0.5) {
          col = mix(col, vec3(1.0, 0.15, 0.4), 0.55);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}

/**
 * 机制示意 / 矢量微立体材质 (2D Schematic / BioRender Vector)
 * 特性:
 * 1. 2D 径向柔和微渐变 (Soft 2D Radial Gradient)
 * 2. 纯净淡彩科研配比，无油腻3D高光
 * 3. 匹配式自然色阶轮廓
 */
function createBubbleMaterial(color: THREE.Color, selected: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: color },
      uLightDir: globalLightingUniforms.uLightDir,
      uIsSelected: { value: selected ? 1.0 : 0.0 }
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uLightDir;
      uniform float uIsSelected;
      varying vec3 vNormal;

      void main() {
        vec3 n = normalize(vNormal);
        vec2 p = vec2(n.x, n.y);

        // Soft pastel palette treatment with dynamic light focus
        vec2 lightFocus = normalize(vec2(uLightDir.x, uLightDir.y)) * 0.45;
        float d = length(p - lightFocus);
        
        vec3 pastelLight = mix(uBaseColor, vec3(1.0), 0.48);
        vec3 pastelMid = mix(uBaseColor, vec3(1.0), 0.12);
        vec3 pastelDark = mix(uBaseColor, vec3(0.12, 0.18, 0.22), 0.20);

        vec3 col = mix(pastelLight, pastelMid, smoothstep(0.20, 0.75, d));
        col = mix(col, pastelDark, smoothstep(0.85, 1.20, d));

        // Delicate crescent glint near upper border
        float dCrescent = length(p - vec2(-0.42, 0.42));
        float crescent = smoothstep(0.18, 0.08, dCrescent) * 0.45;
        col = mix(col, vec3(1.0), crescent);

        if (uIsSelected > 0.5) {
          col = mix(col, vec3(1.0, 0.15, 0.4), 0.55);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}

/**
 * 顶刊马卡龙 / 水滴高光材质 (Candy Pastel / Nature Schematic)
 * 特性:
 * 1. 柔和纯美马卡龙淡彩色调 (Coral Pink / Mint Teal / Sky Blue)
 * 2. 标志性圆润纯白水滴/弯月光斑 (Curved Specular Glint Pill)
 * 3. 柔顺平滑的明暗球体阶梯与微暗边缘自然沉降
 * 4. 适合学术顶刊机制机理示意
 */
function createCandyMaterial(color: THREE.Color, selected: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: color },
      uLightDir: globalLightingUniforms.uLightDir,
      uLightAngle: globalLightingUniforms.uLightAngle,
      uIsSelected: { value: selected ? 1.0 : 0.0 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uLightDir;
      uniform float uLightAngle;
      uniform float uIsSelected;

      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(vViewPosition);
        vec3 l = normalize(uLightDir);
        vec2 p = vec2(n.x, n.y);
        float r = length(p);

        // 1. Soft pastel tone mapping (clean, bright, editorial macaron look)
        vec3 pastelBase = mix(uBaseColor, vec3(1.0), 0.16);

        // 2. Wrap-around soft diffuse shading
        float NdotL = dot(n, l);
        float diff = smoothstep(-0.35, 0.75, NdotL);
        vec3 shadowCol = uBaseColor * 0.64;
        vec3 litCol = pastelBase * 1.06;
        vec3 col = mix(shadowCol, litCol, diff);

        // 3. Crisp vector perimeter darkening (subtle natural edge vignette)
        float rimDark = smoothstep(0.72, 0.99, r);
        col = mix(col, uBaseColor * 0.52, rimDark * 0.45);

        // 4. Iconic Curved Specular Glint Pill (参考图1核心视觉: 优雅水滴弯月弧光)
        float angle = atan(p.y, p.x);
        float targetAngle = uLightAngle;
        float angleDiff = abs(angle - targetAngle);
        if (angleDiff > 3.14159) angleDiff = 6.28318 - angleDiff;

        float arcSpan = 0.54; // ~31 degrees
        float t = clamp(angleDiff / arcSpan, 0.0, 1.0);
        float capsuleThick = 0.072 * (1.0 - t * t * 0.82);
        float dArc = abs(r - 0.60);

        float primaryGlint = (angleDiff < arcSpan)
          ? smoothstep(capsuleThick, capsuleThick - 0.022, dArc) * smoothstep(1.0, 0.65, t)
          : 0.0;

        // Soft halo around glint
        float softHalo = (angleDiff < arcSpan * 1.35)
          ? smoothstep(0.18, 0.0, dArc) * (1.0 - t) * 0.30
          : 0.0;

        // 5. Delicate secondary bounce sheen on opposite bottom-right
        float bounceDiff = abs(angle - (targetAngle - 3.14159));
        if (bounceDiff > 3.14159) bounceDiff = 6.28318 - bounceDiff;
        float bounce = smoothstep(0.70, 0.96, r) * smoothstep(0.9, 0.0, bounceDiff) * 0.22;

        // Composite
        col = mix(col, vec3(1.0), softHalo);
        col = mix(col, vec3(1.0), primaryGlint * 0.96);
        col += bounce * vec3(1.0, 1.0, 1.0);

        if (uIsSelected > 0.5) {
          col = mix(col, vec3(1.0, 0.12, 0.38), 0.55);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}

/**
 * 冷冻电镜 / 荧光辉光材质 (Cryo-EM Fluorescent / Quantum Glow)
 * 特性:
 * 1. 纳米颗粒与生物大分子自发光感
 * 2. 核心深沉通透，外边缘反向菲涅尔强发光
 */
function createGlowMaterial(color: THREE.Color, selected: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: color },
      uLightDir: globalLightingUniforms.uLightDir,
      uIsSelected: { value: selected ? 1.0 : 0.0 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uLightDir;
      uniform float uIsSelected;

      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(vViewPosition);
        vec3 l = normalize(uLightDir);
        vec3 h = normalize(l + v);

        float NdotV = max(0.0, dot(n, v));
        float fresnel = pow(1.0 - NdotV, 2.3);

        float NdotL = max(0.0, dot(n, l));
        vec3 core = uBaseColor * 0.50 * (NdotL * 0.5 + 0.5);

        vec3 halo = uBaseColor * 1.6 + vec3(0.2, 0.25, 0.35);
        vec3 col = mix(core, halo, fresnel * 0.88);

        float spec = pow(max(0.0, dot(n, h)), 28.0) * 0.45;
        col += spec * vec3(1.0);

        if (uIsSelected > 0.5) {
          col = mix(col, vec3(1.0, 0.12, 0.38), 0.6);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}

/**
 * 全息珍珠 / 虹彩干涉材质 (Holographic Pearl / Thin-film Interference)
 * 特性:
 * 1. 模拟薄膜光干涉物理色散，视角变动呈现流动珍珠虹彩
 * 2. 适合二维材料异质结、拓扑材料、薄膜物态
 */
function createIridescentMaterial(color: THREE.Color, selected: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: color },
      uLightDir: globalLightingUniforms.uLightDir,
      uIsSelected: { value: selected ? 1.0 : 0.0 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uLightDir;
      uniform float uIsSelected;

      varying vec3 vNormal;
      varying vec3 vViewPosition;

      vec3 spectralColor(float t) {
        return 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + t));
      }

      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(vViewPosition);
        vec3 l = normalize(uLightDir);
        vec3 h = normalize(l + v);

        float NdotV = max(0.0, dot(n, v));
        float NdotL = max(0.0, dot(n, l));

        // Milky pearl luster base
        vec3 pearlBase = mix(uBaseColor, vec3(0.95, 0.97, 1.0), 0.28);
        vec3 diff = pearlBase * (NdotL * 0.65 + 0.40);

        // Thin-film interference iridescence
        float film = (1.0 - NdotV) * 1.5 + dot(n, l) * 0.22;
        vec3 rainbow = spectralColor(film);

        float irid = pow(1.0 - NdotV, 2.0);
        vec3 col = mix(diff, rainbow * 1.12, irid * 0.72);

        // Sharp pearl glint
        float spec = pow(max(0.0, dot(n, h)), 36.0);
        col += spec * vec3(1.0, 0.98, 0.95) * 0.85;

        if (uIsSelected > 0.5) {
          col = mix(col, vec3(1.0, 0.12, 0.38), 0.55);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}

/**
 * X射线幽灵 / 透视蓝图材质 (X-Ray Ghost / Blueprint)
 * 特性:
 * 1. 结构内部通透幽灵感，多层结构完全不遮挡
 * 2. 强边缘辉光，蓝图科技美感
 */
function createXRayMaterial(color: THREE.Color, selected: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: color },
      uIsSelected: { value: selected ? 1.0 : 0.0 }
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform float uIsSelected;

      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(vViewPosition);

        float NdotV = abs(dot(n, v));
        float edge = pow(1.0 - NdotV, 2.4);

        vec3 cyanTint = mix(uBaseColor, vec3(0.2, 0.85, 1.0), 0.40);
        vec3 col = cyanTint * (edge * 1.8 + 0.30);

        float alpha = clamp(0.22 + edge * 0.72, 0.0, 0.95);

        if (uIsSelected > 0.5) {
          col = mix(col, vec3(1.0, 0.12, 0.38), 0.75);
          alpha = 0.95;
        }

        gl_FragColor = vec4(col, alpha);
      }
    `
  });
}

export function createMaterial(
  type: PresetMaterialType,
  color: THREE.ColorRepresentation,
  selected = false,
  cache = materialCache,
  wireframe = false,
  context: MaterialContext = {}
): THREE.Material {
  type=retiredMaterialFallback(type)??type;
  const baseColor = new THREE.Color(color);
  const cacheKey = `${type}_${baseColor.getHexString()}_${selected}_${wireframe}_${context.textureStrength??.65}_${context.textureScale??12}_${context.role??'atom'}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const emissive = selected ? new THREE.Color('#ff0055') : new THREE.Color('#000000');
  const emissiveIntensity = selected ? 0.6 : 0.0;

  let mat: THREE.Material;

  const extended=createSurfaceMaterial(type,baseColor,selected,context)??createExtendedMaterial(type,baseColor,selected,context,globalLightingUniforms.uLightDir);
  if(extended){if('wireframe'in extended)extended.wireframe=wireframe;cache.set(cacheKey,extended);return extended;}
  switch (type) {
    case 'candy': // 顶刊马卡龙 / 水滴高光
      mat = createCandyMaterial(baseColor, selected);
      break;

    case 'ceramic': // C4D 影棚瓷光 (陶瓷双层清漆 + 高镜面反射)
      mat = new THREE.MeshPhysicalMaterial({
        color: baseColor,
        metalness: 0.03,
        roughness: 0.06,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        reflectivity: 0.98,
        ior: 1.58,
        sheen: 0.32,
        sheenColor: new THREE.Color(0xffffff),
        sheenRoughness: 0.14,
        envMapIntensity: 2.2,
        emissive,
        emissiveIntensity
      });
      break;

    case 'frosted': // 磨砂果冻 / 冰晶半透 (透光微粗糙，穿透多层晶体)
      mat = new THREE.MeshPhysicalMaterial({
        color: baseColor,
        transmission: 0.85,
        opacity: 0.92,
        transparent: true,
        roughness: 0.26,
        metalness: 0.02,
        ior: 1.48,
        thickness: 2.2,
        clearcoat: 0.65,
        clearcoatRoughness: 0.16,
        envMapIntensity: 1.8,
        emissive,
        emissiveIntensity
      });
      break;

    case 'glow': // 冷冻电镜 / 荧光辉光 (自发光边缘粒子辉光)
      mat = createGlowMaterial(baseColor, selected);
      break;

    case 'iridescent': // 全息珍珠 / 虹彩干涉 (薄膜光干涉流动色散)
      mat = createIridescentMaterial(baseColor, selected);
      break;

    case 'xray': // X射线幽灵 / 透视蓝图 (内部全透视蓝图)
      mat = createXRayMaterial(baseColor, selected);
      break;
    case 'comic': // 漫画 / 赛璐珞 (出版级漫画风格)
      mat = createComicMaterial(baseColor, selected);
      break;

    case 'popart': // 潮玩矢量 / 双重高光 (粗轮廓、双高光波普风)
      mat = createPopArtMaterial(baseColor, selected);
      break;

    case 'clay': // 顶刊封面 / 软陶黏土 (柔和次表面、温润无光泽)
      mat = createClayMaterial(baseColor, selected);
      break;

    case 'bubble': // 机制示意 / 气泡高光 (电化学机理示意、扁平气泡)
      mat = createBubbleMaterial(baseColor, selected);
      break;

    case 'mof': // 晶态多孔 / 框架晶体 (半透晶面微透射、多面体棱线)
      mat = new THREE.MeshPhysicalMaterial({
        color: baseColor,
        transmission: 0.65,
        opacity: 0.88,
        transparent: true,
        roughness: 0.10,
        metalness: 0.05,
        clearcoat: 0.95,
        clearcoatRoughness: 0.06,
        ior: 1.45,
        thickness: 1.2,
        reflectivity: 0.90,
        envMapIntensity: 2.0,
        emissive,
        emissiveIntensity
      });
      break;

    case 'handdrawn': // 手绘 / 素描 (铅笔纸张排线)
      mat = createHandDrawnMaterial(baseColor, selected);
      break;

    case 'flat2d': // 2D 矢量平面 (极简平面插画)
      mat = createFlat2DMaterial(baseColor, selected);
      break;

    case 'plastic': // 塑料质感 (高光清漆层、次表面光泽)
      mat = new THREE.MeshPhysicalMaterial({
        color: baseColor,
        metalness: 0.02,
        roughness: 0.26,
        clearcoat: 0.75,
        clearcoatRoughness: 0.12,
        sheen: 0.25,
        sheenColor: new THREE.Color(0xffffff),
        sheenRoughness: 0.3,
        envMapIntensity: 1.25,
        emissive,
        emissiveIntensity
      });
      break;

    case 'glossy': // 光泽漆面 (镜面车漆 / 陶瓷釉面)
      mat = new THREE.MeshPhysicalMaterial({
        color: baseColor,
        metalness: 0.06,
        roughness: 0.04,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        reflectivity: 0.95,
        envMapIntensity: 1.85,
        emissive,
        emissiveIntensity
      });
      break;

    case 'metallic': // 金属质感 (真实各向同性金属反射)
      mat = new THREE.MeshPhysicalMaterial({
        color: baseColor,
        metalness: 0.94,
        roughness: 0.16,
        clearcoat: 0.20,
        clearcoatRoughness: 0.08,
        reflectivity: 0.98,
        envMapIntensity: 2.4,
        emissive,
        emissiveIntensity
      });
      break;

    case 'glass': // 水晶玻璃 (物理透射折射)
      mat = new THREE.MeshPhysicalMaterial({
        color: baseColor,
        transmission: 0.82,
        opacity: 1.0,
        transparent: true,
        ior: 1.52,
        roughness: 0.06,
        metalness: 0.04,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        thickness: 1.4,
        envMapIntensity: 2.0,
        emissive,
        emissiveIntensity
      });
      break;

    case 'smooth': // 物理平滑 (柔和 Studio 漫反射)
      mat = new THREE.MeshStandardMaterial({
        color: baseColor,
        metalness: 0.0,
        roughness: 0.46,
        flatShading: false,
        emissive,
        emissiveIntensity
      });
      break;

    case 'toon': // 经典卡通 (MeshToonMaterial 离散渐变)
      mat = new THREE.MeshToonMaterial({
        color: baseColor,
        gradientMap: getToonGradientMap().clone(),
        emissive,
        emissiveIntensity
      });
      break;

    case 'flat': // 纯色 (完全无光照纯色)
    default:
      mat = new THREE.MeshBasicMaterial({
        color: selected ? new THREE.Color('#ff2266') : baseColor
      });
      break;
  }

  if ('wireframe' in mat) mat.wireframe = wireframe;
  cache.set(cacheKey, mat);
  return mat;
}
