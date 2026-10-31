"use client";

import React, { useCallback, useState } from "react";
import type { Schema, Table } from "@/lib/types";
import type { NormalizationResult, NormalizationViolation } from "@/lib/types";
import {
  analyzeTable,
  planDecomposition,
  applyDecomposition,
  type DecomposedTablePlan,
} from "@/lib/normalization";

// Semantic NF badges: BCNF=green, 3NF=teal, 2NF=amber, 1NF=red, Not 1NF=red
const NF_BADGE: Record<string, string> = {
  "Not 1NF": "bg-red-100 text-red-700 ring-1 ring-red-200",
  "1NF":     "bg-red-50 text-red-600 ring-1 ring-red-200",
  "2NF":     "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  "3NF":     "bg-teal-100 text-teal-700 ring-1 ring-teal-200",
  BCNF:      "bg-green-100 text-green-700 ring-1 ring-green-200",
};

const VIOLATION_COLOR: Record<string, { card: string; badge: string }> = {
  "2NF": { card: "bg-amber-50 border-amber-200", badge: "bg-amber-100 text-amber-700" },
  "3NF": { card: "bg-orange-50 border-orange-200", badge: "bg-orange-100 text-orange-700" },
  BCNF:  { card: "bg-red-50 border-red-200", badge: "bg-red-100 text-red-700" },
};

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
      className="w-3.5 h-3.5 transition-transform duration-150 flex-none"
      style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
      <path d="M5 3l6 5-6 5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

interface Props {
  schema: Schema;
  onChange: (schema: Schema) => void;
  onUndo: (() => void) | null;
}

export default function NormalizationPanel({ schema, onChange, onUndo }: Props) {
  const [preview, setPreview] = useState<{
    tableId: string;
    plans: DecomposedTablePlan[];
    names: string[];
  } | null>(null);

  const results = schema.tables
    .filter((t) => t.name.trim() && t.columns.length > 0)
    .map((t) => analyzeTable(t));

  // Summary stats
  const relCount = schema.tables.reduce(
    (n, t) => n + t.columns.filter((c) => !!c.foreignKey).length, 0
  );
  const worstNF = results.reduce<string | null>((worst, r) => {
    const order = ["Not 1NF", "1NF", "2NF", "3NF", "BCNF"];
    if (!worst) return r.normalForm;
    return order.indexOf(r.normalForm) < order.indexOf(worst) ? r.normalForm : worst;
  }, null);
  const allBCNF = results.length > 0 && results.every((r) => r.normalForm === "BCNF");

  const handleOpenPreview = useCallback(
    (tableId: string, result: NormalizationResult) => {
      const table = schema.tables.find((t) => t.id === tableId);
      if (!table) return;
      const plans = planDecomposition(table, result.violations);
      setPreview({ tableId, plans, names: plans.map((p) => p.suggestedName) });
    },
    [schema]
  );

  const handleApplyPreview = useCallback(() => {
    if (!preview) return;
    const table = schema.tables.find((t) => t.id === preview.tableId);
    if (!table) return;
    const built = applyDecomposition(table, preview.plans, preview.names);
    onChange({ tables: [...schema.tables.filter((t) => t.id !== preview.tableId), ...built] });
    setPreview(null);
  }, [preview, schema, onChange]);

  return (
    <>
      {preview && (
        <DecomposePreviewModal
          plans={preview.plans}
          names={preview.names}
          onNameChange={(i, v) =>
            setPreview((prev) =>
              prev ? { ...prev, names: prev.names.map((n, j) => (j === i ? v : n)) } : null
            )
          }
          onApply={handleApplyPreview}
          onCancel={() => setPreview(null)}
        />
      )}

      <div className="flex flex-col h-full">
        {/* Panel header */}
        <div className="flex-none px-4 py-3 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700">Normalization analysis</h2>
            {onUndo && (
              <button
                onClick={onUndo}
                aria-label="Undo last decomposition"
                className="flex items-center gap-1 text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-md border border-slate-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
              >
                <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8a5 5 0 105 5M3 8V4M3 8H7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Undo
              </button>
            )}
          </div>

          {/* Summary */}
          {results.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">
                {results.length} table{results.length !== 1 ? "s" : ""}
              </span>
              <span className="text-slate-300 text-xs">·</span>
              <span className="text-xs text-slate-500">
                {relCount} relationship{relCount !== 1 ? "s" : ""}
              </span>
              <span className="text-slate-300 text-xs">·</span>
              {allBCNF ? (
                <span className="text-xs font-medium text-green-600">All in BCNF</span>
              ) : (
                <span className="text-xs text-slate-500">
                  Worst: <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${NF_BADGE[worstNF ?? "BCNF"] ?? ""}`}>{worstNF}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
          {results.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 mb-3 text-slate-300">
                <rect x="6" y="6" width="36" height="36" rx="4"/>
                <path d="M14 18h20M14 26h14M14 34h8"/>
              </svg>
              <p className="text-sm font-medium text-slate-400">No tables to analyze</p>
              <p className="text-xs mt-1">Add tables with functional dependencies.</p>
            </div>
          )}

          {results.map((result) => (
            <TableNormCard
              key={result.tableId}
              result={result}
              table={schema.tables.find((t) => t.id === result.tableId)!}
              onDecompose={() => handleOpenPreview(result.tableId, result)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Preview modal
// ---------------------------------------------------------------------------

interface PreviewProps {
  plans: DecomposedTablePlan[];
  names: string[];
  onNameChange: (i: number, v: string) => void;
  onApply: () => void;
  onCancel: () => void;
}

function DecomposePreviewModal({ plans, names, onNameChange, onApply, onCancel }: PreviewProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-slate-800">Decomposition preview</h2>
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="p-1 text-slate-400 hover:text-slate-600 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Review the resulting tables. You can rename any table before applying.
        </p>

        <div className="flex flex-col gap-3">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`border rounded-lg p-3 ${
                plan.isRemainder ? "border-indigo-200 bg-indigo-50/60" : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                  plan.isRemainder ? "bg-indigo-100 text-indigo-600" : "bg-amber-100 text-amber-700"
                }`}>
                  {plan.isRemainder ? "Remainder" : "New table"}
                </span>
                <input
                  value={names[i]}
                  onChange={(e) => onNameChange(i, e.target.value)}
                  aria-label={`Name for ${plan.isRemainder ? "remainder" : "new"} table`}
                  className="flex-1 font-mono text-sm font-semibold border border-slate-200 rounded-md px-2 py-0.5 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 text-slate-800 bg-white"
                />
              </div>

              {plan.sourceFd && (
                <div className="text-xs text-slate-500 mb-2">
                  Source FD:{" "}
                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                    {"{" + plan.sourceFd.determinant.join(", ") + "}"} → {"{" + plan.sourceFd.dependent.join(", ") + "}"}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {plan.columns.map((col) => {
                  const isPK = plan.primaryKey.includes(col);
                  const isFKCol = plan.isRemainder && plans.some((p) => !p.isRemainder && p.primaryKey.includes(col));
                  return (
                    <span
                      key={col}
                      className={`text-xs px-2 py-0.5 rounded-full font-mono border ${
                        isPK ? "bg-amber-50 text-amber-800 border-amber-200 font-semibold"
                          : isFKCol ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : "bg-white text-slate-700 border-slate-200"
                      }`}
                    >
                      {isPK ? "PK · " : isFKCol ? "FK · " : ""}{col}
                    </span>
                  );
                })}
              </div>

              {plan.isRemainder && plans.some((p) => !p.isRemainder) && (
                <p className="mt-2 text-xs text-slate-400">
                  Foreign keys will be added: {plans.filter((p) => !p.isRemainder)
                    .map((p) => `${p.primaryKey.join(", ")} → ${names[plans.indexOf(p)]}`).join("; ")}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            Apply decomposition
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table normalization card (collapsible)
// ---------------------------------------------------------------------------

function TableNormCard({
  result,
  table,
  onDecompose,
}: {
  result: NormalizationResult;
  table: Table;
  onDecompose: () => void;
}) {
  const hasViolations = result.violations.length > 0;
  // Expanded by default if there are violations; collapsed if clean
  const [open, setOpen] = useState(hasViolations);

  const pkCols = table.columns.filter((c) => c.primaryKey).map((c) => c.name);
  const nonPKCols = table.columns.filter((c) => !c.primaryKey && c.name.trim()).map((c) => c.name);
  const hasImpliedKey = pkCols.length > 0 && nonPKCols.length > 0;
  const hasNoDeclaredFDs = table.dependencies.length === 0;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Header (always visible, click to collapse) */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
      >
        <span className="text-slate-400"><IconChevron open={open} /></span>
        <span className="font-mono text-sm font-semibold text-slate-800 flex-1 min-w-0 truncate">{result.tableName}</span>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold flex-none ${NF_BADGE[result.normalForm] ?? "bg-slate-100 text-slate-600"}`}>
          {result.normalForm}
        </span>
        {hasNoDeclaredFDs && (
          <span className="text-[11px] text-slate-400 italic flex-none hidden sm:inline">key only</span>
        )}
        {hasViolations && (
          <button
            onClick={(e) => { e.stopPropagation(); onDecompose(); }}
            aria-label={`Apply decomposition for ${result.tableName}`}
            className="flex-none text-[11px] px-2 py-1 bg-amber-400 hover:bg-amber-500 text-amber-900 font-semibold rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
          >
            Decompose
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-slate-100">
          {/* Candidate keys */}
          <div className="px-3 py-2 flex items-start gap-2 flex-wrap">
            <span className="text-[11px] text-slate-500 font-medium flex-none pt-0.5">Candidate keys</span>
            {result.candidateKeys.length === 0 ? (
              <span className="text-[11px] text-slate-400 italic">none detected</span>
            ) : (
              result.candidateKeys.map((ck, i) => (
                <span key={i} className="text-[11px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                  {"{" + ck.join(", ") + "}"}
                </span>
              ))
            )}
          </div>

          {/* Implied PK dependency */}
          {hasImpliedKey && (
            <div className="px-3 py-1.5 border-t border-slate-100 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-400 flex-none">Implied</span>
              <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-dashed border-slate-300">
                {"{" + pkCols.join(", ") + "}"} → {"{" + nonPKCols.join(", ") + "}"}
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                implied
              </span>
            </div>
          )}

          {/* Violations or clean message */}
          {hasViolations ? (
            <div className="px-3 py-2 border-t border-slate-100 flex flex-col gap-2">
              {result.violations.map((v, i) => (
                <ViolationCard key={i} v={v} />
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 border-t border-slate-100 flex items-center gap-1.5 text-xs text-green-600">
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 flex-none" fill="currentColor">
                <path fillRule="evenodd" d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.53 5.47a.75.75 0 00-1.06-1.06L7 8.88 5.53 7.41a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l4-4z"/>
              </svg>
              No violations — this table is in {result.normalForm}.
              {hasNoDeclaredFDs && <span className="text-slate-400 ml-0.5">(No FDs declared.)</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ViolationCard({ v }: { v: NormalizationViolation }) {
  const c = VIOLATION_COLOR[v.violates] ?? { card: "bg-slate-50 border-slate-200", badge: "bg-slate-100 text-slate-600" };
  return (
    <div className={`text-xs p-2.5 rounded-lg border ${c.card}`}>
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${c.badge}`}>
          Violates {v.violates}
        </span>
        <span className="font-mono text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
          {"{" + v.fd.determinant.join(", ") + "}"} → {"{" + v.fd.dependent.join(", ") + "}"}
        </span>
      </div>
      <p className="text-slate-600 leading-relaxed">{v.explanation}</p>
    </div>
  );
}
