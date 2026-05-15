import React, { Suspense, lazy, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { TransitionProvider } from './Shared/Transition/TransitionManager';
import { useStore } from './Shared/Store/useStore';
import { Room1Scene } from './Scenes/Room1Scene/Room1Scene';
import { Room2Scene } from './Scenes/Room2Scene/Room2Scene';
import { LoadingScreen } from './Shared/Cache/LoadingScreen';
// Room3Scene lazy-loaded: JS chunk + room3.glb + animations load ONLY when entering via door
const Room3Scene = lazy(() =>
  import('./Scenes/Room3Scene/Room3Scene').then(m => ({ default: m.Room3Scene }))
);
import './index.css';

// Inject WebGLRenderer into KTX2Loader (stored in window by main.tsx)
function initKTX2(renderer: any) {
  const loader = (window as any).__ktx2Loader;
  if (loader && !loader._rendererSet) {
    try { loader.detectSupport(renderer); loader._rendererSet = true; } catch(e) {}
  }
}

const HUD = () => {
  const { foundHugs, currentRoom, doorOpened, promptText } = useStore();
  const hugs = foundHugs[currentRoom] || [];
  const isOpen = doorOpened[currentRoom];

  return (
    <>
      <div className="hud">
        <h2>Объятия: {hugs.length} / 4</h2>
        {isOpen ? <p style={{color:'#88ff88'}}>🚪 Дверь открыта!</p> : <p>Найди 4 разных позы объятий.</p>}
      </div>
      {promptText && (
        <div className="interaction-prompt">
          {promptText}
        </div>
      )}
    </>
  );
};

const CharacterSelection = () => {
  const { setCharacter, unlockedRooms, currentRoom, setCurrentRoom } = useStore();
  
  return (
    <div className="char-select">
      <h1 style={{fontSize: '50px'}}>Cozy House SPA</h1>
      <p>Выбери персонажа</p>
      <div>
        <button className="char-btn" onClick={() => setCharacter('Vell')}>Играть за Vell</button>
        <button className="char-btn" onClick={() => setCharacter('Any')}>Играть за Any</button>
      </div>
      
      {unlockedRooms.length > 1 && (
        <div style={{ marginTop: '40px', background: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '15px' }}>
          <h3 style={{ color: '#ff66b3', marginBottom: '15px' }}>🔓 Выбор уровня</h3>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button 
              className="char-btn" 
              style={{ fontSize: '16px', padding: '10px 20px', background: currentRoom === 'Room1Scene' ? '#ff66b3' : '#333' }} 
              onClick={() => setCurrentRoom('Room1Scene')}
            >
              Комната 1
            </button>
            {unlockedRooms.includes('Room2Scene') && (
              <button 
                className="char-btn" 
                style={{ fontSize: '16px', padding: '10px 20px', background: currentRoom === 'Room2Scene' ? '#ff66b3' : '#333' }} 
                onClick={() => setCurrentRoom('Room2Scene')}
              >
                Комната 2
              </button>
            )}
            <button 
              className="char-btn" 
              style={{ fontSize: '16px', padding: '10px 20px', background: currentRoom === 'Room3Scene' ? '#ff66b3' : '#333' }} 
              onClick={() => setCurrentRoom('Room3Scene')}
            >
              Комната 3
            </button>
          </div>
          <p style={{ fontSize: '14px', color: '#aaa', marginTop: '15px' }}>Выбери уровень, а затем нажми "Играть", чтобы начать.</p>
        </div>
      )}
      <button 
        style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '10px' }}
        onClick={() => useStore.getState().unlockRoom('Room2Scene')}
      >
        [DEV: Открыть Комнату 2]
      </button>
    </div>
  );
}

import { triggerAction, setJoystick } from './Scenes/Room1Scene/Room1Scene';

const MobileControls = () => {
  const stickRef = React.useRef<HTMLDivElement>(null);
  const knobRef = React.useRef<HTMLDivElement>(null);
  const activePtr = React.useRef<number | null>(null);

  const getOffset = (e: PointerEvent) => {
    const el = stickRef.current;
    if (!el) return { dx: 0, dy: 0 };
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const RADIUS = 48;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) { dx = dx / len * RADIUS; dy = dy / len * RADIUS; }
    return { dx, dy, nx: dx / RADIUS, ny: -dy / RADIUS };
  };

  React.useEffect(() => {
    const stick = stickRef.current;
    const knob = knobRef.current;
    if (!stick || !knob) return;

    const onDown = (e: PointerEvent) => {
      if (activePtr.current !== null) return;
      activePtr.current = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      const { dx, dy, nx = 0, ny = 0 } = getOffset(e);
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      setJoystick(nx, ny);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== activePtr.current) return;
      const { dx, dy, nx = 0, ny = 0 } = getOffset(e);
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      setJoystick(nx, ny);
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== activePtr.current) return;
      activePtr.current = null;
      knob.style.transform = 'translate(0px,0px)';
      setJoystick(0, 0);
    };

    stick.addEventListener('pointerdown', onDown, { passive: false });
    stick.addEventListener('pointermove', onMove, { passive: false });
    stick.addEventListener('pointerup', onUp);
    stick.addEventListener('pointercancel', onUp);
    stick.addEventListener('lostpointercapture', onUp);
    return () => {
      stick.removeEventListener('pointerdown', onDown);
      stick.removeEventListener('pointermove', onMove);
      stick.removeEventListener('pointerup', onUp);
      stick.removeEventListener('pointercancel', onUp);
      stick.removeEventListener('lostpointercapture', onUp);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: 0, right: 0,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      padding: '0 20px', pointerEvents: 'none', zIndex: 200,
    }}>
      {/* Joystick – needs id="stick" and id="knob" for Room1Vanilla.js */}
      <div
        id="stick"
        ref={stickRef}
        style={{
          width: 120, height: 120, borderRadius: '50%',
          background: 'rgba(255,255,255,0.18)',
          border: '2px solid rgba(255,255,255,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'all', touchAction: 'none', userSelect: 'none',
        }}
      >
        <div
          id="knob"
          ref={knobRef}
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(255,255,255,0.55)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            pointerEvents: 'none', transition: 'transform 0.05s',
          }}
        />
      </div>

      {/* Action buttons – id="leadBtn" and id="hugBtn" for Room1Vanilla.js */}
      <div style={{ display: 'flex', gap: 14, pointerEvents: 'all' }}>
        <button
          id="leadBtn"
          onPointerDown={(e) => { e.preventDefault(); triggerAction('lead'); }}
          style={{
            width: 70, height: 70, borderRadius: '50%',
            background: '#4da6ff', color: 'white', border: 'none',
            boxShadow: '0 4px 12px rgba(77,166,255,0.5)',
            fontSize: 26, touchAction: 'none', userSelect: 'none', cursor: 'pointer',
          }}
        >🤝</button>
        <button
          id="hugBtn"
          onPointerDown={(e) => { e.preventDefault(); triggerAction('hug'); }}
          style={{
            width: 70, height: 70, borderRadius: '50%',
            background: '#ff66b3', color: 'white', border: 'none',
            boxShadow: '0 4px 12px rgba(255,102,179,0.5)',
            fontSize: 26, touchAction: 'none', userSelect: 'none', cursor: 'pointer',
          }}
        >🫂</button>
      </div>
    </div>
  );
};

const Room2MobileControls = () => {
  const stickRef = React.useRef<HTMLDivElement>(null);
  const knobRef  = React.useRef<HTMLDivElement>(null);
  const activePtr = React.useRef<number | null>(null);


  React.useEffect(() => {
    const stick = stickRef.current;
    const knob  = knobRef.current;
    if (!stick || !knob) return;

    const getVec = (e: PointerEvent) => {
      const r = stick.getBoundingClientRect();
      const RADIUS = 48;
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top  + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > RADIUS) { dx = dx / len * RADIUS; dy = dy / len * RADIUS; }
      return { dx, dy, nx: dx / RADIUS, ny: -dy / RADIUS };
    };

    const onDown = (e: PointerEvent) => {
      if (activePtr.current !== null) return;
      activePtr.current = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      const { dx, dy, nx, ny } = getVec(e);
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      (window as any).r2Joystick = { x: nx, y: ny };
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== activePtr.current) return;
      const { dx, dy, nx, ny } = getVec(e);
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      (window as any).r2Joystick = { x: nx, y: ny };
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== activePtr.current) return;
      activePtr.current = null;
      knob.style.transform = 'translate(0px,0px)';
      (window as any).r2Joystick = null;
    };

    stick.addEventListener('pointerdown', onDown, { passive: false });
    stick.addEventListener('pointermove', onMove, { passive: false });
    stick.addEventListener('pointerup', onUp);
    stick.addEventListener('pointercancel', onUp);
    stick.addEventListener('lostpointercapture', onUp);
    return () => {
      stick.removeEventListener('pointerdown', onDown);
      stick.removeEventListener('pointermove', onMove);
      stick.removeEventListener('pointerup', onUp);
      stick.removeEventListener('pointercancel', onUp);
      stick.removeEventListener('lostpointercapture', onUp);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: 0, right: 0,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      padding: '0 20px', pointerEvents: 'none', zIndex: 200,
    }}>
      {/* Joystick */}
      <div
        ref={stickRef}
        style={{
          width: 120, height: 120, borderRadius: '50%',
          background: 'rgba(255,255,255,0.18)',
          border: '2px solid rgba(255,255,255,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'all', touchAction: 'none', userSelect: 'none',
        }}
      >
        <div
          ref={knobRef}
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(255,255,255,0.55)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Action buttons: F (lead) + E (interact) */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', pointerEvents: 'all' }}>
        <button
          onPointerDown={(e) => { e.preventDefault(); (window as any).r2LeadBtn = true; }}
          style={{
            width: 68, height: 68, borderRadius: '50%',
            background: '#4da6ff', color: 'white', border: 'none',
            boxShadow: '0 4px 14px rgba(77,166,255,0.5)',
            fontSize: 22, fontWeight: 700, cursor: 'pointer',
            touchAction: 'none',
          }}
        >
          🤝
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); (window as any).r2PoseBtn = true; }}
          style={{
            width: 80, height: 80, borderRadius: '50%',
            background: '#ff66b3', color: 'white', border: 'none',
            boxShadow: '0 4px 14px rgba(255,102,179,0.5)',
            fontSize: 26, fontWeight: 700, cursor: 'pointer',
            touchAction: 'none',
          }}
        >
          🫂
        </button>
      </div>
    </div>
  );
};

const isMobile = () =>
  /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && !/Windows/i.test(navigator.userAgent));

const Room3MobileControls = () => {
  if (!isMobile()) return null;

  const stickRef = React.useRef<HTMLDivElement>(null);
  const knobRef  = React.useRef<HTMLDivElement>(null);
  const activePtr = React.useRef<number | null>(null);

  React.useEffect(() => {
    const stick = stickRef.current;
    const knob  = knobRef.current;
    if (!stick || !knob) return;

    const getVec = (e: PointerEvent) => {
      const r = stick.getBoundingClientRect();
      const RADIUS = 48;
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top  + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > RADIUS) { dx = dx / len * RADIUS; dy = dy / len * RADIUS; }
      return { dx, dy, nx: dx / RADIUS, ny: -dy / RADIUS };
    };

    const onDown = (e: PointerEvent) => {
      if (activePtr.current !== null) return;
      activePtr.current = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      const { dx, dy, nx, ny } = getVec(e);
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      (window as any).r3Joystick = { x: nx, y: ny };
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== activePtr.current) return;
      const { dx, dy, nx, ny } = getVec(e);
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      (window as any).r3Joystick = { x: nx, y: ny };
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== activePtr.current) return;
      activePtr.current = null;
      knob.style.transform = 'translate(0px,0px)';
      (window as any).r3Joystick = null;
    };

    stick.addEventListener('pointerdown', onDown, { passive: false });
    stick.addEventListener('pointermove', onMove, { passive: false });
    stick.addEventListener('pointerup', onUp);
    stick.addEventListener('pointercancel', onUp);
    stick.addEventListener('lostpointercapture', onUp);
    return () => {
      stick.removeEventListener('pointerdown', onDown);
      stick.removeEventListener('pointermove', onMove);
      stick.removeEventListener('pointerup', onUp);
      stick.removeEventListener('pointercancel', onUp);
      stick.removeEventListener('lostpointercapture', onUp);
    };
  }, []);

  const fireE = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', bubbles: true }));
  };

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: 0, right: 0,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      padding: '0 20px', pointerEvents: 'none', zIndex: 200,
    }}>
      <div
        ref={stickRef}
        style={{
          width: 120, height: 120, borderRadius: '50%',
          background: 'rgba(255,255,255,0.18)',
          border: '2px solid rgba(255,255,255,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'all', touchAction: 'none', userSelect: 'none',
        }}
      >
        <div
          ref={knobRef}
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(255,255,255,0.55)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            pointerEvents: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', pointerEvents: 'all' }}>
        <button
          onPointerDown={(e) => { e.preventDefault(); fireE(); }}
          style={{
            width: 80, height: 80, borderRadius: '50%',
            background: '#ff66b3', color: 'white', border: 'none',
            boxShadow: '0 4px 14px rgba(255,102,179,0.5)',
            fontSize: 26, fontWeight: 700, cursor: 'pointer',
            touchAction: 'none',
          }}
        >
          E
        </button>
      </div>
    </div>
  );
};

import { Loader } from '@react-three/drei';

export const App = () => {
  const { character, currentRoom } = useStore();
  // PWA: показываем LoadingScreen при первом запуске
  // После нажатия "Играть" или "Скачать" — скрываем навсегда в этой сессии
  const [showLoader, setShowLoader] = useState(
    // В dev (?r=2) пропускаем загрузочный экран
    !new URLSearchParams(window.location.search).has('r')
  );

  // DEV: ?r=2 → сразу Room 2, минуя меню. ?c=Vell / ?c=Any → выбор персонажа
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('r') === '2') {
      const s = useStore.getState();
      const char = p.get('c') === 'Vell' ? 'Vell' : 'Any';
      s.setCharacter(char);
      s.unlockRoom('Room2Scene');
      s.setCurrentRoom('Room2Scene');
    }
  }, []);

  // Показываем LoadingScreen до выбора персонажа
  if (showLoader) return <LoadingScreen onPlay={() => setShowLoader(false)} />;

  if (!character) return <CharacterSelection />;

  return (
    <TransitionProvider>
      <HUD />
      <Canvas
        camera={{ position: [0, 5, 12], fov: 58 }}
        shadows
        gl={{ antialias: true }}
        onCreated={({ gl }) => initKTX2(gl)}
      >
        <color attach="background" args={["#1a1a2e"]} />
        <Suspense fallback={
          // Показываем простой цвет фона пока грузится 3D контент
          <mesh>
            <planeGeometry args={[100, 100]} />
            <meshBasicMaterial color="#1a1a2e" />
          </mesh>
        }>
          {currentRoom === 'Room1Scene' && <Room1Scene />}
          {currentRoom === 'Room2Scene' && <Room2Scene />}
          {currentRoom === 'Room3Scene' && <Room3Scene />}
        </Suspense>
      </Canvas>
      {currentRoom === 'Room1Scene' && <MobileControls />}
      {currentRoom === 'Room2Scene' && <Room2MobileControls />}
      {currentRoom === 'Room3Scene' && <Room3MobileControls />}
      <Loader 
        containerStyles={{ background: '#1a1a2e' }} 
        innerStyles={{ width: '300px' }} 
        barStyles={{ background: '#ff66b3' }} 
        dataInterpolation={(p) => `Загрузка 3D моделей... ${p.toFixed(0)}%`} 
      />
    </TransitionProvider>
  );
};

export default App;
