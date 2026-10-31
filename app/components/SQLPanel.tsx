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
      // Fallback for environments where clipboard API is unavailable
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

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-indigo-900 uppercase tracking-wide">SQL Generator</h2>
        <div className="flex items-center gap-2">
          {/* Dialect toggle */}
          <div className="flex rounded overflow-hidden border border-slate-200 text-xs">
            <button
              onClick={() => setDialect("mysql")}
              className={`px-3 py-1.5 font-medium transition-colors ${
                dialect === "mysql"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              MySQL
            </button>
            <button
              onClick={() => setDialect("postgresql")}
              className={`px-3 py-1.5 font-medium transition-colors ${
                dialect === "postgresql"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              PostgreSQL
            </button>
          </div>
          <button
            onClick={handleCopy}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              copied
                ? "bg-green-500 text-white"
                : "bg-amber-400 hover:bg-amber-500 text-amber-900"
            }`}
          >
            {copied ? "✓ Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {schema.tables.filter((t) => t.name.trim() && t.columns.length > 0).length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-12">
          <div className="text-3xl mb-2">💾</div>
          Add tables and columns to generate SQL.
        </div>
      ) : (
        <pre className="flex-1 overflow-auto text-xs font-mono bg-slate-900 text-green-300 rounded-lg p-4 leading-relaxed whitespace-pre">
          {sql}
        </pre>
      )}
    </div>
  );
}
