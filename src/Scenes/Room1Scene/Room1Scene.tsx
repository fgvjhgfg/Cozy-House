import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useTransition } from '../../Shared/Transition/TransitionManager';
import { useStore } from '../../Shared/Store/useStore';
import * as THREE from 'three';
// @ts-ignore
import { initRoom1, updateRoom1, startRoom1Char, triggerAction, setJoystick } from '../../../Room1Vanilla.js';

export { triggerAction, setJoystick };

export const Room1Scene = () => {
  const { scene, camera } = useThree();
  const { onSceneReady, startTransition } = useTransition();
  const { character, addHug, doorOpened } = useStore();
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!groupRef.current) return;
    
    // Внедряем ванильный код из game.js в React Three Fiber
    initRoom1(groupRef.current, camera, 
        (hugType: string) => {
            console.log("Hug triggered in Vanilla:", hugType);
            addHug('Room1Scene', hugType);
        },
        () => {}, // onDoorClick (not used directly here anymore)
        (text: string) => {
            useStore.getState().setPromptText(text);
        }
    );

    startRoom1Char(character === 'Vell');
    onSceneReady();

    return () => {
        if (groupRef.current) groupRef.current.clear();
    };
  }, [character, camera]);

  useFrame((state, dt) => {
    updateRoom1(dt);
  });

  const handleDoorClick = (e: any) => {
    e.stopPropagation();
    if (doorOpened['Room1Scene']) {
        startTransition('Room2Scene');
    } else {
        alert("Сначала найди 3 уникальных объятия в этой комнате, чтобы открыть дверь!");
    }
  };

  const isDoorOpen = doorOpened['Room1Scene'];

  return (
    <group ref={groupRef}>
        {/* Интерактивная React-дверь внутри ванильной комнаты */}
        <mesh position={[0, 2, -12.9]} onClick={handleDoorClick} cursor="pointer">
            <boxGeometry args={[2.2, 4.2, 0.4]} />
            <meshStandardMaterial color={isDoorOpen ? "#88ff88" : "#ff4444"} transparent opacity={0.5} />
        </mesh>
    </group>
  );
};
