import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { Target } from "@phosphor-icons/react/dist/csr/Target";
import { BookOpen } from "@phosphor-icons/react/dist/csr/BookOpen";
import { PortalSculpture } from "../src/PortalSculpture";

const YUANBAI_MARK_URL = `${import.meta.env.BASE_URL}brand/yuanbai-mark.svg`;

// 入口页只负责分流。新增第三个体验时，在这里增加一项，并同步调整 styles.css 的网格。
const EXPERIENCES = [
  {
    id: "explore",
    number: "01",
    eyebrow: "黑暗探索 / EXPLORE",
    title: "探索元白",
    description: "走进九乘九的黑暗网格，让元白楼的轮廓在脚下逐格亮起。首次进入，先在一小片空间里学会探索。",
    action: "进入探索模式",
    icon: Target,
    // 开发服务器需要显式 index.html；游戏加载后会把地址栏整理成 /explore/。
    href: "explore/index.html",
  },
  {
    id: "rules",
    number: "02",
    eyebrow: "操作入门 / FIELD GUIDE",
    title: "探索规则",
    description: "WASD 移动 · Q / E 转向。拾取三种工具，在黑暗中走遍 66 个安全格。",
    action: "重看互动教学",
    icon: BookOpen,
    href: "tutorial/",
  },
];

function PortalCard({ experience, onActivate }) {
  const Icon = experience.icon;
  const href = experience.href;

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
      {experience.id === "rules" ? <div className="school-rule-copy" id="rules">
        <div><b>01 / 走过，才算发现</b><span>9 × 9 网格，走遍 66 个安全格，拼回元白楼。悬崖不计入进度。</span></div>
        <div><b>02 / 借助三种线索</b><span>1 同伴：确认相邻四格<br/>2 探测：小灯寻找前方安全落点<br/>3 全景：地图显现 1.5 秒</span></div>
        <div><b>03 / 留意感知压力</b><span>SAN 随时间增加，拾取道具可降低；满值时转向寻找前路。</span></div>
      </div> : <div className="portal-card-icon" aria-hidden="true"><Icon size={72} weight="thin" /></div>}
      <p>{experience.description}</p>
      <span className="portal-card-action">
        <span>按 {experience.number} · {experience.action}</span>
        <ArrowUpRight size={22} weight="bold" />
      </span>
    </a>
  );
}

export function SchoolPortal() {
  const portalRef = useRef(null);
  const projectionRef = useRef(null);
  const [active, setActive] = useState("explore");
  const [now, setNow] = useState(() => new Date());
  const activeExperience = useMemo(
    () => EXPERIENCES.find((item) => item.id === active) || EXPERIENCES[1],
    [active],
  );

  useEffect(() => {
    document.title = "探索元白 · 未来设计学院";
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
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      window.location.assign(target.href);
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
        <span>未来设计学院</span>
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
          <span>探索元白</span>
          <strong>{activeExperience.eyebrow}</strong>
          <p>{activeExperience.id === "explore" ? "从空间出发，拾起一座楼的记忆。" : "让每一次按键，都成为空间的线索。"}</p>
        </div>
      </section>

      <nav className="portal-navigation" aria-label="元白体验入口">
        {EXPERIENCES.map((experience) => (
          <PortalCard key={experience.id} experience={experience} onActivate={setActive}  />
        ))}
      </nav>

      <footer className="portal-footer">
        <span>YUANBAI PERCEPTION LAB · ARCHITECTURE × PEOPLE × MEMORY</span>
        <span>排行榜 · 坠落更少 → 用时更短 → 步数更少</span>
      </footer>
    </main>
  );
}
