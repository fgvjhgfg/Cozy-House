import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// ── Decoders for compressed GLB assets ───────────────────────────────────────

// Meshopt: needed for meshopt-compressed geometry
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { useGLTF } from '@react-three/drei';
// @ts-ignore – drei 9.x exposes setMeshoptDecoder on useGLTF
if (typeof (useGLTF as any).setMeshoptDecoder === 'function') {
  (useGLTF as any).setMeshoptDecoder(MeshoptDecoder);
}

// KTX2: needed for ETC1S/UASTC GPU-compressed textures in KTX2 format
// Transcoder WASM files must be served from /basis/ (copied to public/basis/)
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// Patch GLTFLoader to use KTX2Loader with basis transcoder
// This is done once globally so all useGLTF calls benefit
const _ktx2Loader = new KTX2Loader();
_ktx2Loader.setTranscoderPath('/basis/');
// Store on window for lazy renderer injection (Canvas provides WebGLRenderer later)
(window as any).__ktx2Loader = _ktx2Loader;

// ─────────────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
