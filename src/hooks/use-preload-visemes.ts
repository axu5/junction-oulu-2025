"use client";

import { useEffect, useRef } from "react";

function preloadViseme(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

export function usePreloadVisemes(path = "/visemes/lisa") {
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    const visemes = ["A", "B", "C", "D", "E", "F", "G", "H", "X"];
    visemes.map(v => {
      const img = preloadViseme(`${path}/${v}.png`);
      imagesRef.current[v] = img;
    });
  }, [path]);

  return imagesRef.current;
}
