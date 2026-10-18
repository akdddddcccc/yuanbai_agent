import React, {useState, useEffect, useCallback, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {Portal} from '../src/Portal.jsx';
import {PageBoundary, simpleView} from '../src/SceneBoundary.jsx';
const App = lazy(() => import('../src/App.jsx').then(m => ({default:m.App})));
import {stopIntroAudio} from '../src/introAudio.js';
import '../src/styles.css';
import '../public/portal-navigation.css';
import './integrated.css';
function SchoolApp(){
 const [path,setPath]=useState(location.pathname);
 useEffect(()=>{const update=()=>{stopIntroAudio();setPath(location.pathname)};window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update)},[]);
 const enter=useCallback(()=>{stopIntroAudio();history.pushState(null,'','/yuanbai/dialogue/'+(simpleView()?'?view=lite':''));setPath(location.pathname)},[]);
 return /\/dialogue\/?$/.test(path)?<Suspense fallback={<div className="school-loading" role="status">正在打开对话元白…</div>}><App textOnly voiceOutput/></Suspense>:<Portal onEnterDialogue={enter}/>;
}
createRoot(document.getElementById('root')).render(<PageBoundary><SchoolApp/></PageBoundary>);
