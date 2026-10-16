import { ArrowUpRight, Target, Waveform } from '@phosphor-icons/react';
import { PortalSculpture } from './PortalSculpture';
import { useRef } from 'react';
import './public-portal.css';
export function PublicPortal({ onEnterDialogue }) {
  const projectionRef = useRef(null);
  const base = import.meta.env.BASE_URL;
  return <main className="public-portal">
    <header className="public-header"><a href={base}><img src={`${base}brand/yuanbai-mark.svg`} alt=""/><strong>元白</strong><span>感知与对话</span></a><a href="https://design.bnu.edu.cn/" target="_blank" rel="noreferrer">未来设计学院 <ArrowUpRight size={16}/></a></header>
    <section className="public-intro"><div><p className="public-kicker">YUANBAI / PERCEPTION LAB</p><h1>从感知空间，<br/>到与建筑对话。</h1><p>探索元白楼的空间记忆，<br/>也聊聊学院、设计与日常的想法。</p></div><div className="public-model"><PortalSculpture projectionRef={projectionRef}/></div></section>
    <nav className="public-options" aria-label="选择体验">
      <a href={`${base}explore/`}><div className="public-option-top"><span>01 / EXPLORE</span><Target size={32}/></div><h2>探索元白</h2><p>在有限的视野中寻找方向，逐步拼出空间的记忆。</p><strong>进入探索 <ArrowUpRight size={22}/></strong></a>
      <a href={`${base}dialogue/`} onClick={e=>{if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onEnterDialogue();}}}><div className="public-option-top"><span>02 / DIALOGUE</span><Waveform size={32}/></div><h2>对话元白</h2><p>用文字或语音，了解元白、学院与教师的公开研究。</p><strong>开始对话 <ArrowUpRight size={22}/></strong></a>
    </nav>
    <footer className="public-footer"><span>元白楼感知设计项目</span><span>数字助手提供参考，学院事务以正式通知为准。</span></footer>
  </main>;
}
