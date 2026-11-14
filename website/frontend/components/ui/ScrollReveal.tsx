"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";

export interface ScrollRevealProps {
  children: React.ReactNode;
  highlightColor?: string;
  mode?: "scrub" | "enter";
  splitBy?: "lines" | "words" | "chars";
  effect?: "fade" | "rise" | "rotate" | string;
  stagger?: number;
  duration?: number;
  smoothing?: number;
  baseOpacity?: number;
  baseRotation?: number;
  baseOffset?: number;
  enableBlur?: boolean;
  blurStrength?: number;
  className?: string;
  containerClassName?: string;
}

export default function ScrollReveal({
  children,
  highlightColor = "",
  mode = "scrub",
  splitBy = "lines",
  effect = "fade",
  stagger = 0.44,
  duration = 0.8,
  smoothing = 0,
  baseOpacity = 0.1,
  baseRotation = 0,
  baseOffset = 9,
  enableBlur = true,
  blurStrength = 6,
  className = "",
  containerClassName = "",
}: ScrollRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Parse children into lines, words, or character segments
  const segments = useMemo(() => {
    if (typeof children !== "string") {
      if (React.isValidElement(children)) {
        return [children];
      }
      if (Array.isArray(children)) {
        return children;
      }
      return [String(children)];
    }

    const text = children.trim();
    if (splitBy === "chars") {
      return Array.from(text);
    }

    if (splitBy === "words") {
      return text.split(/\s+/);
    }

    // Default: splitBy === "lines"
    if (text.includes("\n")) {
      return text.split("\n").map((l) => l.trim()).filter(Boolean);
    }

    // If string has punctuation question marks or exclamation marks, split into natural lyrical lines
    if (text.includes("?") || text.includes("!")) {
      const sentences: string[] = [];
      let current = "";
      for (let i = 0; i < text.length; i++) {
        current += text[i];
        if (text[i] === "?" || text[i] === "!") {
          while (i + 1 < text.length && (text[i + 1] === "?" || text[i + 1] === "!")) {
            i++;
            current += text[i];
          }
          sentences.push(current.trim());
          current = "";
        }
      }
      if (current.trim().length > 0) {
        sentences.push(current.trim());
      }
      if (sentences.length > 1) {
        return sentences;
      }
    }

    return [text];
  }, [children, splitBy]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        if (!containerRef.current) {
          ticking = false;
          return;
        }
        const rect = containerRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight || 800;

        // Container scroll entry calculations
        const startOffset = windowHeight * 0.9;
        const endOffset = windowHeight * 0.25;

        let progress = (startOffset - rect.top) / (startOffset - endOffset);
        progress = Math.max(0, Math.min(1, progress));

        setScrollProgress(progress);
        ticking = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [mode]);

  return (
    <div
      ref={containerRef}
      className={`scroll-reveal-container my-4 text-center ${containerClassName}`}
    >
      <div
        className={`${
          splitBy === "words"
            ? "inline leading-relaxed text-center"
            : "inline-flex flex-col items-center justify-center gap-2"
        } ${className}`}
      >
        {segments.map((segment, idx) => {
          const total = segments.length;
          // Calculate individual segment progress based on stagger
          const itemStart = (idx / Math.max(total, 1)) * (1 - stagger * 0.5);
          const itemEnd = itemStart + (1 - (1 - stagger * 0.5));
          const range = Math.max(0.01, itemEnd - itemStart);
          const itemProgress = Math.max(0, Math.min(1, (scrollProgress - itemStart) / range));

          const currentOpacity = baseOpacity + itemProgress * (1 - baseOpacity);
          const currentOffset = baseOffset * (1 - itemProgress);
          const currentRotation = baseRotation * (1 - itemProgress);
          const currentBlur = enableBlur ? blurStrength * (1 - itemProgress) : 0;
          const isHighlighting = highlightColor && itemProgress > 0.15 && itemProgress < 0.95;

          return (
            <span
              key={idx}
              style={{
                opacity: currentOpacity,
                transform: `translateY(${currentOffset}px) rotate(${currentRotation}deg)`,
                filter: enableBlur ? `blur(${currentBlur}px)` : "none",
                color: isHighlighting ? highlightColor : "inherit",
                transition: `opacity ${duration}s ease, transform ${duration}s cubic-bezier(0.2, 0.65, 0.3, 0.9), filter ${duration}s ease, color 0.3s ease`,
                willChange: "transform, opacity, filter",
              }}
              className={`inline-block leading-relaxed ${splitBy === "words" ? "mr-[0.28em]" : ""}`}
            >
              {segment}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export { ScrollReveal };

