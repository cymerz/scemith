"use client";

import React, { useState, useCallback } from "react";
import type { Schema } from "@/lib/types";
import { validateSchema } from "@/lib/schema";
import { getExamples } from "@/lib/examples";
import SchemaEditor from "@/app/components/SchemaEditor";
import ERDDiagram from "@/app/components/ERDDiagram";
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

  const examples = getExamples();
  const errors = validateSchema(schema);

  const handleSchemaChange = useCallback((next: Schema) => {
    setSchema(next);
    setUndoSnapshot(null);
  }, []);

  const handleDecompositionChange = useCallback(
    (next: Schema) => {
      setUndoSnapshot(schema);
      setSchema(next);
    },
    [schema]
  );

  const handleUndo = useCallback(() => {
    if (undoSnapshot) {
      setSchema(undoSnapshot);
      setUndoSnapshot(null);
    }
  }, [undoSnapshot]);

  const handlePositionChange = useCallback(
    (tableId: string, pos: { x: number; y: number }) => {
      setSchema((prev) => ({
        tables: prev.tables.map((t) => (t.id === tableId ? { ...t, position: pos } : t)),
      }));
    },
    []
  );

  const handleLoadExample = useCallback((example: ReturnType<typeof getExamples>[number]) => {
    setSchema(example.schema);
    setUndoSnapshot(null);
    setShowExampleModal(false);
  }, []);

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

      <div className="h-dvh overflow-hidden flex flex-col bg-white">
        {/* Header */}
        <header className="flex-none flex items-center justify-between px-4 h-11 bg-indigo-700 text-white z-10 shadow-md">
          <div className="flex items-center gap-3">
            <span className="font-bold tracking-tight text-base">SchemaSmith</span>
            <span className="hidden sm:flex items-center gap-2 text-xs text-indigo-300">
              <span className="w-px h-4 bg-indigo-500" />
              {schema.tables.length} table{schema.tables.length !== 1 ? "s" : ""}
              {relCount > 0 && (
                <><span className="text-indigo-500">·</span>
                {relCount} relationship{relCount !== 1 ? "s" : ""}</>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <span className="text-[11px] bg-red-500 text-white px-2 py-0.5 rounded-full font-semibold tabular-nums">
                {errorCount} error{errorCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </header>

        {/* Desktop 3-column layout */}
        <div className="hidden md:flex flex-1 min-h-0">
          {/* Left: Schema Editor — min-w prevents collapse, max-w prevents hogging space */}
          <aside className="w-[340px] min-w-[280px] max-w-[480px] flex-none border-r border-slate-200 overflow-hidden flex flex-col bg-white">
            <SchemaEditor
              schema={schema}
              onChange={handleSchemaChange}
              errors={errors}
              onLoadExample={() => setShowExampleModal(true)}
            />
          </aside>

          {/* Center: ERD */}
          <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
            <div className="flex-none flex items-center gap-2 px-3 h-9 bg-slate-50 border-b border-slate-200">
              <span className="text-xs text-slate-500 font-medium">ERD diagram</span>
              <span className="text-slate-300 text-xs">·</span>
              <span className="text-xs text-slate-400">Drag tables · Ctrl+scroll to zoom · drag background to pan</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <ERDDiagram schema={schema} onPositionChange={handlePositionChange} />
            </div>
          </main>

          {/* Right: Tabs */}
          <aside className="w-[320px] min-w-[260px] max-w-[420px] flex-none border-l border-slate-200 flex flex-col bg-white overflow-hidden">
            <div className="flex-none flex border-b border-slate-200">
              {(["normalization", "sql"] as RightTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  aria-label={tab === "normalization" ? "Normalization analysis" : "SQL generator"}
                  className={`flex-1 py-2 text-xs font-medium transition-colors capitalize focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                    rightTab === tab
                      ? "border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
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
        <div className="flex md:hidden flex-1 min-h-0 flex-col">
          <div className="flex-1 min-h-0 overflow-hidden">
            {mobileTab === "editor" && (
              <div className="h-full overflow-y-auto">
                <SchemaEditor
                  schema={schema}
                  onChange={handleSchemaChange}
                  errors={errors}
                  onLoadExample={() => setShowExampleModal(true)}
                />
              </div>
            )}
            {mobileTab === "diagram" && (
              <div className="h-full overflow-hidden">
                <ERDDiagram schema={schema} onPositionChange={handlePositionChange} />
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
