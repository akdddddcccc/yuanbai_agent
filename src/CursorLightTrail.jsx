import { useEffect, useRef } from "react";

const DOT_COUNT = 22;

// 仅在精确鼠标设备上启用。每个点追随前一个点，形成带延迟的暖色光轨。
export function CursorLightTrail() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!canvas || !pointerQuery.matches) return undefined;

    const context = canvas.getContext("2d");
    const points = Array.from({ length: DOT_COUNT }, () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 }));
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let frame = 0;
    let strength = 0;
    let lastMovement = Number.NEGATIVE_INFINITY;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onPointerMove = (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      target.x = event.clientX;
      target.y = event.clientY;
      lastMovement = performance.now();
    };

    const animate = (now) => {
      frame = requestAnimationFrame(animate);
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const visibleTarget = now - lastMovement < 780 ? 1 : 0;
      strength += (visibleTarget - strength) * .09;

      points[0].x += (target.x - points[0].x) * .34;
      points[0].y += (target.y - points[0].y) * .34;
      for (let index = 1; index < points.length; index += 1) {
        const follow = .27 - index * .0035;
        points[index].x += (points[index - 1].x - points[index].x) * follow;
        points[index].y += (points[index - 1].y - points[index].y) * follow;
      }

      context.globalCompositeOperation = "lighter";
      for (let index = points.length - 1; index >= 0; index -= 1) {
        const progress = index / (points.length - 1);
        const alpha = strength * Math.pow(1 - progress, 1.55) * .82;
        const radius = .65 + (1 - progress) * 2.45;
        context.beginPath();
        context.fillStyle = `rgba(255, ${Math.round(137 + progress * 42)}, ${Math.round(83 + progress * 66)}, ${alpha})`;
        context.shadowColor = `rgba(255, 105, 55, ${alpha * .8})`;
        context.shadowBlur = 7 + (1 - progress) * 13;
        context.arc(points[index].x, points[index].y, radius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalCompositeOperation = "source-over";
      context.shadowBlur = 0;
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="cursor-light-trail" aria-hidden="true" />;
}
