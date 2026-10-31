"use client";

import React, { useCallback } from "react";
import type { Schema, Table } from "@/lib/types";
import type { NormalizationResult, NormalizationViolation } from "@/lib/types";
import { analyzeTable, decomposeTable } from "@/lib/normalization";
import { createColumn, newId } from "@/lib/schema";

const NF_BADGE: Record<string, string> = {
  "Not 1NF": "bg-red-100 text-red-700",
  "1NF": "bg-orange-100 text-orange-700",
  "2NF": "bg-yellow-100 text-yellow-700",
  "3NF": "bg-blue-100 text-blue-700",
  BCNF: "bg-green-100 text-green-700",
};

const VIOLATION_COLOR: Record<string, string> = {
  "2NF": "text-yellow-700 bg-yellow-50 border-yellow-200",
  "3NF": "text-orange-700 bg-orange-50 border-orange-200",
  BCNF: "text-red-700 bg-red-50 border-red-200",
};

interface Props {
  schema: Schema;
  onChange: (schema: Schema) => void;
}

export default function NormalizationPanel({ schema, onChange }: Props) {
  const results = schema.tables
    .filter((t) => t.name.trim() && t.columns.length > 0)
    .map((t) => analyzeTable(t));

  const handleDecompose = useCallback(
    (tableId: string, result: NormalizationResult) => {
      const table = schema.tables.find((t) => t.id === tableId);
      if (!table) return;

      const { newTables } = decomposeTable(table, result.violations);
      const colMap = new Map(table.columns.map((c) => [c.name, c]));

      // Build full Table objects from decomposed descriptors
      const builtTables: Table[] = newTables.map((desc, i) => {
        const columns = desc.columns
          .filter((name) => colMap.has(name))
          .map((name) => {
            const orig = colMap.get(name)!;
            return {
              ...orig,
              id: newId("col"),
              primaryKey: desc.primaryKey.includes(name),
              // Remove FK if target col doesn't exist yet (will be re-added manually)
            };
          });

        return {
          id: desc.id,
          name: desc.name,
          columns,
          dependencies: [],
          position: {
            x: table.position.x + i * 240,
            y: table.position.y + 180,
          },
        };
      });

      // Replace original table with decomposed ones
      const updatedTables = [
        ...schema.tables.filter((t) => t.id !== tableId),
        ...builtTables,
      ];

      onChange({ tables: updatedTables });
    },
    [schema, onChange]
  );

  if (results.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-400 text-center py-12">
        <div className="text-3xl mb-2">📐</div>
        Add tables with functional dependencies to see normalization analysis.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      <h2 className="text-sm font-semibold text-indigo-900 uppercase tracking-wide">
        Normalization Analyzer
      </h2>

      {results.map((result) => (
        <TableNormCard
          key={result.tableId}
          result={result}
          onDecompose={() => handleDecompose(result.tableId, result)}
        />
      ))}
    </div>
  );
}

function TableNormCard({
  result,
  onDecompose,
}: {
  result: NormalizationResult;
  onDecompose: () => void;
}) {
  const hasViolations = result.violations.length > 0;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-slate-800">{result.tableName}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${NF_BADGE[result.normalForm] ?? "bg-slate-100 text-slate-600"}`}>
            {result.normalForm}
          </span>
        </div>
        {hasViolations && (
          <button
            onClick={onDecompose}
            className="text-xs px-2 py-1 bg-amber-400 hover:bg-amber-500 text-amber-900 font-medium rounded transition-colors"
          >
            Apply suggested decomposition
          </button>
        )}
      </div>

      {/* Candidate keys */}
      <div className="px-3 py-2 border-t border-slate-100">
        <span className="text-xs text-slate-500 font-medium">Candidate keys: </span>
        {result.candidateKeys.length === 0 ? (
          <span className="text-xs text-slate-400 italic">none detected</span>
        ) : (
          result.candidateKeys.map((ck, i) => (
            <span key={i} className="inline-block mr-1 text-xs font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
              {"{" + ck.join(", ") + "}"}
            </span>
          ))
        )}
      </div>

      {/* Violations */}
      {hasViolations ? (
        <div className="px-3 py-2 border-t border-slate-100 flex flex-col gap-2">
          <span className="text-xs font-medium text-slate-600">Violations:</span>
          {result.violations.map((v, i) => (
            <ViolationCard key={i} v={v} />
          ))}
        </div>
      ) : (
        <div className="px-3 py-2 border-t border-slate-100 text-xs text-green-600">
          ✓ No violations found — this table is in {result.normalForm}.
        </div>
      )}
    </div>
  );
}

function ViolationCard({ v }: { v: NormalizationViolation }) {
  const color = VIOLATION_COLOR[v.violates] ?? "";
  return (
    <div className={`text-xs p-2 rounded border ${color}`}>
      <div className="font-semibold mb-0.5">
        Violates {v.violates}:{" "}
        <span className="font-mono">
          {"{" + v.fd.determinant.join(", ") + "}"} → {"{" + v.fd.dependent.join(", ") + "}"}
        </span>
      </div>
      <div className="text-xs opacity-80">{v.explanation}</div>
    </div>
  );
}
