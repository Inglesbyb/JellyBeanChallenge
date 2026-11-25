/**
 * @file hero3d.js
 * Shared Pristine-HD Real-Time Cel-Shaded 3D Mascot Engine ("Weebl's Stuff" Cartoon 3D)
 * using Three.js with fwidth-antialiased GLSL cel shading, averaged-normal inverted-hull
 * #000000 ink outlines, surface-projected facial anatomy, multi-step mip downsampling,
 * and a rich suite of game-specific action poses & props.
 */

import * as THREE from 'three';

const TAU = Math.PI * 2;
const VIEW_SIZE = 512; // Supersampled 512x512 WebGL buffer for pristine crisp edges

export const HERO_3D_VIEWS = {
  front: { yaw: 0, pitch: 0.08 },
  threeQuarterFront: { yaw: -0.44, pitch: 0.14 },
  side: { yaw: -Math.PI * 0.5, pitch: 0.08 },
  threeQuarterRear: { yaw: -(Math.PI - 0.36), pitch: 0.24 },
  rear: { yaw: Math.PI, pitch: 0.26 },
};

let _singleton = null;

/**
 * Safely checks whether WebGL can initialize in the current runtime.
 * Returns false in Node SSR (`verify-game-contract.mjs` mockCanvas2d).
 */
export function isHero3DSupported() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (typeof WebGLRenderingContext === 'undefined') return false;
  try {
    const testCanvas = document.createElement('canvas');
    if (!testCanvas || typeof testCanvas.getContext !== 'function') return false;
    const gl =
      testCanvas.getContext('webgl2', { alpha: true }) ||
      testCanvas.getContext('webgl', { alpha: true }) ||
      testCanvas.getContext('experimental-webgl', { alpha: true });
    return Boolean(gl && typeof gl.getParameter === 'function');
  } catch {
    return false;
  }
}

/**
 * Custom GLSL Cel-Shaded Cartoon Material using screen-space derivatives (`fwidth`)
 * so 2-tone cel shadow borders stay vector-smooth and crisp without jagged NearestFilter steps.
 */
function createWeeblCelMaterial(baseHex, shadowHex, options = {}) {
  const { rimHex = 0xeaffde, rimStrength = 0.22 } = options;
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: new THREE.Color(baseHex) },
      uShadowColor: { value: new THREE.Color(shadowHex) },
      uRimColor: { value: new THREE.Color(rimHex) },
      uRimStrength: { value: rimStrength },
      uLightDir: { value: new THREE.Vector3(-0.48, 0.72, 0.50).normalize() },
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uShadowColor;
      uniform vec3 uRimColor;
      uniform float uRimStrength;
      uniform vec3 uLightDir;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      void main() {
        vec3 n = normalize(vWorldNormal);
        float ndl = dot(n, uLightDir);
        float fw = max(fwidth(ndl) * 1.4, 0.022);
        float lit = smoothstep(-0.04 - fw, -0.04 + fw, ndl);
        vec3 col = mix(uShadowColor, uBaseColor, lit);

        // Subtle crisp cel rim accent on top-left lit edge
        float fresnel = 1.0 - max(0.0, dot(n, normalize(vViewDir)));
        float rim = smoothstep(0.68, 0.76, fresnel) * smoothstep(0.15, 0.35, ndl) * uRimStrength;
        col = mix(col, uRimColor, rim);

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * Computes averaged smooth normals across coincident vertices so inverted-hull
 * #000000 outlines extrude cleanly with zero split-seam gaps.
 */
function buildSmoothOutlineGeometry(srcGeo) {
  const geo = srcGeo.index ? srcGeo.toNonIndexed() : srcGeo.clone();
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const map = new Map();

  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
    let acc = map.get(key);
    if (!acc) {
      acc = [0, 0, 0];
      map.set(key, acc);
    }
    acc[0] += norm.getX(i);
    acc[1] += norm.getY(i);
    acc[2] += norm.getZ(i);
  }

  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
    const acc = map.get(key);
    const len = Math.hypot(acc[0], acc[1], acc[2]) || 1;
    norm.setXYZ(i, acc[0] / len, acc[1] / len, acc[2] / len);
  }
  norm.needsUpdate = true;
  return geo;
}

function createInkOutlineMaterial(width = 0.036, color = 0x000000) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uWidth: { value: width },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: `
      uniform float uWidth;
      void main() {
        vec3 extruded = position + normalize(normal) * uWidth;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(extruded, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
      }
    `,
  });
}

function addWithOutline(parent, geometry, material, outlineWidth = 0.036) {
  const mesh = new THREE.Mesh(geometry, material);
  parent.add(mesh);
  if (outlineWidth > 0) {
    const outline = new THREE.Mesh(buildSmoothOutlineGeometry(geometry), createInkOutlineMaterial(outlineWidth));
    mesh.add(outline);
  }
  return mesh;
}

/**
 * Evaluates exact organic kidney-bean surface coordinates at normalized height u in [-1, 1]
 * and azimuth theta in [0, 2*pi] (`theta = PI/2` faces directly +Z toward front camera).
 */
function sampleKidneyTorsoPoint(u, theta) {
  const angle = (u * Math.PI) / 2;
  const baseProfile = Math.pow(Math.max(0.001, Math.cos(angle)), 0.70);

  const hipPlump = 1 + 0.085 * Math.exp(-Math.pow((u + 0.40) / 0.46, 2)) - 0.05 * Math.max(0, u);
  const rx = 0.445 * baseProfile * hipPlump;
  const rz = 0.370 * baseProfile * hipPlump;
  const y = 0.64 * Math.sin(angle);

  // Subtle C-curve leaning toward tilted crown on upper-right (+X)
  const centerX = 0.048 * u - 0.045 * Math.cos(u * 1.45);
  const centerZ = 0.022 * Math.sin(u * 1.9);

  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const frontFlatten = sinT > 0 ? 1 - 0.065 * sinT : 1;

  const x = centerX + cosT * rx;
  const z = centerZ + sinT * rz * frontFlatten;
  return { x, y, z, centerX, rx };
}

/**
 * Computes exact surface point + outward unit normal on torso front face (+Z)
 * for any local offset `(lx, ly)`, eliminating torso clipping across white teeth/mouth.
 */
function projectOntoTorsoFront(lx, ly, outDist = 0.015) {
  const u = Math.max(-0.92, Math.min(0.92, Math.asin(Math.max(-0.98, Math.min(0.98, ly / 0.64))) / (Math.PI * 0.5)));
  const p0 = sampleKidneyTorsoPoint(u, Math.PI * 0.5);
  const cosVal = Math.max(-0.92, Math.min(0.92, (lx - p0.centerX) / Math.max(0.05, p0.rx)));
  const theta = Math.acos(cosVal); // acos in [0, PI] guarantees front hemisphere sin(theta) >= 0

  const p = sampleKidneyTorsoPoint(u, theta);
  const du = 0.01;
  const dt = 0.01;
  const pu = sampleKidneyTorsoPoint(u + du, theta);
  const pt = sampleKidneyTorsoPoint(u, theta - dt);

  const vU = new THREE.Vector3(pu.x - p.x, pu.y - p.y, pu.z - p.z);
  const vT = new THREE.Vector3(pt.x - p.x, pt.y - p.y, pt.z - p.z);
  const norm = new THREE.Vector3().crossVectors(vT, vU).normalize();
  if (norm.z < 0) norm.negate();

  return new THREE.Vector3(
    p.x + norm.x * outDist,
    p.y + norm.y * outDist,
    p.z + norm.z * outDist
  );
}

function buildKidneyTorsoGeometry(rings = 52, segs = 56) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= rings; i++) {
    const v = i / rings;
    const u = -1 + v * 2;
    for (let j = 0; j <= segs; j++) {
      const s = j / segs;
      const theta = s * TAU;
      const p = sampleKidneyTorsoPoint(u, theta);
      positions.push(p.x, p.y, p.z);
      uvs.push(s, v);
    }
  }

  const stride = segs + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = (i + 1) * stride + j;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Curved glossy cartoon jellybean specular shine pills strictly offset outside skin.
 */
function createBeanGlossHighlights() {
  const group = new THREE.Group();
  const glossMat = new THREE.MeshBasicMaterial({
    color: 0xeaffde,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const patches = [
    { uMin: 0.64, uMax: 0.80, tCenter: 1.98, tHalf: 0.24, out: 0.011 },
    { uMin: 0.06, uMax: 0.42, tCenter: 2.38, tHalf: 0.11, out: 0.011 },
    { uMin: 0.60, uMax: 0.78, tCenter: 4.35, tHalf: 0.22, out: 0.011 },
  ];

  for (const cfg of patches) {
    const pos = [];
    const idx = [];
    const rSteps = 12;
    const sSteps = 12;
    for (let i = 0; i <= rSteps; i++) {
      const fr = i / rSteps;
      const u = cfg.uMin + fr * (cfg.uMax - cfg.uMin);
      const ovalPinch = Math.sin(fr * Math.PI);
      for (let j = 0; j <= sSteps; j++) {
        const fs = (j / sSteps) * 2 - 1;
        const theta = cfg.tCenter + fs * cfg.tHalf * ovalPinch;
        const p = sampleKidneyTorsoPoint(u, theta);
        const normLen = Math.hypot(p.x, p.z) || 1;
        pos.push(p.x + (p.x / normLen) * cfg.out, p.y + (u > 0 ? 0.006 : 0), p.z + (p.z / normLen) * cfg.out);
      }
    }
    const stride = sSteps + 1;
    for (let i = 0; i < rSteps; i++) {
      for (let j = 0; j < sSteps; j++) {
        const a = i * stride + j;
        const b = a + 1;
        const c = (i + 1) * stride + j;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    group.add(new THREE.Mesh(g, glossMat));
  }
  return group;
}

/**
 * Tilted 5-point ball-tipped golden crown matching hero-bean-map.png:
 * 3 front gold peaks + 2 recessed warm-amber back peaks on a crisp rounded brim.
 */
function buildCrownRig(goldMat, amberMat, whiteGlossMat) {
  const crown = new THREE.Group();
  const baseR = 0.24;
  const topR = 0.295;
  const h = 0.145;

  const brimGeo = new THREE.TorusGeometry(baseR, 0.038, 16, 40);
  brimGeo.rotateX(Math.PI / 2);
  addWithOutline(crown, brimGeo, goldMat, 0.030);

  const wallGeo = new THREE.CylinderGeometry(topR * 0.93, baseR * 0.96, h, 36, 1, false);
  wallGeo.translate(0, h * 0.5, 0);
  addWithOutline(crown, wallGeo, goldMat, 0.028);

  const spikeAngles = [
    { a: Math.PI * 0.5, tall: 0.255, front: true },
    { a: Math.PI * 0.5 - 1.05, tall: 0.235, front: true },
    { a: Math.PI * 0.5 + 1.05, tall: 0.235, front: true },
    { a: -Math.PI * 0.5 - 0.62, tall: 0.195, front: false },
    { a: -Math.PI * 0.5 + 0.62, tall: 0.195, front: false },
  ];

  for (const s of spikeAngles) {
    const spikeGroup = new THREE.Group();
    spikeGroup.rotation.y = -s.a + Math.PI / 2;
    const cone = new THREE.ConeGeometry(0.09, s.tall, 16);
    cone.translate(0, s.tall * 0.5, 0);
    const holder = new THREE.Group();
    holder.position.set(0, h * 0.84, topR * 0.84);
    holder.rotation.x = 0.18;
    addWithOutline(holder, cone, s.front ? goldMat : amberMat, 0.028);

    const ball = new THREE.SphereGeometry(0.04, 18, 14);
    ball.translate(0, s.tall + 0.015, 0);
    const ballMesh = addWithOutline(holder, ball, s.front ? goldMat : amberMat, 0.028);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), whiteGlossMat);
    shine.position.set(-0.014, s.tall + 0.029, 0.022);
    ballMesh.add(shine);

    spikeGroup.add(holder);
    crown.add(spikeGroup);
  }

  return crown;
}

/**
 * High-poly cartoon arm with open 5-finger waving palm or clenched grip fist.
 */
function buildArmRig(side, greenMat) {
  const shoulder = new THREE.Group();
  const upperGeo = new THREE.CapsuleGeometry(0.058, 0.19, 12, 20);
  upperGeo.translate(0, -0.105, 0);
  addWithOutline(shoulder, upperGeo, greenMat, 0.034);

  const elbow = new THREE.Group();
  elbow.position.set(0, -0.21, 0);
  shoulder.add(elbow);

  const foreGeo = new THREE.CapsuleGeometry(0.055, 0.17, 12, 20);
  foreGeo.translate(0, -0.095, 0);
  addWithOutline(elbow, foreGeo, greenMat, 0.034);

  const wrist = new THREE.Group();
  wrist.position.set(0, -0.20, 0);
  elbow.add(wrist);

  const openHand = new THREE.Group();
  const palmGeo = new THREE.SphereGeometry(0.092, 20, 16);
  palmGeo.scale(1.12, 0.88, 0.46);
  addWithOutline(openHand, palmGeo, greenMat, 0.030);

  const fingers = [
    { x: -side * 0.078, y: -0.012, z: 0.008, rz: side * 0.88, len: 0.068, r: 0.024 },
    { x: -side * 0.056, y: -0.074, z: 0, rz: side * 0.40, len: 0.078, r: 0.022 },
    { x: -side * 0.016, y: -0.086, z: 0, rz: side * 0.12, len: 0.086, r: 0.022 },
    { x: side * 0.028, y: -0.082, z: 0, rz: -side * 0.16, len: 0.080, r: 0.022 },
    { x: side * 0.066, y: -0.066, z: 0, rz: -side * 0.46, len: 0.066, r: 0.020 },
  ];
  for (const f of fingers) {
    const fg = new THREE.Group();
    fg.position.set(f.x, f.y, f.z);
    fg.rotation.z = f.rz;
    const cap = new THREE.CapsuleGeometry(f.r, f.len, 10, 14);
    cap.translate(0, -f.len * 0.42, 0);
    addWithOutline(fg, cap, greenMat, 0.026);
    openHand.add(fg);
  }
  wrist.add(openHand);

  const fistHand = new THREE.Group();
  const fistGeo = new THREE.SphereGeometry(0.10, 20, 16);
  fistGeo.scale(1.06, 0.92, 0.92);
  addWithOutline(fistHand, fistGeo, greenMat, 0.032);
  const thumbKnuckle = new THREE.CapsuleGeometry(0.028, 0.05, 8, 14);
  thumbKnuckle.rotateZ(side * 1.15);
  thumbKnuckle.translate(-side * 0.055, -0.015, 0.068);
  addWithOutline(fistHand, thumbKnuckle, greenMat, 0.026);
  wrist.add(fistHand);

  return { shoulder, elbow, wrist, openHand, fistHand };
}

/**
 * High-poly leg rig with rounded green bean shoe, dark sole, and optional scuba flipper.
 */
function buildLegRig(side, greenMat, soleMat, orangeMat) {
  const hip = new THREE.Group();
  const thighGeo = new THREE.CapsuleGeometry(0.062, 0.15, 12, 18);
  thighGeo.translate(0, -0.085, 0);
  addWithOutline(hip, thighGeo, greenMat, 0.034);

  const knee = new THREE.Group();
  knee.position.set(0, -0.175, 0);
  hip.add(knee);

  const shinGeo = new THREE.CapsuleGeometry(0.057, 0.14, 12, 18);
  shinGeo.translate(0, -0.08, 0);
  addWithOutline(knee, shinGeo, greenMat, 0.034);

  const ankle = new THREE.Group();
  ankle.position.set(0, -0.165, 0);
  knee.add(ankle);

  const footHolder = new THREE.Group();
  footHolder.rotation.y = side * 0.22;
  ankle.add(footHolder);

  const shoeGeo = new THREE.SphereGeometry(0.114, 24, 16);
  shoeGeo.scale(0.95, 0.56, 1.52);
  shoeGeo.translate(0, -0.024, 0.062);
  addWithOutline(footHolder, shoeGeo, greenMat, 0.034);

  const soleGeo = new THREE.CylinderGeometry(0.097, 0.10, 0.026, 24);
  soleGeo.scale(0.96, 1, 1.56);
  soleGeo.translate(0, -0.072, 0.062);
  footHolder.add(new THREE.Mesh(soleGeo, soleMat));

  // Optional 3D orange scuba flipper over shoe
  const flipperGroup = new THREE.Group();
  const finGeo = new THREE.BoxGeometry(0.21, 0.04, 0.36);
  finGeo.translate(0, -0.05, 0.18);
  addWithOutline(flipperGroup, finGeo, orangeMat, 0.026);
  flipperGroup.visible = false;
  footHolder.add(flipperGroup);

  return { hip, knee, ankle, footHolder, flipperGroup };
}

/**
 * Helper: builds surface-projected 3D curved patch strictly outside torso mesh.
 * Subdivides across an internal (nx x ny) UV grid so interior triangles follow torso curvature
 * without chord-sagging or green torso bleed-through.
 */
function buildProjectedQuadPatch(xMin, xMax, yMin, yMax, evalInsideFn, outDist, nx = 14, ny = 10) {
  const pos = [];
  const idx = [];
  for (let iy = 0; iy <= ny; iy++) {
    const fy = iy / ny;
    const rawY = yMin + fy * (yMax - yMin);
    for (let ix = 0; ix <= nx; ix++) {
      const fx = ix / nx;
      const rawX = xMin + fx * (xMax - xMin);
      const { x, y } = evalInsideFn ? evalInsideFn(fx, fy, rawX, rawY) : { x: rawX, y: rawY };
      const v = projectOntoTorsoFront(x, y, outDist);
      pos.push(v.x, v.y, v.z);
    }
  }
  const stride = nx + 1;
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const a = iy * stride + ix;
      const b = a + 1;
      const c = (iy + 1) * stride + ix;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildProjectedTubeGeo(points2d, radius, outDist, tubularSegs = 44) {
  const pts3d = points2d.map(([x, y]) => projectOntoTorsoFront(x, y, outDist));
  const curve = new THREE.CatmullRomCurve3(pts3d, false);
  return new THREE.TubeGeometry(curve, tubularSegs, radius, 10, false);
}

/**
 * Builds crisp, clip-free 3D eyes, brows, and multi-expression curved mouth.
 */
function buildFaceRig(skinMat) {
  const face = new THREE.Group();
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const mouthInMat = new THREE.MeshBasicMaterial({ color: 0x3b0712, side: THREE.DoubleSide });
  const tongueMat = new THREE.MeshBasicMaterial({ color: 0xfb7185, side: THREE.DoubleSide });

  // Touching white sclera eyes + pupils + crisp catchlights + brows
  const eyes = [];
  for (const side of [-1, 1]) {
    const eyeCenter = projectOntoTorsoFront(side * 0.132 + 0.016, 0.195, 0.024);
    const eyePivot = new THREE.Group();
    eyePivot.position.copy(eyeCenter);
    eyePivot.rotation.y = side * 0.16;

    const scleraGeo = new THREE.SphereGeometry(0.138, 28, 20);
    scleraGeo.scale(1.0, 1.16, 0.42);
    const sclera = addWithOutline(eyePivot, scleraGeo, whiteMat, 0.032);

    const pupilGroup = new THREE.Group();
    pupilGroup.position.set(0, -0.004, 0.058);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 22, 16), blackMat);
    pupil.scale.set(0.95, 1.05, 0.25);
    pupilGroup.add(pupil);

    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 12), whiteMat);
    glint.position.set(0.019, 0.021, 0.014);
    pupilGroup.add(glint);
    eyePivot.add(pupilGroup);

    const lidGeo = new THREE.SphereGeometry(0.144, 22, 14, 0, TAU, 0, Math.PI * 0.56);
    lidGeo.scale(1.01, 1.18, 0.46);
    const lid = addWithOutline(eyePivot, lidGeo, skinMat, 0.024);
    lid.visible = false;

    const dizzyGroup = new THREE.Group();
    dizzyGroup.position.set(0, 0, 0.064);
    const barGeo = new THREE.CapsuleGeometry(0.016, 0.10, 6, 10);
    const b1 = new THREE.Mesh(barGeo, blackMat);
    b1.rotation.z = Math.PI * 0.25;
    const b2 = new THREE.Mesh(barGeo, blackMat);
    b2.rotation.z = -Math.PI * 0.25;
    dizzyGroup.add(b1, b2);
    dizzyGroup.visible = false;
    eyePivot.add(dizzyGroup);

    const browCenter = projectOntoTorsoFront(side * 0.132 + 0.016, 0.376, 0.028);
    const browPivot = new THREE.Group();
    browPivot.position.copy(browCenter);
    browPivot.rotation.y = side * 0.16;
    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.078, -0.018, -0.01),
      new THREE.Vector3(0, 0.024, 0.022),
      new THREE.Vector3(0.078, -0.012, -0.01),
    ]);
    const browMesh = new THREE.Mesh(new THREE.TubeGeometry(browCurve, 16, 0.026, 10, false), blackMat);
    browPivot.add(browMesh);
    face.add(browPivot);

    face.add(eyePivot);
    eyes.push({ side, baseY: browCenter.y, eyePivot, sclera, pupilGroup, lid, dizzyGroup, browPivot });
  }

  // Happy open laughing mouth mapped across a smooth curved grid strictly outside torso (+0.022..+0.032)
  const happyMouth = new THREE.Group();
  const mx = 0.018;
  const my = -0.072;

  const evalSmile = (fx, fy) => {
    const sx = (fx * 2 - 1);
    const halfW = 0.200 * Math.pow(Math.max(0.05, Math.sin(fy * Math.PI * 0.85 + 0.25)), 0.45);
    const topArch = my + 0.044 - (1 - sx * sx) * 0.018;
    const botArch = my - 0.165 + sx * sx * 0.088;
    return {
      x: mx + sx * halfW,
      y: botArch + fy * (topArch - botArch),
    };
  };
  happyMouth.add(new THREE.Mesh(buildProjectedQuadPatch(-1, 1, 0, 1, evalSmile, 0.021, 16, 10), mouthInMat));

  // Upper teeth hugging top lip strictly outside cavity (+0.027)
  const evalTeeth = (fx, fy) => {
    const sx = (fx * 2 - 1);
    const halfW = 0.184;
    const topArch = my + 0.038 - (1 - sx * sx) * 0.016;
    const botArch = my - 0.020 - (1 - sx * sx) * 0.014;
    return {
      x: mx + sx * halfW * (0.94 + fy * 0.06),
      y: botArch + fy * (topArch - botArch),
    };
  };
  happyMouth.add(new THREE.Mesh(buildProjectedQuadPatch(-1, 1, 0, 1, evalTeeth, 0.027, 14, 5), whiteMat));

  // Rounded pink tongue cleanly inside lower half (+0.024)
  const evalTongue = (fx, fy) => {
    const sx = (fx * 2 - 1);
    const arcPinch = Math.sqrt(Math.max(0.02, 1 - sx * sx));
    const botArch = my - 0.156 + sx * sx * 0.048;
    const topArch = my - 0.145 + arcPinch * 0.076;
    return {
      x: mx + 0.012 + sx * 0.098,
      y: botArch + fy * (topArch - botArch),
    };
  };
  happyMouth.add(new THREE.Mesh(buildProjectedQuadPatch(-1, 1, 0, 1, evalTongue, 0.024, 12, 6), tongueMat));

  // Bold #000000 comic lip border + corner crease + chin dimple (+0.030)
  happyMouth.add(
    new THREE.Mesh(
      buildProjectedTubeGeo(
        [
          [mx - 0.200, my + 0.044],
          [mx, my + 0.026],
          [mx + 0.200, my + 0.044],
          [mx + 0.135, my - 0.120],
          [mx, my - 0.165],
          [mx - 0.135, my - 0.120],
          [mx - 0.200, my + 0.044],
        ],
        0.018,
        0.030,
        48
      ),
      blackMat
    )
  );
  happyMouth.add(
    new THREE.Mesh(
      buildProjectedTubeGeo(
        [
          [mx - 0.044, my - 0.204],
          [mx, my - 0.214],
          [mx + 0.044, my - 0.204],
        ],
        0.014,
        0.022,
        14
      ),
      blackMat
    )
  );
  face.add(happyMouth);

  // Gritted determined combat smile (strictly subdivided curved grid +0.027)
  const gritMouth = new THREE.Group();
  const evalGrit = (fx, fy) => {
    const sx = (fx * 2 - 1);
    const topArch = my + 0.018 - (1 - sx * sx) * 0.014;
    const botArch = my - 0.070 + sx * sx * 0.036;
    return {
      x: mx + sx * 0.172,
      y: botArch + fy * (topArch - botArch),
    };
  };
  gritMouth.add(new THREE.Mesh(buildProjectedQuadPatch(-1, 1, 0, 1, evalGrit, 0.026, 14, 6), whiteMat));
  gritMouth.add(
    new THREE.Mesh(
      buildProjectedTubeGeo(
        [
          [mx - 0.172, my + 0.018],
          [mx, my + 0.004],
          [mx + 0.172, my + 0.018],
          [mx + 0.140, my - 0.062],
          [mx, my - 0.070],
          [mx - 0.140, my - 0.062],
          [mx - 0.172, my + 0.018],
        ],
        0.017,
        0.030,
        36
      ),
      blackMat
    )
  );
  gritMouth.add(
    new THREE.Mesh(
      buildProjectedTubeGeo(
        [
          [mx - 0.155, my - 0.026],
          [mx, my - 0.034],
          [mx + 0.155, my - 0.026],
        ],
        0.010,
        0.029,
        18
      ),
      blackMat
    )
  );
  gritMouth.visible = false;
  face.add(gritMouth);

  // Panic / O-gasp mouth strictly projected outside torso shell
  const panicMouth = new THREE.Group();
  panicMouth.position.copy(projectOntoTorsoFront(mx, my - 0.025, 0.022));
  addWithOutline(
    panicMouth,
    new THREE.SphereGeometry(0.088, 22, 16).scale(0.86, 1.05, 0.35),
    mouthInMat,
    0.024
  );
  panicMouth.visible = false;
  face.add(panicMouth);

  return { face, eyes, happyMouth, gritMouth, panicMouth };
}

/**
 * 3D Cartoon Action Props (hoverboard, twin jetpack with flames, combat blaster, scuba gear).
 */
function buildActionProps(goldMat, redMat, slateMat, blueMat, yellowMat) {
  const hoverboard = new THREE.Group();
  const deckGeo = new THREE.CapsuleGeometry(0.18, 0.66, 10, 22);
  deckGeo.rotateZ(Math.PI / 2);
  deckGeo.scale(1, 0.24, 1.05);
  addWithOutline(hoverboard, deckGeo, goldMat, 0.032);
  const stripeGeo = new THREE.CapsuleGeometry(0.09, 0.54, 8, 16);
  stripeGeo.rotateZ(Math.PI / 2);
  stripeGeo.scale(1, 0.26, 0.65);
  stripeGeo.translate(0, 0.012, 0);
  hoverboard.add(new THREE.Mesh(stripeGeo, blueMat));
  hoverboard.visible = false;

  const jetpack = new THREE.Group();
  jetpack.position.set(0, 0.05, -0.37);
  const flames = [];
  const flameOuterMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  const flameInnerMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  for (const s of [-1, 1]) {
    const tank = new THREE.CapsuleGeometry(0.11, 0.34, 10, 18);
    tank.translate(s * 0.14, 0, 0);
    addWithOutline(jetpack, tank, redMat, 0.030);
    const nozzle = new THREE.ConeGeometry(0.09, 0.14, 16);
    nozzle.translate(s * 0.14, -0.25, 0);
    addWithOutline(jetpack, nozzle, slateMat, 0.026);

    const fGroup = new THREE.Group();
    fGroup.position.set(s * 0.14, -0.31, 0);
    const outerCone = new THREE.ConeGeometry(0.075, 0.28, 14);
    outerCone.rotateX(Math.PI);
    outerCone.translate(0, -0.13, 0);
    addWithOutline(fGroup, outerCone, flameOuterMat, 0.022);
    const innerCone = new THREE.ConeGeometry(0.04, 0.16, 12);
    innerCone.rotateX(Math.PI);
    innerCone.translate(0, -0.09, 0.01);
    fGroup.add(new THREE.Mesh(innerCone, flameInnerMat));
    jetpack.add(fGroup);
    flames.push(fGroup);
  }
  jetpack.visible = false;

  // Compact Cartoon Twin-Grip Blaster / Control Rig seated cleanly below face line
  const blaster = new THREE.Group();
  blaster.position.set(0, -0.26, 0.58);
  const body = new THREE.CapsuleGeometry(0.085, 0.38, 10, 16);
  body.rotateX(Math.PI * 0.5);
  addWithOutline(blaster, body, slateMat, 0.028);
  const tip = new THREE.CylinderGeometry(0.065, 0.08, 0.14, 16);
  tip.rotateX(Math.PI * 0.5);
  tip.translate(0, 0, 0.24);
  addWithOutline(blaster, tip, blueMat, 0.026);
  const coreBand = new THREE.CylinderGeometry(0.092, 0.092, 0.12, 16);
  coreBand.rotateX(Math.PI * 0.5);
  addWithOutline(blaster, coreBand, goldMat, 0.022);
  blaster.visible = false;

  // Curved Twin-Lens Scuba Goggles & Snorkel for Deep Feeder swimmer
  const scuba = new THREE.Group();
  const visorMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.42 });
  for (const s of [-1, 1]) {
    const rim = new THREE.TorusGeometry(0.135, 0.026, 12, 24);
    rim.scale(0.95, 1.12, 1);
    rim.translate(s * 0.132 + 0.016, 0.195, 0.415);
    addWithOutline(scuba, rim, slateMat, 0.022);
    const lens = new THREE.CylinderGeometry(0.125, 0.125, 0.03, 20);
    lens.rotateX(Math.PI * 0.5);
    lens.scale(0.95, 1.12, 1);
    lens.translate(s * 0.132 + 0.016, 0.195, 0.412);
    scuba.add(new THREE.Mesh(lens, visorMat));
  }

  const snkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.34, -0.06, 0.30),
    new THREE.Vector3(-0.46, 0.02, 0.18),
    new THREE.Vector3(-0.48, 0.46, 0.12),
  ]);
  addWithOutline(scuba, new THREE.TubeGeometry(snkCurve, 18, 0.042, 10, false), yellowMat, 0.024);
  scuba.visible = false;

  return { hoverboard, jetpack, flames, blaster, scuba };
}

class Hero3DSingleton {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = VIEW_SIZE;
    this.canvas.height = VIEW_SIZE;

    // Offscreen bilinear mip pyramid canvases for anti-aliased scaling down to 36..140px game sprites
    this.mip256 = document.createElement('canvas');
    this.mip256.width = 256;
    this.mip256.height = 256;
    this.ctx256 = this.mip256.getContext('2d');
    this.ctx256.imageSmoothingEnabled = true;
    this.ctx256.imageSmoothingQuality = 'high';

    this.mip128 = document.createElement('canvas');
    this.mip128.width = 128;
    this.mip128.height = 128;
    this.ctx128 = this.mip128.getContext('2d');
    this.ctx128.imageSmoothingEnabled = true;
    this.ctx128.imageSmoothingQuality = 'high';

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(VIEW_SIZE, VIEW_SIZE, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.2, 20);
    this.camera.position.set(0, 1.06, 5.15);
    this.camera.lookAt(0, 0.94, 0);

    // Saturated Pristine Weebl Cel Materials
    this.greenMat = createWeeblCelMaterial(0x3be02c, 0x169c22, { rimHex: 0xecfccb, rimStrength: 0.26 });
    this.soleMat = createWeeblCelMaterial(0x1e293b, 0x09090b, { rimStrength: 0 });
    this.goldMat = createWeeblCelMaterial(0xfde047, 0xd97706, { rimHex: 0xfef9c3, rimStrength: 0.28 });
    this.amberMat = createWeeblCelMaterial(0xf59e0b, 0xb45309, { rimStrength: 0.1 });
    this.redMat = createWeeblCelMaterial(0xef4444, 0xb91c1c, { rimHex: 0xfecdd3, rimStrength: 0.2 });
    this.slateMat = createWeeblCelMaterial(0x64748b, 0x334155, { rimStrength: 0.15 });
    this.blueMat = createWeeblCelMaterial(0x38bdf8, 0x0284c7, { rimHex: 0xe0f2fe, rimStrength: 0.25 });
    this.orangeMat = createWeeblCelMaterial(0xf97316, 0xc2410c, { rimStrength: 0.15 });
    this.whiteGlossMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Character Root Hierarchy (ground feet origin y = 0)
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.pelvis = new THREE.Group();
    this.pelvis.position.set(0, 0.99, 0);
    this.root.add(this.pelvis);

    this.torsoPivot = new THREE.Group();
    this.pelvis.add(this.torsoPivot);

    addWithOutline(this.torsoPivot, buildKidneyTorsoGeometry(), this.greenMat, 0.045);
    this.torsoPivot.add(createBeanGlossHighlights());

    this.faceRig = buildFaceRig(this.greenMat);
    this.torsoPivot.add(this.faceRig.face);

    // Tilted 5-point crown perched upper-right
    this.crownPivot = new THREE.Group();
    this.crownPivot.position.set(0.115, 0.565, 0.012);
    this.crownPivot.rotation.set(0.08, 0.14, -0.34);
    this.crownPivot.add(buildCrownRig(this.goldMat, this.amberMat, this.whiteGlossMat));
    this.torsoPivot.add(this.crownPivot);

    // Articulated limbs
    this.leftArm = buildArmRig(1, this.greenMat);
    this.leftArm.shoulder.position.set(-0.39, 0.06, 0.02);
    this.torsoPivot.add(this.leftArm.shoulder);

    this.rightArm = buildArmRig(-1, this.greenMat);
    this.rightArm.shoulder.position.set(0.42, 0.04, 0.02);
    this.torsoPivot.add(this.rightArm.shoulder);

    this.leftLeg = buildLegRig(-1, this.greenMat, this.soleMat, this.orangeMat);
    this.leftLeg.hip.position.set(-0.195, -0.56, 0);
    this.pelvis.add(this.leftLeg.hip);

    this.rightLeg = buildLegRig(1, this.greenMat, this.soleMat, this.orangeMat);
    this.rightLeg.hip.position.set(0.205, -0.56, 0);
    this.pelvis.add(this.rightLeg.hip);

    this.props = buildActionProps(this.goldMat, this.redMat, this.slateMat, this.blueMat, this.goldMat);
    this.root.add(this.props.hoverboard);
    this.torsoPivot.add(this.props.jetpack);
    this.torsoPivot.add(this.props.blaster);
    this.torsoPivot.add(this.props.scuba);
  }

  applyPose(opts = {}) {
    const view = opts.view || 'front';
    const state = opts.state || 'idle';
    const expr = opts.expr || 'happy';
    const prop = opts.prop;
    const skinColor = opts.skinColor || null;
    const t = Number.isFinite(opts.t) ? opts.t : 0;
    const lean = Number.isFinite(opts.lean) ? opts.lean : 0;
    const lookX = Number.isFinite(opts.lookX) ? opts.lookX : 0;
    const dir = opts.dir < 0 ? -1 : 1;
    const squashX = Number.isFinite(opts.squashX) && opts.squashX > 0.1 ? opts.squashX : 1;
    const squashY = Number.isFinite(opts.squashY) && opts.squashY > 0.1 ? opts.squashY : 1;
    const recoil = Number.isFinite(opts.recoil) ? Math.max(0, Math.min(1, opts.recoil)) : 0;
    const yaw = Number.isFinite(opts.yaw) ? opts.yaw : undefined;
    const pitch = Number.isFinite(opts.pitch) ? opts.pitch : undefined;

    if (skinColor) {
      this.greenMat.uniforms.uBaseColor.value.set(skinColor);
      this.greenMat.uniforms.uShadowColor.value.set(skinColor).multiplyScalar(0.58);
    } else {
      this.greenMat.uniforms.uBaseColor.value.setHex(0x3be02c);
      this.greenMat.uniforms.uShadowColor.value.setHex(0x169c22);
    }

    const viewCfg = HERO_3D_VIEWS[view] || HERO_3D_VIEWS.front;
    let targetYaw = yaw !== undefined ? yaw : viewCfg.yaw * dir;
    let targetPitch = pitch !== undefined ? pitch : viewCfg.pitch;

    // Cleanly reset all joints before applying active state pose
    this.pelvis.position.set(0, 0.99, 0);
    this.pelvis.rotation.set(0, 0, 0);
    this.torsoPivot.rotation.set(0, 0, 0);
    this.torsoPivot.position.set(0, 0, 0);
    this.root.scale.set(squashX, squashY, squashX);
    this.crownPivot.rotation.set(0.08, 0.14, -0.34);

    for (const arm of [this.leftArm, this.rightArm]) {
      arm.shoulder.rotation.set(0, 0, 0);
      arm.elbow.rotation.set(0, 0, 0);
      arm.wrist.rotation.set(0, 0, 0);
    }
    for (const leg of [this.leftLeg, this.rightLeg]) {
      leg.hip.rotation.set(0, 0, 0);
      leg.knee.rotation.set(0, 0, 0);
      leg.ankle.rotation.set(0, 0, 0);
      leg.flipperGroup.visible = state === 'swim' || prop === 'scuba';
    }

    this.props.hoverboard.visible = prop === 'hoverboard' || (state === 'surf' && prop !== 'none');
    this.props.jetpack.visible = prop === 'jetpack' || (state === 'jetpack' && prop !== 'none');
    this.props.blaster.visible = prop === 'blaster' || (state === 'turret_fire' && prop !== 'none');
    this.props.scuba.visible = prop === 'scuba' || (state === 'swim' && prop !== 'none');
    this.props.hoverboard.position.set(0, 0.08, 0);
    this.props.hoverboard.rotation.set(0, 0, 0);
    this.props.blaster.position.set(0, -0.26, 0.58 - recoil * 0.10);
    this.props.blaster.rotation.set(-recoil * 0.14, 0, 0);

    for (let i = 0; i < this.props.flames.length; i++) {
      const fScale = 0.78 + 0.34 * Math.abs(Math.sin(t * 22 + i));
      this.props.flames[i].scale.set(1, fScale, 1);
    }

    const setOpenHands = (lOpen, rOpen) => {
      this.leftArm.openHand.visible = lOpen;
      this.leftArm.fistHand.visible = !lOpen;
      this.rightArm.openHand.visible = rOpen;
      this.rightArm.fistHand.visible = !rOpen;
    };

    if (state === 'turret_fire') {
      // Zombie Fortress Gunner: hunched combat stance gripping blaster below face with recoil kick!
      setOpenHands(false, false);
      const kickBounce = recoil * 0.08 + Math.sin(t * 5) * 0.025;
      this.pelvis.position.y = 0.90 - recoil * 0.05;
      this.torsoPivot.rotation.set(0.18 - recoil * 0.16, 0, Math.sin(t * 14) * recoil * 0.06);
      this.crownPivot.rotation.z = -0.34 - recoil * 0.08;

      this.leftArm.shoulder.rotation.set(-1.12 - kickBounce, 0.38, -0.10);
      this.leftArm.elbow.rotation.set(-0.68, 0.32, 0.42);
      this.rightArm.shoulder.rotation.set(-1.12 - kickBounce, -0.38, 0.10);
      this.rightArm.elbow.rotation.set(-0.68, -0.32, -0.42);

      this.leftLeg.hip.rotation.set(-0.28, 0, -0.18);
      this.leftLeg.knee.rotation.set(0.42, 0, 0);
      this.rightLeg.hip.rotation.set(-0.12, 0, 0.18);
      this.rightLeg.knee.rotation.set(0.32, 0, 0);
    } else if (state === 'pilot') {
      // Void Eater / Cockpit Pilot: seated lean forward gripping steering controls & banking into turns
      setOpenHands(false, false);
      const rev = Math.sin(t * 5) * 0.04;
      this.pelvis.position.y = 0.94 + rev;
      this.torsoPivot.rotation.set(0.24, -lean * 0.65, -lean * 0.55);

      this.leftArm.shoulder.rotation.set(-1.12, -0.25, -0.22);
      this.leftArm.elbow.rotation.set(-0.55, 0, 0.2);
      this.rightArm.shoulder.rotation.set(-1.12, 0.25, 0.22);
      this.rightArm.elbow.rotation.set(-0.55, 0, -0.2);

      this.leftLeg.hip.rotation.set(-0.85, 0, -0.18);
      this.leftLeg.knee.rotation.set(0.75, 0, 0);
      this.rightLeg.hip.rotation.set(-0.85, 0, 0.18);
      this.rightLeg.knee.rotation.set(0.75, 0, 0);
    } else if (state === 'aim_pull') {
      // Citadel Siege Slingshot Draw: crouched athletic tension pulling pouch back with both fists
      setOpenHands(false, false);
      const strain = Math.sin(t * 14) * 0.025;
      this.pelvis.position.y = 0.87;
      this.torsoPivot.rotation.set(-0.28, -0.32, -0.14 + strain);
      this.crownPivot.rotation.z = -0.44;

      this.leftArm.shoulder.rotation.set(-1.15, -0.4, -0.15);
      this.leftArm.elbow.rotation.set(-0.25, 0, 0.15);
      this.rightArm.shoulder.rotation.set(-0.92, 0.25, 0.55);
      this.rightArm.elbow.rotation.set(-1.12, 0, 0.18);

      this.leftLeg.hip.rotation.set(-0.48, 0, -0.24);
      this.leftLeg.knee.rotation.set(0.78, 0, 0);
      this.rightLeg.hip.rotation.set(0.28, 0, 0.20);
      this.rightLeg.knee.rotation.set(0.45, 0, 0);
    } else if (state === 'throw') {
      // Dynamic snap-forward launch follow-through
      setOpenHands(true, false);
      this.pelvis.position.y = 1.03;
      this.torsoPivot.rotation.set(0.28, 0.35, -0.10);
      this.leftArm.shoulder.rotation.set(0.55, 0, -0.65);
      this.rightArm.shoulder.rotation.set(-1.85, 0, 0.28);
      this.rightArm.elbow.rotation.set(-0.18, 0, 0);
    } else if (state === 'steer_fire') {
      // Block Buster Carriage Operator: leaning with sled movement, spotting up & pumping trigger!
      setOpenHands(true, false);
      const spotY = Math.sin(t * 6) * 0.08;
      this.pelvis.position.y = 0.96;
      this.torsoPivot.rotation.set(0.08, -lean * 0.45, -lean * 0.55);

      this.leftArm.shoulder.rotation.set(-1.45, 0, -1.25 - spotY);
      this.leftArm.elbow.rotation.set(-0.35, 0, -0.2);
      this.rightArm.shoulder.rotation.set(0.25, 0, 0.55);
      this.rightArm.elbow.rotation.set(-0.85, 0, 0.35);

      this.leftLeg.hip.rotation.set(-0.18, 0, -0.22);
      this.leftLeg.knee.rotation.set(0.32, 0, 0);
      this.rightLeg.hip.rotation.set(0.18, 0, 0.22);
      this.rightLeg.knee.rotation.set(0.32, 0, 0);
    } else if (state === 'balance' || state === 'drop_push') {
      // Fruit Merge Acrobat: wide-armed balance on rolling candy, snapping down into a stomp push on release!
      const isPush = state === 'drop_push';
      setOpenHands(true, true);
      this.pelvis.position.y = isPush ? 0.86 : 0.93;
      this.torsoPivot.rotation.set(isPush ? 0.34 : 0.08, 0, -lean * 0.72 + (isPush ? 0 : Math.sin(t * 5) * 0.06));

      this.leftArm.shoulder.rotation.set(isPush ? -0.95 : 0.1, 0, isPush ? -0.75 : -1.78 - lean * 0.6);
      this.rightArm.shoulder.rotation.set(isPush ? -0.95 : 0.1, 0, isPush ? 0.75 : 1.78 - lean * 0.6);
      this.leftLeg.hip.rotation.set(-0.28, 0, -0.32);
      this.leftLeg.knee.rotation.set(0.55, 0, 0);
      this.rightLeg.hip.rotation.set(-0.28, 0, 0.32);
      this.rightLeg.knee.rotation.set(0.55, 0, 0);
    } else if (state === 'wobble') {
      // Tower Slice Tightrope Wobble: frantic windmilling arms & shaky knees!
      setOpenHands(true, true);
      const flail = Math.sin(t * 16);
      this.pelvis.position.y = 0.94 + Math.abs(flail) * 0.04;
      this.torsoPivot.rotation.set(-0.08, flail * 0.24, flail * 0.28);
      this.leftArm.shoulder.rotation.set(flail * 0.65, 0, -1.75 + flail * 0.55);
      this.rightArm.shoulder.rotation.set(-flail * 0.65, 0, 1.75 + flail * 0.55);
      this.leftLeg.hip.rotation.set(-0.25, 0, -0.36);
      this.leftLeg.knee.rotation.set(0.45, 0, 0);
      this.rightLeg.hip.rotation.set(-0.25, 0, 0.36);
      this.rightLeg.knee.rotation.set(0.45, 0, 0);
    } else if (state === 'hop_leap') {
      // Crossy Road Forward Leap: tucked knees & outstretched dive arms!
      setOpenHands(true, true);
      this.pelvis.position.y = 1.04;
      this.torsoPivot.rotation.set(0.32, 0, -lean * 0.35);
      this.leftArm.shoulder.rotation.set(-1.35, 0, -0.55);
      this.leftArm.elbow.rotation.set(-0.35, 0, 0);
      this.rightArm.shoulder.rotation.set(-1.35, 0, 0.55);
      this.rightArm.elbow.rotation.set(-0.35, 0, 0);
      this.leftLeg.hip.rotation.set(-0.92, 0, -0.22);
      this.leftLeg.knee.rotation.set(1.55, 0, 0);
      this.rightLeg.hip.rotation.set(-0.85, 0, 0.22);
      this.rightLeg.knee.rotation.set(1.50, 0, 0);
    } else if (state === 'fall_dive') {
      // Doodle Jump Rapid Descent: arms & legs scrambling upward!
      setOpenHands(true, true);
      const kick = Math.sin(t * 16);
      this.pelvis.position.y = 1.02;
      this.torsoPivot.rotation.set(-0.18, 0, lean * 0.4);
      this.leftArm.shoulder.rotation.set(0, 0, -2.55 + kick * 0.32);
      this.rightArm.shoulder.rotation.set(0, 0, 2.55 + kick * 0.32);
      this.leftLeg.hip.rotation.set(-0.35 + kick * 0.35, 0, -0.24);
      this.leftLeg.knee.rotation.set(0.55, 0, 0);
      this.rightLeg.hip.rotation.set(-0.35 - kick * 0.35, 0, 0.24);
      this.rightLeg.knee.rotation.set(0.55, 0, 0);
    } else if (state === 'swim') {
      // Deep Feeder Scuba Swimmer: streamlined buoyant swim stroke + trailing flutter kick
      setOpenHands(true, true);
      const stroke = Math.sin(t * 7.5);
      const kick = Math.sin(t * 11);
      this.pelvis.position.y = 1.18 + Math.sin(t * 3) * 0.04;
      this.torsoPivot.rotation.set(0.68, 0, -lean * 0.35);
      this.leftArm.shoulder.rotation.set(-0.95 + stroke * 0.50, 0, -0.62 - stroke * 0.30);
      this.leftArm.elbow.rotation.set(-0.42, 0, 0);
      this.rightArm.shoulder.rotation.set(-0.95 - stroke * 0.50, 0, 0.62 + stroke * 0.30);
      this.rightArm.elbow.rotation.set(-0.42, 0, 0);

      this.leftLeg.hip.rotation.set(-0.62 + kick * 0.38, 0, -0.14);
      this.leftLeg.knee.rotation.set(0.24 + Math.max(0, kick) * 0.28, 0, 0);
      this.rightLeg.hip.rotation.set(-0.62 - kick * 0.38, 0, 0.14);
      this.rightLeg.knee.rotation.set(0.24 + Math.max(0, -kick) * 0.28, 0, 0);
    } else if (state === 'run' || state === 'walk') {
      const freq = state === 'run' ? t : t * 0.72;
      const stride = Math.sin(freq);
      const liftL = Math.max(0, Math.sin(freq + Math.PI * 0.45));
      const liftR = Math.max(0, Math.sin(freq + Math.PI * 1.45));
      const bounce = Math.abs(Math.cos(freq)) * 0.08;

      setOpenHands(false, false);
      this.pelvis.position.y = 0.96 + bounce;
      this.torsoPivot.rotation.x = state === 'run' ? 0.25 : 0.10;
      this.torsoPivot.rotation.y = stride * 0.16;
      this.torsoPivot.rotation.z = -lean * 0.42;

      this.leftLeg.hip.rotation.set(-stride * 0.78, 0, -0.08);
      this.leftLeg.knee.rotation.set(liftL * 1.42 + 0.14, 0, 0);
      this.leftLeg.ankle.rotation.set(-liftL * 0.45, 0, 0);

      this.rightLeg.hip.rotation.set(stride * 0.78, 0, 0.08);
      this.rightLeg.knee.rotation.set(liftR * 1.42 + 0.14, 0, 0);
      this.rightLeg.ankle.rotation.set(-liftR * 0.45, 0, 0);

      this.leftArm.shoulder.rotation.set(stride * 0.88, 0, -0.50);
      this.leftArm.elbow.rotation.set(-0.98 - stride * 0.24, 0, -0.28);
      this.rightArm.shoulder.rotation.set(-stride * 0.88, 0, 0.50);
      this.rightArm.elbow.rotation.set(-0.98 + stride * 0.24, 0, 0.28);

      this.crownPivot.rotation.z = -0.34 - Math.sin(freq * 2) * 0.05;
    } else if (state === 'jump' || state === 'jump_launch') {
      setOpenHands(true, true);
      const w = Math.sin(t * 2);
      this.pelvis.position.y = 1.04;
      this.torsoPivot.rotation.set(0.14, 0, -lean * 0.38);

      this.leftArm.shoulder.rotation.set(-0.4, 0, -2.25 + w * 0.14);
      this.leftArm.elbow.rotation.set(-0.3, 0, -0.25);
      this.rightArm.shoulder.rotation.set(-0.4, 0, 2.25 - w * 0.14);
      this.rightArm.elbow.rotation.set(-0.3, 0, 0.25);

      this.leftLeg.hip.rotation.set(-0.72, 0, -0.16);
      this.leftLeg.knee.rotation.set(1.22, 0, 0);
      this.rightLeg.hip.rotation.set(-0.25, 0, 0.16);
      this.rightLeg.knee.rotation.set(0.88, 0, 0);
    } else if (state === 'slide') {
      setOpenHands(false, true);
      this.pelvis.position.y = 0.72;
      this.torsoPivot.rotation.set(-0.46, 0.58, -0.16);

      this.leftLeg.hip.rotation.set(-1.32, 0.22, -0.32);
      this.leftLeg.knee.rotation.set(0.28, 0, 0);
      this.rightLeg.hip.rotation.set(-0.62, -0.35, 0.62);
      this.rightLeg.knee.rotation.set(1.45, 0, 0);

      this.leftArm.shoulder.rotation.set(-0.35, 0, -0.95);
      this.leftArm.elbow.rotation.set(-0.6, 0, -0.3);
      this.rightArm.shoulder.rotation.set(0.25, 0, 1.35);
      this.rightArm.elbow.rotation.set(-0.35, 0, 0.25);
    } else if (state === 'surf') {
      setOpenHands(true, false);
      const carve = Math.sin(t * 1.4) * 0.12;
      this.pelvis.position.y = 1.06;
      this.props.hoverboard.position.set(0, 0.12, 0);
      this.props.hoverboard.rotation.set(0.06, -0.58, lean * 0.38);

      this.torsoPivot.rotation.set(0.06, -1.34, -lean * 0.30 + carve * 0.35);
      this.leftLeg.hip.rotation.set(-0.20, -0.62, -0.34);
      this.leftLeg.knee.rotation.set(0.40, 0, 0);
      this.rightLeg.hip.rotation.set(0.16, -0.62, 0.36);
      this.rightLeg.knee.rotation.set(0.42, 0, 0);

      this.leftArm.shoulder.rotation.set(0.05, 0, -1.72 - carve);
      this.leftArm.elbow.rotation.set(-0.22, 0, -0.22);
      this.rightArm.shoulder.rotation.set(-0.08, 0, 1.55 + carve);
      this.rightArm.elbow.rotation.set(-0.30, 0, 0.22);
    } else if (state === 'jetpack') {
      setOpenHands(false, false);
      const hover = Math.sin(t * 2.2) * 0.04;
      this.pelvis.position.y = 1.06 + hover;
      this.torsoPivot.rotation.set(0.44, 0, -lean * 0.48);

      this.leftArm.shoulder.rotation.set(-0.85, 0, -1.35);
      this.leftArm.elbow.rotation.set(-0.35, 0, -0.18);
      this.rightArm.shoulder.rotation.set(-0.85, 0, 1.35);
      this.rightArm.elbow.rotation.set(-0.35, 0, 0.18);

      this.leftLeg.hip.rotation.set(0.48, 0, -0.14);
      this.leftLeg.knee.rotation.set(0.55, 0, 0);
      this.rightLeg.hip.rotation.set(0.68, 0, 0.14);
      this.rightLeg.knee.rotation.set(0.32, 0, 0);
    } else if (state === 'hurt' || state === 'dead') {
      setOpenHands(true, true);
      targetYaw = 0;
      targetPitch = 0.14;
      this.pelvis.position.y = 0.80;
      this.torsoPivot.rotation.set(-0.22, 0, Math.sin(t * 2) * 0.18);
      this.crownPivot.rotation.z = -0.62;
      this.leftArm.shoulder.rotation.set(-0.2, 0, -1.75);
      this.rightArm.shoulder.rotation.set(-0.2, 0, 1.75);
      this.leftLeg.hip.rotation.set(-1.32, 0.15, -0.45);
      this.leftLeg.knee.rotation.set(0.28, 0, 0);
      this.rightLeg.hip.rotation.set(-1.26, -0.15, 0.45);
      this.rightLeg.knee.rotation.set(0.34, 0, 0);
    } else if (state === 'cheer') {
      setOpenHands(true, true);
      const hop = Math.abs(Math.sin(t * 2.5)) * 0.12;
      this.pelvis.position.y = 0.99 + hop;
      this.torsoPivot.rotation.set(-0.04, Math.sin(t * 1.4) * 0.16, Math.sin(t * 2.5) * 0.06);
      this.leftArm.shoulder.rotation.set(0, 0, -2.35 + Math.sin(t * 6) * 0.24);
      this.leftArm.elbow.rotation.set(-0.25, 0, -0.2);
      this.rightArm.shoulder.rotation.set(0, 0, 2.35 - Math.sin(t * 6) * 0.24);
      this.rightArm.elbow.rotation.set(-0.25, 0, 0.2);
    } else if (state === 'stand_alert') {
      // Action-ready boxer bounce (no Chuck E Cheese waving in non-menu games!)
      const bob = Math.abs(Math.sin(t * 3.5)) * 0.045;
      setOpenHands(false, false);
      this.pelvis.position.y = 0.95 + bob;
      this.torsoPivot.rotation.set(0.10, -lean * 0.35, -lean * 0.35);

      this.leftArm.shoulder.rotation.set(-0.55, 0, -0.42);
      this.leftArm.elbow.rotation.set(-1.25, 0, 0.25);
      this.rightArm.shoulder.rotation.set(-0.55, 0, 0.42);
      this.rightArm.elbow.rotation.set(-1.25, 0, -0.25);

      this.leftLeg.hip.rotation.set(-0.18, 0, -0.18);
      this.leftLeg.knee.rotation.set(0.34, 0, 0);
      this.rightLeg.hip.rotation.set(0.12, 0, 0.18);
      this.rightLeg.knee.rotation.set(0.28, 0, 0);
    } else {
      // Official Signature Front Greeting Pose from hero-bean-map.png
      const wave = Math.sin(t * 3.4);
      const breathe = Math.sin(t * 2.2) * 0.025;
      setOpenHands(true, false);
      this.pelvis.position.y = 0.99 + breathe;
      this.torsoPivot.rotation.z = Math.sin(t * 1.1) * 0.025;

      this.leftArm.shoulder.rotation.set(0, 0, -1.62 + wave * 0.14);
      this.leftArm.elbow.rotation.set(0, 0, -0.96 + wave * 0.18);
      this.leftArm.wrist.rotation.set(0.18, 0.25, wave * 0.20);

      this.rightArm.shoulder.rotation.set(0, 0, 1.32);
      this.rightArm.elbow.rotation.set(0, 0, 1.62 + Math.sin(t * 2.2) * 0.06);
      this.rightArm.wrist.rotation.set(0, 0, 0);

      this.leftLeg.hip.rotation.set(0, 0, -0.05);
      this.leftLeg.knee.rotation.set(0.05, 0, 0);
      this.rightLeg.hip.rotation.set(0, 0, 0.05);
      this.rightLeg.knee.rotation.set(0.05, 0, 0);
    }

    // Expressions + Eye Look + Blink
    const effectiveExpr = state === 'dead' || state === 'hurt' ? 'dizzy' : expr;
    const isBlink = effectiveExpr !== 'dizzy' && Math.sin(t * 0.9) > 0.975;
    const pupilOffset = Math.max(-0.032, Math.min(0.032, lookX * 0.032));

    for (const e of this.faceRig.eyes) {
      e.lid.visible = isBlink;
      e.dizzyGroup.visible = effectiveExpr === 'dizzy';
      e.pupilGroup.visible = effectiveExpr !== 'dizzy' && !isBlink;
      e.pupilGroup.position.x = pupilOffset;
      e.pupilGroup.position.y = effectiveExpr === 'panic' ? 0.006 : -0.004;
      e.pupilGroup.scale.setScalar(effectiveExpr === 'panic' ? 0.72 : 1);

      if (effectiveExpr === 'focus') {
        e.browPivot.position.y = e.baseY - 0.022;
        e.browPivot.rotation.z = -e.side * 0.24;
      } else if (effectiveExpr === 'panic' || effectiveExpr === 'dizzy') {
        e.browPivot.position.y = e.baseY + 0.030;
        e.browPivot.rotation.z = e.side * 0.26;
      } else {
        e.browPivot.position.y = e.baseY;
        e.browPivot.rotation.z = e.side * 0.08;
      }
    }

    const useGrit =
      effectiveExpr === 'focus' &&
      (state === 'turret_fire' || state === 'aim_pull' || state === 'steer_fire' || state === 'wobble');
    this.faceRig.happyMouth.visible = !useGrit && (effectiveExpr === 'happy' || effectiveExpr === 'focus');
    this.faceRig.gritMouth.visible = useGrit;
    this.faceRig.panicMouth.visible = effectiveExpr === 'panic' || effectiveExpr === 'dizzy';

    const camDist = 5.15;
    const targetY = 0.98;
    const cosP = Math.cos(targetPitch);
    this.camera.position.set(
      Math.sin(targetYaw) * cosP * camDist,
      targetY + Math.sin(targetPitch) * camDist,
      Math.cos(targetYaw) * cosP * camDist
    );
    this.camera.lookAt(0, targetY, 0);
  }

  renderToCanvas(opts, destPixelSize = 128) {
    this.applyPose(opts);
    this.renderer.render(this.scene, this.camera);

    // Multi-step high-quality mip downsample so 512px ink contours never alias at small sprite sizes
    if (destPixelSize <= 96) {
      this.ctx256.clearRect(0, 0, 256, 256);
      this.ctx256.drawImage(this.canvas, 0, 0, VIEW_SIZE, VIEW_SIZE, 0, 0, 256, 256);
      this.ctx128.clearRect(0, 0, 128, 128);
      this.ctx128.drawImage(this.mip256, 0, 0, 256, 256, 0, 0, 128, 128);
      return this.mip128;
    }
    if (destPixelSize <= 190) {
      this.ctx256.clearRect(0, 0, 256, 256);
      this.ctx256.drawImage(this.canvas, 0, 0, VIEW_SIZE, VIEW_SIZE, 0, 0, 256, 256);
      return this.mip256;
    }
    return this.canvas;
  }
}

export function getHero3DSingleton() {
  if (_singleton) return _singleton;
  if (!isHero3DSupported()) return null;
  try {
    _singleton = new Hero3DSingleton();
    return _singleton;
  } catch {
    return null;
  }
}

/**
 * Draws the Pristine-HD cel-shaded 3D Hero Bean onto any 2D Canvas, anchored cleanly at
 * bottom-center feet `(x, y)`. Returns `true` if 3D WebGL rendered cleanly.
 */
export function drawHero3D(ctx, x, y, size = 72, opts = {}) {
  const engine = getHero3DSingleton();
  if (!engine) return false;
  const drawSize = size * 1.48;
  const dprScale = typeof ctx.getTransform === 'function' ? Math.max(1, Math.hypot(ctx.getTransform().a, ctx.getTransform().b)) : 1;
  const imgSource = engine.renderToCanvas(opts, drawSize * dprScale);

  const prevSmooth = ctx.imageSmoothingEnabled;
  const prevQual = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const footAnchorY = 0.865;
  ctx.drawImage(imgSource, x - drawSize * 0.5, y - drawSize * footAnchorY, drawSize, drawSize);

  ctx.imageSmoothingEnabled = prevSmooth;
  ctx.imageSmoothingQuality = prevQual;
  return true;
}
