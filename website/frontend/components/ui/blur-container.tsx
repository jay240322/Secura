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
  onAnimationComplete?: () => void;
}

export default function BlurContainer({
  children,
  className = "",
  trigger = "view",
  delay = 100,
  stepDuration = 0.45,
  blur = 6,
  distance = 25,
  direction = "top",
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
      { threshold: 0.08, rootMargin: "0px 0px -20px 0px" }
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
        transition: `opacity ${stepDuration}s ease-out, transform ${stepDuration}s cubic-bezier(0.16, 1, 0.3, 1)`,
        transitionDelay: `${delay}ms`,
        willChange: "transform, opacity",
      }}
      className={`relative ${className}`}
    >
      {children}
    </div>
  );
}

export { BlurContainer };
