import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Target, Waveform } from "@phosphor-icons/react";
import { PortalSculpture } from "./PortalSculpture";

const YUANBAI_MARK_URL = `${import.meta.env.BASE_URL}brand/yuanbai-mark.svg`;

// 入口页只负责分流。新增第三个体验时，在这里增加一项，并同步调整 styles.css 的网格。
const EXPERIENCES = [
  {
    id: "explore",
    number: "01",
    eyebrow: "黑暗探索 / EXPLORE",
    title: "探索元白",
    description: "走进九乘九的黑暗网格，让元白楼的轮廓在脚下逐格亮起。",
    action: "进入探索模式",
    icon: Target,
    // 开发服务器需要显式 index.html；游戏加载后会把地址栏整理成 /explore/。
    href: "explore/index.html",
  },
  {
    id: "dialogue",
    number: "02",
    eyebrow: "建筑对话 / DIALOGUE",
    title: "对话元白",
    description: "按住说话，让建筑记住你的声音，并用灯光和体块回应。",
    action: "进入对话模式",
    icon: Waveform,
    href: "dialogue/",
  },
];

function PortalCard({ experience, onActivate }) {
  const Icon = experience.icon;
  const href = `${import.meta.env.BASE_URL}${experience.href}`;

  return (
    <a
      className={`portal-card portal-card-${experience.id}`}
      href={href}
      onMouseEnter={() => onActivate(experience.id)}
      onFocus={() => onActivate(experience.id)}
      aria-label={`${experience.title}：${experience.description}`}
    >
      <div className="portal-card-head">
        <strong>{experience.number}</strong>
        <span>{experience.eyebrow}</span>
      </div>
      <div className="portal-card-title">
        <span className="portal-accent" aria-hidden="true" />
        <h2>{experience.title}</h2>
      </div>
      <div className="portal-card-icon" aria-hidden="true">
        <Icon size={72} weight="thin" />
      </div>
      <p>{experience.description}</p>
      <span className="portal-card-action">
        <span>按 {experience.number} · {experience.action}</span>
        <ArrowUpRight size={22} weight="bold" />
      </span>
    </a>
  );
}

export function Portal() {
  const portalRef = useRef(null);
  const projectionRef = useRef(null);
  const [active, setActive] = useState("dialogue");
  const [now, setNow] = useState(() => new Date());
  const activeExperience = useMemo(
    () => EXPERIENCES.find((item) => item.id === active) || EXPERIENCES[1],
    [active],
  );

  useEffect(() => {
    document.title = "元白感知实验室 · YUANBAI PERCEPTION LAB";
    const timer = window.setInterval(() => setNow(new Date()), 1000);

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    // 两侧刻度随鼠标纵向位置反向滑动；CSS transition 负责消除手部细小抖动。
    const onPointerMove = (event) => {
      if (event.pointerType === "touch" || !finePointer.matches || reducedMotion.matches) return;
      const amount = (event.clientY / window.innerHeight - .5) * -52;
      portalRef.current?.style.setProperty("--scale-left-y", `${amount.toFixed(2)}px`);
      portalRef.current?.style.setProperty("--scale-right-y", `${(-amount * .78).toFixed(2)}px`);
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    // 数字键是桌面端快速入口；手机端仍使用整张大卡片点击。
    const onKeyDown = (event) => {
      if (event.key !== "1" && event.key !== "2") return;
      const target = EXPERIENCES[Number(event.key) - 1];
      window.location.assign(`${import.meta.env.BASE_URL}${target.href}`);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  const scaleTicks = Array.from({ length: 13 }, (_, index) => {
    if (index === 0) return "+3.0";
    if (index === 3) return "+1.5";
    if (index === 6) return "0.0";
    if (index === 9) return "-1.5";
    if (index === 12) return "-3.0";
    return "";
  });

  return (
    <main ref={portalRef} className={`portal portal-active-${active}`}>
      <header className="portal-header">
        <div className="portal-brand">
          <img src={YUANBAI_MARK_URL} alt="元白楼标志" />
          <span className="portal-brand-copy">
            <strong>元白感知实验室</strong>
            <span>YUANBAI PERCEPTION LAB</span>
          </span>
        </div>
        <p>让建筑<br />再次与人相遇</p>
      </header>

      <div className="portal-status" aria-label="项目状态">
        <span className="portal-live-dot" />
        <span>ONLINE</span>
        <span>元白楼</span>
        <span>珠海</span>
        <time dateTime={now.toISOString()}>
          {now.toLocaleTimeString("zh-CN", { hour12: false })}
        </time>
      </div>

      <section className="portal-stage" aria-label="元白感知实验装置">
        {/* 顶光由纯 CSS 绘制：锥形亮度、噪点尘埃和缓慢呼吸互相独立，便于后续调色。 */}
        <span className="portal-top-light" aria-hidden="true" />
        <PortalSculpture projectionRef={projectionRef} />
        {/* 使用同一标志制作远处投影；压扁和模糊后只保留形态，不与实体模型重叠。 */}
        <span className="portal-floor-projection" aria-hidden="true">
          <canvas ref={projectionRef} width="256" height="160" />
        </span>
        <div className="portal-scale portal-scale-left" aria-hidden="true">
          {/* 角标固定在刻度窗中央；只有下方 strip 随鼠标滑动。 */}
          <i className="portal-scale-marker" />
          <div className="portal-scale-strip">
            {scaleTicks.map((label, index) => <span key={`left-${index}`}><b>{label}</b><i /></span>)}
          </div>
        </div>
        <div className="portal-scale portal-scale-right" aria-hidden="true">
          <i className="portal-scale-marker" />
          <div className="portal-scale-strip">
            {scaleTicks.map((label, index) => <span key={`right-${index}`}><i /><b>{label}</b></span>)}
          </div>
        </div>
        <div className="portal-model-copy">
          <span>元白与你</span>
          <strong>{activeExperience.eyebrow}</strong>
          <p>{activeExperience.id === "explore" ? "从空间出发，拾起一座楼的记忆。" : "建筑是一种持续发生的对话。"}</p>
        </div>
      </section>

      <nav className="portal-navigation" aria-label="元白体验入口">
        {EXPERIENCES.map((experience) => (
          <PortalCard key={experience.id} experience={experience} onActivate={setActive} />
        ))}
      </nav>

      <footer className="portal-footer">
        <span>YUANBAI PERCEPTION LAB · ARCHITECTURE × PEOPLE × MEMORY</span>
        <span>从空间出发，抵达更好的生活</span>
      </footer>
    </main>
  );
}
