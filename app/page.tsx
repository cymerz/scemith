"use client";

import React, { useState, useCallback, useRef } from "react";
import type { Schema } from "@/lib/types";
import { validateSchema } from "@/lib/schema";
import { getExamples } from "@/lib/examples";
import SchemaEditor from "@/app/components/SchemaEditor";
import ERDDiagram, { autoLayout } from "@/app/components/ERDDiagram";
import NormalizationPanel from "@/app/components/NormalizationPanel";
import SQLPanel from "@/app/components/SQLPanel";
import ExampleModal from "@/app/components/ExampleModal";

type RightTab = "normalization" | "sql";
type MobileTab = "editor" | "diagram" | "normalization" | "sql";

const INITIAL_SCHEMA: Schema = { tables: [] };

function IconEditor() {
  return (
    <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="14" height="12" rx="2"/>
      <path d="M3 8h14M8 8v8" strokeLinecap="round"/>
    </svg>
  );
}
function IconDiagram() {
  return (
    <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="7" height="5" rx="1.5"/>
      <rect x="11" y="12" width="7" height="5" rx="1.5"/>
      <path d="M9 5.5h3.5a1 1 0 011 1v5.5" strokeLinecap="round"/>
    </svg>
  );
}
function IconNorm() {
  return (
    <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 5h12M4 10h8M4 15h5" strokeLinecap="round"/>
    </svg>
  );
}
function IconSQL() {
  return (
    <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 7l-3 3 3 3M15 7l3 3-3 3M11 4l-2 12" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function Home() {
  const [schema, setSchema] = useState<Schema>(INITIAL_SCHEMA);
  const [undoSnapshot, setUndoSnapshot] = useState<Schema | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("normalization");
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");
  const [showExampleModal, setShowExampleModal] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  // Increment fitKey to tell ERDDiagram to auto-fit after load/decompose/undo
  const fitKeyRef = useRef(0);
  const [fitKey, setFitKey] = useState(0);

  const bumpFit = useCallback(() => {
    fitKeyRef.current += 1;
    setFitKey(fitKeyRef.current);
  }, []);

  const examples = getExamples();
  const errors = validateSchema(schema);

  const handleSchemaChange = useCallback((next: Schema) => {
    setSchema(next);
    setUndoSnapshot(null);
  }, []);

  // Functional-update wrapper so SchemaEditor callbacks never close over stale schema
  const handleSchemaChangeFn = useCallback((updater: (prev: Schema) => Schema) => {
    setSchema(updater);
    setUndoSnapshot(null);
  }, []);

  const handleDecompositionChange = useCallback(
    (next: Schema) => {
      setUndoSnapshot(schema);
      // Apply auto-layout so the decomposed tables are arranged cleanly
      setSchema({ tables: autoLayout(next.tables) });
      bumpFit();
    },
    [schema, bumpFit]
  );

  const handleUndo = useCallback(() => {
    if (undoSnapshot) {
      setSchema(undoSnapshot);
      setUndoSnapshot(null);
      bumpFit();
    }
  }, [undoSnapshot, bumpFit]);

  const handlePositionChange = useCallback(
    (tableId: string, pos: { x: number; y: number }) => {
      setSchema((prev) => ({
        tables: prev.tables.map((t) => (t.id === tableId ? { ...t, position: pos } : t)),
      }));
    },
    []
  );

  const handleExport = useCallback(() => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(schema, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "schema.json";
    link.click();
    URL.revokeObjectURL(url);
  }, [schema]);

  const handleImport = useCallback(async (file?: File) => {
    if (!file) return;
    if (schema.tables.length > 0 && !window.confirm("Importing will replace the current schema. Continue?")) {
      if (importInputRef.current) importInputRef.current.value = "";
      return;
    }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as Schema).tables)) {
        throw new Error("Invalid schema file. Expected a JSON object with a tables array.");
      }
      const next = parsed as Schema;
      if (!next.tables.every((table) =>
        table && typeof table.id === "string" && typeof table.name === "string" &&
        Array.isArray(table.columns) && Array.isArray(table.dependencies) &&
        table.position && typeof table.position.x === "number" && typeof table.position.y === "number" &&
        table.columns.every((column) =>
          column && typeof column.id === "string" && typeof column.name === "string" &&
          typeof column.type === "string" && typeof column.primaryKey === "boolean" &&
          typeof column.notNull === "boolean" && typeof column.unique === "boolean" &&
          typeof column.autoIncrement === "boolean"
        ) && table.dependencies.every((fd) =>
          fd && typeof fd.id === "string" && Array.isArray(fd.determinant) &&
          Array.isArray(fd.dependent) && typeof fd.raw === "string"
        )
      )) {
        throw new Error("Invalid schema file. Table or column data is incomplete.");
      }
      setSchema(next);
      setUndoSnapshot(null);
      setImportError(null);
      bumpFit();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not import this file.");
    }
    if (importInputRef.current) importInputRef.current.value = "";
  }, [bumpFit]);

  const handleLoadExample = useCallback((example: ReturnType<typeof getExamples>[number]) => {
    // Apply auto-layout so example tables are arranged in a tidy graph
    setSchema({ tables: autoLayout(example.schema.tables) });
    setUndoSnapshot(null);
    setShowExampleModal(false);
    bumpFit();
  }, [bumpFit]);

  const errorCount = errors.length;
  const relCount = schema.tables.reduce((n, t) => n + t.columns.filter((c) => !!c.foreignKey).length, 0);

  const MOBILE_TABS = [
    { key: "editor" as MobileTab, label: "Editor", Icon: IconEditor },
    { key: "diagram" as MobileTab, label: "Diagram", Icon: IconDiagram },
    { key: "normalization" as MobileTab, label: "Analysis", Icon: IconNorm },
    { key: "sql" as MobileTab, label: "SQL", Icon: IconSQL },
  ];

  return (
    <>
      {showExampleModal && (
        <ExampleModal
          examples={examples}
          onSelect={handleLoadExample}
          onClose={() => setShowExampleModal(false)}
        />
      )}

      <div className="h-dvh overflow-hidden flex flex-col bg-[#f4f6fa] text-slate-900">
        <header className="flex-none flex items-center justify-between px-5 h-14 bg-white border-b border-slate-200/80 z-10">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="2.5" y="3" width="15" height="14" rx="2.5" />
                <path d="M2.5 7.5h15M7.5 7.5V17" />
              </svg>
            </span>
            <span className="font-semibold tracking-tight text-[15px]">SchemaSmith</span>
            <span className="hidden sm:inline-block w-px h-5 bg-slate-200 mx-1" />
            <span className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{schema.tables.length} table{schema.tables.length !== 1 ? "s" : ""}</span>
              {relCount > 0 && <><span className="text-slate-300">·</span>{relCount} relationship{relCount !== 1 ? "s" : ""}</>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              aria-label="Import schema JSON"
              onChange={(e) => void handleImport(e.target.files?.[0])}
            />
            <button
              onClick={() => importInputRef.current?.click()}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >Import</button>
            <button
              onClick={handleExport}
              disabled={schema.tables.length === 0}
              className="px-2.5 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >Export</button>
            {errorCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs bg-red-50 text-red-700 border border-red-100 px-2.5 py-1 rounded-full font-medium tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {errorCount} issue{errorCount !== 1 ? "s" : ""}
              </span>
            ) : schema.tables.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Schema valid
              </span>
            ) : null}
          </div>
        </header>

        {importError && (
          <div role="alert" className="flex-none px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-100">
            {importError}
            <button onClick={() => setImportError(null)} className="ml-3 underline">Dismiss</button>
          </div>
        )}

        <div className="hidden md:flex flex-1 min-h-0 gap-3 p-3">
          <aside className="w-[340px] min-w-[280px] max-w-[480px] flex-none border border-slate-200/80 rounded-xl flex flex-col bg-white overflow-x-hidden overflow-y-auto shadow-sm">
            <SchemaEditor
              schema={schema}
              onChange={handleSchemaChange}
              onChangeFn={handleSchemaChangeFn}
              errors={errors}
              onLoadExample={() => setShowExampleModal(true)}
            />
          </aside>

          {/* Center: ERD */}
          <main className="flex-1 min-w-0 overflow-hidden flex flex-col rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex-none flex items-center justify-between gap-2 px-4 h-11 bg-white border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-xs text-slate-700 font-semibold">ER diagram</span>
              </div>
              <span className="hidden lg:inline text-[11px] text-slate-400">Drag to arrange <span className="mx-1 text-slate-300">·</span> Ctrl + scroll to zoom <span className="mx-1 text-slate-300">·</span> Drag canvas to pan</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <ERDDiagram schema={schema} onPositionChange={handlePositionChange} fitKey={fitKey} />
            </div>
          </main>

          {/* Right: Tabs */}
          <aside className="w-[320px] min-w-[260px] max-w-[420px] flex-none border border-slate-200/80 rounded-xl flex flex-col bg-white overflow-hidden shadow-sm">
            <div className="flex-none flex border-b border-slate-100 px-2 pt-2">
              {(["normalization", "sql"] as RightTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  aria-label={tab === "normalization" ? "Normalization analysis" : "SQL generator"}
                  className={`flex-1 py-2 text-xs font-medium transition-colors capitalize focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                    rightTab === tab
                      ? "border-b-2 border-indigo-600 text-indigo-700"
                      : "border-b-2 border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab === "normalization" ? "Normalization" : "SQL"}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {rightTab === "normalization" ? (
                <NormalizationPanel
                  schema={schema}
                  onChange={handleDecompositionChange}
                  onUndo={undoSnapshot ? handleUndo : null}
                />
              ) : (
                <SQLPanel schema={schema} />
              )}
            </div>
          </aside>
        </div>

        {/* Mobile: single panel + bottom tabs */}
        <div className="flex md:hidden flex-1 min-h-0 flex-col bg-[#f4f6fa]">
          <div className="flex-1 min-h-0 overflow-y-auto m-2 mb-0 rounded-xl border border-slate-200/80 bg-white shadow-sm">
            {mobileTab === "editor" && (
              <SchemaEditor
                schema={schema}
                onChange={handleSchemaChange}
                onChangeFn={handleSchemaChangeFn}
                errors={errors}
                onLoadExample={() => setShowExampleModal(true)}
              />
            )}
            {mobileTab === "diagram" && (
              <div className="h-full overflow-hidden">
                <ERDDiagram schema={schema} onPositionChange={handlePositionChange} fitKey={fitKey} />
              </div>
            )}
            {mobileTab === "normalization" && (
              <div className="h-full overflow-hidden flex flex-col">
                <NormalizationPanel
                  schema={schema}
                  onChange={handleDecompositionChange}
                  onUndo={undoSnapshot ? handleUndo : null}
                />
              </div>
            )}
            {mobileTab === "sql" && (
              <div className="h-full flex flex-col">
                <SQLPanel schema={schema} />
              </div>
            )}
          </div>

          {/* Bottom nav */}
          <nav className="flex-none flex border-t border-slate-200 bg-white" aria-label="Main navigation">
            {MOBILE_TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setMobileTab(key)}
                aria-label={label}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 ${
                  mobileTab === key
                    ? "text-indigo-700 border-t-2 border-indigo-600 -mt-px"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
