// ╔══════════════════════════════════════════════════════════════╗
// ║  🔧 DEBUG_CHAR_POSER — ВРЕМЕННЫЙ ИНСТРУМЕНТ КАЛИБРОВКИ      ║
// ║  Удалить после калибровки:                                   ║
// ║  1. Удалить этот файл: src/_DEBUG_CharPoser.tsx              ║
// ║  2. В Room2Scene.tsx найти "DEBUG_CHAR_POSER" и убрать       ║
// ╚══════════════════════════════════════════════════════════════╝

import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const R2D = THREE.MathUtils.radToDeg;
type SelMode = 'player' | 'npc' | 'box2';
type RotAxis = 'x' | 'y' | 'z' | null;

export const DebugCharPoser = () => {
  const { camera, gl } = useThree();
  const selected    = useRef<SelMode>('player');
  const dragMode    = useRef(false);
  const dragging    = useRef(false);
  const rotAxis     = useRef<RotAxis>(null);
  const startPos    = useRef({ x: 0, y: 0, z: 0 });
  const startHit    = useRef(new THREE.Vector3());
  const startMouseX = useRef(0);
  const startMouseY = useRef(0);
  const startCharY  = useRef(0);
  const startRotX   = useRef(0);
  const startRotY   = useRef(0);
  const startRotZ   = useRef(0);
  const dragPlane   = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const rc          = useRef(new THREE.Raycaster());

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const getRb = () => selected.current === 'player'
    ? (window as any).__debugPlayerRb
    : (window as any).__debugNpcRb;

  const getCharGroup = (): THREE.Group | null => selected.current === 'player'
    ? (window as any).__debugPlayerGroup ?? null
    : (window as any).__debugNpcGroup ?? null;

  const getBox2 = (): THREE.Group | null =>
    (window as any).__debugBox2Group ?? null;

  const updateFrozen = (pos: { x: number; y: number; z: number }) => {
    const ref = selected.current === 'player'
      ? (window as any).__debugPlayerFrozenPos
      : (window as any).__debugNpcFrozenPos;
    if (ref) ref.current = { ...pos };
  };

  // ── HTML Panel ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const panel = document.createElement('div');
    panel.id = '__dp';
    panel.style.cssText = [
      'position:fixed','bottom:16px','left:16px',
      'background:rgba(0,0,0,0.92)','color:#fff',
      'font:12px monospace','padding:14px 16px',
      'border-radius:10px','z-index:999999',
      'border:2px solid #ff6600','min-width:300px',
      'box-shadow:0 4px 24px rgba(0,0,0,0.7)',
    ].join(';');
    panel.innerHTML = `
      <div style="color:#ff6600;font-weight:bold;font-size:13px;margin-bottom:10px">🔧 DEBUG: Char Poser</div>
      <div style="display:flex;gap:5px;margin-bottom:10px">
        <button id="__dpP" style="flex:1;background:#ff6600;color:#fff;border:none;padding:5px;border-radius:5px;cursor:pointer;font:11px monospace">👤 Player</button>
        <button id="__dpN" style="flex:1;background:#333;color:#aaa;border:none;padding:5px;border-radius:5px;cursor:pointer;font:11px monospace">🤝 NPC</button>
        <button id="__dpB2" style="flex:1;background:#333;color:#aaa;border:none;padding:5px;border-radius:5px;cursor:pointer;font:11px monospace">📦 Box2</button>
      </div>
      <div id="__dpCoords" style="margin-bottom:10px;line-height:2;font-size:11px">—</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="color:#aaa;font-size:11px">📏 Масштаб:</span>
        <button id="__dpScM" style="background:#333;color:#fff;border:1px solid #555;padding:3px 10px;border-radius:4px;cursor:pointer;font:13px monospace">−</button>
        <span id="__dpScV" style="color:#0ff;font-size:11px;min-width:44px;text-align:center">×1.00</span>
        <button id="__dpScP" style="background:#333;color:#fff;border:1px solid #555;padding:3px 10px;border-radius:4px;cursor:pointer;font:13px monospace">+</button>
        <button id="__dpScR" style="background:#333;color:#aaa;border:1px solid #555;padding:3px 7px;border-radius:4px;cursor:pointer;font:10px monospace">reset</button>
      </div>
      <div id="__dpB2Panel" style="display:none;margin-bottom:8px;border:1px solid #555;padding:8px;border-radius:5px">
        <div style="color:#aaa;font-size:10px;margin-bottom:6px">📦 Box2 размер (W/H/D):</div>
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
          <span style="color:#888;font-size:10px;width:28px">W X</span>
          <button id="__b2XM" style="background:#333;color:#fff;border:1px solid #555;padding:2px 8px;border-radius:3px;cursor:pointer;font:12px monospace">−</button>
          <span id="__b2XV" style="min-width:36px;text-align:center;color:#0ff;font-size:11px">1.00</span>
          <button id="__b2XP" style="background:#333;color:#fff;border:1px solid #555;padding:2px 8px;border-radius:3px;cursor:pointer;font:12px monospace">+</button>
        </div>
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
          <span style="color:#888;font-size:10px;width:28px">H Y</span>
          <button id="__b2YM" style="background:#333;color:#fff;border:1px solid #555;padding:2px 8px;border-radius:3px;cursor:pointer;font:12px monospace">−</button>
          <span id="__b2YV" style="min-width:36px;text-align:center;color:#0ff;font-size:11px">1.00</span>
          <button id="__b2YP" style="background:#333;color:#fff;border:1px solid #555;padding:2px 8px;border-radius:3px;cursor:pointer;font:12px monospace">+</button>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <span style="color:#888;font-size:10px;width:28px">D Z</span>
          <button id="__b2ZM" style="background:#333;color:#fff;border:1px solid #555;padding:2px 8px;border-radius:3px;cursor:pointer;font:12px monospace">−</button>
          <span id="__b2ZV" style="min-width:36px;text-align:center;color:#0ff;font-size:11px">1.00</span>
          <button id="__b2ZP" style="background:#333;color:#fff;border:1px solid #555;padding:2px 8px;border-radius:3px;cursor:pointer;font:12px monospace">+</button>
        </div>
      </div>
      <button id="__dpDrag" style="width:100%;background:#1a1a1a;color:#aaa;border:1px solid #555;padding:6px;border-radius:5px;cursor:pointer;font:12px monospace;margin-bottom:6px">
        🖱 DRAG: <span id="__dpDS">OFF</span>
      </button>
      <div id="__dpRotRow" style="display:none;justify-content:space-between;align-items:center;gap:4px;margin-bottom:8px">
        <span style="color:#888;font-size:10px">🔄 Ось:</span>
        <button id="__dpRX" style="flex:1;background:#333;color:#aaa;border:1px solid #555;padding:4px;border-radius:4px;cursor:pointer;font:11px monospace">X</button>
        <button id="__dpRY" style="flex:1;background:#333;color:#aaa;border:1px solid #555;padding:4px;border-radius:4px;cursor:pointer;font:11px monospace">Y</button>
        <button id="__dpRZ" style="flex:1;background:#333;color:#aaa;border:1px solid #555;padding:4px;border-radius:4px;cursor:pointer;font:11px monospace">Z</button>
        <button id="__dpRN" style="flex:1;background:#333;color:#aaa;border:1px solid #555;padding:4px;border-radius:4px;cursor:pointer;font:11px monospace">—</button>
      </div>
      <div style="color:#555;font-size:10px;line-height:1.8;margin-bottom:10px">
        <b style="color:#888">Move:</b> Drag=XZ &nbsp; Shift+Drag=Y<br>
        <b style="color:#888">Rotate:</b> Alt+X/Y/Z → ось → тащи мышью<br>
        <b style="color:#888">Scale:</b> кнопки ±0.05 &nbsp; Shift+колёсико<br>
        Tab = Player ↔ NPC
      </div>
      <button id="__dpCopy" style="width:100%;background:#111;color:#0f0;border:1px solid #0f0;padding:5px;border-radius:5px;cursor:pointer;font:11px monospace">📋 Скопировать координаты</button>
    `;
    document.body.appendChild(panel);

    const btns: Record<SelMode, HTMLButtonElement> = {
      player: document.getElementById('__dpP') as HTMLButtonElement,
      npc:    document.getElementById('__dpN') as HTMLButtonElement,
      box2:   document.getElementById('__dpB2') as HTMLButtonElement,
    };
    const rotRow = document.getElementById('__dpRotRow')!;
    const axBtns: Record<string, HTMLButtonElement> = {
      x:  document.getElementById('__dpRX') as HTMLButtonElement,
      y:  document.getElementById('__dpRY') as HTMLButtonElement,
      z:  document.getElementById('__dpRZ') as HTMLButtonElement,
      '': document.getElementById('__dpRN') as HTMLButtonElement,
    };

    const setRotAxis = (ax: RotAxis) => {
      rotAxis.current = ax;
      const key = ax ?? '';
      Object.keys(axBtns).forEach(k => {
        axBtns[k].style.background  = k === key ? '#ff6600' : '#333';
        axBtns[k].style.color       = k === key ? '#fff'    : '#aaa';
        axBtns[k].style.borderColor = k === key ? '#ff6600' : '#555';
      });
      const ds = document.getElementById('__dpDS')!;
      if (dragMode.current) {
        ds.textContent = ax ? `ON · ROT-${ax.toUpperCase()}` : 'ON';
        ds.style.color = ax ? '#ff9944' : '#0f0';
      }
    };

    const setSelected = (key: SelMode) => {
      selected.current = key;
      (Object.keys(btns) as SelMode[]).forEach(k => {
        btns[k].style.background = k === key ? '#ff6600' : '#333';
        btns[k].style.color      = k === key ? '#fff'    : '#aaa';
      });
      const b2p = document.getElementById('__dpB2Panel')!;
      b2p.style.display = key === 'box2' ? 'block' : 'none';
    };

    const toggleDrag = () => {
      dragMode.current = !dragMode.current;
      const ds  = document.getElementById('__dpDS')!;
      const btn = document.getElementById('__dpDrag')!;
      if (dragMode.current) {
        ds.textContent        = 'ON';
        ds.style.color        = '#0f0';
        btn.style.borderColor = '#0f0';
        rotRow.style.display  = 'flex';
        gl.domElement.style.cursor = 'crosshair';
      } else {
        ds.textContent        = 'OFF';
        ds.style.color        = '#aaa';
        btn.style.borderColor = '#555';
        rotRow.style.display  = 'none';
        gl.domElement.style.cursor = '';
        setRotAxis(null);
      }
    };

    btns.player.addEventListener('click', () => setSelected('player'));
    btns.npc.addEventListener('click',    () => setSelected('npc'));
    btns.box2.addEventListener('click',   () => setSelected('box2'));
    document.getElementById('__dpDrag')!.addEventListener('click', toggleDrag);

    axBtns['x'].addEventListener('click', () => setRotAxis(rotAxis.current === 'x' ? null : 'x'));
    axBtns['y'].addEventListener('click', () => setRotAxis(rotAxis.current === 'y' ? null : 'y'));
    axBtns['z'].addEventListener('click', () => setRotAxis(rotAxis.current === 'z' ? null : 'z'));
    axBtns[''].addEventListener('click',  () => setRotAxis(null));

    // ── Box2 scale buttons ──
    const b2Scale = (axis: 'x'|'y'|'z', delta: number) => {
      const b = getBox2(); if (!b) return;
      const next = Math.max(0.05, (b.scale[axis] as number) + delta);
      b.scale[axis] = next;
      const el = document.getElementById(`__b2${axis.toUpperCase()}V`);
      if (el) el.textContent = next.toFixed(2);
    };
    document.getElementById('__b2XM')!.addEventListener('click', () => b2Scale('x', -0.05));
    document.getElementById('__b2XP')!.addEventListener('click', () => b2Scale('x', +0.05));
    document.getElementById('__b2YM')!.addEventListener('click', () => b2Scale('y', -0.05));
    document.getElementById('__b2YP')!.addEventListener('click', () => b2Scale('y', +0.05));
    document.getElementById('__b2ZM')!.addEventListener('click', () => b2Scale('z', -0.05));
    document.getElementById('__b2ZP')!.addEventListener('click', () => b2Scale('z', +0.05));

    // ── Scale helpers ──────────────────────────────────────────────────────────
    const updateScaleDisplay = () => {
      const g = getCharGroup();
      const sv = document.getElementById('__dpScV');
      if (sv) sv.textContent = `×${(g?.scale.x ?? 1).toFixed(2)}`;
    };
    const changeCharScale = (delta: number) => {
      const g = getCharGroup();
      if (!g) return;
      const next = Math.max(0.1, Math.min(10, g.scale.x + delta));
      g.scale.setScalar(next);
      updateScaleDisplay();
    };
    document.getElementById('__dpScM')!.addEventListener('click', () => changeCharScale(-0.05));
    document.getElementById('__dpScP')!.addEventListener('click', () => changeCharScale(+0.05));
    document.getElementById('__dpScR')!.addEventListener('click', () => {
      const g = getCharGroup(); if (!g) return;
      g.scale.setScalar(1); updateScaleDisplay();
    });

    document.getElementById('__dpCopy')!.addEventListener('click', () => {
      const pRb = (window as any).__debugPlayerRb;
      const nRb = (window as any).__debugNpcRb;
      const pG  = (window as any).__debugPlayerGroup as THREE.Group | undefined;
      const nG  = (window as any).__debugNpcGroup   as THREE.Group | undefined;
      const p   = pRb?.translation() ?? { x: 0, y: 0, z: 0 };
      const n   = nRb?.translation() ?? { x: 0, y: 0, z: 0 };
      const pr  = pG?.rotation ?? new THREE.Euler();
      const nr  = nG?.rotation ?? new THREE.Euler();
      const f   = (v: number) => v.toFixed(3);
      const txt =
        `// Player — pos: [${f(p.x)}, ${f(p.y)}, ${f(p.z)}]  rot: [${f(R2D(pr.x))}°, ${f(R2D(pr.y))}°, ${f(R2D(pr.z))}°]\n` +
        `// NPC    — pos: [${f(n.x)}, ${f(n.y)}, ${f(n.z)}]  rot: [${f(R2D(nr.x))}°, ${f(R2D(nr.y))}°, ${f(R2D(nr.z))}°]`;
      navigator.clipboard.writeText(txt).then(() => {
        const btn = document.getElementById('__dpCopy')!;
        btn.textContent = '✅ Скопировано!';
        setTimeout(() => { btn.textContent = '📋 Скопировать координаты'; }, 2000);
      });
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setSelected(selected.current === 'player' ? 'npc' : 'player');
        return;
      }
      if (dragMode.current && e.altKey) {
        if (e.code === 'KeyX') { e.preventDefault(); setRotAxis(rotAxis.current === 'x' ? null : 'x'); }
        if (e.code === 'KeyY') { e.preventDefault(); setRotAxis(rotAxis.current === 'y' ? null : 'y'); }
        if (e.code === 'KeyZ') { e.preventDefault(); setRotAxis(rotAxis.current === 'z' ? null : 'z'); }
      }
      if (e.code === 'Escape' && rotAxis.current) {
        e.preventDefault();
        setRotAxis(null);
      }
    };
    window.addEventListener('keydown', onKey);

    // ── Shift+Wheel = scale ───────────────────────────────────────────────────
    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      e.preventDefault(); e.stopPropagation();
      const g = getCharGroup(); if (!g) return;
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      const next  = Math.max(0.1, Math.min(10, g.scale.x + delta));
      g.scale.setScalar(next);
      const sv = document.getElementById('__dpScV');
      if (sv) sv.textContent = `×${next.toFixed(2)}`;
    };
    gl.domElement.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', onKey);
      gl.domElement.removeEventListener('wheel', onWheel);
      panel.remove();
      gl.domElement.style.cursor = '';
    };
  }, [gl]);

  // ── Pointer events ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = gl.domElement;

    const getMouseNDC = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX - r.left) / r.width)  *  2 - 1,
        ((e.clientY - r.top)  / r.height) * -2 + 1,
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!dragMode.current) return;
      e.stopPropagation();
      if (e.button !== 0) return;

      // ── Box2 drag (no rigidbody — move group directly)
      if (selected.current === 'box2') {
        const box = getBox2(); if (!box) return;
        dragging.current    = true;
        startMouseX.current = e.clientX;
        startMouseY.current = e.clientY;
        startPos.current    = { x: box.position.x, y: box.position.y, z: box.position.z };
        startCharY.current  = box.position.y;
        startRotX.current   = box.rotation.x;
        startRotY.current   = box.rotation.y;
        startRotZ.current   = box.rotation.z;
        dragPlane.current.set(new THREE.Vector3(0, 1, 0), -box.position.y);
        rc.current.setFromCamera(getMouseNDC(e), camera);
        const hit = rc.current.ray.intersectPlane(dragPlane.current, startHit.current);
        if (!hit) startHit.current.set(box.position.x, box.position.y, box.position.z);
        (e.target as Element).setPointerCapture(e.pointerId);
        return;
      }

      const rb = getRb();
      if (!rb) return;
      dragging.current   = true;
      startMouseX.current = e.clientX;
      startMouseY.current = e.clientY;
      const t            = rb.translation();
      startPos.current   = { x: t.x, y: t.y, z: t.z };
      startCharY.current = t.y;
      startRotX.current  = getCharGroup()?.rotation.x ?? 0;
      startRotY.current  = getCharGroup()?.rotation.y ?? 0;
      startRotZ.current  = getCharGroup()?.rotation.z ?? 0;
      dragPlane.current.set(new THREE.Vector3(0, 1, 0), -t.y);
      rc.current.setFromCamera(getMouseNDC(e), camera);
      const hit = rc.current.ray.intersectPlane(dragPlane.current, startHit.current);
      if (!hit) startHit.current.set(t.x, t.y, t.z);
      (e.target as Element).setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragMode.current || !dragging.current) return;
      e.stopPropagation();
      const dx      = e.clientX - startMouseX.current;
      const dy      = e.clientY - startMouseY.current;
      const isShift = e.shiftKey;
      const axis    = rotAxis.current;

      // ── Box2 move
      if (selected.current === 'box2') {
        const box = getBox2(); if (!box) return;
        if (axis === 'x')      { box.rotation.x = startRotX.current + dy * 0.008; }
        else if (axis === 'y') { box.rotation.y = startRotY.current + dx * 0.008; }
        else if (axis === 'z') { box.rotation.z = startRotZ.current + dx * 0.008; }
        else if (isShift) {
          box.position.y = startCharY.current - dy * 0.008;
        } else {
          rc.current.setFromCamera(getMouseNDC(e), camera);
          const hit = new THREE.Vector3();
          if (rc.current.ray.intersectPlane(dragPlane.current, hit)) {
            box.position.x = startPos.current.x + (hit.x - startHit.current.x);
            box.position.z = startPos.current.z + (hit.z - startHit.current.z);
          }
        }
        return;
      }

      const rb    = getRb();
      const group = getCharGroup();
      if (!rb) return;
      const t = rb.translation();
      if (axis === 'x')      { if (group) group.rotation.x = startRotX.current + dy * 0.008; }
      else if (axis === 'y') { if (group) group.rotation.y = startRotY.current + dx * 0.008; }
      else if (axis === 'z') { if (group) group.rotation.z = startRotZ.current + dx * 0.008; }
      else if (isShift) {
        const np = { x: t.x, y: startCharY.current - dy * 0.008, z: t.z };
        rb.setTranslation(np, true); rb.setLinvel({ x: 0, y: 0, z: 0 }, true); updateFrozen(np);
      } else {
        rc.current.setFromCamera(getMouseNDC(e), camera);
        const hit = new THREE.Vector3();
        if (rc.current.ray.intersectPlane(dragPlane.current, hit)) {
          const np = { x: startPos.current.x + (hit.x - startHit.current.x), y: t.y, z: startPos.current.z + (hit.z - startHit.current.z) };
          rb.setTranslation(np, true); rb.setLinvel({ x: 0, y: 0, z: 0 }, true); updateFrozen(np);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragMode.current) return;
      e.stopPropagation();
      if (e.button === 0 && dragging.current) {
        dragging.current = false;
        try { (e.target as Element).releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };

    canvas.addEventListener('pointerdown',   onPointerDown, { capture: true });
    canvas.addEventListener('pointermove',   onPointerMove, { capture: true });
    canvas.addEventListener('pointerup',     onPointerUp,   { capture: true });
    canvas.addEventListener('pointercancel', onPointerUp,   { capture: true });
    return () => {
      canvas.removeEventListener('pointerdown',   onPointerDown, { capture: true });
      canvas.removeEventListener('pointermove',   onPointerMove, { capture: true });
      canvas.removeEventListener('pointerup',     onPointerUp,   { capture: true });
      canvas.removeEventListener('pointercancel', onPointerUp,   { capture: true });
    };
  }, [camera, gl]);

  // ── Display ───────────────────────────────────────────────────────────────────
  useFrame(() => {
    const el = document.getElementById('__dpCoords');
    if (!el) return;
    const pRb = (window as any).__debugPlayerRb;
    const nRb = (window as any).__debugNpcRb;
    const pG  = (window as any).__debugPlayerGroup as THREE.Group | undefined;
    const nG  = (window as any).__debugNpcGroup   as THREE.Group | undefined;
    const p   = pRb?.translation();
    const n   = nRb?.translation();
    const pr  = pG?.rotation;
    const nr  = nG?.rotation;
    const sel = selected.current;

    const fPos = (v: any, active: boolean) => {
      if (!v) return '<span style="color:#444">—</span>';
      const c = active ? '#ffcc00' : '#666';
      return `<span style="color:${c}">x=${v.x.toFixed(2)} y=${v.y.toFixed(2)} z=${v.z.toFixed(2)}</span>`;
    };
    const fRot = (r: THREE.Euler | undefined, active: boolean) => {
      if (!r) return '';
      const c = active ? '#ff9955' : '#444';
      return `<span style="color:${c}"> ${R2D(r.x).toFixed(1)}° ${R2D(r.y).toFixed(1)}° ${R2D(r.z).toFixed(1)}°</span>`;
    };

    // Sync scale display
    const sv = document.getElementById('__dpScV');
    const cg = sel === 'player'
      ? (window as any).__debugPlayerGroup as THREE.Group | undefined
      : (window as any).__debugNpcGroup   as THREE.Group | undefined;
    if (sv && cg && sel !== 'box2') sv.textContent = `×${cg.scale.x.toFixed(2)}`;

    // Sync box2 scale display
    const b2 = getBox2();
    if (b2) {
      const xv = document.getElementById('__b2XV'); if (xv) xv.textContent = b2.scale.x.toFixed(2);
      const yv = document.getElementById('__b2YV'); if (yv) yv.textContent = b2.scale.y.toFixed(2);
      const zv = document.getElementById('__b2ZV'); if (zv) zv.textContent = b2.scale.z.toFixed(2);
    }

    // Box2 coords display
    const f3 = (v: number) => v.toFixed(3);
    const b2Line = b2
      ? `<div>📦 <span style="color:${sel==='box2'?'#ffcc00':'#666'}">pos [${f3(b2.position.x)}, ${f3(b2.position.y)}, ${f3(b2.position.z)}]  scale [${b2.scale.x.toFixed(2)}, ${b2.scale.y.toFixed(2)}, ${b2.scale.z.toFixed(2)}]</span></div>`
      : '';

    el.innerHTML = `
      <div>👤 ${fPos(p, sel==='player')}${fRot(pr, sel==='player')}</div>
      <div>🤝 ${fPos(n, sel==='npc')}${fRot(nr, sel==='npc')}</div>
      ${b2Line}
    `;
  });

  return null;
};
