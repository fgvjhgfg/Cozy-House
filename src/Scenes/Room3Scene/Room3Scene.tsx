/**
 * Room3Scene — полностью изолированная, лениво загружаемая сцена.
 * Не зависит от Room2Scene. Общие только модели персонажей (GLB).
 * Загружается только при переходе через дверь из Room 2.
 */
import React, { Suspense, useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import { Physics, RigidBody, CapsuleCollider, CuboidCollider, RapierRigidBody } from '@react-three/rapier';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import * as THREE from 'three';
import { useStore } from '../../Shared/Store/useStore';
import { useTransition } from '../../Shared/Transition/TransitionManager';

// ─── URLs ────────────────────────────────────────────────────────────────────
const ROOM3_URL     = '/animations/room3.glb';
const ANNY_URL      = '/animations/AnyModel.glb';
const VELL_URL      = '/animations/VellModel.glb';
const ANNY_WALK_URL = '/animations/AnyIdle.glb';
const VELL_WALK_URL = '/animations/VellWalk.glb';

// ─── Bone name normaliser ────────────────────────────────────────────────────
function normBone(name: string): string {
  const col = name.lastIndexOf(':');
  return col !== -1 ? name.slice(col + 1).toLowerCase() : name.toLowerCase();
}

function adaptClip(clip: THREE.AnimationClip, root: THREE.Object3D): THREE.AnimationClip {
  const boneMap = new Map<string, string>();
  root.traverse(o => {
    if ((o as any).isBone || (o as THREE.SkinnedMesh).isSkinnedMesh) {
      boneMap.set(normBone(o.name), o.name);
    }
    const sm = o as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh && sm.skeleton) {
      sm.skeleton.bones.forEach(b => boneMap.set(normBone(b.name), b.name));
    }
  });

  const tracks: THREE.KeyframeTrack[] = [];
  clip.tracks.forEach(t => {
    const dot  = t.name.indexOf('.');
    const bone = dot !== -1 ? t.name.slice(0, dot) : t.name;
    const prop = dot !== -1 ? t.name.slice(dot)    : '';
    const real = boneMap.get(normBone(bone));
    if (real) {
      const c = t.clone();
      c.name  = real + prop;
      tracks.push(c);
    }
  });

  return new THREE.AnimationClip(clip.name, clip.duration, tracks.length > 0 ? tracks : clip.tracks);
}

// ─── Keyboard hook (isolated from Room 2) ────────────────────────────────────
const useKeys = () => {
  const keys = useRef<Set<string>>(new Set());
  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.current.add(e.code);
    const up   = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup',   up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  return keys;
};

// ─── Room model ───────────────────────────────────────────────────────────────
const Room3Model = () => {
  const { scene } = useGLTF(ROOM3_URL);
  const scaled = useMemo(() => {
    const clone = scene.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) clone.scale.setScalar(12 / maxDim);
    clone.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(clone);
    clone.position.y -= box2.min.y;
    clone.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow   = true;
        (child as THREE.Mesh).receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return (
    <RigidBody type="fixed" colliders="trimesh">
      <primitive object={scaled} />
    </RigidBody>
  );
};

// ─── Character body ───────────────────────────────────────────────────────────
const CharacterBody = ({
  modelUrl,
  walkUrl,
  isPlayer,
  spawnPos,
  targetHeight,
  label,
}: {
  modelUrl: string;
  walkUrl: string;
  isPlayer: boolean;
  spawnPos: [number, number, number];
  targetHeight: number;
  label: string;
}) => {
  const model    = useGLTF(modelUrl);
  const walkGlb  = useGLTF(walkUrl);
  const rb       = useRef<RapierRigidBody>(null);
  const group    = useRef<THREE.Group>(null);
  const keys     = useKeys();

  const mixerRef      = useRef<THREE.AnimationMixer | null>(null);
  const walkActionRef = useRef<THREE.AnimationAction | null>(null);

  // Clone GLB + scale to targetHeight
  const clone = useMemo(() => {
    const c = SkeletonUtils.clone(model.scene);

    // GLB from Mixamo/Blender is Z-up → rotate -90° so character stands upright
    c.rotation.set(-Math.PI / 2, 0, 0);
    c.updateMatrixWorld(true);

    // Measure height AFTER rotation
    const box = new THREE.Box3().setFromObject(c);
    const size = new THREE.Vector3();
    box.getSize(size);
    const h = size.y;
    if (h > 0) c.scale.multiplyScalar(targetHeight / h);
    c.updateMatrixWorld(true);

    // Seat on floor
    const box2 = new THREE.Box3().setFromObject(c);
    c.position.y -= box2.min.y;

    c.traverse(o => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow    = true;
        (o as THREE.Mesh).receiveShadow = true;
      }
    });
    return c;
  }, [model.scene, targetHeight]);

  // Animation mixer
  useEffect(() => {
    if (!clone) return;
    const mixer = new THREE.AnimationMixer(clone);
    mixerRef.current = mixer;

    if (walkGlb.animations.length > 0) {
      let clip = adaptClip(walkGlb.animations[0].clone(), clone);
      // Strip root motion
      clip.tracks = clip.tracks.filter(t => {
        const n = t.name.toLowerCase();
        return !(n.includes('hips') && n.includes('.position'));
      });
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      walkActionRef.current = action;
    }

    return () => { mixer.stopAllAction(); mixer.uncacheRoot(clone); };
  }, [clone, walkGlb]);

  // Export position for proximity checks
  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
    if (!rb.current || !group.current) return;
    const trans = rb.current.translation();

    if (isPlayer) {
      (window as any).r3_playerPos = { x: trans.x, y: trans.y, z: trans.z };
    } else {
      (window as any).r3_npcPos = { x: trans.x, y: trans.y, z: trans.z };
    }

    if (!isPlayer) return;

    const SPEED = 2;
    const k = keys.current;
    let vx = 0, vz = 0;
    if (k.has('KeyW') || k.has('ArrowUp'))    vz -= SPEED;
    if (k.has('KeyS') || k.has('ArrowDown'))  vz += SPEED;
    if (k.has('KeyA') || k.has('ArrowLeft'))  vx -= SPEED;
    if (k.has('KeyD') || k.has('ArrowRight')) vx += SPEED;

    // Mobile joystick
    const joy = (window as any).r3Joystick;
    if (joy) {
      vx += joy.x * SPEED;
      vz -= joy.y * SPEED;
    }

    const moving = vx !== 0 || vz !== 0;
    rb.current.setLinvel({ x: vx, y: rb.current.linvel().y, z: vz }, true);

    // Face direction of movement
    if (moving) {
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y, Math.atan2(vx, vz), 0.15
      );
    }

    // Walk animation
    if (walkActionRef.current) {
      if (moving  && !walkActionRef.current.isRunning()) walkActionRef.current.reset().play();
      if (!moving &&  walkActionRef.current.isRunning()) walkActionRef.current.stop();
    }
  });

  return (
    <RigidBody
      ref={rb}
      type="dynamic"
      lockRotations
      friction={0}
      colliders={false}
      position={spawnPos}
    >
      <CapsuleCollider args={[0.5, 0.3]} position={[0, 0.8, 0]} />
      <group ref={group}>
        <primitive object={clone} />
      </group>
    </RigidBody>
  );
};

// ─── Door trigger — back to Room 2 ───────────────────────────────────────────
const DoorTrigger = () => {
  const { setCurrentRoom, setPromptText } = useStore();

  useFrame(() => {
    const p = (window as any).r3_playerPos;
    if (!p) return;
    const dist = Math.hypot(p.x - 0, p.z - (-5));
    if (dist < 3) {
      setPromptText('Нажми [E], чтобы вернуться в Комнату 2');
      (window as any).r3_atDoor = true;
    } else {
      setPromptText('');
      (window as any).r3_atDoor = false;
    }
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.key === 'e' || e.key === 'E') && (window as any).r3_atDoor) {
        setPromptText('');
        setCurrentRoom('Room2Scene');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [setCurrentRoom, setPromptText]);

  return null;
};

// ─── Scene wrapper ────────────────────────────────────────────────────────────
const Room3Content = () => {
  const { character } = useStore();
  const isAnny = character === 'Any';

  return (
    <group>
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />

      <Physics gravity={[0, -20, 0]}>
        {/* Invisible safety floor */}
        <RigidBody type="fixed" position={[0, -0.2, 0]}>
          <CuboidCollider args={[20, 0.2, 20]} />
        </RigidBody>

        <Suspense fallback={null}>
          <Room3Model />
        </Suspense>

        <Suspense fallback={null}>
          <CharacterBody
            modelUrl={isAnny ? ANNY_URL : VELL_URL}
            walkUrl={isAnny ? ANNY_WALK_URL : VELL_WALK_URL}
            isPlayer
            spawnPos={[0, 2, 0]}
            targetHeight={isAnny ? 1.6 : 1.8}
            label="player"
          />
          <CharacterBody
            modelUrl={isAnny ? VELL_URL : ANNY_URL}
            walkUrl={isAnny ? VELL_WALK_URL : ANNY_WALK_URL}
            isPlayer={false}
            spawnPos={[1.5, 2, 0]}
            targetHeight={isAnny ? 1.8 : 1.6}
            label="npc"
          />
        </Suspense>
      </Physics>

      <DoorTrigger />
      <OrbitControls
        makeDefault
        target={[0, 1, 0]}
        maxPolarAngle={Math.PI / 2 + 0.1}
        minDistance={2}
        maxDistance={15}
      />
    </group>
  );
};

// ─── Public export — lazy loaded ──────────────────────────────────────────────
export const Room3Scene = () => {
  const { onSceneReady } = useTransition();

  useEffect(() => {
    onSceneReady();
  }, [onSceneReady]);

  return (
    <Suspense fallback={null}>
      <Room3Content />
    </Suspense>
  );
};

// Preload assets for Room3 when it becomes active
useGLTF.preload(ROOM3_URL);
useGLTF.preload(ANNY_URL);
useGLTF.preload(VELL_URL);
useGLTF.preload(ANNY_WALK_URL);
useGLTF.preload(VELL_WALK_URL);
