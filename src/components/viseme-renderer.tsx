"use client";

import { useRef, useEffect, useState } from "react";
import NextImage from "next/image";

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

  // preload images once
  useEffect(() => {
    const keys = ["A", "B", "C", "D", "E", "F", "G", "H", "X"];
    const loaded: Record<string, HTMLImageElement> = {};
    let count = 0;

    keys.forEach(v => {
      const img = new Image();
      img.src = `/visemes/kmarkitty/${v}.png`;
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

  return (
    <>
      <canvas
        className='absolute top-1/2 left-1/2 -translate-1/2 z-10'
        ref={canvasRef}
        width={width}
        height={height}
      />
      <NextImage
        className='absolute top-1/2 left-1/2 -translate-1/2 z-0'
        src='/kmarkitty.gif'
        alt='Kmarkitty'
        width={width}
        height={height}
        unoptimized
      />
    </>
  );
}
