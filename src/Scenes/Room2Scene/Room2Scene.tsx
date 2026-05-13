import React, { useEffect, useRef, useMemo, Suspense } from 'react';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { useTransition } from '../../Shared/Transition/TransitionManager';
import { useStore } from '../../Shared/Store/useStore';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Physics, RigidBody, RapierRigidBody, CapsuleCollider, CuboidCollider } from '@react-three/rapier';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';

// ── URLs ──────────────────────────────────────────────────────────────────────
// 3-stage compression: Meshopt geometry + 2048×2048 resize + WebP/KTX2 textures = −86% vs original
// To revert to meshopt-only: change 'ktx2' → 'compressed'
// To revert to originals:   change 'ktx2' → '' (remove /compressed prefix entirely)
const ASSET_BASE    = '/animations/ktx2';
const ROOM_URL      = '/animations/room4.glb'; // no compressed version yet
const ANNY_URL      = `${ASSET_BASE}/AnyModel.glb`;
const VELL_URL      = `${ASSET_BASE}/VellModel.glb`;
const ANNY_IDLE_URL = `${ASSET_BASE}/AnyIdle.glb`;
const ANNY_WALK_URL = `${ASSET_BASE}/AnyWalk.glb`;
const VELL_WALK_URL = `${ASSET_BASE}/VellWalk.glb`;

const ANNY_POSE_URLS: [string,string,string,string] = [
  `${ASSET_BASE}/room2/Anny/Any1p2r.glb`,
  `${ASSET_BASE}/room2/Anny/Any2p2r.glb`,
  `${ASSET_BASE}/room2/Anny/Any3p2r.glb`,
  `${ASSET_BASE}/room2/Anny/Any4p2r.glb`,
];
const VELL_POSE_URLS: [string,string,string,string] = [
  `${ASSET_BASE}/room2/Vell/Vell1p2r.glb`,
  `${ASSET_BASE}/room2/Vell/Vell2p2r.glb`,
  `${ASSET_BASE}/room2/Vell/Vell3p2r.glb`,
  `${ASSET_BASE}/room2/Vell/Vell4p2r.glb`,
];


const BED_CYCLE   = [1, 3, 4];
const BED_CENTER  = { x: 4,   z: -3.5 };
const WALL_CENTER = { x: 2.5, z: 1.5  };
const DOOR_CENTER = { x: 0,   z: -5   };
const BED_RADIUS  = 5.5;
const WALL_RADIUS = 4.5;
const DOOR_RADIUS = 5.0;
const ROOM_SCALE_TARGET = 12;

// ── Shared mutable state ──────────────────────────────────────────────────────
const poseState   = { activePose: null as null | number, poseIdx: 0 };
const leadState   = { active: false };
const npcRbRef    = { current: null as null | RapierRigidBody };
const npcGroupRef = { current: null as null | THREE.Group };

// ── Debug overlay (dev only) ──────────────────────────────────────────────────
const DebugOverlay = () => {
  const [info, setInfo] = React.useState('');
  useFrame(() => {
    const ap = poseState.activePose;
    const txt = ap === null ? 'idle' : `pose${ap}`;
    setInfo(txt);
    (window as any).__r2debug = { poseState, leadState };
  });
  return (
    <group>
      {/* overlay rendered via HTML portal — see DOM element below */}
    </group>
  );
};

// HTML debug overlay — appended to body, updated each frame
if (typeof document !== 'undefined' && !(window as any).__r2debugEl) {
  const el = document.createElement('div');
  el.id = '__r2debug';
  el.style.cssText = [
    'position:fixed','top:8px','left:50%','transform:translateX(-50%)',
    'background:rgba(0,0,0,0.72)','color:#0f0','font:bold 14px monospace',
    'padding:4px 14px','border-radius:6px','z-index:9999',
    'pointer-events:none','letter-spacing:1px',
  ].join(';');
  document.body.appendChild(el);
  (window as any).__r2debugEl = el;
  // update every 100ms
  setInterval(() => {
    const ap = poseState.activePose;
    el.textContent = `POSE: ${ap === null ? 'idle' : ap} | LEAD: ${leadState.active}`;
  }, 100);
}

// ── Bone name normaliser ──────────────────────────────────────────────────────
function normBone(name: string): string {
  const col = name.lastIndexOf(':');
  return col !== -1 ? name.slice(col + 1).toLowerCase() : name.toLowerCase();
}

// Strips hips root-motion position from a THREE.js AnimationClip (in-place)
// Root bones that carry root-motion position data
const ROOT_MOTION_BONES = new Set(['hips','root','pelvis','bip01','bip001','armature','character','torso']);

function stripHipsPosition(clip: THREE.AnimationClip): THREE.AnimationClip {
  clip.tracks = clip.tracks.filter(t => {
    const dot  = t.name.indexOf('.');
    const bone = dot !== -1 ? t.name.slice(0, dot) : t.name;
    const prop = dot !== -1 ? t.name.slice(dot) : '';
    // Remove root-motion position/translation from any known root bone
    return !(ROOT_MOTION_BONES.has(normBone(bone)) && (prop.includes('position') || prop.includes('translation')));
  });
  return clip;
}

function adaptClip(
  clip: THREE.AnimationClip,
  root: THREE.Object3D,
  label = '',
  stripAllPositions = false  // true for walk anims to prevent visual snap at loop
): THREE.AnimationClip {
  // Строим карту: normName → realName
  const boneMap = new Map<string, string>();
  root.traverse(o => {
    if ((o as any).isBone) boneMap.set(normBone(o.name), o.name);
    const sm = o as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh && sm.skeleton)
      sm.skeleton.bones.forEach(b => boneMap.set(normBone(b.name), b.name));
  });

  const modelBones = [...boneMap.values()].slice(0, 3).join(', ');
  const clipTracks = clip.tracks.slice(0, 3).map(t => t.name).join(', ');
  console.log(`[adaptClip ${label}] model bones sample: ${modelBones}`);
  console.log(`[adaptClip ${label}] clip tracks sample: ${clipTracks}`);

  const tracks: THREE.KeyframeTrack[] = [];
  clip.tracks.forEach(t => {
    const dot  = t.name.indexOf('.');
    const bone = dot !== -1 ? t.name.slice(0, dot) : t.name;
    const prop = dot !== -1 ? t.name.slice(dot) : '';
    const isPos = prop.includes('position') || prop.includes('translation');
    // Skip ALL position tracks for walk anims (prevent visual snap at loop)
    if (stripAllPositions && isPos) return;
    // Skip root-motion position from root bones
    if (ROOT_MOTION_BONES.has(normBone(bone)) && isPos) return;
    const real = boneMap.get(normBone(bone));
    if (real) { const c = t.clone(); c.name = real + prop; tracks.push(c); }
  });

  let result: THREE.AnimationClip;
  if (tracks.length === 0) {
    console.warn(`[adaptClip ${label}] 0 tracks matched – falling back to raw tracks`);
    result = new THREE.AnimationClip(clip.name, clip.duration, [...clip.tracks]);
  } else {
    console.log(`[adaptClip ${label}] matched ${tracks.length}/${clip.tracks.length} tracks`);
    result = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  }
  // ALWAYS strip root-motion positions as a final safety measure
  return stripHipsPosition(result);
}

// ── Keyboard hook ─────────────────────────────────────────────────────────────
const usePlayerControls = () => {
  const mv = useRef({ forward: false, backward: false, left: false, right: false });
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      const c = e.code.toLowerCase();
      if (c === 'keyw' || c === 'arrowup')    mv.current.forward  = true;
      if (c === 'keys' || c === 'arrowdown')  mv.current.backward = true;
      if (c === 'keya' || c === 'arrowleft')  mv.current.left     = true;
      if (c === 'keyd' || c === 'arrowright') mv.current.right    = true;
    };
    const up = (e: KeyboardEvent) => {
      const c = e.code.toLowerCase();
      if (c === 'keyw' || c === 'arrowup')    mv.current.forward  = false;
      if (c === 'keys' || c === 'arrowdown')  mv.current.backward = false;
      if (c === 'keya' || c === 'arrowleft')  mv.current.left     = false;
      if (c === 'keyd' || c === 'arrowright') mv.current.right    = false;
    };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup',   up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);
  return mv;
};

// ── CharacterBody ─────────────────────────────────────────────────────────────
const CharacterBody = ({
  modelUrl, idleAnimUrl, walkAnimUrl, isPlayer, spawnPos, targetHeight,
  colliderArgs, colliderOffset, charKey, poseUrls, modelRotationX,
}: {
  modelUrl: string;
  idleAnimUrl?: string;
  walkAnimUrl?: string;
  isPlayer: boolean;
  spawnPos: [number,number,number];
  targetHeight: number;
  colliderArgs: [number,number];
  colliderOffset: [number,number,number];
  charKey: 'anny' | 'vell';
  poseUrls: [string,string,string,string];
  modelRotationX?: number;
}) => {
  const DUMMY = '/animations/AnyIdle.glb';
  const model   = useGLTF(modelUrl);
  const idleGlb = useGLTF(idleAnimUrl ?? DUMMY);
  const walkGlb = useGLTF(walkAnimUrl ?? DUMMY);
  const p0 = useGLTF(poseUrls[0]);
  const p1 = useGLTF(poseUrls[1]);
  const p2 = useGLTF(poseUrls[2]);
  const p3 = useGLTF(poseUrls[3]);

  // group — поворачивается для facing direction (rotation.y)
  const group        = useRef<THREE.Group>(null);
  const rb           = useRef<RapierRigidBody>(null);
  const controls     = usePlayerControls();

  const mixerRef  = useRef<THREE.AnimationMixer | null>(null);
  const idleAct   = useRef<THREE.AnimationAction | null>(null);
  const walkAct   = useRef<THREE.AnimationAction | null>(null);
  const poseActs  = useRef<(THREE.AnimationAction | null)[]>([null, null, null, null]);
  const lastPose  = useRef<null | number>(null);
  const frozenPos = useRef<{ x: number; y: number; z: number } | null>(null);
  // Track walk state to avoid redundant reset() calls that cause visual snapping
  const isWalking = useRef(false);

  useFrame(() => {
    if (!isPlayer) {
      npcRbRef.current    = rb.current;
      npcGroupRef.current = group.current;
    }
  });

  // ── Clone + scale + seat on floor ────────────────────────────────────────────
  const clone = useMemo(() => {
    const c = SkeletonUtils.clone(model.scene);

    // 1. Измеряем bbox ДО поворота (для Vell: измеряем "лёжа" → правильный rawH)
    c.updateMatrixWorld(true);
    const box0 = new THREE.Box3().setFromObject(c);
    const sz0  = new THREE.Vector3(); box0.getSize(sz0);
    // Детальное логирование
    console.log(`[${charKey}] bbox BEFORE rot: x=${sz0.x.toFixed(3)} y=${sz0.y.toFixed(3)} z=${sz0.z.toFixed(3)}`);
    // Оба персонажа лежат в GLB с одинаковым Y≈0.2 (толщина тела)
    // Используем Y для обоих → одинаковая логика масштабирования
    const rawH = sz0.y;
    console.log(`[${charKey}] rawH=${rawH.toFixed(3)} target=${targetHeight} scale=${(targetHeight/rawH).toFixed(3)}`);

    // 2. Масштабируем до targetHeight
    if (rawH > 0) c.scale.multiplyScalar(targetHeight / rawH);

    // 3. Применяем поворот (например Vell лежит в GLB → ставим вертикально)
    if (modelRotationX) c.rotation.x = modelRotationX;
    c.updateMatrixWorld(true);

    // 4. Садим на пол по bbox ПОСЛЕ поворота (min.y → 0)
    const sb = new THREE.Box3().setFromObject(c);
    c.position.y -= sb.min.y;

    c.traverse(o => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        (o as THREE.Mesh).receiveShadow = true;
        // Fix transparency artifacts from KTX2 textures:
        // KTX2 loader sometimes marks materials transparent even when opacity ≈ 1
        const mesh = o as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach(mat => {
          const m = mat as THREE.MeshStandardMaterial;
          if (m && m.isMaterial && m.opacity > 0.9) {
            m.transparent = false;
            m.depthWrite  = true;
            m.alphaTest   = 0;
            m.side        = THREE.FrontSide;
            m.needsUpdate = true;
          }
        });
      }
    });
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.scene, targetHeight, charKey, modelRotationX]);

  // ── Setup mixer + animations ──────────────────────────────────────────────────
  useEffect(() => {
    if (!clone) return;
    const mixer = new THREE.AnimationMixer(clone);
    mixerRef.current  = mixer;
    lastPose.current  = null;
    frozenPos.current = null;
    idleAct.current   = null;
    walkAct.current   = null;
    isWalking.current = false;

    // Idle (только если задан URL)
    if (idleAnimUrl && idleGlb.animations.length > 0) {
      const clip = adaptClip(idleGlb.animations[0].clone(), clone, `${charKey}/idle`);
      const act  = mixer.clipAction(clip);
      act.setLoop(THREE.LoopRepeat, Infinity);
      idleAct.current = act;
      act.reset().play();
      console.log(`[${charKey}] idle ready (${clip.tracks.length} tracks)`);
    } else if (idleAnimUrl) {
      console.warn(`[${charKey}] idle GLB has 0 animations!`);
    }

    // Walk (только если задан URL)
    if (walkAnimUrl && walkGlb.animations.length > 0) {
      // Walk GLB may be cumulative — take the LAST animation (same as pose files)
      const allWalkAnims = walkGlb.animations;
      const walkRaw = allWalkAnims[allWalkAnims.length - 1];
      // stripAllPositions removed: ROOT_MOTION_BONES already strips XZ root motion.
      // Keeping hips Y bobbing prevents Anny from sinking into floor.
      const clip = adaptClip(walkRaw.clone(), clone, `${charKey}/walk`);
      const act  = mixer.clipAction(clip);
      act.setLoop(THREE.LoopRepeat, Infinity);
      // Anny walk slower (0.55) to match her movement speed and avoid slide
      act.timeScale = charKey === 'anny' ? 0.55 : 1.0;
      walkAct.current = act;
      console.log(`[${charKey}] walk ready — ANIM[${allWalkAnims.length - 1}] "${walkRaw.name}" (${clip.tracks.length} tracks, timeScale=${act.timeScale})`);
    } else if (walkAnimUrl) {
      console.warn(`[${charKey}] walk GLB has 0 animations!`);
    }

    // Poses
    // NOTE: GLB files are cumulative packs — AnyNp2r.glb contains N+5 animations.
    // The correct pose for each file is always the LAST animation (the newly added one).
    const glbSources = [p0, p1, p2, p3];
    poseActs.current = glbSources.map((glb, i) => {
      const allAnims = glb.animations ?? [];
      // Take the LAST animation — it's the unique pose for this file
      const raw = allAnims.length > 0 ? allAnims[allAnims.length - 1] : null;
      if (!raw || raw.tracks.length === 0) {
        console.warn(`[${charKey}] pose${i + 1} — no animations in GLB!`);
        return null;
      }
      const clip = adaptClip(raw.clone(), clone, `${charKey}/pose${i + 1}`);
      const act = mixer.clipAction(clip);
      // Short clips (< 0.5s) are static poses — clamp at last frame to hold the pose.
      // Longer clips are real looping animations.
      if (clip.duration < 0.5) {
        act.setLoop(THREE.LoopOnce, 1);
        act.clampWhenFinished = true;
      } else {
        act.setLoop(THREE.LoopRepeat, Infinity);
        act.clampWhenFinished = false;
      }
      console.log(`[${charKey}] pose${i + 1} ready — picked ANIM[${allAnims.length - 1}] "${raw.name}" (${clip.tracks.length} tracks, dur=${clip.duration.toFixed(3)}s, loop=${clip.duration < 0.5 ? 'CLAMP' : 'REPEAT'})`);
      return act;
    });

    return () => { mixer.stopAllAction(); mixer.uncacheRoot(clone); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clone, idleAnimUrl, walkAnimUrl, idleGlb, walkGlb, p0, p1, p2, p3]);

  // ── Per-frame logic ───────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
    if (!rb.current || !group.current) return;

    const t = rb.current.translation();
    if (isPlayer) (window as any).playerPos = { x: t.x, y: t.y, z: t.z };
    else          (window as any).npcPos    = { x: t.x, y: t.y, z: t.z };

    const ap = poseState.activePose;

    // ── POSE MODE ──────────────────────────────────────────────────────────────
    if (ap !== null) {
      if (lastPose.current !== ap) {
        lastPose.current  = ap;
        frozenPos.current = { x: t.x, y: t.y, z: t.z };
        idleAct.current?.stop();
        walkAct.current?.stop();
        poseActs.current.forEach((a, i) => { if (a && i !== ap - 1) a.stop(); });
        const act = poseActs.current[ap - 1] ?? null;
        if (act) { act.reset(); act.play(); }
        else console.warn(`[${charKey}] pose${ap} – no action`);
      }
      if (frozenPos.current) {
        rb.current.setTranslation(frozenPos.current, true);
        rb.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rb.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      return;
    }

    // ── EXIT POSE ──────────────────────────────────────────────────────────────
    if (lastPose.current !== null) {
      poseActs.current.forEach(a => a?.fadeOut(0.2));
      lastPose.current  = null;
      frozenPos.current = null;
      isWalking.current = false; // reset walk state so transition works cleanly
      if (idleAct.current) { idleAct.current.reset().fadeIn(0.2).play(); }
    }

    // ── NPC: переключение idle ↔ walk ─────────────────────────────────────────
    if (!isPlayer) {
      const v      = rb.current.linvel();
      const moving = Math.abs(v.x) > 0.1 || Math.abs(v.z) > 0.1;
      if (moving) {
        if (!isWalking.current) {
          isWalking.current = true;
          idleAct.current?.fadeOut(0.15);
          if (walkAct.current) { walkAct.current.reset().fadeIn(0.15).play(); }
        }
        // Face movement direction — NPC rotation is just group.rotation.y (no modelRotationX conflict)
        npcGroupRef.current.rotation.y = THREE.MathUtils.lerp(
          npcGroupRef.current.rotation.y,
          Math.atan2(v.x, v.z), 0.15
        );
      } else {
        if (isWalking.current) {
          isWalking.current = false;
          walkAct.current?.fadeOut(0.15);
          if (idleAct.current) { idleAct.current.reset().fadeIn(0.15).play(); }
        }
      }
      return;
    }

    // ── PLAYER: movement ──────────────────────────────────────────────────────
    const SPEED = 1.25;
    const vel   = rb.current.linvel();
    let dx = 0, dz = 0;
    if (controls.current.forward)  dz -= SPEED;
    if (controls.current.backward) dz += SPEED;
    if (controls.current.left)     dx -= SPEED;
    if (controls.current.right)    dx += SPEED;
    const joy = (window as any).r2Joystick;
    if (joy) {
      if (Math.abs(joy.x) > 0.08) dx += joy.x * SPEED;
      if (Math.abs(joy.y) > 0.08) dz -= joy.y * SPEED;
    }
    rb.current.setLinvel({ x: dx, y: vel.y, z: dz }, true);

    const moving = dx !== 0 || dz !== 0;
    if (moving) {
      // Start walk only once (don't reset() every frame — that causes visual snap)
      if (!isWalking.current) {
        isWalking.current = true;
        idleAct.current?.fadeOut(0.15);
        if (walkAct.current) { walkAct.current.reset().fadeIn(0.15).play(); }
      }
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, Math.atan2(dx, dz), 0.15);
    } else {
      if (isWalking.current) {
        isWalking.current = false;
        walkAct.current?.fadeOut(0.15);
        if (idleAct.current) { idleAct.current.reset().fadeIn(0.15).play(); }
      }
    }

    // ── LEAD BY HAND ──────────────────────────────────────────────────────────
    if (leadState.active && npcRbRef.current && npcGroupRef.current) {
      const npcRb  = npcRbRef.current;
      const npcT   = npcRb.translation();
      const angle  = group.current.rotation.y;
      const fwdX   = Math.sin(angle), fwdZ = Math.cos(angle);
      const rightX = Math.cos(angle), rightZ = -Math.sin(angle);
      const targetX = t.x - fwdX * 0.9 + rightX * 0.4;
      const targetZ = t.z - fwdZ * 0.9 + rightZ * 0.4;
      const dist    = Math.hypot(npcT.x - targetX, npcT.z - targetZ);
      const spd     = Math.min(3, 2 + dist * 1.5);
      const ndx     = (targetX - npcT.x) * spd;
      const ndz     = (targetZ - npcT.z) * spd;
      // Clamp Y ≤ 0: prevent trimesh collisions from pushing NPC upward
      const ndY = Math.min(0, npcRb.linvel().y);
      npcRb.setLinvel({ x: ndx, y: ndY, z: ndz }, true);
    }
  });

  return (
    <RigidBody ref={rb} type="dynamic" lockRotations friction={0} colliders={false} canSleep={false} position={spawnPos}>
      <CapsuleCollider args={colliderArgs} position={colliderOffset} />
      {/* group вращается только по Y (facing direction) */}
      <group ref={group}>
        <primitive object={clone} />
      </group>
    </RigidBody>
  );
};

// ── Interactions ──────────────────────────────────────────────────────────────
const Room2Interactions = () => {
  const { setPromptText } = useStore();
  useTransition();
  // Cache last prompt to avoid calling setPromptText every frame (60fps → Zustand mutations → remount loop)
  const lastPrompt = useRef('');

  useFrame(() => {
    const p = (window as any).playerPos;
    if (!p) return;

    const dBed  = Math.hypot(p.x - BED_CENTER.x,  p.z - BED_CENTER.z);
    const dWall = Math.hypot(p.x - WALL_CENTER.x, p.z - WALL_CENTER.z);
    const dDoor = Math.hypot(p.x - DOOR_CENTER.x, p.z - DOOR_CENTER.z);

    let zone = '';
    if      (dBed  < BED_RADIUS)  zone = 'bed';
    else if (dWall < WALL_RADIUS) zone = 'wall';
    else if (dDoor < DOOR_RADIUS) zone = 'door';
    (window as any).activeZone   = zone;
    (window as any).r2ActiveZone = zone;

    // Only call setPromptText when text changes (prevents 60fps Zustand mutations)
    let newPrompt = '';
    if (poseState.activePose !== null)  newPrompt = '[E] выйти из позы   ·   [F] отпустить руку';
    else if (leadState.active)          newPrompt = '[F] отпустить руку   ·   [E] поза';
    else if (zone === 'door')           newPrompt = '[E] перейти в третью комнату   ·   [F] вести за руку';
    else                                newPrompt = '[E] поза   ·   [F] вести за руку';
    if (newPrompt !== lastPrompt.current) {
      lastPrompt.current = newPrompt;
      setPromptText(newPrompt);
    }

    if ((window as any).r2PoseBtn) {
      (window as any).r2PoseBtn = false;
      if (poseState.activePose !== null) {
        const next = poseState.activePose + 1;
        poseState.activePose = next > 4 ? null : next;
      } else {
        leadState.active     = false;
        poseState.activePose = 1;
        poseState.poseIdx    = 1;
      }
    }
    if ((window as any).r2LeadBtn) {
      (window as any).r2LeadBtn = false;
      leadState.active = !leadState.active;
      if (!leadState.active && npcRbRef.current) npcRbRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ── Guard: ignore key-repeat events (held key) ────────────────────────
      if (e.repeat) return;

      if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
        leadState.active = !leadState.active;
        if (!leadState.active && npcRbRef.current) npcRbRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        console.log('[F] leadState.active =', leadState.active);
        return;
      }
      if (e.key !== 'e' && e.key !== 'E' && e.code !== 'Space') return;
      const zone = (window as any).activeZone ?? '';
      if (zone === 'door') { useStore.getState().setCurrentRoom('Room3Scene'); return; }

      // E: цикл поз null→1→2→3→4→null
      if (poseState.activePose === null) {
        // Войти в первую позу
        leadState.active     = false;
        poseState.activePose = 1;
        poseState.poseIdx    = 1;
      } else {
        // Перейти к следующей позе или выйти
        const next = poseState.activePose + 1;
        if (next > 4) {
          poseState.activePose = null;
        } else {
          poseState.activePose = next;
          poseState.poseIdx    = next;
        }
      }
      console.log('[E] poseState.activePose =', poseState.activePose, '| lead=', leadState.active);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
};

// ── Room model ────────────────────────────────────────────────────────────────
const RoomModel = () => {
  const room = useGLTF(ROOM_URL);
  const scaled = useMemo(() => {
    if (!room.scene) return room.scene;
    const clone = room.scene.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const sz  = new THREE.Vector3(); box.getSize(sz);
    const md  = Math.max(sz.x, sz.z);
    if (md > 0) clone.scale.setScalar(ROOM_SCALE_TARGET / md);
    clone.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(clone);
    clone.position.y -= b2.min.y;
    clone.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
        const m = child.material?.name?.toLowerCase() || '';
        const n = child.name.toLowerCase();
        if (m.includes('glass') || n.includes('glass') || n.includes('window') || m.includes('window')) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, transmission: 0.95, opacity: 1, metalness: 0.1,
            roughness: 0.05, ior: 1.5, thickness: 0.5, envMapIntensity: 2, transparent: true,
          });
        }
      }
    });
    return clone;
  }, [room.scene]);
  return (
    <RigidBody type="fixed" colliders="trimesh">
      <primitive object={scaled} position={[0, 0, 0]} />
    </RigidBody>
  );
};

// ── Error boundary ────────────────────────────────────────────────────────────
class SceneErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(p: any) { super(p); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError)
      return <mesh position={[0,1,0]}><boxGeometry args={[1,1,1]}/><meshStandardMaterial color="red"/></mesh>;
    return this.props.children;
  }
}

// ── Preload ───────────────────────────────────────────────────────────────────
useGLTF.preload(ROOM_URL);
useGLTF.preload(ANNY_URL);
useGLTF.preload(VELL_URL);
useGLTF.preload(ANNY_IDLE_URL);
useGLTF.preload(ANNY_WALK_URL);
useGLTF.preload(VELL_WALK_URL);
ANNY_POSE_URLS.forEach(u => useGLTF.preload(u));
VELL_POSE_URLS.forEach(u => useGLTF.preload(u));

// ── Scene ─────────────────────────────────────────────────────────────────────
export const Room2Scene = () => {
  const { onSceneReady } = useTransition();
  const { character }   = useStore();

  useEffect(() => {
    // Reset all shared state when scene mounts
    poseState.activePose = null;
    poseState.poseIdx    = 0;
    leadState.active     = false;
    onSceneReady();
    console.log('[Room2Scene] mounted — state reset');
  }, [onSceneReady]);

  return (
    <group>
      <ambientLight intensity={0.8} color="#ffe8c0" />
      <hemisphereLight args={["#87CEEB", "#5a3e2b", 0.6]} />
      <group>
        <mesh position={[5, 8, -25]}><sphereGeometry args={[2, 32, 32]} /><meshBasicMaterial color="#ffd599" /></mesh>
        <mesh position={[0, 0, -30]}><planeGeometry args={[100, 50]} /><meshBasicMaterial color="#87CEEB" /></mesh>
        <directionalLight position={[5, 8, -25]} intensity={3} color="#ffd599" castShadow />
      </group>

      <Physics gravity={[0, -15, 0]}>
        <SceneErrorBoundary>
          <Suspense fallback={<group />}><RoomModel /></Suspense>
        </SceneErrorBoundary>

        <RigidBody type="fixed" position={[0, -0.5, 0]}>
          <CuboidCollider args={[20, 0.5, 20]} />
        </RigidBody>

        <SceneErrorBoundary>
          <Suspense fallback={
            <mesh position={[0, 1, 0]}>
              <sphereGeometry args={[0.3, 16, 16]} />
              <meshStandardMaterial color="#ff66b3" emissive="#ff66b3" emissiveIntensity={0.5} wireframe />
            </mesh>
          }>
            {/* Anny: idle (AnyIdle) + walk (AnyWalk) */}
            <CharacterBody
              modelUrl={ANNY_URL}
              idleAnimUrl={ANNY_IDLE_URL}
              walkAnimUrl={ANNY_WALK_URL}
              charKey="anny"
              poseUrls={ANNY_POSE_URLS}
              isPlayer={character === 'Any'}
              spawnPos={[-0.5, 3, 0]}
              targetHeight={0.8}
              colliderArgs={[0.12, 0.35]}
              colliderOffset={[0, 0.47, 0]}
            />
            {/* Vell: без idle (стоит без анимации), walk только когда его ведут */}
            <CharacterBody
              modelUrl={VELL_URL}
              walkAnimUrl={VELL_WALK_URL}
              charKey="vell"
              poseUrls={VELL_POSE_URLS}
              isPlayer={character === 'Vell'}
              spawnPos={[0.5, 3, 0]}
              targetHeight={0.9}
              colliderArgs={[0.13, 0.38]}
              colliderOffset={[0, 0.51, 0]}
              modelRotationX={-Math.PI / 2}
            />
          </Suspense>
        </SceneErrorBoundary>
      </Physics>

      <Room2Interactions />
      <OrbitControls makeDefault target={[0, 1, 0]} maxPolarAngle={Math.PI / 2 + 0.1} minDistance={2} maxDistance={15} />
    </group>
  );
};
