"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bell,
  ExternalLink,
  Moon,
  Palette,
  Shield,
  Sun,
  User,
} from "lucide-react";

function GithubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
      {children}
    </h2>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] text-slate-500 ml-2">
      Coming soon
    </span>
  );
}

function Toggle({ label, checked = false }: { label: string; checked?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
      <span className="text-sm text-slate-300">{label}</span>
      <div
        className={`relative w-10 h-5 rounded-full transition-colors ${
          checked ? "bg-blue-600" : "bg-white/[0.1]"
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Account */}
      <div>
        <SectionTitle>
          <User className="h-4 w-4 text-slate-500" />
          Account
        </SectionTitle>
        <Card>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Name</label>
              <input
                type="text"
                defaultValue="Jay"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Email</label>
              <input
                type="email"
                defaultValue="jay@example.com"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500/50"
              />
            </div>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors">
              Save changes
            </button>
          </CardContent>
        </Card>
      </div>

      {/* GitHub */}
      <div>
        <SectionTitle>
          <GithubIcon className="h-4 w-4 text-slate-500" />
          GitHub Integration
        </SectionTitle>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-slate-200">GitHub account</p>
                <p className="text-xs text-slate-500 mt-0.5">Not connected</p>
              </div>
              <button className="flex items-center gap-2 rounded-lg bg-white/[0.05] border border-white/[0.1] px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.08] transition-colors">
                <GithubIcon className="h-4 w-4" />
                Connect GitHub
              </button>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-xs text-slate-400 mb-1.5">Secura GitHub App</p>
              <a
                href="https://github.com/apps/secura"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
              >
                Install or configure the GitHub App
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security policy */}
      <div>
        <SectionTitle>
          <Shield className="h-4 w-4 text-slate-500" />
          Security Policy
        </SectionTitle>
        <Card>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Max critical findings
                </label>
                <input
                  type="number"
                  defaultValue={0}
                  min={0}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Max high findings
                </label>
                <input
                  type="number"
                  defaultValue={0}
                  min={0}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Minimum security score
                </label>
                <input
                  type="number"
                  defaultValue={80}
                  min={0}
                  max={100}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-300 outline-none"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              These thresholds control when the Secura Security Gate blocks pull
              request merges. Changes take effect on the next scan.
            </p>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors">
              Save policy
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Notifications */}
      <div>
        <SectionTitle>
          <Bell className="h-4 w-4 text-slate-500" />
          Notifications
          <ComingSoon label="coming soon" />
        </SectionTitle>
        <Card>
          <CardContent>
            <Toggle label="New critical finding detected" checked={true} />
            <Toggle label="New high-severity finding detected" checked={true} />
            <Toggle label="Scan failure" checked={false} />
            <Toggle label="Weekly security digest" checked={false} />
            <p className="mt-3 text-xs text-slate-500">
              Email notification settings coming soon.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Appearance */}
      <div>
        <SectionTitle>
          <Palette className="h-4 w-4 text-slate-500" />
          Appearance
          <ComingSoon label="coming soon" />
        </SectionTitle>
        <Card>
          <CardContent>
            <div className="flex gap-3">
              <button className="flex flex-col items-center gap-1.5 rounded-lg border-2 border-blue-500/50 bg-[#0d1117] px-6 py-4 text-xs text-slate-300">
                <Moon className="h-5 w-5 text-blue-400" />
                Dark
              </button>
              <button className="flex flex-col items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-6 py-4 text-xs text-slate-400 opacity-50 cursor-not-allowed">
                <Sun className="h-5 w-5" />
                Light
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Light mode is coming soon. Currently only dark mode is supported.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

