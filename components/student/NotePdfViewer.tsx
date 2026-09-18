"use client";

import React from "react";
import { FullscreenFrame, useFullscreen } from "@/components/student/FullscreenFrame";

/** A note's Drive PDF, shown in the page with a full-screen option. */
export function NotePdfViewer({ src, title }: { src: string; title: string }) {
  const fullscreen = useFullscreen();

  return (
    <FullscreenFrame
      fullscreen={fullscreen}
      src={src}
      title={`${title} (PDF)`}
      label={title}
      collapsedClassName="h-[70dvh]"
      allow="autoplay"
    />
  );
}
