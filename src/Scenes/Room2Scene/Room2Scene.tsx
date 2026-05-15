import React, { useEffect, useRef, useMemo, Suspense } from 'react';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { useTransition } from '../../Shared/Transition/TransitionManager';
import { useStore } from '../../Shared/Store/useStore';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Physics, RigidBody, RapierRigidBody, CapsuleCollider, CuboidCollider } from '@react-three/rapier';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
// import { DebugCharPoser } from '../../_DEBUG_CharPoser'; // DEBUG_CHAR_POSER (раскомментировать чтобы включить)

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
  stripRootAll = false  // true for rotated models (Vell): strip ALL root-bone tracks (pos+rot)
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
    const isRot = prop.includes('quaternion') || prop.includes('rotation');
    const isRoot = ROOT_MOTION_BONES.has(normBone(bone));
    // For rotated models (Vell walk): strip ALL root tracks (pos AND rot)
    // The walk anim was recorded for an upright model; applying its root rotation
    // to Vell's -π/2 rotated skeleton causes him to flip horizontal.
    if (stripRootAll && isRoot) return;
    // For normal models (Anny walk): only strip root-motion positions
    if (!stripRootAll && isRoot && isPos) return;
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

// Compensates pose clip quaternion tracks for the -π/2 wrapper rotation.
// Pose animations were recorded for an UPRIGHT model, but the clone lives in
// native (lying) space. The rotWrapper applies -π/2 visually.
// To cancel this mismatch, pre-multiply every root bone quaternion keyframe by +π/2.
function compensatePoseClip(
  clip: THREE.AnimationClip,
  root: THREE.Object3D
): THREE.AnimationClip {
  const comp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const boneMap = new Map<string, string>();
  root.traverse(o => {
    if ((o as any).isBone) boneMap.set(normBone(o.name), o.name);
  });
  clip.tracks.forEach(t => {
    const dot  = t.name.indexOf('.');
    const bone = dot !== -1 ? t.name.slice(0, dot) : t.name;
    const prop = dot !== -1 ? t.name.slice(dot) : '';
    const isRoot = [...boneMap.values()].some(real => {
      // Match the track's bone name against the model's actual bone name
      const realNorm = normBone(real);
      const boneNorm = normBone(bone);
      // Only process root bones (direct children of non-bone parents)
      if (realNorm !== boneNorm) return false;
      const obj = root.getObjectByName(real);
      return obj && obj.parent && !(obj.parent as any).isBone;
    });
    if (isRoot && prop.includes('quaternion')) {
      const qt = t as THREE.QuaternionKeyframeTrack;
      const tmp = new THREE.Quaternion();
      for (let i = 0; i < qt.values.length; i += 4) {
        tmp.set(qt.values[i], qt.values[i+1], qt.values[i+2], qt.values[i+3]);
        tmp.premultiply(comp);
        qt.values[i] = tmp.x; qt.values[i+1] = tmp.y;
        qt.values[i+2] = tmp.z; qt.values[i+3] = tmp.w;
      }
    }
  });
  return clip;
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
    // DEV: expose controls globally for testing
    (window as any).__r2controls = mv.current;
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);
  return mv;
};

// ── CharacterBody ─────────────────────────────────────────────────────────────
type PoseSpawn = { pos: [number,number,number]; rotY: number } | null;

// ── Initial spawn positions (used to reset after pose 4) ─────────────────────
const ANNY_INITIAL_SPAWN: [number,number,number] = [0.751, 1, 0.977];
const VELL_INITIAL_SPAWN: [number,number,number] = [-0.721, 3, 0.395];
// Shared flag: when true, CharacterBody will teleport to initial spawn on next frame
const pendingSpawnReset = { anny: false, vell: false };

const CharacterBody = ({
  modelUrl, idleAnimUrl, walkAnimUrl, isPlayer, spawnPos, targetHeight,
  colliderArgs, colliderOffset, charKey, poseUrls, modelRotationX, visualOffsetY = 0,
  poseSpawns,
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
  visualOffsetY?: number;
  /** Per-pose teleport targets: index = pose number - 1. null = use current position. */
  poseSpawns?: PoseSpawn[];
  /** Initial spawn pos used for reset-to-spawn after pose 4 */
  initialSpawn?: [number,number,number];
}) => {
  const DUMMY = '/animations/AnyIdle.glb';
  const model   = useGLTF(modelUrl);
  const idleGlb = useGLTF(idleAnimUrl ?? DUMMY);
  const walkGlb = useGLTF(walkAnimUrl ?? DUMMY);
  const p0 = useGLTF(poseUrls[0]);
  const p1 = useGLTF(poseUrls[1]);
  const p2 = useGLTF(poseUrls[2]);
  const p3 = useGLTF(poseUrls[3]);

  // group — facing direction (rotation.y); rotWrapper — visual X-rotation for Vell
  const group        = useRef<THREE.Group>(null);
  const rotWrapper   = useRef<THREE.Group>(null); // carries modelRotationX for Vell
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
  // Stores T-pose position AND quaternion of root bones (before any animation plays).
  // resetToTpose() XZ position → prevents root-motion drift
  // resetToTpose() Y position  → keeps native Y offset (prevents Anny sinking / Vell floating)
  // resetToTpose() quaternion  → (Vell walk only) prevents Mixamo hips 90° flip
  const rootBoneTpose = useRef<Map<string, { pos: THREE.Vector3; quat: THREE.Quaternion }>>(new Map());

  useFrame(() => {
    if (!isPlayer) {
      npcRbRef.current    = rb.current;
      npcGroupRef.current = group.current;
    }
    // DEBUG_CHAR_POSER: expose rb + frozenPos + group for manual calibration
    if (isPlayer) { (window as any).__debugPlayerRb = rb.current; (window as any).__debugPlayerFrozenPos = frozenPos; (window as any).__debugPlayerGroup = group.current; }
    else          { (window as any).__debugNpcRb    = rb.current; (window as any).__debugNpcFrozenPos    = frozenPos; (window as any).__debugNpcGroup    = group.current; }
  });

  // ── Clone + scale + seat on floor ────────────────────────────────────────────
  const cloneData = useMemo(() => {
    const c = SkeletonUtils.clone(model.scene);

    // APPROACH: Clone stays UNROTATED (native GLB space).
    // ALL Vell animations (walk AND poses) are recorded in native GLB space.
    // Visual upright rotation applied in JSX via rotWrapper (rotation.x = modelRotationX).
    c.updateMatrixWorld(true);
    const box0 = new THREE.Box3().setFromObject(c);
    const sz0  = new THREE.Vector3(); box0.getSize(sz0);
    console.log(`[${charKey}] bbox native: x=${sz0.x.toFixed(3)} y=${sz0.y.toFixed(3)} z=${sz0.z.toFixed(3)}`);

    const rawH = modelRotationX ? sz0.z : sz0.y;
    if (rawH > 0) c.scale.multiplyScalar(targetHeight / rawH);
    console.log(`[${charKey}] rawH=${rawH.toFixed(3)} target=${targetHeight} scale=${(targetHeight/rawH).toFixed(3)}`);
    c.updateMatrixWorld(true);

    const sb = new THREE.Box3().setFromObject(c);
    // rotation.x = -π/2 maps native (x,y,z) → world (x, z, -y).
    // So world_y = native_z → lowest world point = sb.min.z.
    // wrapperFloorY lifts rotWrapper so that sb.min.z aligns with group Y=0.
    const wrapperFloorY = modelRotationX ? -sb.min.z + visualOffsetY : 0;
    // Anny: lift clone so native min.y = 0, plus visualOffsetY
    const floorY = modelRotationX ? 0 : -sb.min.y + visualOffsetY;
    if (!modelRotationX) c.position.y = floorY;
    console.log(`[${charKey}] wrapperFloorY=${wrapperFloorY.toFixed(3)} floorY=${floorY.toFixed(3)} visualOffsetY=${visualOffsetY}`);

    c.traverse(o => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        (o as THREE.Mesh).receiveShadow = true;
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
    return { c, wrapperFloorY, floorY };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.scene, targetHeight, charKey, modelRotationX, visualOffsetY]);

  const clone          = cloneData.c;
  const floorY         = cloneData.floorY;
  const wrapperFloorY  = cloneData.wrapperFloorY;

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
      // Strip only root bone POSITION (prevents root-motion drift in XYZ).
      // Keep root bone ROTATION for walk lean/bob — it works correctly because
      // the clone is UNROTATED (native GLB space) and walk anim was recorded in native space.
      const clip = adaptClip(walkRaw.clone(), clone, `${charKey}/walk`, false);
      const act  = mixer.clipAction(clip);
      act.setLoop(THREE.LoopRepeat, Infinity);
      // Anny: 0.55, Vell: 0.45 (slowed to match higher movement speed of 2.5)
      act.timeScale = charKey === 'anny' ? 0.55 : 0.45;
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
      let clip = adaptClip(raw.clone(), clone, `${charKey}/pose${i + 1}`);
      // For Vell (native/lying clone + -π/2 rotWrapper): poses were recorded for upright model.
      // Compensate root bone quaternion tracks by +π/2 to cancel the wrapper mismatch.
      if (modelRotationX) clip = compensatePoseClip(clip, clone);
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

    // Snapshot T-pose position AND quaternion of root bones.
    {
      const tposeMap = new Map<string, { pos: THREE.Vector3; quat: THREE.Quaternion }>();
      clone.traverse(o => {
        const bone = o as THREE.Bone;
        if (bone.isBone && !(bone.parent as THREE.Bone | null)?.isBone) {
          tposeMap.set(bone.uuid, {
            pos:  bone.position.clone(),
            quat: bone.quaternion.clone(),
          });
        }
      });
      rootBoneTpose.current = tposeMap;
      console.log(`[${charKey}] T-pose captured for ${tposeMap.size} root bone(s)`);
    }

    return () => { mixer.stopAllAction(); mixer.uncacheRoot(clone); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clone, idleAnimUrl, walkAnimUrl, idleGlb, walkGlb, p0, p1, p2, p3]);

  // ── Per-frame logic ───────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
    // Lock clone position to prevent root-motion drift.
    // clone has NO rotation (rotation lives in rotWrapper group in JSX).
    // For Vell (modelRotationX): offset is along native Z axis.
    // For Anny (no rotation): offset is along Y axis.
    if (clone) {
      clone.position.set(0, floorY + visualOffsetY, 0);
      const inPose = poseState.activePose !== null;
      clone.traverse(o => {
        const bone = o as THREE.Bone;
        if (bone.isBone && !(bone.parent as THREE.Bone | null)?.isBone) {
          const tp = rootBoneTpose.current.get(bone.uuid);
          if (modelRotationX) {
            // Vell: zero root bone position.
            // In pose mode: clip was pre-compensated by compensatePoseClip() at load time.
            // In walk/idle: reset quaternion to T-pose to prevent Mixamo hips 90° flip.
            bone.position.set(0, 0, 0);
            if (!inPose && tp) bone.quaternion.copy(tp.quat);
          } else {
            // Anny: zero root bone position.
            bone.position.set(0, 0, 0);
          }
        }
      });
    }
    // Hard-lock upright orientation every frame.
    // Trimesh wall contacts can flip the character despite lockRotations.
    if (rb.current) {
      rb.current.setAngvel({ x: 0, y: 0, z: 0 }, false);
      rb.current.setRotation({ x: 0, y: 0, z: 0, w: 1 }, false);
    }

    if (!rb.current || !group.current) return;

    const t = rb.current.translation();
    if (isPlayer) (window as any).playerPos = { x: t.x, y: t.y, z: t.z };
    else          (window as any).npcPos    = { x: t.x, y: t.y, z: t.z };

    const ap = poseState.activePose;

    // ── POSE MODE ──────────────────────────────────────────────────────────────
    if (ap !== null) {
      if (lastPose.current !== ap) {
        lastPose.current = ap;
        // Switch to kinematic so physics engine stops fighting our frozen position
        rb.current.setBodyType(2, true); // 2 = KinematicPositionBased
        rb.current.setLinvel({ x: 0, y: 0, z: 0 }, false);
        const spawn = poseSpawns?.[ap - 1] ?? null;
        if (spawn) {
          frozenPos.current = { x: spawn.pos[0], y: spawn.pos[1], z: spawn.pos[2] };
          if (group.current) group.current.rotation.y = spawn.rotY;
        } else {
          frozenPos.current = { x: t.x, y: t.y, z: t.z };
        }
        idleAct.current?.stop();
        walkAct.current?.stop();
        poseActs.current.forEach((a, i) => { if (a && i !== ap - 1) a.stop(); });
        const act = poseActs.current[ap - 1] ?? null;
        if (act) { act.reset(); act.play(); }
        else console.warn(`[${charKey}] pose${ap} – no action`);
      }
      if (frozenPos.current) {
        rb.current.setNextKinematicTranslation(frozenPos.current);
      }
      return;
    }

    // ── EXIT POSE ──────────────────────────────────────────────────────────────
    if (lastPose.current !== null) {
      const wasLastPose = lastPose.current === 4;
      poseActs.current.forEach(a => a?.fadeOut(0.2));
      lastPose.current  = null;
      frozenPos.current = null;
      isWalking.current = false;
      // Restore dynamic physics so character can move again
      rb.current.setBodyType(0, true); // 0 = Dynamic
      if (idleAct.current) { idleAct.current.reset().fadeIn(0.2).play(); }
      // After pose 4: teleport back to initial Room 2 spawn
      if (wasLastPose && pendingSpawnReset[charKey] !== undefined) {
        pendingSpawnReset[charKey] = true;
      }
    }
    // Delayed spawn-reset (needs Dynamic body already restored)
    if (pendingSpawnReset[charKey]) {
      pendingSpawnReset[charKey] = false;
      const spawn = charKey === 'anny' ? ANNY_INITIAL_SPAWN : VELL_INITIAL_SPAWN;
      rb.current.setTranslation({ x: spawn[0], y: spawn[1], z: spawn[2] }, true);
      rb.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      if (group.current) group.current.rotation.y = 0;
      console.log(`[${charKey}] reset to initial spawn`, spawn);
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
    // Vell is taller/faster — his walk anim covers more ground per cycle
    const SPEED = charKey === 'vell' ? 2.5 : 1.25;
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
    // Clamp Y ≤ 0: trimesh contact normals can push player upward on ramps/edges.
    // This game has no jumping, so positive Y velocity is always a physics glitch.
    rb.current.setLinvel({ x: dx, y: Math.min(0, vel.y), z: dz }, true);

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
      <group ref={group}>
        {/* rotWrapper: carries visual X-rotation for Vell (-π/2) and floor-Y offset.
            Clone stays in native GLB space; rotWrapper makes Vell appear upright.
            wrapperFloorY positions feet at world Y=0 (= RigidBody floor level). */}
        <group
          ref={rotWrapper}
          rotation={[modelRotationX ?? 0, 0, 0]}
          position={[0, wrapperFloorY, 0]}
        >
          <primitive object={clone} />
        </group>
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
    else if (zone === 'door')           newPrompt = '[H] перейти в третью комнату   ·   [F] вести за руку';
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
      // E cycles poses only — door transition uses H key

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
    // H — переход в Room 3 у двери
    const onKeyH = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key !== 'h' && e.key !== 'H') return;
      if ((window as any).activeZone === 'door') useStore.getState().setCurrentRoom('Room3Scene');
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onKeyH);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', onKeyH);
    };
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
// ── Pose 1 Box (visible only during pose 1) ────────────────────────────────────
const Pose1Box = () => {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.visible = (poseState.activePose === 1);
    (window as any).__debugBoxGroup = groupRef.current;
  });
  // Midpoint between Anny [1.948, -0.968, 3.471] and Vell [-0.507, 0.149, 0.670]
  return (
    <group ref={groupRef} visible={false} position={[0.024, -0.088, 2.044]} scale={2.2}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.45, 0.45, 0.45]} />
        <meshStandardMaterial color="#7B4A2D" roughness={0.85} metalness={0.05} />
      </mesh>
    </group>
  );
};

// ── Pose 4 Box (visible only during pose 4) ─────────────────────────────────────
const Pose4Box = () => {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.visible = (poseState.activePose === 4);
    (window as any).__debugBox2Group = groupRef.current;
  });
  // Рядом с позой 4: Anny [2.821,-0.808,1.656] Vell [0.425,0.053,3.193]
  return (
    <group ref={groupRef} visible={false} position={[0.787, 1.052, 2.279]} scale={[1.00, 6.90, 1.00]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.45, 0.45, 0.45]} />
        <meshStandardMaterial color="#7B4A2D" roughness={0.85} metalness={0.05} />
      </mesh>
    </group>
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
              spawnPos={[0.751, 1, 0.977]}
              targetHeight={0.8}
              colliderArgs={[0.12, 0.35]}
              colliderOffset={[0, 0.47, 0]}
              visualOffsetY={0.72}
              poseSpawns={[
                { pos: [1.948, -0.968, 3.471], rotY: THREE.MathUtils.degToRad(-140.260) }, // Pose 1: объятия
                { pos: [-1.506, -0.048, -4.735], rotY: THREE.MathUtils.degToRad(-60.046) }, // Pose 2
                { pos: [2.899, -0.656, -1.049], rotY: THREE.MathUtils.degToRad(86.173) },  // Pose 3
                { pos: [2.821, -0.808, 1.656],  rotY: THREE.MathUtils.degToRad(-94.423) }, // Pose 4
              ]}
            />
            {/* Vell: без idle (стоит без анимации), walk только когда его ведут */}
            <CharacterBody
              modelUrl={VELL_URL}
              walkAnimUrl={VELL_WALK_URL}
              charKey="vell"
              poseUrls={VELL_POSE_URLS}
              isPlayer={character === 'Vell'}
              spawnPos={[-0.721, 3, 0.395]}
              targetHeight={4.2}
              colliderArgs={[0.13, 0.38]}
              colliderOffset={[0, 0.36, 0]}
              visualOffsetY={-0.5}
              modelRotationX={-Math.PI / 2}
              poseSpawns={[
                { pos: [-0.507, 0.149, 0.670], rotY: THREE.MathUtils.degToRad(41.253) }, // Pose 1: объятия
                { pos: [-2.074, 0.149, -3.654], rotY: THREE.MathUtils.degToRad(152.636) }, // Pose 2: объятия
                { pos: [5.697, -0.675, 0.018], rotY: THREE.MathUtils.degToRad(274.103) }, // Pose 3
                { pos: [0.425, 0.053, 3.193],   rotY: THREE.MathUtils.degToRad(91.032) },  // Pose 4 (451.032-360)
              ]}
            />
          </Suspense>
        </SceneErrorBoundary>

        {/* Pose 1 box — appears during first hug pose */}
        <Pose1Box />
        {/* Pose 4 box — appears during fourth hug pose */}
        <Pose4Box />
      </Physics>

      <Room2Interactions />
      {/* <DebugCharPoser /> */} {/* DEBUG_CHAR_POSER (раскомментировать чтобы включить) */}
      <OrbitControls makeDefault target={[0, 1, 0]} maxPolarAngle={Math.PI / 2 + 0.1} minDistance={2} maxDistance={15} />
    </group>
  );
};
