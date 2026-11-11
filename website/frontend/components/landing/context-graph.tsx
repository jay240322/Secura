"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ShieldAlert,
  GitPullRequest,
  CheckCircle2,
  ChevronDown,
  FileCode,
} from "lucide-react";

interface StepConfig {
  id: string;
  name: string;
  title: string;
  description: string;
  models: { name: string; tag: string }[];
  contextItems: { name: string; isGreen?: boolean }[];
  diff: {
    fileName: string;
    startLine: number;
    lines: { num: number; text: string; isAdded?: boolean; isRemoved?: boolean }[];
    badge: string;
  };
  review: {
    author: string;
    botBadge: string;
    date: string;
    tags: { label: string; icon: string; color: string }[];
    title: string;
    message: string;
  };
}

const STEPS_DATA: StepConfig[] = [
  {
    id: "secret-signatures",
    name: "Secret Signatures",
    title: "100+ Secret Signatures & AST Scanning",
    description:
      "Scans pull request diffs in-memory against 100+ high-entropy credential patterns with zero source code retention.",
    models: [
      { name: "Stripe Secret Key", tag: "active signature" },
      { name: "AWS Access Key ID", tag: "active signature" },
      { name: "OpenAI API Token", tag: "active signature" },
      { name: "Private RSA / SSH Key", tag: "active signature" },
      { name: "GCP Service JSON", tag: "active signature" },
    ],
    contextItems: [
      { name: "Zero Code Retention Policy", isGreen: true },
      { name: "In-Memory Diff Inspection", isGreen: true },
      { name: "GitHub Checks API Sync", isGreen: false },
      { name: "AST Tree-Sitter Parser", isGreen: true },
      { name: "Git Chunk Boundary Checker", isGreen: false },
    ],
    diff: {
      fileName: "src/config/stripe.ts",
      startLine: 14,
      badge: "+1 -1 | 14–19",
      lines: [
        { num: 14, text: "export const stripeConfig = {" },
        { num: 15, text: "  apiVersion: '2023-10-16'," },
        { num: 16, text: "- sec" + "retKey: 'sk_live_" + "51M0...92K8jA0',", isRemoved: true },
        { num: 17, text: "+ secretKey: process.env.STRIPE_SECRET_KEY,", isAdded: true },
        { num: 18, text: "  maxNetworkRetries: 3," },
        { num: 19, text: "};" },
      ],
    },
    review: {
      author: "secura-bot",
      botBadge: "BOT",
      date: "just now · edited",
      tags: [
        { label: "Potential leak", icon: "⚠️", color: "text-amber-400" },
        { label: "Critical", icon: "🔴", color: "text-rose-400" },
        { label: "Stripe Key", icon: "🔒", color: "text-sky-400" },
      ],
      title: "Exposed Stripe live secret key detected in diff.",
      message: "GitHub PR merge button is locked until the secret is rotated.",
    },
  },
  {
    id: "shannon-entropy",
    name: "Shannon Entropy",
    title: "Shannon Entropy & Randomness Filter",
    description:
      "Measures character distribution entropy (0.0 to 5.0) to eliminate dummy test mocks and detect true live credentials.",
    models: [
      { name: "Shannon Entropy", tag: "score: 4.92 / 5.0" },
      { name: "Randomness Gate", tag: "threshold exceeded" },
      { name: "Noise Filter", tag: "dummy mocks eliminated" },
      { name: "Character Distribution", tag: "high entropy" },
      { name: "Test Mock Suppressor", tag: "verified non-mock" },
    ],
    contextItems: [
      { name: "Test Mock Fixture Filter", isGreen: true },
      { name: "Documentation Whitelist", isGreen: true },
      { name: "High-Entropy Token Detector", isGreen: true },
      { name: "Cryptographic Salt Filter", isGreen: false },
      { name: "Zero False Positive Engine", isGreen: true },
    ],
    diff: {
      fileName: "tests/auth.test.ts",
      startLine: 24,
      badge: "+1 -1 | 24–27",
      lines: [
        { num: 24, text: "const mockTok" + "en = 'ghp_dummy_test_mock_123';" },
        { num: 25, text: "-const liveTok" + "en = 'ghp_92b8F01cZaK89xL10qP77e';", isRemoved: true },
        { num: 26, text: "+const liveToken = process.env.GITHUB_TOKEN;", isAdded: true },
        { num: 27, text: "expect(client.auth(liveToken)).toBe(true);" },
      ],
    },
    review: {
      author: "secura-bot",
      botBadge: "BOT",
      date: "just now · edited",
      tags: [
        { label: "Entropy 4.92", icon: "🧠", color: "text-purple-400" },
        { label: "Critical", icon: "🔴", color: "text-rose-400" },
        { label: "GitHub PAT", icon: "🎯", color: "text-blue-400" },
      ],
      title: "High-entropy GitHub token detected (score 4.92 / 5.0).",
      message: "Test mock fixtures were verified and allowed with zero false alarms.",
    },
  },
  {
    id: "system-guidelines",
    name: "System Guidelines",
    title: "Adaptive Rules & Repository Policies",
    description:
      "Enforces your team's security requirements from .cursorrules, CLAUDE.md, and local branch protection rules.",
    models: [
      { name: ".cursorrules", tag: "strict credential rule" },
      { name: "CLAUDE.md", tag: "security architecture" },
      { name: "AGENTS.md", tag: "tool permissions" },
      { name: "Path Rules", tag: "src/config/* protected" },
      { name: "Team Standards", tag: "env variables only" },
    ],
    contextItems: [
      { name: "Credential Policy Enforcer", isGreen: true },
      { name: "Protected Branch Check", isGreen: true },
      { name: "Zero Plaintext Rule", isGreen: false },
      { name: "Secrets Vault Enforcer", isGreen: true },
      { name: "AST Policy Checker", isGreen: false },
    ],
    diff: {
      fileName: "src/database/pool.ts",
      startLine: 42,
      badge: "+2 -1 | 42–46",
      lines: [
        { num: 42, text: "export async function initDb() {" },
        { num: 43, text: "- const dbUri = 'postgres://" + "admin:P@ssw0rd2024!@db:5432';", isRemoved: true },
        { num: 44, text: "+ const dbUri = await vault.get('DATABASE_URL');", isAdded: true },
        { num: 45, text: "  return new Pool({ connectionString: dbUri });" },
        { num: 46, text: "}" },
      ],
    },
    review: {
      author: "secura-bot",
      botBadge: "BOT",
      date: "just now · edited",
      tags: [
        { label: "Policy Violation", icon: "📋", color: "text-amber-400" },
        { label: "Critical", icon: "🔴", color: "text-rose-400" },
        { label: ".cursorrules", icon: "🛡️", color: "text-purple-400" },
      ],
      title: "Hardcoded secret violates .cursorrules policy.",
      message: "Production credentials must be loaded from environment vault.",
    },
  },
  {
    id: "merge-gate",
    name: "Automated Merge Gate",
    title: "GitHub Checks API Merge Gate",
    description:
      "Fails GitHub CheckRuns and locks the PR merge button automatically until all exposed credentials are safe.",
    models: [
      { name: "GitHub Checks API", tag: "check_run active" },
      { name: "PR Merge Button", tag: "LOCKED ON GITHUB" },
      { name: "CheckRun Status", tag: "FAILURE (Critical)" },
      { name: "Remediation Gate", tag: "automatic re-test" },
      { name: "Zero Retention", tag: "in-memory discarded" },
    ],
    contextItems: [
      { name: "Automated PR Merge Lock", isGreen: true },
      { name: "GitHub Status Check Sync", isGreen: true },
      { name: "Webhook Event Listener", isGreen: false },
      { name: "Automatic Re-check on Push", isGreen: true },
      { name: "Zero Code Retention Audit", isGreen: false },
    ],
    diff: {
      fileName: "github/checks/merge-gate",
      startLine: 1,
      badge: "Gate | PASSED",
      lines: [
        { num: 1, text: "// GitHub CheckRun: Secura Security Gate" },
        { num: 2, text: "-Status: FAILED (Critical secret in diff)", isRemoved: true },
        { num: 3, text: "-Merge: LOCKED on GitHub", isRemoved: true },
        { num: 4, text: "+Status: PASSED (Secret rotated to .env)", isAdded: true },
        { num: 5, text: "+Merge: UNLOCKED on GitHub", isAdded: true },
      ],
    },
    review: {
      author: "secura-bot",
      botBadge: "BOT",
      date: "just now · edited",
      tags: [
        { label: "CheckRun Passed", icon: "🛡️", color: "text-emerald-400" },
        { label: "Merge Unlocked", icon: "🔓", color: "text-sky-400" },
        { label: "Zero Retention", icon: "🔒", color: "text-zinc-400" },
      ],
      title: "Secura Security Gate passed. GitHub PR merge unlocked.",
      message: "All exposed credentials remediated. Pull request is safe to merge.",
    },
  },
];

// Generate 3D Fibonacci sphere nodes
interface Node3D {
  x: number;
  y: number;
  z: number;
}

const SPHERE_RADIUS = 162;
const NODE_COUNT = 64;

function createFibonacciSphere(count: number, radius: number): Node3D[] {
  const nodes: Node3D[] = [];
  const phi = Math.PI * (Math.sqrt(5) - 1); // golden angle

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2; // y: 1 to -1
    const rAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;

    nodes.push({
      x: Math.cos(theta) * rAtY * radius,
      y: y * radius,
      z: Math.sin(theta) * rAtY * radius,
    });
  }
  return nodes;
}

// Pre-compute 3D links between nearby sphere nodes
function createSphereLinks(nodes: Node3D[], maxDist: number): [number, number][] {
  const links: [number, number][] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dz = nodes[i].z - nodes[j].z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < maxDist) {
        links.push([i, j]);
      }
    }
  }
  return links;
}

const NODES_3D = createFibonacciSphere(NODE_COUNT, SPHERE_RADIUS);
const LINKS_3D = createSphereLinks(NODES_3D, SPHERE_RADIUS * 0.58);

export function ContextGraphSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const rotYRef = useRef(0);
  const targetRotYRef = useRef(0);

  // Trigger animation key whenever step index changes
  useEffect(() => {
    setAnimKey((prev) => prev + 1);
  }, [activeStepIdx]);

  // Scroll tracking to drive the 4 stages and the 3D sphere rotation
  useEffect(() => {
    const handleScroll = () => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const windowH = window.innerHeight;
      const totalScrollable = rect.height - windowH;
      if (totalScrollable <= 0) return;

      const scrolled = -rect.top;
      const progress = Math.min(Math.max(scrolled / totalScrollable, 0), 1);
      setScrollProgress(progress);

      // Determine active step from scroll progress (0..0.25 => 0, 0.25..0.50 => 1, etc.)
      const step = Math.min(Math.floor(progress * STEPS_DATA.length), STEPS_DATA.length - 1);
      setActiveStepIdx(step);

      // Drive rotation from scroll
      targetRotYRef.current = progress * Math.PI * 3.5;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 60FPS Continuous 3D Constellation Sphere Engine across all 4 stages
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const render = () => {
      time += 0.015;
      rotYRef.current += (targetRotYRef.current + time * 0.3 - rotYRef.current) * 0.08;
      const rotY = rotYRef.current;
      const rotX = 0.24 + Math.sin(time * 0.45) * 0.08;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const width = canvas.width;
      const height = canvas.height;
      const cx = 0; // Flush with the left orange divider line
      const cy = 210;
      const domeRadius = 190;

      ctx.clearRect(0, 0, width, height);

      // ─── CLIP STRICTLY TO HALF-CUT DOME FLUSH ON THE LEFT DIVIDER ───
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, domeRadius, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(cx, cy - domeRadius);
      ctx.closePath();
      ctx.clip();

      // Subtle background radial glow inside the hemisphere dome
      const bgGrad = ctx.createRadialGradient(cx, cy, 15, cx, cy, domeRadius);
      bgGrad.addColorStop(0, "rgba(42, 28, 92, 0.38)");
      bgGrad.addColorStop(0.65, "rgba(17, 17, 19, 0.8)");
      bgGrad.addColorStop(1, "rgba(17, 17, 19, 0.98)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Project 3D Fibonacci Sphere Nodes
      const projected = NODES_3D.map((node, nIdx) => {
        const x1 = node.x * cosY - node.z * sinY;
        const z1 = node.z * cosY + node.x * sinY;
        const y2 = node.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + node.y * sinX;

        const fov = 340;
        const scale = fov / (fov + z2);
        const px = cx + x1 * scale;
        const py = cy + y2 * scale;

        const edgeFade = Math.max(0, Math.min(1, px / 28));
        const depthAlpha = Math.max(0.12, Math.min(0.95, 0.52 - z2 / 320));
        const alpha = edgeFade * depthAlpha;

        return {
          px,
          py,
          pz: z2,
          scale,
          alpha,
          isFront: z2 < 0,
          nIdx,
        };
      });

      // ─── 3D CONNECTING CONSTELLATION EDGES ───
      ctx.lineWidth = 0.85;
      for (const [fromIdx, toIdx] of LINKS_3D) {
        const from = projected[fromIdx];
        const to = projected[toIdx];

        if (from.px <= 0 && to.px <= 0) continue;
        const linkAlpha = Math.min(from.alpha, to.alpha);
        if (linkAlpha <= 0.02) continue;

        let strokeColor = `rgba(56, 189, 248, ${linkAlpha * 0.45})`;
        if (activeStepIdx === 1) {
          strokeColor = `rgba(168, 85, 247, ${linkAlpha * 0.5})`;
        } else if (activeStepIdx === 2) {
          strokeColor = `rgba(16, 185, 129, ${linkAlpha * 0.48})`;
        } else if (activeStepIdx === 3) {
          strokeColor = `rgba(244, 63, 94, ${linkAlpha * 0.52})`;
        }

        ctx.strokeStyle = strokeColor;
        ctx.beginPath();
        ctx.moveTo(from.px, from.py);
        ctx.lineTo(to.px, to.py);
        ctx.stroke();
      }

      // ─── 3D CONSTELLATION NODES & HIGHLIGHTED SECURITY TOKENS ───
      for (const node of projected) {
        if (node.alpha <= 0.03 || node.px <= 0) continue;

        const r = Math.max(1.2, 2.3 * node.scale);
        const isSpecialFinding = node.nIdx % 11 === 0;

        ctx.beginPath();
        ctx.arc(node.px, node.py, r, 0, Math.PI * 2);

        if (isSpecialFinding && node.isFront) {
          const pulse = Math.sin(time * 3 + node.nIdx) * 0.3 + 0.7;
          if (activeStepIdx === 0) {
            ctx.fillStyle = `rgba(255, 170, 0, ${node.alpha * pulse})`;
            ctx.shadowBlur = 8;
            ctx.shadowColor = "#FF5500";
          } else if (activeStepIdx === 1) {
            ctx.fillStyle = `rgba(192, 132, 252, ${node.alpha * pulse})`;
            ctx.shadowBlur = 8;
            ctx.shadowColor = "#A855F7";
          } else if (activeStepIdx === 2) {
            ctx.fillStyle = `rgba(52, 211, 153, ${node.alpha * pulse})`;
            ctx.shadowBlur = 8;
            ctx.shadowColor = "#10B981";
          } else {
            ctx.fillStyle = `rgba(251, 113, 133, ${node.alpha * pulse})`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = "#F43F5E";
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          if (node.isFront) {
            ctx.fillStyle = `rgba(255, 255, 255, ${node.alpha * 0.88})`;
          } else {
            ctx.fillStyle = `rgba(148, 163, 184, ${node.alpha * 0.38})`;
          }
          ctx.fill();
        }
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [activeStepIdx]);

  const activeStep = STEPS_DATA[activeStepIdx] || STEPS_DATA[0];

  const handleSelectStep = (idx: number) => {
    setActiveStepIdx(idx);
    if (!trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const windowH = window.innerHeight;
    const totalScrollable = rect.height - windowH;
    if (totalScrollable <= 0) return;

    const targetProgress = (idx + 0.15) / STEPS_DATA.length;
    const targetScrollY = window.scrollY + rect.top + targetProgress * totalScrollable;

    window.scrollTo({
      top: targetScrollY,
      behavior: "smooth",
    });
  };

  return (
    <section
      id="context"
      ref={trackRef}
      className="relative h-[340vh] bg-[#141417ed] text-zinc-100"
      style={{ backgroundColor: "#141417ed" }}
    >
      {/* ─── PINNED STICKY VIEWPORT CONTAINER ─── */}
      <div className="sticky top-12 lg:top-16 min-h-[calc(100vh-4rem)] flex flex-col justify-center py-6 px-4 sm:px-8">
        <div className="max-w-7xl w-full mx-auto">
          {/* ─── SECTION HEADER ──────────────────────────────────────────────── */}
          <div className="mb-8 sm:mb-10">
            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold tracking-tight text-white leading-[1.15]">
              Best-in-class context.
            </h2>
            <p className="mt-2.5 text-sm sm:text-base text-zinc-400">
              Across each step, we pull in dozens more points of context than other tools.
            </p>
          </div>

          {/* ─── MAIN SHOWCASE CONTAINER (Matching CodeRabbit Video Frame) ────── */}
          <div className="rounded-2xl border border-white/10 bg-[#141417ed] backdrop-blur-md overflow-hidden shadow-2xl relative">
            <div className="flex flex-col lg:flex-row min-h-[530px]">
              {/* ─── LEFT COLUMN: Steps Navigation + Bottom Title & Description ─── */}
              <div className="w-full lg:w-64 xl:w-72 p-6 sm:p-8 flex flex-col justify-between shrink-0 select-none border-b lg:border-b-0 border-slate-200 dark:border-white/10">
                {/* Step Navigation Tabs with Scroll Progress Bars */}
                <div className="space-y-6 sm:space-y-7">
                  {STEPS_DATA.map((step, idx) => {
                    const isActive = idx === activeStepIdx;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        suppressHydrationWarning
                        onClick={() => handleSelectStep(idx)}
                        className={`text-left text-base sm:text-lg transition-colors duration-200 cursor-pointer block font-medium group w-full ${
                          isActive
                            ? "text-slate-900 dark:text-white font-semibold"
                            : "text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{step.name}</span>
                          {isActive && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FF5500]/15 text-[#FF5500] border border-[#FF5500]/30 font-bold">
                              ACTIVE
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Bottom Explanation Block (Animated Arrival) */}
                <div
                  key={`desc-${animKey}`}
                  className="mt-8 lg:mt-auto pt-6 border-t border-slate-200/50 dark:border-white/10"
                  style={{ animation: "cardSlideUp 0.35s ease-out forwards" }}
                >
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5 tracking-tight">
                    {activeStep.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                    {activeStep.description}
                  </p>
                </div>
              </div>

              {/* ─── VERTICAL DIVIDER: High-Contrast Neon Orange Line ──────────────────────── */}
              <div className="hidden lg:block w-[2px] bg-[#FF5500] shrink-0 self-stretch shadow-[0_0_12px_rgba(255,85,0,0.6)] z-20" />

              {/* ─── RIGHT AREA: Half-Cut Sphere + Animated Signals + Diff + Review ─── */}
              <div className="flex-1 p-3 sm:p-6 lg:p-8 flex flex-col xl:flex-row items-center justify-between gap-6 overflow-hidden relative">
                {/* Left/Middle Cluster: Half-Cut Dome + SVG Arcs + Animated Signals */}
                <div className="relative shrink-0 w-full max-w-[540px] h-[420px] select-none mx-auto xl:mx-0">
                  {/* Layer 1: Half-Cut Canvas Engine (Flush against left orange line) */}
                  <canvas
                    ref={canvasRef}
                    width={260}
                    height={420}
                    className="absolute left-0 top-0 w-[260px] h-[420px] pointer-events-none z-0"
                  />

                  {/* Layer 2: Half-Cut SVG Arcs + Laser Beam + Cascading Animated Text */}
                  <svg
                    viewBox="0 0 540 420"
                    className="absolute left-0 top-0 w-[540px] h-[420px] pointer-events-none select-none z-10 overflow-visible"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <filter id="orange-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>

                      <marker
                        id="orange-arrow"
                        viewBox="0 0 10 10"
                        refX="6"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                      >
                        <path d="M 0 1 L 8 5 L 0 9 z" fill="#FF5500" />
                      </marker>

                      {/* Progressive reveal masks for upper & bottom green dotted segments along r=195 */}
                      <mask id="mask-upper-green-arc" maskUnits="userSpaceOnUse" x="-15" y="0" width="230" height="420">
                        <path
                          d="M 0 15 A 195 195 0 0 1 138 72"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="12"
                          strokeDasharray="165"
                          strokeDashoffset={activeStepIdx >= 1 ? 0 : 165}
                          style={{
                            transition: "stroke-dashoffset 0.65s cubic-bezier(0.22, 1, 0.36, 1)",
                          }}
                        />
                      </mask>

                      <mask id="mask-bottom-green-arc" maskUnits="userSpaceOnUse" x="-15" y="0" width="230" height="420">
                        <path
                          d="M 0 405 A 195 195 0 0 0 138 348"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="12"
                          strokeDasharray="165"
                          strokeDashoffset={activeStepIdx >= 2 ? 0 : 165}
                          style={{
                            transition: "stroke-dashoffset 0.65s cubic-bezier(0.22, 1, 0.36, 1)",
                          }}
                        />
                      </mask>
                    </defs>

                    {/* Semicircle / Half-Cut Round Shape (Flush against x=0, no default border on step 1) */}
                    <path
                      d="M 0 20 A 190 190 0 0 1 0 400 Z"
                      className="fill-slate-100/10 dark:fill-white/[0.03]"
                      stroke="none"
                    />

                    {/* Step 2+ (Shannon Entropy): Upper Green Dotted Arc appearing from the top side (r=195) */}
                    <path
                      d="M 0 15 A 195 195 0 0 1 138 72"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeDasharray="2 7"
                      strokeDashoffset={-scrollProgress * 240}
                      mask="url(#mask-upper-green-arc)"
                      style={{
                        opacity: activeStepIdx >= 1 ? 0.92 : 0,
                        transition: "opacity 0.3s ease",
                      }}
                    />

                    {/* Step 3+ (System Guidelines): Bottom Green Dotted Arc on the same r=195 line appearing from the bottom side */}
                    <path
                      d="M 0 405 A 195 195 0 0 0 138 348"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeDasharray="2 7"
                      strokeDashoffset={-scrollProgress * 240}
                      mask="url(#mask-bottom-green-arc)"
                      style={{
                        opacity: activeStepIdx >= 2 ? 0.92 : 0,
                        transition: "opacity 0.3s ease",
                      }}
                    />

                    {/* Step 4 (Automated Merge Gate): Middle Solid Glowing Orange Arc between the two green dotted arcs (r=195) */}
                    <path
                      d="M 138 72 A 195 195 0 0 1 138 348"
                      fill="none"
                      stroke="#FF5500"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      filter="url(#orange-glow)"
                      className="drop-shadow-sm"
                      strokeDasharray="315"
                      strokeDashoffset={activeStepIdx >= 3 ? 0 : 315}
                      style={{
                        opacity: activeStepIdx >= 3 ? 1 : 0,
                        transition:
                          "stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease",
                      }}
                    />

                    {/* Orange Laser Pointer Beam (Animated firing when stage activates) */}
                    <line
                      key={`laser-${animKey}`}
                      x1="195"
                      y1="210"
                      x2="480"
                      y2="210"
                      stroke="#FF5500"
                      strokeWidth="2"
                      markerEnd="url(#orange-arrow)"
                      filter="url(#orange-glow)"
                      style={{
                        animation: "laserFire 0.45s ease-out forwards",
                        strokeDasharray: 320,
                      }}
                    />

                    {/* Animated Traveling Photon along Orange Beam */}
                    <circle r="3.5" fill="#ffffff">
                      <animateMotion
                        path="M 195 210 L 474 210"
                        dur="1.3s"
                        repeatCount="indefinite"
                      />
                    </circle>

                    {/* ─── CONTEXT POINTS LIST ─── */}
                    {/* Top Cluster: Models with Cyan/Blue Dots */}
                    <g className="text-[11px] font-sans">
                      {activeStep.models.map((item, idx) => {
                        const yPos = 112 + idx * 17.5;
                        return (
                          <g
                            key={`${animKey}-model-${idx}`}
                            style={{
                              animation: `signalSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 55}ms forwards`,
                              opacity: 0,
                              transform: "translateX(16px)",
                            }}
                          >
                            <circle cx="215" cy={yPos - 3} r="2.5" fill="#38BDF8" />
                            <text
                              x="225"
                              y={yPos}
                              className="fill-slate-800 dark:fill-zinc-300 text-[11px] font-medium"
                            >
                              <tspan className="font-semibold text-slate-900 dark:text-white">
                                {item.name}
                              </tspan>
                              <tspan className="fill-slate-400 dark:fill-zinc-400">
                                {" "}· {item.tag}
                              </tspan>
                            </text>
                          </g>
                        );
                      })}

                      {/* Ellipsis separator */}
                      <text
                        x="225"
                        y="226"
                        className="fill-slate-400 dark:fill-zinc-600 font-mono text-[12px]"
                      >
                        ...
                      </text>

                      {/* Bottom Cluster: Tools, KB, SAST */}
                      {activeStep.contextItems.map((item, idx) => {
                        const yPos = 246 + idx * 18;
                        return (
                          <g
                            key={`${animKey}-tool-${idx}`}
                            style={{
                              animation: `signalSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) ${220 + idx * 55}ms forwards`,
                              opacity: 0,
                              transform: "translateX(16px)",
                            }}
                          >
                            <circle
                              cx="215"
                              cy={yPos - 3}
                              r="2"
                              fill={item.isGreen ? "#10B981" : "#64748B"}
                            />
                            <text
                              x="225"
                              y={yPos}
                              className={`text-[11px] ${
                                item.isGreen
                                  ? "fill-emerald-600 dark:fill-emerald-400 font-medium"
                                  : "fill-slate-600 dark:fill-zinc-400"
                              }`}
                            >
                              {item.name}
                            </text>
                          </g>
                        );
                      })}

                      {/* Bottom Ellipsis */}
                      <text
                        x="225"
                        y="356"
                        className="fill-slate-400 dark:fill-zinc-600 font-mono text-[12px]"
                      >
                        ...
                      </text>
                    </g>
                  </svg>
                </div>

                {/* ─── RIGHT COLUMN: Code Diff Box + Secura Bot Review Card ───────── */}
                <div
                  key={`right-cards-${activeStepIdx}`}
                  className="w-full xl:max-w-[420px] space-y-3 shrink-0 font-sans"
                  style={{ animation: "cardSlideUp 0.35s ease-out forwards" }}
                >
                  {/* 1. Code Diff Box (Clean real code, no verbose clutter) */}
                  <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md shadow-lg overflow-hidden text-xs">
                    {/* Clean Code Gutter & Lines */}
                    <div className="p-3.5 font-mono text-[11px] leading-relaxed overflow-x-auto text-slate-800 dark:text-zinc-300">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-white/10 text-[10px] text-slate-400 dark:text-zinc-500">
                        <span className="font-semibold text-slate-600 dark:text-zinc-400">
                          {activeStep.diff.fileName}
                        </span>
                        <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 rounded px-1.5 py-0.2 font-mono font-bold text-[9px]">
                          {activeStep.diff.badge}
                        </span>
                      </div>

                      {activeStep.diff.lines.map((line, lIdx) => {
                        const renderHighlighted = (raw: string) => {
                          const segments = raw.split(
                            /(\b(?:export|const|await|return|new|true|false|Status|Merge|FAILED|PASSED)\b|'[^'\r\n]*'|"[^"\r\n]*"|\/\/[^\r\n]*)/g
                          );
                          return segments.map((t, idx) => {
                            if (t.startsWith("//")) {
                              return (
                                <span key={idx} className="text-slate-400 dark:text-zinc-500 italic">
                                  {t}
                                </span>
                              );
                            }
                            if (["export", "const", "await", "return", "new"].includes(t)) {
                              return (
                                <span key={idx} className="text-purple-400 font-medium">
                                  {t}
                                </span>
                              );
                            }
                            if (["Status", "Merge"].includes(t)) {
                              return (
                                <span key={idx} className="text-sky-400 font-semibold">
                                  {t}
                                </span>
                              );
                            }
                            if (t === "FAILED") {
                              return (
                                <span key={idx} className="text-rose-400 font-bold">
                                  {t}
                                </span>
                              );
                            }
                            if (t === "PASSED") {
                              return (
                                <span key={idx} className="text-emerald-400 font-bold">
                                  {t}
                                </span>
                              );
                            }
                            if (["true", "false"].includes(t)) {
                              return (
                                <span key={idx} className="text-amber-400">
                                  {t}
                                </span>
                              );
                            }
                            if (t.startsWith("'") || t.startsWith('"')) {
                              return (
                                <span key={idx} className="text-emerald-400">
                                  {t}
                                </span>
                              );
                            }
                            return <span key={idx}>{t}</span>;
                          });
                        };

                        return (
                          <div
                            key={lIdx}
                            className={`flex items-center gap-2.5 px-1 rounded ${
                              line.isAdded
                                ? "bg-emerald-950/40 text-emerald-300"
                                : line.isRemoved
                                ? "bg-rose-950/40 text-rose-300"
                                : ""
                            }`}
                          >
                            <span className="w-5 shrink-0 text-slate-400 dark:text-zinc-600 select-none text-[10px] text-right font-mono">
                              {line.num}
                            </span>
                            <span className="whitespace-pre">{renderHighlighted(line.text)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Secura Bot Review Card (Clean & concise, logo icon) ─── */}
                  <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md p-3.5 shadow-lg space-y-2 text-xs">
                    {/* Author Header with Secura Image Logo */}
                    <div className="flex items-center gap-2">
                      <img
                        src="/logo.png"
                        alt="Secura"
                        className="h-4.5 w-4.5 rounded-full object-cover shadow-xs border border-white/10 shrink-0"
                      />
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {activeStep.review.author}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 font-semibold">
                        {activeStep.review.botBadge}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center gap-0.5 ml-auto">
                        <span>{activeStep.review.date}</span>
                        <ChevronDown className="h-3 w-3" />
                      </span>
                    </div>

                    {/* Severity Badges */}
                    <div className="flex items-center gap-2 text-[10.5px] font-semibold flex-wrap">
                      {activeStep.review.tags.map((tag, tIdx) => (
                        <span key={tIdx} className={`flex items-center gap-1 ${tag.color}`}>
                          <span>{tag.icon}</span>
                          <span>{tag.label}</span>
                        </span>
                      ))}
                    </div>

                    {/* Short, crisp finding title & 1 supporting line */}
                    <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">
                      {activeStep.review.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                      {activeStep.review.message}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContextGraphSection;
