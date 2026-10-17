import React, {useState, useEffect, useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {Portal} from '../src/Portal.jsx';
import {App} from '../src/App.jsx';
import {stopIntroAudio} from '../src/introAudio.js';
import '../src/styles.css';
import './integrated.css';
document.documentElement.dataset.schoolTheme='spectrum';
function SchoolApp(){
 const [path,setPath]=useState(location.pathname);
 useEffect(()=>{const update=()=>{stopIntroAudio();setPath(location.pathname)};window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update)},[]);
 const enter=useCallback(()=>{stopIntroAudio();history.pushState(null,'','/yuanbai/dialogue/');setPath(location.pathname)},[]);
 return /\/dialogue\/?$/.test(path)?<App/>:<Portal onEnterDialogue={enter}/>;
}
createRoot(document.getElementById('root')).render(<SchoolApp/>);
