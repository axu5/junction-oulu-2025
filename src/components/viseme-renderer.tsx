"use client";

import { useRef, useEffect, useState } from "react";

export function VisemeRenderer({
  currentViseme,
  width = 100,
  height = 100,
}: {
  currentViseme: string | null;
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<
    Record<string, HTMLImageElement>
  >({});

  console.log(images);

  // preload images once
  useEffect(() => {
    const keys = ["A", "B", "C", "D", "E", "F", "G", "H", "X"];
    const loaded: Record<string, HTMLImageElement> = {};
    let count = 0;

    keys.forEach(v => {
      const img = new Image();
      img.src = `/visemes/lisa/${v}.png`;
      img.onload = () => {
        count++;
        if (count === keys.length) setImages(loaded);
      };
      loaded[v] = img;
    });
  }, [setImages]);

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
