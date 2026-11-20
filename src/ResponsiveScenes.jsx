import { lazy, Suspense, useState } from 'react';
import { prefersLightweightScene } from './renderMode.js';
import './mobile-scenes.css';

const DesktopBuilding = lazy(() => import('./YuanbaiScene.js').then(m => ({ default: m.YuanbaiScene })));
const DesktopSculpture = lazy(() => import('./PortalSculpture.js').then(m => ({ default: m.PortalSculpture })));
const asset = name => `${import.meta.env.BASE_URL}mobile/${name}`;

export function MobileBuilding({ phase = 'idle', level = 0 }) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const energy = Math.min(1, Math.max(0, Number(level) || 0));
  const light = phase === 'speaking' ? .3 + energy * .7 : phase === 'listening' ? .4 : .18;
  return <div className="scene-mount mobile-building" data-renderer="image" data-state={failed ? 'fallback' : ready ? 'ready' : 'loading'} aria-hidden="true">
    <div className="mobile-building-frame" style={{ '--window-light': light }}>
      <img className="mobile-window-base" src={asset('windows.webp')} alt="" width="1024" height="768" decoding="async" />
      <img className="mobile-window-light" src={asset('windows.webp')} alt="" width="1024" height="768" decoding="async" />
      <img className="mobile-building-body" src={asset('building.webp')} alt="" width="1024" height="768" fetchPriority="high" decoding="async" onLoad={() => setReady(true)} onError={() => setFailed(true)} />
    </div>
    {failed && <span className="mobile-scene-fallback">元白 · 正在聆听</span>}
  </div>;
}

export function YuanbaiScene(props) {
  const [lightweight] = useState(prefersLightweightScene);
  return lightweight ? <MobileBuilding {...props} /> : <Suspense fallback={<div className="scene-mount" />}><DesktopBuilding {...props} /></Suspense>;
}

export function PortalSculpture(props) {
  const [lightweight] = useState(prefersLightweightScene);
  const [state, setState] = useState('loading');
  if (!lightweight) return <Suspense fallback={<div className="portal-sculpture" />}><DesktopSculpture {...props} /></Suspense>;
  return <div className="portal-sculpture mobile-portal-sculpture" data-state={state} data-renderer="image" aria-hidden="true">
    <img src={asset('portal.webp')} alt="" width="800" height="800" fetchPriority="high" decoding="async" onLoad={() => setState('ready')} onError={() => setState('fallback')} />
  </div>;
}
