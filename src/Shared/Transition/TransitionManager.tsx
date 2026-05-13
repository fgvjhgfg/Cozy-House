import React, { createContext, useContext, useState, useCallback } from 'react';
import { useStore } from '../Store/useStore';

interface TransitionContextType {
  isTransitioning: boolean;
  startTransition: (nextScene: string) => void;
  onSceneReady: () => void;
}

const TransitionContext = createContext<TransitionContextType | null>(null);

export const useTransition = () => {
  const ctx = useContext(TransitionContext);
  if (!ctx) throw new Error('useTransition must be used within TransitionProvider');
  return ctx;
};

export const TransitionProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const { setCurrentRoom } = useStore();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [fadeOpacity, setFadeOpacity] = useState(0);

  const startTransition = useCallback((nextScene: string) => {
    setIsTransitioning(true);
    setFadeOpacity(1); // Fade Out
    setTimeout(() => {
        setCurrentRoom(nextScene);
    }, 800);
  }, [setCurrentRoom]);

  const onSceneReady = useCallback(() => {
    setTimeout(() => {
        setFadeOpacity(0); // Fade In
        setTimeout(() => setIsTransitioning(false), 800);
    }, 200);
  }, []);

  return (
    <TransitionContext.Provider value={{ isTransitioning, startTransition, onSceneReady }}>
      {children}
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'black', opacity: fadeOpacity,
        transition: 'opacity 0.8s ease-in-out',
        pointerEvents: fadeOpacity > 0 ? 'all' : 'none',
        zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center'
      }}>
        {isTransitioning && <h2 style={{color: 'white'}}>Переход в следующую комнату...</h2>}
      </div>
    </TransitionContext.Provider>
  );
};
