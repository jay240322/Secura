"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";

export interface BlurTextProps {
  text: string;
  effect?: "blur" | string;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
  staggerFrom?: "start" | "center" | "end" | "random";
  trigger?: "view" | "load" | "hover";
  delay?: number;
  stepDuration?: number;
  blur?: number;
  distance?: number;
  onAnimationComplete?: () => void;
  className?: string;
  loop?: boolean;
  loopDelay?: number;
  focusOnHover?: boolean;
}

export default function BlurText({
  text = "",
  effect = "blur",
  animateBy = "words",
  direction = "top",
  staggerFrom = "start",
  trigger = "view",
  delay = 200,
  stepDuration = 0.35,
  blur = 10,
  distance = 50,
  onAnimationComplete,
  className = "",
  loop = false,
  loopDelay = 2,
  focusOnHover = false,
}: BlurTextProps) {
  const containerRef = useRef<HTMLParagraphElement>(null);
  const [inView, setInView] = useState(trigger === "load");
  const [isHovered, setIsHovered] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Split text into words or characters
  const elements = useMemo(() => {
    if (!text) return [];
    if (animateBy === "letters") {
      return Array.from(text);
    }
    return text.split(" ");
  }, [text, animateBy]);

  // Calculate stagger index based on staggerFrom
  const getStaggerIndex = (index: number, total: number) => {
    if (staggerFrom === "end") return total - 1 - index;
    if (staggerFrom === "center") {
      const center = (total - 1) / 2;
      return Math.abs(center - index);
    }
    if (staggerFrom === "random") {
      return ((index * 37) % total);
    }
    return index; // "start"
  };

  // IntersectionObserver for trigger="view"
  useEffect(() => {
    if (trigger !== "view") return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            if (!loop) {
              observer.unobserve(el);
            }
          } else if (loop) {
            setInView(false);
            setCompleted(false);
          }
        });
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [trigger, loop]);

  // Handle loop logic
  useEffect(() => {
    if (!loop || !inView) return;
    const totalDuration = delay + elements.length * (stepDuration * 1000 * 0.4) + loopDelay * 1000;
    const timer = setTimeout(() => {
      setInView(false);
      setCompleted(false);
      setTimeout(() => setInView(true), 100);
    }, totalDuration);
    return () => clearTimeout(timer);
  }, [loop, inView, delay, elements.length, stepDuration, loopDelay]);

  // Callback on animation complete
  useEffect(() => {
    if (!inView || completed) return;
    const maxStagger = elements.length > 0 ? elements.length : 1;
    const totalTimeMs = delay + maxStagger * (stepDuration * 1000 * 0.4) + stepDuration * 1000;
    const timer = setTimeout(() => {
      setCompleted(true);
      onAnimationComplete?.();
    }, totalTimeMs);
    return () => clearTimeout(timer);
  }, [inView, completed, delay, elements.length, stepDuration, onAnimationComplete]);

  const offsetDistance = direction === "top" ? -distance : distance;

  return (
    <p
      ref={containerRef}
      onMouseEnter={() => {
        if (trigger === "hover") setInView(true);
        if (focusOnHover) setIsHovered(true);
      }}
      onMouseLeave={() => {
        if (trigger === "hover") setInView(false);
        if (focusOnHover) setIsHovered(false);
      }}
      className={`inline-flex flex-wrap items-center gap-x-[0.28em] ${className}`}
    >
      {elements.map((item, idx) => {
        const staggerIdx = getStaggerIndex(idx, elements.length);
        const itemDelayMs = delay + staggerIdx * (stepDuration * 1000 * 0.35);

        const isAnimated = inView;
        const currentBlur = isAnimated ? (focusOnHover && !isHovered ? blur * 0.2 : 0) : blur;
        const currentTranslateY = isAnimated ? 0 : offsetDistance;
        const currentOpacity = isAnimated ? 1 : 0;

        return (
          <span
            key={idx}
            style={{
              display: "inline-block",
              filter: `blur(${currentBlur}px)`,
              transform: `translateY(${currentTranslateY}px)`,
              opacity: currentOpacity,
              transition: `filter ${stepDuration}s cubic-bezier(0.2, 0.65, 0.3, 0.9), transform ${stepDuration}s cubic-bezier(0.2, 0.65, 0.3, 0.9), opacity ${stepDuration}s ease`,
              transitionDelay: `${itemDelayMs}ms`,
              willChange: "transform, filter, opacity",
            }}
          >
            {item === " " ? "\u00A0" : item}
          </span>
        );
      })}
    </p>
  );
}
export { BlurText };

