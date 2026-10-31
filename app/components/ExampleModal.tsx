"use client";

import React from "react";
import type { Example } from "@/lib/examples";

interface Props {
  examples: Example[];
  onSelect: (example: Example) => void;
  onClose: () => void;
}

export default function ExampleModal({ examples, onSelect, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-5 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Load Example Schema</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>

        <div className="flex flex-col gap-3">
          {examples.map((ex) => (
            <button
              key={ex.id}
              onClick={() => onSelect(ex)}
              className="text-left p-3 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              <div className="text-sm font-semibold text-indigo-800 mb-0.5">{ex.label}</div>
              <div className="text-xs text-slate-500">{ex.description}</div>
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Loading an example will replace the current schema.
        </p>
      </div>
    </div>
  );
}
