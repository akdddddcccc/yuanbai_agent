import { useEffect, useRef } from "react";

const TRAIL_POINT_COUNT = 22;

// 仅在精确鼠标设备上启用。采样点负责延迟跟随，最终绘制为一条连续渐变曲线。
export function CursorLightTrail() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!canvas || !pointerQuery.matches) return undefined;

    const context = canvas.getContext("2d");
    const points = Array.from({ length: TRAIL_POINT_COUNT }, () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 }));
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

      const head = points[0];
      const tail = points[points.length - 1];
      const gradient = context.createLinearGradient(tail.x, tail.y, head.x, head.y);
      gradient.addColorStop(0, "rgba(255, 158, 112, 0)");
      gradient.addColorStop(.34, `rgba(232, 91, 49, ${strength * .18})`);
      gradient.addColorStop(.72, `rgba(255, 125, 65, ${strength * .48})`);
      gradient.addColorStop(1, `rgba(255, 205, 157, ${strength * .86})`);

      context.globalCompositeOperation = "lighter";
      context.beginPath();
      context.moveTo(tail.x, tail.y);
      for (let index = points.length - 2; index > 0; index -= 1) {
        const next = points[index - 1];
        const midpointX = (points[index].x + next.x) * .5;
        const midpointY = (points[index].y + next.y) * .5;
        context.quadraticCurveTo(points[index].x, points[index].y, midpointX, midpointY);
      }
      context.lineTo(head.x, head.y);
      context.strokeStyle = gradient;
      context.lineWidth = 2.15;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.shadowColor = `rgba(255, 100, 52, ${strength * .44})`;
      context.shadowBlur = 13;
      context.stroke();
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
