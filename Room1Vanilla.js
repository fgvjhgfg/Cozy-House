import * as THREE from 'three';

export let onHugCallback = null;
export let onDoorClickCallback = null;
export let onPromptCallback = null;

let scene = null;
let camera = null;

export function initRoom1(parentScene, r3fCamera, onHug, onDoorClick, onPrompt) {
  scene = parentScene;
  camera = r3fCamera;
  onHugCallback = onHug;
  onDoorClickCallback = onDoorClick;
  onPromptCallback = onPrompt;
  gameOn = false;
  activeHug = null;

  
camera.position.set(0, 5, 9);
scene.add(new THREE.AmbientLight(0xFFE8C8, 0.9));
const sun = new THREE.DirectionalLight(0xFFD090, 1.5);
sun.position.set(6, 12, 6);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18 });
sun.shadow.mapSize.set(512, 512);
sun.shadow.bias = -0.001;
scene.add(sun);
const lamp = new THREE.PointLight(0xFFCC60, 1.4, 10);
lamp.position.set(8, 2.4, -8);
scene.add(lamp);
const warmFill = new THREE.PointLight(0xFF8060, 0.7, 22);
warmFill.position.set(-6, 4, -4);
scene.add(warmFill);


  const doorMat = new THREE.MeshStandardMaterial({color: 0x5c3a21});
  const doorGeo = new THREE.BoxGeometry(2, 4, 0.2);
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, 2, -12.9);
  door.name = "Door";
  scene.add(door);
}
"use strict";

// ── Renderer / Scene / Camera / Lights ───────────────────────


















// ── Helpers ───────────────────────────────────────────────────
const M = (hex, r = 0.85, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color: hex, roughness: r, metalness });

function smesh(geo, mat, x, y, z, rx = 0, ry = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, 0);
  o.castShadow = true;
  o.receiveShadow = true;
  scene.add(o);
  return o;
}

// ── Room ──────────────────────────────────────────────────────
function buildRoom() {
  // Пол
  smesh(new THREE.PlaneGeometry(26, 26), M(0xC49258, 0.9), 0, 0, 0, -Math.PI / 2);

  // Доски пола
  for (let i = -12; i < 13; i += 1.8) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 26), M(0xA87840, 0.95));
    p.rotation.x = -Math.PI / 2;
    p.position.set(i, 0.001, 0);
    scene.add(p);
  }

  // ВАЖНО:
  // Потолка нет вообще.
  // Стены сделаны НЕ plane-плоскостями, а тонкими BoxGeometry.
  // Так они не могут случайно лечь горизонтально и висеть над персонажами.
  const wallMat = M(0xFAF0E6, 0.95);
  const wallH = 5.0;
  const wallY = wallH / 2;
  const wallT = 0.22;
  const room = 13;

  // Задняя стена
  smesh(new THREE.BoxGeometry(26, wallH, wallT), wallMat, 0, wallY, -room);

  // Передняя стена
  smesh(new THREE.BoxGeometry(26, wallH, wallT), wallMat, 0, wallY, room);

  // Левая стена
  smesh(new THREE.BoxGeometry(wallT, wallH, 26), wallMat, -room, wallY, 0);

  // Правая стена
  smesh(new THREE.BoxGeometry(wallT, wallH, 26), wallMat, room, wallY, 0);

  // Ковёр
  smesh(new THREE.PlaneGeometry(7, 5), M(0x7A2020, 0.95), 0, 0.003, 0, -Math.PI / 2);

  // Мебель
  buildSofa(-7, 0, 6);
  buildBed(6, 0, -7);

  // Стол
  smesh(new THREE.BoxGeometry(3, 0.1, 1.5), M(0x8B6340, 0.7), 0, 0.58, 6.8);
  [[-1, 6.1], [1, 6.1], [-1, 7.5], [1, 7.5]].forEach(([lx, lz]) =>
    smesh(new THREE.CylinderGeometry(0.05, 0.05, 0.54), M(0x7A5530), lx, 0.27, lz)
  );

  // Торшер
  smesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2), M(0x8B7355, 0.6), 8, 1.1, -8);
  smesh(new THREE.ConeGeometry(0.55, 0.65, 10), M(0xF4C842, 0.5), 8, 2.5, -8);

  // Окно на задней стене
  const windowGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 2.8),
    new THREE.MeshStandardMaterial({
      color: 0xC8E8FF,
      roughness: 0.05,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    })
  );
  windowGlass.position.set(0, 3.2, -12.86);
  scene.add(windowGlass);

  // Простая картина и тумбочка для уюта
  smesh(new THREE.BoxGeometry(1.3, 1.7, 0.06), M(0x5A3924, 0.85), -10.2, 3.1, -12.82);
  smesh(new THREE.BoxGeometry(1.0, 1.25, 0.04), M(0x88A070, 0.9), -10.2, 3.1, -12.78);
  smesh(new THREE.BoxGeometry(1.2, 1.0, 0.55), M(0x7A4A25, 0.8), -10.1, 0.5, -11.6);
}

function buildSofa(x, y, z) {
  const C = 0x8B6B8B;
  const f = (g, c, ox, oy, oz) => smesh(g, M(c), x + ox, y + oy, z + oz);

  f(new THREE.BoxGeometry(4.8, 0.5, 1.7), C, 0, 0.25, 0);
  f(new THREE.BoxGeometry(4.8, 1.35, 0.4), C, 0, 1.17, -0.65);
  f(new THREE.BoxGeometry(4.4, 0.28, 1.5), 0x9B7B9B, 0, 0.64, 0.05);
  f(new THREE.BoxGeometry(0.44, 0.9, 1.7), C, -2.18, 0.7, 0);
  f(new THREE.BoxGeometry(0.44, 0.9, 1.7), C, 2.18, 0.7, 0);
}

function buildBed(x, y, z) {
  const W = 0x8B6340;
  const f = (g, c, ox, oy, oz) => smesh(g, M(c), x + ox, y + oy, z + oz);

  f(new THREE.BoxGeometry(2.4, 0.28, 4.8), W, 0, 0.14, 0);
  f(new THREE.BoxGeometry(2.4, 0.72, 0.18), W, 0, 0.60, -2.3);
  f(new THREE.BoxGeometry(2.4, 0.28, 0.14), W, 0, 0.50, 2.3);

  [[-1, -2.2], [-1, 2.2], [1, -2.2], [1, 2.2]].forEach(([lx, lz]) =>
    f(new THREE.CylinderGeometry(0.08, 0.08, 0.28), W, lx, 0, lz)
  );

  f(new THREE.BoxGeometry(2.2, 0.22, 4.5), 0xF5F0E8, 0, 0.39, 0.05);
  f(new THREE.BoxGeometry(0.9, 0.14, 0.54), 0xEEE8DD, -0.55, 0.55, -1.9);
  f(new THREE.BoxGeometry(0.9, 0.14, 0.54), 0xEEE8DD, 0.55, 0.55, -1.9);
  f(new THREE.BoxGeometry(2.15, 0.1, 1.8), 0xD4C4B0, 0, 0.55, 1.4);
}

// ── Character ─────────────────────────────────────────────────
class Character {
  constructor(isMale, pos) {
    this.isMale = isMale;
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    this.walkPhase = isMale ? 0 : Math.PI;
    this.speed = 0;
    this.targetRotY = 0;
    this.isHugging = false;
    this.parts = {};
    this._build();
    scene.add(this.group);
  }

  _m(h, r = 0.85) {
    return new THREE.MeshStandardMaterial({ color: h, roughness: r });
  }

  _add(geo, col, x, y, z) {
    const m = new THREE.Mesh(geo, this._m(col));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  _build() {
    const SK = 0xFFCBA4;
    const HR = this.isMale ? 0x2E1A0D : 0xE8D08C;
    const EY = this.isMale ? 0x3D2B1F : 0x4A90D9;
    const TP = this.isMale ? 0x6B9FD4 : 0x252525;
    const PT = this.isMale ? 0x2C3545 : 0x8BB0D8;
    const SH = 0xF0F0F0;

    this.parts.head = this._add(new THREE.SphereGeometry(0.225, 14, 10), SK, 0, 1.82, 0);

    if (this.isMale) {
      this._add(new THREE.BoxGeometry(0.38, 0.1, 0.4), HR, 0, 2.02, -0.01);
      this._add(new THREE.BoxGeometry(0.4, 0.15, 0.28), HR, 0, 1.88, -0.09);
    } else {
      this._add(new THREE.BoxGeometry(0.46, 0.14, 0.44), HR, 0, 2.04, 0);
      this._add(new THREE.BoxGeometry(0.42, 0.6, 0.12), HR, 0, 1.60, -0.21);
      this._add(new THREE.BoxGeometry(0.14, 0.55, 0.12), HR, -0.22, 1.52, 0);
      this._add(new THREE.BoxGeometry(0.14, 0.55, 0.12), HR, 0.22, 1.52, 0);
      this._add(new THREE.BoxGeometry(0.4, 0.3, 0.1), HR, 0, 1.18, -0.2);
    }

    [-0.08, 0.08].forEach(dx =>
      this._add(new THREE.SphereGeometry(0.033, 8, 8), EY, dx, 1.83, 0.21)
    );

    this.parts.torso = this._add(new THREE.BoxGeometry(0.44, 0.56, 0.22), TP, 0, 1.27, 0);
    // Грудь Any. Это простые небольшие полусферы/сферы на торсе.
    // Добавляем только женскому персонажу.
    if (!this.isMale) {
      this.parts.chestL = this._add(new THREE.SphereGeometry(0.075, 10, 8), TP, -0.085, 1.34, 0.13);
      this.parts.chestR = this._add(new THREE.SphereGeometry(0.075, 10, 8), TP, 0.085, 1.34, 0.13);
      this.parts.chestL.scale.set(1, 0.75, 0.55);
      this.parts.chestR.scale.set(1, 0.75, 0.55);
    }


    if (this.isMale) {
      this._add(new THREE.BoxGeometry(0.28, 0.09, 0.24), 0xF5F5F5, 0, 1.52, 0.01);
    }

    this.parts.armL = this._makeArm(-0.30, TP, SK);
    this.parts.armR = this._makeArm(0.30, TP, SK);

    this._add(new THREE.BoxGeometry(0.40, 0.13, 0.21), PT, 0, 0.96, 0);

    this.parts.legL = this._makeLeg(-0.11, PT, SH);
    this.parts.legR = this._makeLeg(0.11, PT, SH);
  }

  _makeArm(x, tc, sc) {
    const g = new THREE.Group();
    g.position.set(x, 1.45, 0);

    const mk = (geo, c, y) => {
      const m = new THREE.Mesh(geo, this._m(c));
      m.position.y = y;
      m.castShadow = true;
      g.add(m);
    };

    mk(new THREE.BoxGeometry(0.14, 0.32, 0.14), tc, -0.16);
    mk(new THREE.BoxGeometry(0.13, 0.30, 0.13), tc, -0.47);
    mk(new THREE.SphereGeometry(0.07, 8, 6), sc, -0.68);

    this.group.add(g);
    return g;
  }

  _makeLeg(x, pc, sc) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.9, 0);

    const u = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.44, 0.17), this._m(pc));
    u.position.y = -0.22;
    u.castShadow = true;
    hip.add(u);

    const knee = new THREE.Group();
    knee.position.y = -0.46;
    hip.add(knee);
    hip.userData.knee = knee;

    const l = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.40, 0.15), this._m(pc));
    l.position.y = -0.22;
    l.castShadow = true;
    knee.add(l);

    const f = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.26), this._m(sc, 0.7));
    f.position.set(0, -0.46, 0.06);
    f.castShadow = true;
    knee.add(f);

    this.group.add(hip);
    return hip;
  }

  animate(dt) {
    if (this.isHugging) return;

    const s = Math.min(this.speed, 1);
    this.walkPhase += dt * 7 * s;
    const sw = Math.sin(this.walkPhase) * s;

    this.parts.legL.rotation.x = sw * 0.45;
    this.parts.legR.rotation.x = -sw * 0.45;

    // Во время ведения за руку руки задаёт hand-hold система, а не походка.
    if (!handHoldActive) {
      this.parts.armL.rotation.x = -sw * 0.40;
      this.parts.armR.rotation.x = sw * 0.40;
    }

    this.group.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.03 * s;
  }

  savePose() {
    this._sp = {
      pos: this.group.position.clone(),
      ry: this.group.rotation.y
    };
  }

  restorePose() {
    if (!this._sp) return;

    this.group.position.copy(this._sp.pos);
    this.group.position.y = 0;
    this.group.rotation.set(0, this._sp.ry, 0);

    ["armL", "armR", "legL", "legR"].forEach(k => {
      this.parts[k].rotation.set(0, 0, 0);
      if (this.parts[k].userData.knee) this.parts[k].userData.knee.rotation.set(0, 0, 0);
    });

    this.parts.head.rotation.set(0, 0, 0);
    this.parts.head.position.set(0, 1.82, 0);
    if (this.parts.torso) this.parts.torso.rotation.set(0, 0, 0);
    this.isHugging = false;
  }
}

// ── Hug / Cuddle Pose Library ─────────────────────────────────
// Точки зон: диван и кровать

const SOFA_COLLISION_BOXES = [
  {
    x: 0,
    z: 0,
    w: 2.6,
    d: 1.2
  }
];

function collidesWithSofa(x, z){
  for(const b of SOFA_COLLISION_BOXES){
    if(
      x > b.x - b.w/2 &&
      x < b.x + b.w/2 &&
      z > b.z - b.d/2 &&
      z < b.z + b.d/2
    ){
      return true;
    }
  }
  return false;
}

const SP = new THREE.Vector3(-7, 0, 6);
const BP = new THREE.Vector3(6, 0, -7);

// Это уже не одна поза, а библиотека.
// Каждая поза относится к зоне: floor / sofa / bed.
const POSES = {
  standing_front: {
    zone: "floor",
    label: "❤️  [E] Обнять стоя",
    dur: 4.5,
    fov: 48,
    dist: 3.2,
    ch: 3.0
  },
  standing_close: {
    zone: "floor",
    label: "💕  [E] Крепко обнять",
    dur: 5.2,
    fov: 44,
    dist: 2.9,
    ch: 2.8
  },
  standing_side: {
    zone: "floor",
    label: "🤍  [E] Обнять сбоку",
    dur: 4.8,
    fov: 46,
    dist: 3.1,
    ch: 2.9
  },
  standing_forehead: {
    zone: "floor",
    label: "💗  [E] Прижаться лбами",
    dur: 4.8,
    fov: 42,
    dist: 2.7,
    ch: 2.7
  },

  sofa_side_cuddle: {
    zone: "sofa",
    label: "🛋  [E] Обняться на диване",
    dur: 6.2,
    fov: 44,
    dist: 3.8,
    ch: 2.2
  },
  sofa_shoulder: {
    zone: "sofa",
    label: "🛋  [E] Прильнуть к плечу",
    dur: 6.8,
    fov: 42,
    dist: 3.5,
    ch: 2.0
  },
  sofa_lap_hug: {
    zone: "sofa",
    label: "🛋  [E] Объятие на коленях",
    dur: 6.5,
    fov: 40,
    dist: 3.2,
    ch: 2.0
  },
  sofa_sleepy: {
    zone: "sofa",
    label: "🛋  [E] Сонные объятия",
    dur: 7.4,
    fov: 43,
    dist: 3.6,
    ch: 2.1
  },

  bed_side_by_side: {
    zone: "bed",
    label: "🛏  [E] Лечь рядом",
    dur: 8,
    fov: 50,
    dist: 0,
    ch: 4.5,
    top: true
  },
  bed_spoon: {
    zone: "bed",
    label: "🛏  [E] Ложечкой",
    dur: 8.5,
    fov: 48,
    dist: 0,
    ch: 4.4,
    top: true
  },
  bed_face_to_face: {
    zone: "bed",
    label: "🛏  [E] Обняться лёжа",
    dur: 8.2,
    fov: 47,
    dist: 0,
    ch: 4.3,
    top: true
  },
  bed_head_on_chest: {
    zone: "bed",
    label: "🛏  [E] Голова на груди",
    dur: 8.8,
    fov: 46,
    dist: 0,
    ch: 4.2,
    top: true
  }
};

const POSE_ORDER = {
  floor: ["standing_front", "standing_close", "standing_side", "standing_forehead"],
  sofa: ["sofa_side_cuddle", "sofa_shoulder", "sofa_lap_hug", "sofa_sleepy"],
  bed: ["bed_side_by_side", "bed_spoon", "bed_face_to_face", "bed_head_on_chest"]
};

const poseCycle = { floor: 0, sofa: 0, bed: 0 };

function detectZone(pl, np) {
  if (pl.group.position.distanceTo(np.group.position) > 2.6) return null;
  if (pl.group.position.distanceTo(BP) < 3.7) return "bed";
  if (pl.group.position.distanceTo(SP) < 3.7) return "sofa";
  return "floor";
}

function getPreviewPose(pl, np) {
  const zone = detectZone(pl, np);
  if (!zone) return null;
  return POSE_ORDER[zone][poseCycle[zone] % POSE_ORDER[zone].length];
}

function getNextPose(pl, np) {
  const zone = detectZone(pl, np);
  if (!zone) return null;

  const list = POSE_ORDER[zone];
  const poseName = list[poseCycle[zone] % list.length];
  poseCycle[zone] += 1;

  return poseName;
}



// ── Simple body collision rules ───────────────────────────────
// Для этой примитивной low-poly модели используем не pixel-perfect,
// а понятное правило: центры тел не могут быть ближе минимальной дистанции.
// Это защищает от "Any внутри Vell", как коллизии защищают от стен/мебели.
const BODY_COLLISION_RADIUS = 0.34;
const SOFA_BODY_MIN_DISTANCE = 0.36;

function getBodyXZ(c) {
  return new THREE.Vector2(c.group.position.x, c.group.position.z);
}

function enforceCharacterSeparation(a, b, minDist = BODY_COLLISION_RADIUS * 2) {
  const ax = a.group.position.x;
  const az = a.group.position.z;
  const bx = b.group.position.x;
  const bz = b.group.position.z;

  let dx = bx - ax;
  let dz = bz - az;
  let dist = Math.hypot(dx, dz);

  if (dist < 0.0001) {
    dx = 1;
    dz = 0;
    dist = 1;
  }

  if (dist < minDist) {
    const push = (minDist - dist) * 0.5;
    const nx = dx / dist;
    const nz = dz / dist;

    a.group.position.x -= nx * push;
    a.group.position.z -= nz * push;
    b.group.position.x += nx * push;
    b.group.position.z += nz * push;
  }
}

function enforceSofaNoOverlap(vell, any) {
  // В диванной позе Vell не двигаем сильно: он опора.
  // Any отталкиваем от Vell, если её тело залезло в него.
  const ax = any.group.position.x;
  const az = any.group.position.z;
  const vx = vell.group.position.x;
  const vz = vell.group.position.z;

  let dx = ax - vx;
  let dz = az - vz;
  let dist = Math.hypot(dx, dz);

  if (dist < 0.0001) {
    dx = 1;
    dz = 0;
    dist = 1;
  }

  if (dist < SOFA_BODY_MIN_DISTANCE) {
    const push = (SOFA_BODY_MIN_DISTANCE - dist);
    any.group.position.x += (dx / dist) * push;
    any.group.position.z += (dz / dist) * push;
  }
}



function placeSofaCuddle(pl, np, variant = "side") {
  // V29:
  // Any больше не разбирается на отдельные "сломанные" части.
  // Не крутим torso отдельно.
  // Не сдвигаем голову далеко от тела.
  // Вся Any остаётся цельной моделью, только слегка прислоняется к Vell.

  const vell = pl.isMale ? pl : np;
  const any = pl.isMale ? np : pl;

  const seatY = 0.40;

  // Vell — опора.
  vell.group.position.set(SP.x - 0.34, seatY, SP.z + 0.12);

  // Any сидит рядом, не внутри Vell.
  any.group.scale.set(0.86, 0.86, 0.86);
  any.group.position.set(SP.x + 0.16, seatY, SP.z + 0.12);

  // Vell ровно.
  vell.group.rotation.set(0, 0, 0);

  // Any наклоняется к Vell ЦЕЛИКОМ, очень мягко.
  // Это сохраняет её как цельного персонажа, а не набор деталей.
  any.group.rotation.set(0, 0, 0.10);

  sitLegs90(vell);
  sitLegs90(any);

  // Сброс частей в нормальные базовые позиции.
  vell.parts.torso.rotation.set(0, 0, 0);
  vell.parts.head.position.set(0, 1.82, 0);
  vell.parts.head.rotation.set(0, 0, -0.04);

  any.parts.torso.rotation.set(0, 0, 0);
  any.parts.head.position.set(-0.02, 1.72, 0);
  any.parts.head.rotation.set(0.02, 0, 0.18);

  // Руки спокойные. Vell чуть обнимает Any.
  vell.parts.armR.rotation.set(0.04, 0, -0.55);
  vell.parts.armL.rotation.set(0.02, 0, 0.08);

  any.parts.armL.rotation.set(0.03, 0, 0.18);
  any.parts.armR.rotation.set(0.03, 0, -0.08);

  if (variant === "shoulder") {
    // Более близкая версия: Any всё ещё цельная, просто сидит ближе.
    any.group.position.set(SP.x + 0.02, seatY, SP.z + 0.12);
    any.group.rotation.set(0, 0, 0.14);
    any.parts.head.rotation.set(0.02, 0, 0.24);
    vell.parts.armR.rotation.set(0.04, 0, -0.62);
  }

  if (variant === "lap") {
    // Не делаем колени/посадку на колени — на этой модели это ломает геометрию.
    // Оставляем близкую сидячую cuddle-позу.
    any.group.position.set(SP.x + 0.00, seatY, SP.z + 0.16);
    any.group.rotation.set(0, 0, 0.14);
    any.parts.head.rotation.set(0.02, 0, 0.24);
    vell.parts.armR.rotation.set(0.05, 0, -0.64);
  }

  if (variant === "sleepy") {
    any.group.position.set(SP.x + 0.00, seatY, SP.z + 0.14);
    any.group.rotation.set(0, 0, 0.16);
    any.parts.head.rotation.set(0.03, 0, 0.28);
    vell.parts.head.rotation.set(0, 0, -0.06);
    vell.parts.armR.rotation.set(0.06, 0, -0.68);
  }

  // Мягкая защита от залезания тел друг в друга.
  enforceSofaNoOverlap(vell, any);
}


function sitLegs90(c) {
  // Ноги 90°:
  // бедро почти горизонтально вперёд,
  // голень вниз.
  c.parts.legL.rotation.set(-Math.PI / 2, 0, 0);
  c.parts.legR.rotation.set(-Math.PI / 2, 0, 0);

  if (c.parts.legL.userData.knee) c.parts.legL.userData.knee.rotation.set(Math.PI / 2, 0, 0);
  if (c.parts.legR.userData.knee) c.parts.legR.userData.knee.rotation.set(Math.PI / 2, 0, 0);
}

// removed

// removed


function sitLegsSide(c) {
  // Ноги Any чуть в сторону, но без дикой диагонали и пересечений.
  c.parts.legL.rotation.set(-0.25, 0, 0.06);
  c.parts.legR.rotation.set(-0.25, 0, 0.10);

  if (c.parts.legL.userData.knee) c.parts.legL.userData.knee.rotation.set(0.46, 0, 0.03);
  if (c.parts.legR.userData.knee) c.parts.legR.userData.knee.rotation.set(0.46, 0, 0.05);
}


function sitLegsStable(c) {
  // Устойчивая сидячая поза для текущей примитивной модели.
  // Бёдра чуть вперёд, голени не выворачиваются, ступни остаются читаемыми.
  c.parts.legL.rotation.set(-0.35, 0, 0);
  c.parts.legR.rotation.set(-0.35, 0, 0);

  if (c.parts.legL.userData.knee) c.parts.legL.userData.knee.rotation.set(0.55, 0, 0);
  if (c.parts.legR.userData.knee) c.parts.legR.userData.knee.rotation.set(0.55, 0, 0);
}


function sitLegs(c) { sitLegs90(c); }

function lieOnBed(c, x, z, rotZ = 0) {
  c.group.position.set(x, 0.88, z);
  c.group.rotation.set(-Math.PI / 2, 0, rotZ);
}


function frontHugArms(c, tight = 1.0, high = 0.0) {
  // Руки тянутся ВПЕРЁД в локальном направлении персонажа.
  // rotation.x даёт вынос рук вперёд к партнёру,
  // rotation.z слегка оборачивает их вокруг тела партнёра.
  c.parts.armL.rotation.set(-1.15 - high, 0.08, 0.78 * tight);
  c.parts.armR.rotation.set(-1.15 - high, -0.08, -0.78 * tight);
}

function softHoldArms(c, tight = 1.0) {
  c.parts.armL.rotation.set(-0.95, 0.05, 0.58 * tight);
  c.parts.armR.rotation.set(-0.95, -0.05, -0.58 * tight);
}

function resetLimbRotations(c) {
  ["legL", "legR", "armL", "armR"].forEach(k => {
    c.parts[k].rotation.set(0, 0, 0);
    if (c.parts[k].userData.knee) c.parts[k].userData.knee.rotation.set(0, 0, 0);
  });
  c.parts.head.rotation.set(0, 0, 0);
}


function applyPose(type, pl, np) {
  if (type === "standing_front") {
    const mid = new THREE.Vector3().addVectors(pl.group.position, np.group.position).multiplyScalar(0.5);
    mid.y = 0;

    pl.group.position.set(mid.x - 0.31, 0, mid.z);
    np.group.position.set(mid.x + 0.31, 0, mid.z);
    pl.group.rotation.set(0, Math.PI / 2, 0);
    np.group.rotation.set(0, -Math.PI / 2, 0);

    frontHugArms(pl, 0.95, 0.00);
    frontHugArms(np, 0.95, 0.00);
    pl.parts.head.rotation.z = 0.10;
    np.parts.head.rotation.z = -0.10;
  }

  else if (type === "standing_close") {
    const mid = new THREE.Vector3().addVectors(pl.group.position, np.group.position).multiplyScalar(0.5);
    mid.y = 0;

    pl.group.position.set(mid.x - 0.26, 0, mid.z);
    np.group.position.set(mid.x + 0.26, 0, mid.z);
    pl.group.rotation.set(0, Math.PI / 2, 0);
    np.group.rotation.set(0, -Math.PI / 2, 0);

    frontHugArms(pl, 1.25, 0.05);
    frontHugArms(np, 1.25, 0.05);
    pl.parts.head.rotation.z = 0.16;
    np.parts.head.rotation.z = -0.16;
  }

  else if (type === "standing_side") {
    const mid = new THREE.Vector3().addVectors(pl.group.position, np.group.position).multiplyScalar(0.5);
    mid.y = 0;

    pl.group.position.set(mid.x - 0.34, 0, mid.z);
    np.group.position.set(mid.x + 0.34, 0, mid.z + 0.12);
    pl.group.rotation.set(0, 0, 0);
    np.group.rotation.set(0, 0, 0);

    pl.parts.armR.rotation.set(-1.05, -0.05, -0.88);
    pl.parts.armL.rotation.set(-0.65, 0.05, 0.28);
    np.parts.armL.rotation.set(-1.05, 0.05, 0.88);
    np.parts.armR.rotation.set(-0.65, -0.05, -0.28);
    pl.parts.head.rotation.z = -0.10;
    np.parts.head.rotation.z = 0.10;
  }

  else if (type === "standing_forehead") {
    const mid = new THREE.Vector3().addVectors(pl.group.position, np.group.position).multiplyScalar(0.5);
    mid.y = 0;

    pl.group.position.set(mid.x - 0.30, 0, mid.z);
    np.group.position.set(mid.x + 0.30, 0, mid.z);
    pl.group.rotation.set(0, Math.PI / 2, 0);
    np.group.rotation.set(0, -Math.PI / 2, 0);

    softHoldArms(pl, 0.75);
    softHoldArms(np, 0.75);
    pl.parts.head.rotation.x = 0.22;
    np.parts.head.rotation.x = 0.22;
  }

  else if (type === "sofa_side_cuddle") {
    placeSofaCuddle(pl, np, "side");
  }

  else if (type === "sofa_shoulder") {
    placeSofaCuddle(pl, np, "shoulder");
  }

  else if (type === "sofa_lap_hug") {
    placeSofaCuddle(pl, np, "lap");
  }

  else if (type === "sofa_sleepy") {
    placeSofaCuddle(pl, np, "sleepy");
  }

  else if (type === "bed_side_by_side") {
    lieOnBed(pl, BP.x - 0.30, BP.z, 0);
    lieOnBed(np, BP.x + 0.30, BP.z, 0);

    pl.parts.head.rotation.z = -0.35;
    np.parts.head.rotation.z = 0.35;
    pl.parts.armR.rotation.set(0.4, 0, -0.55);
    np.parts.armL.rotation.set(0.4, 0, 0.55);
  }

  else if (type === "bed_spoon") {
    lieOnBed(pl, BP.x - 0.10, BP.z + 0.16, 0);
    lieOnBed(np, BP.x + 0.28, BP.z + 0.16, 0);

    pl.parts.armR.rotation.set(0.45, 0, -0.85);
    pl.parts.armL.rotation.set(0.2, 0, 0.35);
    np.parts.armL.rotation.set(0.2, 0, 0.25);
    np.parts.head.rotation.z = -0.16;
  }

  else if (type === "bed_face_to_face") {
    lieOnBed(pl, BP.x - 0.28, BP.z + 0.05, 0.15);
    lieOnBed(np, BP.x + 0.28, BP.z + 0.05, -0.15);

    pl.parts.armR.rotation.set(0.45, 0, -0.75);
    np.parts.armL.rotation.set(0.45, 0, 0.75);
    pl.parts.head.rotation.z = -0.35;
    np.parts.head.rotation.z = 0.35;
  }

  else if (type === "bed_head_on_chest") {
    lieOnBed(pl, BP.x - 0.10, BP.z, 0);
    lieOnBed(np, BP.x + 0.20, BP.z + 0.18, -0.28);

    pl.parts.armR.rotation.set(0.40, 0, -0.55);
    np.parts.head.rotation.z = -0.42;
    np.parts.armL.rotation.set(0.30, 0, 0.75);
    np.parts.armR.rotation.set(0.30, 0, -0.20);
  }
}

function hugPulse(pl, np, t, type) {
  const p = Math.sin(t * 2.8) * 0.04;

  // Пульсация теперь не ломает позу накоплением.
  // Она задаёт мягкое дыхание/сжатие вокруг базовой позы.
  if (type === "standing_front") {
    frontHugArms(pl, 0.95 + p, 0.00);
    frontHugArms(np, 0.95 + p, 0.00);
  } else if (type === "standing_close") {
    frontHugArms(pl, 1.25 + p, 0.05);
    frontHugArms(np, 1.25 + p, 0.05);
  } else if (type === "standing_side") {
    pl.parts.armR.rotation.set(-1.05, -0.05, -0.88 - p);
    np.parts.armL.rotation.set(-1.05, 0.05, 0.88 + p);
  } else if (type === "standing_forehead") {
    softHoldArms(pl, 0.75 + p);
    softHoldArms(np, 0.75 + p);
  } else if (type.startsWith("sofa")) {
    // Мягкое дыхание на диване без проваливания и без смены роли.
    if (type === "sofa_side_cuddle") placeSofaCuddle(pl, np, "side");
    else if (type === "sofa_shoulder") placeSofaCuddle(pl, np, "shoulder");
    else if (type === "sofa_lap_hug") placeSofaCuddle(pl, np, "lap");
    else if (type === "sofa_sleepy") placeSofaCuddle(pl, np, "sleepy");
  } else if (type.startsWith("bed")) {
    pl.parts.armR.rotation.z -= p * 0.16;
    np.parts.armL.rotation.z += p * 0.16;
  }
}

// ── Game State ───────────────────────────────────────────────
let player = null;
let npc = null;
let gameOn = false;
let activeHug = null;
let hugT = 0;
let handHoldActive = false;
let handHoldSide = 1;
let holdArmAny = null;
let holdArmVell = null;
let holdHandPoint = null;

const keys = {};

// ── Touch controls ───────────────────────────────────────────
const touchMove = new THREE.Vector2(0, 0);
let touchHugPressed = false;
let touchLeadPressed = false;

function setupTouchControls() {
  const stick = document.getElementById("stick");
  const knob = document.getElementById("knob");
  const hugBtn = document.getElementById("hugBtn");
  const leadBtn = document.getElementById("leadBtn");

  if (!stick || !knob || !hugBtn || !leadBtn) return;

  let activePointerId = null;
  const radius = 72;

  function setStickFromEvent(e) {
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);

    if (len > radius) {
      dx = dx / len * radius;
      dy = dy / len * radius;
    }

    knob.style.transform = `translate(${dx}px, ${dy}px)`;

    // x: влево/вправо, y: вперёд/назад
    touchMove.set(dx / radius, -dy / radius);
  }

  function resetStick() {
    activePointerId = null;
    touchMove.set(0, 0);
    knob.style.transform = "translate(0px, 0px)";
  }

  stick.addEventListener("pointerdown", e => {
    activePointerId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    setStickFromEvent(e);
  });

  stick.addEventListener("pointermove", e => {
    if (e.pointerId !== activePointerId) return;
    setStickFromEvent(e);
  });

  stick.addEventListener("pointerup", resetStick);
  stick.addEventListener("pointercancel", resetStick);
  stick.addEventListener("lostpointercapture", resetStick);

  function pressHug(e) {
    e.preventDefault();
    touchHugPressed = true;
  }

  function pressLead(e) {
    e.preventDefault();
    touchLeadPressed = true;
  }

  hugBtn.addEventListener("pointerdown", pressHug);
  hugBtn.addEventListener("touchstart", pressHug, { passive: false });

  leadBtn.addEventListener("pointerdown", pressLead);
  leadBtn.addEventListener("touchstart", pressLead, { passive: false });
}

// setupTouchControls() called from startRoom1Char after React mounts DOM

// ── Extra mobile fallback controls ───────────────────────────
// Некоторые мобильные браузеры плохо отрабатывают pointer-события в локальных HTML.
// Поэтому дублируем управление через touch-события.
function setupMobileFallbackControls(){
  const stick = document.getElementById("stick");
  const knob = document.getElementById("knob");
  const hugBtn = document.getElementById("hugBtn");
  const leadBtn = document.getElementById("leadBtn");

  if (!stick || !knob) return;

  let stickTouchId = null;
  const radius = 72;

  function setStickByTouch(t) {
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = t.clientX - cx;
    let dy = t.clientY - cy;
    const len = Math.hypot(dx, dy);

    if (len > radius) {
      dx = dx / len * radius;
      dy = dy / len * radius;
    }

    knob.style.transform = `translate(${dx}px, ${dy}px)`;

    if (typeof touchMove !== "undefined") {
      touchMove.set(dx / radius, -dy / radius);
    }
  }

  function resetStickFallback() {
    stickTouchId = null;
    knob.style.transform = "translate(0px, 0px)";
    if (typeof touchMove !== "undefined") {
      touchMove.set(0, 0);
    }
  }

  stick.addEventListener("touchstart", e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    stickTouchId = t.identifier;
    setStickByTouch(t);
  }, { passive:false });

  stick.addEventListener("touchmove", e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === stickTouchId) {
        setStickByTouch(t);
        break;
      }
    }
  }, { passive:false });

  stick.addEventListener("touchend", e => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickTouchId) {
        resetStickFallback();
        break;
      }
    }
  }, { passive:false });

  stick.addEventListener("touchcancel", resetStickFallback, { passive:false });

  if (hugBtn) {
    hugBtn.addEventListener("touchstart", e => {
      e.preventDefault();
      if (typeof touchHugPressed !== "undefined") touchHugPressed = true;
      if (typeof keys !== "undefined") keys["KeyE"] = true;
    }, { passive:false });

    hugBtn.addEventListener("click", e => {
      e.preventDefault();
      if (typeof touchHugPressed !== "undefined") touchHugPressed = true;
      if (typeof keys !== "undefined") keys["KeyE"] = true;
    });
  }

  if (leadBtn) {
    leadBtn.addEventListener("touchstart", e => {
      e.preventDefault();
      if (typeof touchLeadPressed !== "undefined") touchLeadPressed = true;
      if (typeof keys !== "undefined") keys["KeyF"] = true;
    }, { passive:false });

    leadBtn.addEventListener("click", e => {
      e.preventDefault();
      if (typeof touchLeadPressed !== "undefined") touchLeadPressed = true;
      if (typeof keys !== "undefined") keys["KeyF"] = true;
    });
  }
}

const camT = new THREE.Vector3();
const camL = new THREE.Vector3();
let fovT = 58;

// ── Free camera orbit controls ───────────────────────────────
// На телефоне: свайп по правой/центральной части экрана.
// На ПК: правая кнопка мыши + движение мышью.
let camYaw = 0;
let camPitch = 0.18;
let camDistance = 6.0;
let camHeight = 3.4;
let camDragActive = false;
let camDragPointerId = null;
let camLastX = 0;
let camLastY = 0;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function isCameraDragBlocked(target) {
  if (!target) return false;
  return !!target.closest?.("#stick, #hugBtn, #leadBtn, .card, #sel");
}

function startCameraDrag(e) {
  if (isCameraDragBlocked(e.target)) return;

  // На телефоне левую нижнюю зону оставляем под стик.
  if (e.pointerType === "touch" && e.clientX < window.innerWidth * 0.42 && e.clientY > window.innerHeight * 0.55) {
    return;
  }

  // На ПК крутим правой кнопкой мыши. На телефоне — любым пальцем вне кнопок.
  if (e.pointerType === "mouse" && e.button !== 2) return;

  camDragActive = true;
  camDragPointerId = e.pointerId;
  camLastX = e.clientX;
  camLastY = e.clientY;

  try { document.body.setPointerCapture?.(e.pointerId); } catch {}
  e.preventDefault();
}

function moveCameraDrag(e) {
  if (!camDragActive || e.pointerId !== camDragPointerId) return;

  const dx = e.clientX - camLastX;
  const dy = e.clientY - camLastY;

  camLastX = e.clientX;
  camLastY = e.clientY;

  camYaw -= dx * 0.008;
  camPitch = clamp(camPitch + dy * 0.006, -0.35, 0.85);

  e.preventDefault();
}

function endCameraDrag(e) {
  if (e.pointerId !== camDragPointerId) return;
  camDragActive = false;
  camDragPointerId = null;
}

window.addEventListener("pointerdown", startCameraDrag, { passive: false });
window.addEventListener("pointermove", moveCameraDrag, { passive: false });
window.addEventListener("pointerup", endCameraDrag);
window.addEventListener("pointercancel", endCameraDrag);
window.addEventListener("contextmenu", e => e.preventDefault());

window.addEventListener("wheel", e => {
  camDistance = clamp(camDistance + e.deltaY * 0.004, 3.0, 10.0);
}, { passive: true });

window.addEventListener("keydown", e => {
  keys[e.code] = true;
});

window.addEventListener("keyup", e => {
  keys[e.code] = false;
});

function selectChar(isMale) {
  buildRoom();

  const vp = new THREE.Vector3(isMale ? -2 : 2, 0, 0);
  const np = new THREE.Vector3(isMale ? 2 : -2, 0, 0);

  player = new Character(isMale, vp);
  npc = new Character(!isMale, np);


  gameOn = true;
}



function canLeadByHand() {
  if (!player || !npc || activeHug) return false;
  return player.group.position.distanceTo(npc.group.position) < 2.8;
}

function makeHoldCylinder(color, radius = 0.045) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 1, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.65 })
  );
  m.castShadow = true;
  scene.add(m);
  return m;
}

function ensureHoldArms() {
  if (holdArmAny && holdArmVell && holdHandPoint) return;

  // Прямой цилиндр руки Any
  holdArmAny = makeHoldCylinder(0x111111, 0.048);

  // Прямой цилиндр руки Vell
  holdArmVell = makeHoldCylinder(0x6B9FD4, 0.048);

  // Общая кисть
  holdHandPoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xFFCBA4, roughness: 0.55 })
  );
  holdHandPoint.castShadow = true;
  scene.add(holdHandPoint);
}

function setCylinderBetween(mesh, a, b) {
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(0.001, dir.length());

  mesh.position.copy(mid);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize()
  );
}

function setOriginalHandHoldArmsVisible(visible) {
  if (!player || !npc) return;

  // Скрываем старые кубические руки, чтобы не было лишних рук.
  player.parts.armR.visible = visible; // правая рука Any
  npc.parts.armL.visible = visible;    // левая рука Vell
}

function hideHoldArms() {
  if (holdArmAny) holdArmAny.visible = false;
  if (holdArmVell) holdArmVell.visible = false;
  if (holdHandPoint) holdHandPoint.visible = false;

  setOriginalHandHoldArmsVisible(true);
}

function showStraightHoldArms(anyShoulder, vellShoulder, handPoint) {
  ensureHoldArms();

  holdArmAny.visible = true;
  holdArmVell.visible = true;
  holdHandPoint.visible = true;

  // Только прямые цилиндры. Никаких локтей.
  setCylinderBetween(holdArmAny, anyShoulder, handPoint);
  setCylinderBetween(holdArmVell, vellShoulder, handPoint);
  holdHandPoint.position.copy(handPoint);
}

function setHandHoldPose(leader, follower, stretch = 0) {
  // Руки, участвующие в держании, скрыты и заменены прямыми цилиндрами.
  setOriginalHandHoldArmsVisible(false);

  // Свободные руки оставляем обычными.
  leader.parts.armL.rotation.set(0.05, 0, 0.14);
  follower.parts.armR.rotation.set(0.05, 0, -0.14);

  leader.parts.head.rotation.z = -0.02;
  follower.parts.head.rotation.z = 0.02;
}

function clearHandHoldPose() {
  if (!player || !npc) return;
  resetLimbRotations(player);
  resetLimbRotations(npc);
  hideHoldArms();
}

function toggleLeadByHand() {
  if (activeHug) return;

  if (handHoldActive) {
    handHoldActive = false;
    clearHandHoldPose();
    return;
  }

  if (!canLeadByHand()) return;

  handHoldActive = true;
  handHoldSide = 1;
  ensureHoldArms();
  setHandHoldPose(player, npc, 0);
}

function updateLeadByHand(dt) {
  if (!handHoldActive || !player || !npc) return;

  if (player.group.position.distanceTo(npc.group.position) > 5.5) {
    handHoldActive = false;
    clearHandHoldPose();
    return;
  }

  const forward = new THREE.Vector3(0, 0, 1)
    .applyEuler(new THREE.Euler(0, player.group.rotation.y, 0))
    .normalize();

  const right = new THREE.Vector3(1, 0, 0)
    .applyEuler(new THREE.Euler(0, player.group.rotation.y, 0))
    .normalize();

  // Any впереди, Vell позади-справа.
  const target = player.group.position.clone()
    .addScaledVector(forward, -1.30)
    .addScaledVector(right, 0.82);

  target.y = 0;

  const dist = npc.group.position.distanceTo(target);
  const speed = 6.0 + Math.min(7.0, dist * 4.0);
  npc.group.position.lerp(target, Math.min(1, dt * speed));
  npc.group.position.y = 0;

  const desiredY = player.group.rotation.y;
  let diff = desiredY - npc.group.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  npc.group.rotation.y += diff * Math.min(1, dt * 10.0);

  npc.speed = Math.max(player.speed * 0.9, dist > 0.12 ? 0.35 : 0);
  setHandHoldPose(player, npc, dist);

  // Общая кисть.
  const handPoint = player.group.position.clone()
    .addScaledVector(forward, -0.68)
    .addScaledVector(right, 0.56)
    .add(new THREE.Vector3(0, 1.00, 0));

  // Плечо/начало прямой руки Any.
  const anyShoulder = player.group.position.clone()
    .addScaledVector(forward, -0.03)
    .addScaledVector(right, 0.32)
    .add(new THREE.Vector3(0, 1.34, 0));

  // Плечо/начало прямой руки Vell.
  const vellShoulder = npc.group.position.clone()
    .addScaledVector(forward, 0.03)
    .addScaledVector(right, -0.30)
    .add(new THREE.Vector3(0, 1.34, 0));

  showStraightHoldArms(anyShoulder, vellShoulder, handPoint);
}


function startHug(type) {
  if (activeHug) return;

  if (handHoldActive) {
    handHoldActive = false;
    clearHandHoldPose();
  }
  hideHoldArms();

  activeHug = type; if (onHugCallback) onHugCallback(type);
  hugT = 0;

  player.savePose();
  npc.savePose();

  player.isHugging = true;
  npc.isHugging = true;

  [player, npc].forEach(c => {
    ["legL", "legR", "armL", "armR"].forEach(k => {
      c.parts[k].rotation.set(0, 0, 0);
      if (c.parts[k].userData.knee) c.parts[k].userData.knee.rotation.set(0, 0, 0);
    });

    c.parts.head.rotation.set(0, 0, 0);
    c.parts.head.position.set(0, 1.82, 0);
    if (c.parts.torso) c.parts.torso.rotation.set(0, 0, 0);
    c.group.position.y = 0;
  });

  applyPose(type, player, npc);
  fovT = POSES[type].fov;

  spawnHearts();
}

function endHug() {
  if (!activeHug) return;

  player.restorePose();
  npc.restorePose();

  activeHug = null;
  fovT = 58;
}

function spawnHearts() {
  const em = ["❤️", "🧡", "💗", "💕", "🤍"];

  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
    }, i * 210);
  }
}


// ── D-pad movement buttons ───────────────────────────────────
(function setupDpadButtons(){
  const map = {
    moveUp: "KeyW",
    moveDown: "KeyS",
    moveLeft: "KeyA",
    moveRight: "KeyD"
  };

  for (const [id, code] of Object.entries(map)) {
    const btn = document.getElementById(id);
    if (!btn) continue;

    const press = (e) => {
      e.preventDefault();
      if (typeof keys !== "undefined") keys[code] = true;
      btn.classList.add("active");
    };

    const release = (e) => {
      if (e) e.preventDefault();
      if (typeof keys !== "undefined") keys[code] = false;
      btn.classList.remove("active");
    };

    btn.addEventListener("pointerdown", press, { passive:false });
    btn.addEventListener("pointerup", release, { passive:false });
    btn.addEventListener("pointercancel", release, { passive:false });
    btn.addEventListener("pointerleave", release, { passive:false });

    btn.addEventListener("touchstart", press, { passive:false });
    btn.addEventListener("touchend", release, { passive:false });
    btn.addEventListener("touchcancel", release, { passive:false });

    btn.addEventListener("mousedown", press);
    btn.addEventListener("mouseup", release);
    btn.addEventListener("mouseleave", release);
  }

  window.addEventListener("blur", () => {
    for (const code of Object.values(map)) {
      if (typeof keys !== "undefined") keys[code] = false;
    }
    document.querySelectorAll(".moveBtn").forEach(b => b.classList.remove("active"));
  });
})();

// ── Main Loop ─────────────────────────────────────────────────
const clock = new THREE.Clock();

export function updateRoom1(dt) {
  

  if (!gameOn) {
    
    return;
  }

  if (!activeHug) {
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();

    const right = new THREE.Vector3()
      .crossVectors(fwd, new THREE.Vector3(0, 1, 0))
      .negate();

    const dir = new THREE.Vector3();

    if (keys["KeyW"] || keys["ArrowUp"]) dir.add(fwd);
    if (keys["KeyS"] || keys["ArrowDown"]) dir.sub(fwd);
    if (keys["KeyA"] || keys["ArrowLeft"]) dir.add(right);
    if (keys["KeyD"] || keys["ArrowRight"]) dir.sub(right);

    // Мобильный виртуальный стик
    if (touchMove.y > 0.08) dir.addScaledVector(fwd, touchMove.y);
    if (touchMove.y < -0.08) dir.addScaledVector(fwd, touchMove.y);
    if (touchMove.x < -0.08) dir.addScaledVector(right, -touchMove.x);
    if (touchMove.x > 0.08) dir.addScaledVector(right, -touchMove.x);

    player.speed = dir.length();

    if (player.speed > 0.01) {
      dir.normalize();
      player.targetRotY = Math.atan2(dir.x, dir.z);

      const p = player.group.position;
      p.x = Math.max(-11.5, Math.min(11.5, p.x + dir.x * 4.5 * dt));
      p.z = Math.max(-11.5, Math.min(11.5, p.z + dir.z * 4.5 * dt));
    } else {
      player.speed = 0;
    }

    let diff = player.targetRotY - player.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.group.rotation.y += diff * 10 * dt;

    // Обычная коллизия персонажей во время ходьбы:
    // они не могут занимать одну и ту же область.
    if (!handHoldActive) {
      enforceCharacterSeparation(player, npc, BODY_COLLISION_RADIUS * 2);
    }

    if (keys["KeyF"] || touchLeadPressed) {
      toggleLeadByHand();
      keys["KeyF"] = false;
      touchLeadPressed = false;
    }

    if (keys["KeyE"] || keys["KeyY"] || touchHugPressed) {
      const pose = getNextPose(player, npc);
      if (pose) {
        startHug(pose);
      }
      keys["KeyE"] = false;
      keys["KeyY"] = false;
      touchHugPressed = false;
    }
  }

  if (activeHug) {
    hugT += dt;
    hugPulse(player, npc, hugT, activeHug);

    if (hugT >= POSES[activeHug].dur) {
      endHug();
    }
  }

  updateLeadByHand(dt);

  player.animate(dt);
  npc.animate(dt);

  // Camera
  const pp = player.group.position;

  if (activeHug) {
    const cfg = POSES[activeHug];
    const mid = new THREE.Vector3()
      .addVectors(player.group.position, npc.group.position)
      .multiplyScalar(0.5);

    // Свободная orbit-камера во время объятий тоже работает.
    // Отличие: камера ближе и смотрит на центр пары, а не только на игрока.
    const hugDistance = cfg.top ? 4.2 : Math.max(2.6, cfg.dist || 3.2);
    const orbitYaw = player.group.rotation.y + camYaw;

    const camOffset = new THREE.Vector3(
      Math.sin(orbitYaw) * hugDistance,
      (cfg.top ? cfg.ch : cfg.ch + 0.2) + Math.sin(camPitch) * 1.8,
      Math.cos(orbitYaw) * hugDistance
    );

    camT.copy(mid).add(camOffset);
    camL.copy(mid).add(new THREE.Vector3(0, cfg.top ? 0.35 : 0.9, 0));
  } else {
    // Свободная orbit-камера вокруг игрока.
    // Базово смотрит сзади персонажа, но пользователь может крутить yaw/pitch.
    const orbitYaw = player.group.rotation.y + camYaw;

    const camOffset = new THREE.Vector3(
      Math.sin(orbitYaw) * camDistance,
      camHeight + Math.sin(camPitch) * 2.2,
      Math.cos(orbitYaw) * camDistance
    );

    camT.copy(pp).add(camOffset);
    camL.copy(pp).add(new THREE.Vector3(0, 1.15, 0));
  }

  camera.position.lerp(camT, 7 * dt);
  camera.lookAt(camL);
  camera.fov += (fovT - camera.fov) * 5 * dt;
  camera.updateProjectionMatrix();

// Prompt UI logic is now handled by React HUD
  if (!activeHug) {
    const pose = getPreviewPose(player, npc);
    if (handHoldActive) {
      const leader = player.isMale ? 'Vell' : 'Annie';
      const follower = player.isMale ? 'Annie' : 'Vell';
      if (onPromptCallback) onPromptCallback(`🤝  ${leader} ведёт ${follower} за руку · [F] отпустить`);
    } else if (pose) {
      const leadHint = canLeadByHand() ? "   ·   🤝 [F] Вести" : "";
      if (onPromptCallback) onPromptCallback(POSES[pose].label + leadHint);
    } else {
      if (onPromptCallback) onPromptCallback("");
    }
  } else {
    if (onPromptCallback) onPromptCallback("");
  }

  
}



export function startRoom1Char(isMale) {
  selectChar(isMale);
  // DOM elements are available now that React has rendered MobileControls
  setupTouchControls();
  setupMobileFallbackControls();
}

export function triggerAction(action) { if(action === 'hug') touchHugPressed = true; if(action === 'lead') touchLeadPressed = true; }
export function setJoystick(x, y) { touchMove.set(x, y); }
