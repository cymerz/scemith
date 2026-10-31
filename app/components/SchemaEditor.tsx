"use client";

import React, { useState, useCallback } from "react";
import type { Column, ColumnType, FunctionalDependency, Schema, Table, ValidationError } from "@/lib/types";
import { createColumn, createFD, createTable } from "@/lib/schema";

const COLUMN_TYPES: ColumnType[] = [
  "INT","BIGINT","SMALLINT","TINYINT","DECIMAL","FLOAT","DOUBLE",
  "VARCHAR","CHAR","TEXT","BOOLEAN","DATE","DATETIME","TIMESTAMP","TIME","JSON",
];
const HAS_LENGTH: ColumnType[] = ["VARCHAR", "CHAR", "DECIMAL"];
const INT_TYPES: ColumnType[] = ["INT", "BIGINT", "SMALLINT", "TINYINT"];

// Grid template: name | type+len | PK | NN | UQ | AI | FK | delete
// Widths: flexible | 140px | 36px | 36px | 36px | 36px | 150px | 32px
const COL_GRID = "grid-cols-[minmax(80px,1fr)_140px_36px_36px_36px_36px_150px_32px]";

function IconTrash() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 transition-transform duration-150" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
      <path d="M5 3l6 5-6 5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
      <path d="M8 2v12M2 8h12" strokeLinecap="round"/>
    </svg>
  );
}

function IconTable() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 mb-3 text-slate-300">
      <rect x="2" y="4" width="16" height="12" rx="2"/>
      <path d="M2 8h16M8 8v8"/>
    </svg>
  );
}

function getColErrors(errors: ValidationError[], tableId: string, colId?: string) {
  return errors.filter((e) => e.tableId === tableId && e.columnId === colId);
}
function getTableErrors(errors: ValidationError[], tableId: string) {
  return errors.filter((e) => e.tableId === tableId && !e.columnId);
}

interface Props {
  schema: Schema;
  onChange: (schema: Schema) => void;
  errors: ValidationError[];
  onLoadExample: () => void;
}

export default function SchemaEditor({ schema, onChange, errors, onLoadExample }: Props) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addTable = useCallback(() => {
    const t = createTable({ position: { x: 40 + schema.tables.length * 260, y: 40 } });
    setExpandedTables((prev) => new Set([...prev, t.id]));
    onChange({ tables: [...schema.tables, t] });
  }, [schema, onChange]);

  const updateTable = useCallback((id: string, patch: Partial<Table>) => {
    onChange({ tables: schema.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  }, [schema, onChange]);

  const removeTable = useCallback((id: string) => {
    onChange({ tables: schema.tables.filter((t) => t.id !== id) });
  }, [schema, onChange]);

  const addColumn = useCallback((tableId: string) => {
    const col = createColumn();
    onChange({
      tables: schema.tables.map((t) =>
        t.id === tableId ? { ...t, columns: [...t.columns, col] } : t
      ),
    });
  }, [schema, onChange]);

  const updateColumn = useCallback((tableId: string, colId: string, patch: Partial<Column>) => {
    onChange({
      tables: schema.tables.map((t) =>
        t.id === tableId
          ? { ...t, columns: t.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c)) }
          : t
      ),
    });
  }, [schema, onChange]);

  const removeColumn = useCallback((tableId: string, colId: string) => {
    onChange({
      tables: schema.tables.map((t) =>
        t.id === tableId ? { ...t, columns: t.columns.filter((c) => c.id !== colId) } : t
      ),
    });
  }, [schema, onChange]);

  const updateFDs = useCallback((tableId: string, raw: string) => {
    const lines = raw.split("\n").map((s) => s.trim()).filter(Boolean);
    const fds: FunctionalDependency[] = [];
    for (const line of lines) {
      const fd = createFD(line);
      if (fd) fds.push(fd);
    }
    onChange({ tables: schema.tables.map((t) => (t.id === tableId ? { ...t, dependencies: fds } : t)) });
  }, [schema, onChange]);

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <h2 className="text-sm font-semibold text-slate-700">Schema editor</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onLoadExample}
            aria-label="Load example schema"
            className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors"
          >
            Load example
          </button>
          <button
            onClick={addTable}
            aria-label="Add new table"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors"
          >
            <IconPlus />
            Add table
          </button>
        </div>
      </div>

      {/* Table list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {schema.tables.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm">
            <IconTable />
            <p className="font-medium text-slate-500 mb-1">No tables yet</p>
            <p className="text-xs">Click <strong>Add table</strong> or load an example.</p>
          </div>
        )}

        {schema.tables.map((table) => {
          const tErrors = getTableErrors(errors, table.id);
          const isExpanded = expandedTables.has(table.id);
          const hasError = tErrors.length > 0;

          return (
            <div
              key={table.id}
              className={`rounded-lg border bg-white shadow-sm overflow-hidden transition-colors ${
                hasError ? "border-red-300" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {/* Table header row */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 transition-colors"
                onClick={() => toggleExpand(table.id)}
                role="button"
                aria-expanded={isExpanded}
              >
                <span className="text-slate-400 flex-none">
                  <IconChevron open={isExpanded} />
                </span>
                <input
                  value={table.name}
                  onChange={(e) => updateTable(table.id, { name: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="table_name"
                  aria-label="Table name"
                  className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300 focus:text-indigo-700"
                />
                <span className="text-[11px] text-slate-400 flex-none tabular-nums">
                  {table.columns.length} col{table.columns.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeTable(table.id); }}
                  aria-label={`Remove table ${table.name}`}
                  className="flex-none p-1 text-slate-400 hover:text-red-500 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 transition-colors"
                >
                  <IconTrash />
                </button>
              </div>

              {/* Validation errors */}
              {tErrors.map((e, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 bg-red-50 border-t border-red-100">
                  <svg viewBox="0 0 16 16" className="w-3 h-3 flex-none" fill="currentColor">
                    <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 4a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 018 5zm0 6.5a.75.75 0 110-1.5.75.75 0 010 1.5z"/>
                  </svg>
                  {e.message}
                </div>
              ))}

              {/* Expanded body */}
              {isExpanded && (
                <div className="border-t border-slate-100">
                  {/* Column grid header */}
                  <div className={`grid ${COL_GRID} gap-x-1.5 px-3 pt-2.5 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide`}>
                    <span>Name</span>
                    <span>Type</span>
                    <span className="text-center" title="Primary key">PK</span>
                    <span className="text-center" title="Not null">NN</span>
                    <span className="text-center" title="Unique">UQ</span>
                    <span className="text-center" title="Auto-increment">AI</span>
                    <span>Foreign key</span>
                    <span></span>
                  </div>

                  {/* Column rows */}
                  <div className="px-3 pb-1 flex flex-col gap-0.5">
                    {table.columns.map((col) => {
                      const cErrors = getColErrors(errors, table.id, col.id);
                      return (
                        <ColumnRow
                          key={col.id}
                          col={col}
                          table={table}
                          schema={schema}
                          errors={cErrors}
                          onChange={(patch) => updateColumn(table.id, col.id, patch)}
                          onRemove={() => removeColumn(table.id, col.id)}
                        />
                      );
                    })}
                  </div>

                  {table.columns.length === 0 && (
                    <p className="px-3 py-2 text-xs text-slate-400 italic">No columns — add one below.</p>
                  )}

                  {/* Add column */}
                  <div className="px-3 py-2 border-t border-slate-100">
                    <button
                      onClick={() => addColumn(table.id)}
                      className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 rounded"
                    >
                      <IconPlus />
                      Add column
                    </button>
                  </div>

                  {/* Functional dependencies */}
                  <div className="px-3 pb-3 border-t border-slate-100 pt-2">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                      Functional dependencies
                      <span className="normal-case font-normal text-slate-400 ml-1">(one per line, e.g. id → name)</span>
                    </label>
                    <textarea
                      rows={Math.max(2, table.dependencies.length + 1)}
                      defaultValue={table.dependencies.map((fd) => fd.raw).join("\n")}
                      onBlur={(e) => updateFDs(table.id, e.target.value)}
                      placeholder={"id_anggota -> nama_anggota\nid_buku -> judul_buku"}
                      aria-label="Functional dependencies"
                      className="w-full text-xs font-mono border border-slate-200 rounded-md px-2 py-1.5 resize-none outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 text-slate-700 placeholder:text-slate-300 bg-slate-50"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column Row
// ---------------------------------------------------------------------------

interface ColumnRowProps {
  col: Column;
  table: Table;
  schema: Schema;
  errors: ValidationError[];
  onChange: (patch: Partial<Column>) => void;
  onRemove: () => void;
}

function ColumnRow({ col, table, schema, errors, onChange, onRemove }: ColumnRowProps) {
  const isIntType = INT_TYPES.includes(col.type);
  const hasLength = HAS_LENGTH.includes(col.type);

  const fkTargets = schema.tables
    .filter((t) => t.id !== table.id)
    .flatMap((t) =>
      t.columns
        .filter((c) => (c.primaryKey || c.unique) && c.name.trim())
        .map((c) => ({ tableId: t.id, tableName: t.name, colName: c.name }))
    );

  const currentFKValue = col.foreignKey
    ? `${col.foreignKey.tableId}::${col.foreignKey.columnName}`
    : "";

  const inputBase = "w-full text-xs border rounded px-1.5 py-1 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 text-slate-800 placeholder:text-slate-300 bg-white";
  const checkBase = "w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer focus:ring-2 focus:ring-indigo-300";

  const hasError = errors.length > 0;

  return (
    <div className={`rounded ${hasError ? "bg-red-50 ring-1 ring-red-200" : ""}`}>
      <div className={`grid ${COL_GRID} gap-x-1.5 items-center py-0.5`}>
        {/* Name */}
        <input
          value={col.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="col_name"
          aria-label="Column name"
          className={`${inputBase} border-slate-200`}
        />

        {/* Type + optional length */}
        <div className="flex gap-1 items-center">
          <select
            value={col.type}
            onChange={(e) => {
              const t = e.target.value as ColumnType;
              onChange({
                type: t,
                autoIncrement: col.autoIncrement && INT_TYPES.includes(t) ? col.autoIncrement : false,
              });
            }}
            aria-label="Column type"
            className={`flex-1 min-w-0 ${inputBase} border-slate-200 pr-0.5`}
          >
            {COLUMN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {hasLength && (
            <input
              type="number"
              value={col.length ?? ""}
              onChange={(e) => onChange({ length: parseInt(e.target.value) || undefined })}
              aria-label="Column length"
              placeholder="len"
              className="w-12 text-xs border border-slate-200 rounded px-1 py-1 outline-none focus:border-indigo-400 text-slate-700 bg-white flex-none"
            />
          )}
        </div>

        {/* PK */}
        <div className="flex justify-center items-center">
          <input
            type="checkbox"
            checked={col.primaryKey}
            onChange={(e) =>
              onChange({ primaryKey: e.target.checked, notNull: e.target.checked ? true : col.notNull })
            }
            aria-label="Primary key"
            className={checkBase}
          />
        </div>

        {/* NN */}
        <div className="flex justify-center items-center">
          <input
            type="checkbox"
            checked={col.notNull}
            onChange={(e) => onChange({ notNull: e.target.checked })}
            aria-label="Not null"
            className={checkBase}
          />
        </div>

        {/* UQ */}
        <div className="flex justify-center items-center">
          <input
            type="checkbox"
            checked={col.unique}
            onChange={(e) => onChange({ unique: e.target.checked })}
            aria-label="Unique"
            className={checkBase}
          />
        </div>

        {/* AI */}
        <div className="flex justify-center items-center">
          <input
            type="checkbox"
            checked={col.autoIncrement}
            disabled={!isIntType}
            onChange={(e) => onChange({ autoIncrement: e.target.checked })}
            aria-label={isIntType ? "Auto-increment" : "Auto-increment (integer types only)"}
            className={`${checkBase} accent-amber-500 disabled:opacity-25 disabled:cursor-not-allowed`}
          />
        </div>

        {/* FK */}
        <select
          value={currentFKValue}
          onChange={(e) => {
            if (!e.target.value) {
              onChange({ foreignKey: undefined });
            } else {
              const [tableId, colName] = e.target.value.split("::");
              onChange({ foreignKey: { tableId, columnName: colName } });
            }
          }}
          aria-label="Foreign key reference"
          className={`${inputBase} border-slate-200`}
        >
          <option value="">— none —</option>
          {fkTargets.map((t) => (
            <option key={`${t.tableId}::${t.colName}`} value={`${t.tableId}::${t.colName}`}>
              {t.tableName}.{t.colName}
            </option>
          ))}
        </select>

        {/* Delete */}
        <div className="flex justify-center items-center">
          <button
            onClick={onRemove}
            aria-label={`Remove column ${col.name}`}
            className="p-1 text-slate-400 hover:text-red-500 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 transition-colors"
          >
            <IconTrash />
          </button>
        </div>
      </div>

      {/* Column errors */}
      {errors.map((e, i) => (
        <div key={i} className="text-xs text-red-600 px-1.5 pb-0.5 flex items-center gap-1">
          <svg viewBox="0 0 16 16" className="w-3 h-3 flex-none" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 4a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 018 5zm0 6.5a.75.75 0 110-1.5.75.75 0 010 1.5z"/>
          </svg>
          {e.message}
        </div>
      ))}
    </div>
  );
}
