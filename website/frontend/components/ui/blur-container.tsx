"use client";

import React, { useEffect, useRef, useState } from "react";

export interface BlurContainerProps {
  children: React.ReactNode;
  className?: string;
  trigger?: "view" | "load";
  delay?: number;
  stepDuration?: number;
  blur?: number;
  distance?: number;
  direction?: "top" | "bottom";
  blueEffect?: boolean;
  onAnimationComplete?: () => void;
}

export default function BlurContainer({
  children,
  className = "",
  trigger = "view",
  delay = 150,
  stepDuration = 0.5,
  blur = 10,
  distance = 40,
  direction = "top",
  blueEffect = true,
  onAnimationComplete,
}: BlurContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(trigger === "load");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (trigger !== "view") return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [trigger]);

  useEffect(() => {
    if (!inView || completed) return;
    const timer = setTimeout(() => {
      setCompleted(true);
      onAnimationComplete?.();
    }, delay + stepDuration * 1000);
    return () => clearTimeout(timer);
  }, [inView, completed, delay, stepDuration, onAnimationComplete]);

  const offset = direction === "top" ? distance : -distance;

  return (
    <div
      ref={containerRef}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : `translateY(${offset}px)`,
        filter: inView ? "blur(0px)" : `blur(${blur}px)`,
        transition: `opacity ${stepDuration}s cubic-bezier(0.2, 0.65, 0.3, 0.9), transform ${stepDuration}s cubic-bezier(0.2, 0.65, 0.3, 0.9), filter ${stepDuration}s cubic-bezier(0.2, 0.65, 0.3, 0.9), box-shadow 0.6s ease, border-color 0.6s ease`,
        transitionDelay: `${delay}ms`,
        willChange: "transform, opacity, filter",
      }}
      className={`relative transition-all duration-500 ${
        blueEffect && inView
          ? "border-blue-500/40 shadow-[0_0_35px_-8px_rgba(59,130,246,0.32)] hover:border-blue-500/70 hover:shadow-[0_0_45px_-4px_rgba(59,130,246,0.5)]"
          : blueEffect
          ? "border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
          : ""
      } ${className}`}
    >
      {blueEffect && (
        <div
          className={`pointer-events-none absolute -inset-px rounded-[inherit] bg-gradient-to-b from-blue-500/10 via-transparent to-blue-600/5 transition-opacity duration-700 ${
            inView ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {children}
    </div>
  );
}

export { BlurContainer };

