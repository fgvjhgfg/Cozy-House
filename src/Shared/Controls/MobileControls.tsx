import React from 'react';

export const MobileControls = () => {
  return (
    <div style={{
      position: 'fixed', bottom: '20px', left: '20px', right: '20px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      pointerEvents: 'none', zIndex: 100
    }}>
      <div style={{ 
        width: 120, height: 120, borderRadius: '50%', 
        background: 'rgba(255,255,255,0.15)', 
        pointerEvents: 'all', display: 'flex', 
        justifyContent: 'center', alignItems: 'center',
        border: '2px solid rgba(255,255,255,0.3)'
      }}>
        <div style={{ 
          width: 50, height: 50, borderRadius: '50%', 
          background: 'rgba(255,255,255,0.4)',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }} />
      </div>
      
      <div style={{ display: 'flex', gap: '15px', pointerEvents: 'all' }}>
        <button style={{ 
          width: 70, height: 70, borderRadius: '50%', 
          background: '#4da6ff', color: 'white', border: 'none',
          boxShadow: '0 4px 10px rgba(0,0,0,0.2)', fontSize: '24px'
        }}>🤝</button>
        <button style={{ 
          width: 70, height: 70, borderRadius: '50%', 
          background: '#ff66b3', color: 'white', border: 'none',
          boxShadow: '0 4px 10px rgba(0,0,0,0.2)', fontSize: '24px'
        }}>🫂</button>
      </div>
    </div>
  );
};
