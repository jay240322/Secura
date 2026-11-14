"use client";

import React, { useEffect, useRef, useMemo, RefObject } from "react";

export interface VariableProximityProps {
  label: string;
  className?: string;
  fromFontVariationSettings?: string;
  toFontVariationSettings?: string;
  containerRef?: RefObject<HTMLElement | null>;
  radius?: number;
  falloff?: "linear" | "exponential" | "gaussian";
  smoothing?: number;
  scale?: number;
  lift?: number;
  idleWave?: boolean;
  fontSize?: number | string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

function parseFontVariationSettings(str: string): Record<string, number> {
  const result: Record<string, number> = {};
  if (!str) return result;
  const parts = str.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    const spaceIdx = trimmed.lastIndexOf(" ");
    if (spaceIdx > 0) {
      const axis = trimmed.slice(0, spaceIdx).replace(/['"]/g, "").trim();
      const val = parseFloat(trimmed.slice(spaceIdx + 1).trim());
      if (axis && !isNaN(val)) {
        result[axis] = val;
      }
    }
  }
  return result;
}

function formatFontVariationSettings(axes: Record<string, number>): string {
  const parts: string[] = [];
  for (const [axis, val] of Object.entries(axes)) {
    parts.push(`'${axis}' ${Math.round(val * 100) / 100}`);
  }
  return parts.join(", ");
}

function calculateIntensity(
  dist: number,
  radius: number,
  falloff: "linear" | "exponential" | "gaussian"
): number {
  if (dist >= radius || radius <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, 1 - dist / radius));
  if (falloff === "exponential") {
    return ratio * ratio;
  }
  if (falloff === "gaussian") {
    return Math.exp(-Math.pow(dist / (radius * 0.5), 2));
  }
  return ratio;
}

export default function VariableProximity({
  label,
  className = "",
  fromFontVariationSettings = "'wght' 400, 'opsz' 9",
  toFontVariationSettings = "'wght' 1000, 'opsz' 40",
  containerRef,
  radius = 100,
  falloff = "linear",
  smoothing = 0.2,
  scale = 1,
  lift = 0,
  idleWave = false,
  fontSize,
  style = {},
  onClick,
}: VariableProximityProps) {
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const parsedFrom = useMemo(
    () => parseFontVariationSettings(fromFontVariationSettings),
    [fromFontVariationSettings]
  );
  const parsedTo = useMemo(
    () => parseFontVariationSettings(toFontVariationSettings),
    [toFontVariationSettings]
  );

  useEffect(() => {
    let animationFrameId: number;
    let mouseX = -9999;
    let mouseY = -9999;

    const resetLetters = () => {
      letterRefs.current.forEach((el) => {
        if (!el) return;
        el.style.fontVariationSettings = fromFontVariationSettings;
        if (scale !== 1 || lift !== 0) {
          el.style.transform = "none";
        }
      });
    };

    const updatePositions = () => {
      const container = containerRef?.current;
      if (container) {
        const cRect = container.getBoundingClientRect();
        if (
          mouseX < cRect.left - radius ||
          mouseX > cRect.right + radius ||
          mouseY < cRect.top - radius ||
          mouseY > cRect.bottom + radius
        ) {
          resetLetters();
          return;
        }
      }

      letterRefs.current.forEach((el) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const charCenterX = rect.left + rect.width / 2;
        const charCenterY = rect.top + rect.height / 2;
        const dist = Math.hypot(mouseX - charCenterX, mouseY - charCenterY);
        const intensity = calculateIntensity(dist, radius, falloff);

        const currentAxes: Record<string, number> = {};
        for (const axis of Object.keys(parsedTo)) {
          const fromVal = parsedFrom[axis] ?? 400;
          const toVal = parsedTo[axis];
          currentAxes[axis] = fromVal + (toVal - fromVal) * intensity;
        }
        el.style.fontVariationSettings = formatFontVariationSettings(currentAxes);

        const transforms: string[] = [];
        if (lift && lift !== 0) {
          transforms.push(`translateY(${-lift * intensity}px)`);
        }
        if (scale && scale !== 1) {
          transforms.push(`scale(${1 + (scale - 1) * intensity})`);
        }
        el.style.transform = transforms.length > 0 ? transforms.join(" ") : "none";
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(updatePositions);
    };

    const handleMouseLeave = () => {
      mouseX = -9999;
      mouseY = -9999;
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(resetLetters);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseleave", handleMouseLeave, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [
    parsedFrom,
    parsedTo,
    fromFontVariationSettings,
    containerRef,
    radius,
    falloff,
    scale,
    lift,
  ]);

  const words = useMemo(() => (label ? label.split(" ") : []), [label]);

  let letterIndex = 0;

  return (
    <span
      className={className}
      onClick={onClick}
      style={{
        display: "inline-block",
        fontSize: typeof fontSize === "number" ? `${fontSize}px` : fontSize,
        ...style,
      }}
    >
      {words.map((word, wIdx) => {
        const letters = Array.from(word);
        return (
          <span key={wIdx} className="inline-block whitespace-nowrap">
            {letters.map((char, cIdx) => {
              const currentIndex = letterIndex++;
              return (
                <span
                  key={cIdx}
                  ref={(el) => {
                    letterRefs.current[currentIndex] = el;
                  }}
                  style={{
                    display: "inline-block",
                    fontVariationSettings: fromFontVariationSettings,
                    transition:
                      smoothing > 0
                        ? `transform ${smoothing}s ease, font-variation-settings ${smoothing}s ease`
                        : undefined,
                    willChange: "transform, font-variation-settings",
                  }}
                >
                  {char}
                </span>
              );
            })}
            {wIdx < words.length - 1 && (
              <span className="inline-block">&nbsp;</span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export { VariableProximity };
