"use client";

import React, { useState, useCallback } from "react";
import type { Schema } from "@/lib/types";
import { generateSQL } from "@/lib/sql";

type Dialect = "mysql" | "postgresql";

interface Props {
  schema: Schema;
}

export default function SQLPanel({ schema }: Props) {
  const [dialect, setDialect] = useState<Dialect>("mysql");
  const [copied, setCopied] = useState(false);

  const sql = generateSQL(schema, dialect);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = sql;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [sql]);

  const hasContent = schema.tables.filter((t) => t.name.trim() && t.columns.length > 0).length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <h2 className="text-sm font-semibold text-slate-700">SQL generator</h2>
        <div className="flex items-center gap-2">
          {/* Dialect toggle */}
          <div className="flex rounded-md overflow-hidden border border-slate-200 text-xs">
            {(["mysql", "postgresql"] as Dialect[]).map((d) => (
              <button
                key={d}
                onClick={() => setDialect(d)}
                aria-label={d === "mysql" ? "MySQL output" : "PostgreSQL output"}
                aria-pressed={dialect === d}
                className={`px-3 py-1.5 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 ${
                  dialect === d
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {d === "mysql" ? "MySQL" : "PostgreSQL"}
              </button>
            ))}
          </div>

          <button
            onClick={handleCopy}
            disabled={!hasContent}
            aria-label={copied ? "Copied to clipboard" : "Copy SQL to clipboard"}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus-visible:outline focus-visible:outline-2 disabled:opacity-40 disabled:cursor-not-allowed ${
              copied
                ? "bg-green-500 text-white focus-visible:outline-green-400"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-indigo-400"
            }`}
          >
            {copied ? (
              <>
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
                  <path fillRule="evenodd" d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.53 5.47a.75.75 0 00-1.06-1.06L7 8.88 5.53 7.41a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l4-4z"/>
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="5" y="4" width="8" height="10" rx="1.5"/>
                  <path d="M3 12V3a1 1 0 011-1h7" strokeLinecap="round"/>
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {!hasContent ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 mb-3 text-slate-300">
            <path d="M10 6h28a2 2 0 012 2v32a2 2 0 01-2 2H10a2 2 0 01-2-2V8a2 2 0 012-2z"/>
            <path d="M16 16h16M16 22h16M16 28h10" strokeLinecap="round"/>
          </svg>
          <p className="text-sm font-medium text-slate-400">No SQL to show</p>
          <p className="text-xs mt-1">Add tables with columns to generate SQL.</p>
        </div>
      ) : (
        <pre className="flex-1 overflow-auto text-xs font-mono bg-slate-900 text-green-300 p-4 leading-relaxed whitespace-pre">
          {sql}
        </pre>
      )}
    </div>
  );
}
