import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Target, Waveform } from '@phosphor-icons/react';
import { PortalSculpture } from "./ResponsiveScenes.jsx";
import './personal-portal.css';

const base = import.meta.env.BASE_URL;
const experiences = [
  { id: 'explore', number: '01', title: '探索元白', subtitle: '用脚步，拼出空间的记忆', description: '走进未知的网格，在局部线索中寻找方向，让建筑逐格显现。', action: '开始探索', href: `${base}explore/index.html`, Icon: Target },
  { id: 'dialogue', number: '02', title: '对话元白', subtitle: '用声音，与建筑相遇', description: '说出此刻的感受，或一段关于元白的记忆，听见建筑的回应。', action: '进入对话', href: `${base}dialogue/`, Icon: Waveform },
];

export function PersonalPortal({ onEnterDialogue }) {
  const projectionRef = useRef(null);
  const stageRef = useRef(null);
  const [modelState, setModelState] = useState('loading');

  useEffect(() => {
    document.title = '元白感知实验室 · 探索与对话';
    const onKeyDown = (event) => {
      if (event.repeat || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey
        || event.target?.closest?.('input, textarea, select, button, a, [contenteditable="true"]')) return;
      if (event.key === '1') window.location.assign(experiences[0].href);
      if (event.key === '2') onEnterDialogue();
    };
    window.addEventListener('keydown', onKeyDown);
    const updateModelState = () => setModelState(stageRef.current?.querySelector('.portal-sculpture')?.dataset.state || 'loading');
    updateModelState();
    const observer = new MutationObserver(updateModelState);
    if (stageRef.current) observer.observe(stageRef.current, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] });
    return () => { window.removeEventListener('keydown', onKeyDown); observer.disconnect(); };
  }, [onEnterDialogue]);

  const enterDialogue = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onEnterDialogue();
  };

  return (
    <main className="personal-portal">
      <a className="pp-skip" href="#personal-experiences">跳到体验入口</a>
      <div className="pp-shell">
        <header className="pp-header">
          <div className="pp-brand">
            <img src={`${base}brand/yuanbai-mark.svg`} alt="" width="44" height="36" />
            <span><strong>元白感知实验室</strong><small>YUANBAI PERCEPTION LAB</small></span>
          </div>
          <a href="#personal-about" className="pp-about-link">关于这次实验 <ArrowUpRight size={16} aria-hidden="true" /></a>
        </header>

        <section className="pp-hero" aria-labelledby="personal-title">
          <div className="pp-intro">
            <p className="pp-eyebrow">始于一次蒙眼行走</p>
            <h1 id="personal-title">重新认识<br />一座熟悉的楼<span aria-hidden="true">。</span></h1>
            <p className="pp-lead">当视觉退场，脚步、声音与回应，<br className="pp-wide-break" />成为理解元白的新线索。</p>
            <a href="#personal-experiences" className="pp-start">选择一种体验 <ArrowUpRight size={20} aria-hidden="true" /></a>
          </div>
          <figure className="pp-stage" ref={stageRef}>
            <div className="pp-model-view"><PortalSculpture projectionRef={projectionRef} /></div>
            <div className="pp-model-status" role="status" aria-live="polite">
              {modelState === 'loading' && '正在加载建筑装置…'}
              {(modelState === 'fallback' || modelState === 'error') && '装置暂时无法显示，你仍可进入下方体验。'}
            </div>
            <figcaption><span>元白感知装置</span><span>空间的片段，重新相遇</span></figcaption>
          </figure>
        </section>

        <nav id="personal-experiences" className="pp-experiences" aria-label="选择元白体验">
          {experiences.map(({ id, number, title, subtitle, description, action, href, Icon }) => (
            <a key={id} className={`pp-experience pp-experience-${id}`} href={href}
              onClick={id === 'dialogue' ? enterDialogue : undefined} aria-label={`${action}：${subtitle}`}>
              <div className="pp-experience-head"><span className="pp-number">{number}</span><Icon size={28} weight="regular" aria-hidden="true" /></div>
              <h2>{title}</h2><p className="pp-subtitle">{subtitle}</p><p className="pp-description">{description}</p>
              <div className="pp-action"><span>{action}</span><ArrowUpRight size={24} aria-hidden="true" /></div>
            </a>
          ))}
        </nav>

        <section className="pp-about" id="personal-about" aria-labelledby="personal-about-title">
          <h2 id="personal-about-title">看不见的元白</h2>
          <p>一次蒙眼体验，让熟悉的建筑变得陌生。我们把行动中的试探、零散的空间记忆与对回应的期待，转化为探索游戏和建筑对话。你可以从其中任意一种体验开始。</p>
        </section>
        <footer className="pp-footer"><span>元白楼 · 珠海</span><span>用身体感知，以声音回应</span></footer>
      </div>
    </main>
  );
}
