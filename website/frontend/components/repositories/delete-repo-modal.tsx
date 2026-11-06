"use client";

import React from "react";
import { Trash2, Loader2 } from "lucide-react";

interface DeleteRepoModalProps {
  isOpen: boolean;
  repoFullName: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteRepoModal({
  isOpen,
  repoFullName,
  loading,
  onClose,
  onConfirm,
}: DeleteRepoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-2xl space-y-4 text-slate-900 dark:text-zinc-100">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Delete Repository
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
              Are you sure you want to delete{" "}
              <strong className="text-slate-800 dark:text-zinc-200 font-semibold">{repoFullName}</strong>?
              This will remove the repository container, pull request security monitoring, and all associated findings from Secura.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
          <button
            type="button"
            onClick={onClose}
            suppressHydrationWarning
            className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            suppressHydrationWarning
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-500 transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}

