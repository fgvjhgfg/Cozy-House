import React, { useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useTransition } from '../Shared/Transition/TransitionManager';

export interface SceneBaseProps {
  children: React.ReactNode;
  isLoaded: boolean;
  onUpdate?: (delta: number) => void;
}

export const SceneBase: React.FC<SceneBaseProps> = ({ children, isLoaded, onUpdate }) => {
  const { onSceneReady } = useTransition();
  const { scene, gl } = useThree();

  // Handle start() / scene ready
  useEffect(() => {
    if (isLoaded) {
      onSceneReady();
    }
  }, [isLoaded, onSceneReady]);

  // Handle update()
  useFrame((state, delta) => {
    if (isLoaded && onUpdate) {
      onUpdate(delta);
    }
  });

  // Handle dispose()
  useEffect(() => {
    return () => {
      console.log('SceneBase: Disposing scene resources to prevent memory leaks.');
      scene.traverse((object: any) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((mat: any) => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      // Optionally clear scene cache if using custom textures or loaders manually.
    };
  }, [scene]);

  return <>{isLoaded ? children : null}</>;
};
