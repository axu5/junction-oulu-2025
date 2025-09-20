"use client";

import { useRef, useEffect } from "react";

export function VisemeRenderer({
  currentViseme,
  images,
  width = 100,
  height = 100,
}: {
  currentViseme: string | null;
  images: Record<string, HTMLImageElement>;
  width?: number;
  height?: number;
}) {
  console.log(currentViseme);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visemeImages: Record<string, HTMLImageElement> = {};
  ["A", "B", "C", "D", "E", "F", "G", "H", "X"].forEach(v => {
    if (typeof window !== "undefined") {
      const img = new Image();
      img.src = `/visemes/lisa/${v}.png`;
      visemeImages[v] = img;
    }
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const draw = () => {
      if (!ctx) return;

      // clear previous frame
      ctx.clearRect(0, 0, width, height);

      const img = images[currentViseme ?? "X"];
      if (img && img.complete) {
        ctx.drawImage(img, 0, 0, width, height);
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationFrameId);
  }, [currentViseme, width, height, images]);

  return <canvas ref={canvasRef} width={width} height={height} />;
}
