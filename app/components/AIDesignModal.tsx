"use client";

import React, { useState } from "react";
import type { Schema } from "@/lib/types";

interface Props {
  onApply: (schema: Schema) => void;
  onClose: () => void;
}

export default function AIDesignModal({ onApply, onClose }: Props) {
  const [story, setStory] = useState("");
  const [draft, setDraft] = useState<Schema | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/design-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not generate a schema.");
      setDraft(result.schema as Schema);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate a schema.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-design-title"
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="ai-design-title" className="text-base font-semibold text-slate-900">Design from a story</h2>
            <p className="mt-1 text-xs text-slate-500">Describe the system then review the suggested tables before applying.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <label htmlFor="system-story" className="mb-2 block text-xs font-semibold text-slate-700">System description</label>
          <textarea
            id="system-story"
            value={story}
            onChange={(event) => setStory(event.target.value)}
            maxLength={12000}
            rows={5}
            placeholder="Example: A library manages members, books, authors, and loans. Members can borrow several books; each loan records the checkout and return dates..."
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <div className="mt-1 flex justify-between text-[11px] text-slate-400">
            <span>Be specific about records, rules, and relationships.</span>
            <span>{story.length}/12000</span>
          </div>

          {error && <p role="alert" className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          {draft && (
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800">Suggested schema</h3>
                <span className="text-xs text-slate-500">{draft.tables.length} tables · {draft.tables.reduce((n, table) => n + table.columns.length, 0)} columns</span>
              </div>
              <div className="flex flex-col gap-3">
                {draft.tables.map((table) => (
                  <article key={table.id} className="overflow-hidden rounded-xl border border-slate-200">
                    <h4 className="border-b border-slate-100 bg-slate-50 px-3 py-2 font-mono text-sm font-semibold text-slate-800">{table.name}</h4>
                    <ul className="divide-y divide-slate-100">
                      {table.columns.map((column) => (
                        <li key={column.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-xs">
                          <span className="min-w-0 flex-1 font-medium text-slate-700">{column.name}</span>
                          <span className="font-mono text-slate-500">{column.type}{column.length ? `(${column.length})` : ""}</span>
                          {column.primaryKey && <span className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">PK</span>}
                          {column.foreignKey && <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigo-700">FK</span>}
                          {column.unique && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">Unique</span>}
                        </li>
                      ))}
                    </ul>
                    {table.dependencies.length > 0 && (
                      <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                        {table.dependencies.map((fd) => <div key={fd.id} className="font-mono">{fd.raw}</div>)}
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-amber-700">AI suggestions can be inaccurate. Review keys and relationships before applying.</p>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          {draft ? (
            <>
              <button onClick={() => setDraft(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Edit description</button>
              <button onClick={() => onApply(draft)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700">Apply schema</button>
            </>
          ) : (
            <button onClick={() => void generate()} disabled={loading || !story.trim()} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? "Generating…" : "Generate schema"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
