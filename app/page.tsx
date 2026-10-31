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

export default function Home() {
  const [schema, setSchema] = useState<Schema>(INITIAL_SCHEMA);
  const [rightTab, setRightTab] = useState<RightTab>("normalization");
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");
  const [showExampleModal, setShowExampleModal] = useState(false);

  const examples = getExamples();

  const errors = validateSchema(schema);

  const handleSchemaChange = useCallback((next: Schema) => {
    setSchema(next);
  }, []);

  const handlePositionChange = useCallback(
    (tableId: string, pos: { x: number; y: number }) => {
      setSchema((prev) => ({
        tables: prev.tables.map((t) =>
          t.id === tableId ? { ...t, position: pos } : t
        ),
      }));
    },
    []
  );

  const handleLoadExample = useCallback((example: ReturnType<typeof getExamples>[number]) => {
    setSchema(example.schema);
    setShowExampleModal(false);
  }, []);

  const errorCount = errors.length;

  return (
    <>
      {/* Example Modal */}
      {showExampleModal && (
        <ExampleModal
          examples={examples}
          onSelect={handleLoadExample}
          onClose={() => setShowExampleModal(false)}
        />
      )}

      {/* Full-viewport layout */}
      <div className="h-dvh overflow-hidden flex flex-col bg-white">
        {/* Top bar */}
        <header className="flex-none flex items-center justify-between px-4 py-2 bg-indigo-700 text-white shadow-md z-10">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">⚒ SchemaSmith</span>
            <span className="hidden sm:inline text-xs text-indigo-300">Database Schema Designer</span>
          </div>
          <div className="flex items-center gap-3">
            {errorCount > 0 && (
              <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-medium">
                {errorCount} error{errorCount !== 1 ? "s" : ""}
              </span>
            )}
            <span className="text-xs text-indigo-300 hidden sm:inline">
              {schema.tables.length} table{schema.tables.length !== 1 ? "s" : ""}
            </span>
          </div>
        </header>

        {/* Desktop 3-column layout (hidden on mobile) */}
        <div className="hidden md:flex flex-1 min-h-0">
          {/* Left: Schema Editor */}
          <aside className="w-72 lg:w-80 xl:w-96 flex-none border-r border-slate-200 overflow-y-auto bg-white">
            <SchemaEditor
              schema={schema}
              onChange={handleSchemaChange}
              errors={errors}
              onLoadExample={() => setShowExampleModal(true)}
            />
          </aside>

          {/* Center: ERD Diagram */}
          <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
            <div className="flex-none px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-medium">
              ERD Diagram — drag tables to reposition
            </div>
            <div className="flex-1 overflow-hidden">
              <ERDDiagram schema={schema} onPositionChange={handlePositionChange} />
            </div>
          </main>

          {/* Right: Normalization + SQL tabs */}
          <aside className="w-80 xl:w-96 flex-none border-l border-slate-200 flex flex-col bg-white">
            {/* Tabs */}
            <div className="flex-none flex border-b border-slate-200">
              <button
                onClick={() => setRightTab("normalization")}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  rightTab === "normalization"
                    ? "border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                Normalization
              </button>
              <button
                onClick={() => setRightTab("sql")}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  rightTab === "sql"
                    ? "border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                SQL
              </button>
            </div>
            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {rightTab === "normalization" ? (
                <NormalizationPanel schema={schema} onChange={handleSchemaChange} />
              ) : (
                <SQLPanel schema={schema} />
              )}
            </div>
          </aside>
        </div>

        {/* Mobile: single panel + bottom tabs */}
        <div className="flex md:hidden flex-1 min-h-0 flex-col">
          {/* Panel area */}
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
              <div className="h-full overflow-y-auto">
                <NormalizationPanel schema={schema} onChange={handleSchemaChange} />
              </div>
            )}
            {mobileTab === "sql" && (
              <div className="h-full flex flex-col">
                <SQLPanel schema={schema} />
              </div>
            )}
          </div>

          {/* Bottom tabs */}
          <nav className="flex-none flex border-t border-slate-200 bg-white">
            {(
              [
                { key: "editor", label: "Editor", icon: "✏️" },
                { key: "diagram", label: "Diagram", icon: "📊" },
                { key: "normalization", label: "Normal.", icon: "📐" },
                { key: "sql", label: "SQL", icon: "💾" },
              ] as { key: MobileTab; label: string; icon: string }[]
            ).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setMobileTab(key)}
                className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
                  mobileTab === key
                    ? "text-indigo-700 border-t-2 border-indigo-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
