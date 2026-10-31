"use client";

import React, { useState, useCallback, useEffect } from "react";
import type { Column, ColumnType, FunctionalDependency, Schema, Table, ValidationError } from "@/lib/types";
import { createColumn, createFD, createTable } from "@/lib/schema";

const COLUMN_TYPES: ColumnType[] = [
  "INT","BIGINT","SMALLINT","TINYINT","DECIMAL","FLOAT","DOUBLE",
  "VARCHAR","CHAR","TEXT","BOOLEAN","DATE","DATETIME","TIMESTAMP","TIME","JSON",
];
const HAS_LENGTH: ColumnType[] = ["VARCHAR", "CHAR", "DECIMAL"];
const INT_TYPES: ColumnType[] = ["INT", "BIGINT", "SMALLINT", "TINYINT"];

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

function DependencyEditor({
  table,
  onUpdate,
}: {
  table: Table;
  onUpdate: (tableId: string, raw: string) => void;
}) {
  const [value, setValue] = useState(table.dependencies.map((fd) => fd.raw).join("\n"));

  useEffect(() => {
    setValue(table.dependencies.map((fd) => fd.raw).join("\n"));
  }, [table.dependencies]);

  return (
    <textarea
      rows={Math.max(2, table.dependencies.length + 1)}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onUpdate(table.id, value)}
      placeholder={"id_anggota -> nama_anggota\nid_buku -> judul_buku"}
      aria-label="Functional dependencies"
      className="w-full text-xs font-mono border border-slate-200 rounded-lg px-2.5 py-2 resize-y outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-slate-700 placeholder:text-slate-300 bg-slate-50/70"
    />
  );
}

interface Props {
  schema: Schema;
  onChange: (schema: Schema) => void;
  onChangeFn: (updater: (prev: Schema) => Schema) => void;
  errors: ValidationError[];
  onLoadExample: () => void;
}

export default function SchemaEditor({ schema, onChange, onChangeFn, errors, onLoadExample }: Props) {
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
    onChangeFn((prev) => ({ tables: prev.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }, [onChangeFn]);

  const removeTable = useCallback((id: string) => {
    onChangeFn((prev) => ({ tables: prev.tables.filter((t) => t.id !== id) }));
  }, [onChangeFn]);

  const addColumn = useCallback((tableId: string) => {
    const col = createColumn();
    onChangeFn((prev) => ({
      tables: prev.tables.map((t) =>
        t.id === tableId ? { ...t, columns: [...t.columns, col] } : t
      ),
    }));
  }, [onChangeFn]);

  const updateColumn = useCallback((tableId: string, colId: string, patch: Partial<Column>) => {
    onChangeFn((prev) => ({
      tables: prev.tables.map((t) =>
        t.id === tableId
          ? { ...t, columns: t.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c)) }
          : t
      ),
    }));
  }, [onChangeFn]);

  const removeColumn = useCallback((tableId: string, colId: string) => {
    onChangeFn((prev) => ({
      tables: prev.tables.map((t) =>
        t.id === tableId ? { ...t, columns: t.columns.filter((c) => c.id !== colId) } : t
      ),
    }));
  }, [onChangeFn]);

  const updateFDs = useCallback((tableId: string, raw: string) => {
    const lines = raw.split("\n").map((s) => s.trim()).filter(Boolean);
    const fds: FunctionalDependency[] = [];
    for (const line of lines) {
      const fd = createFD(line);
      if (fd) fds.push(fd);
    }
    onChangeFn((prev) => ({ tables: prev.tables.map((t) => (t.id === tableId ? { ...t, dependencies: fds } : t)) }));
  }, [onChangeFn]);

  return (
    <div className="flex flex-col">
      {/* Panel header */}
      <div className="sticky top-0 z-10 flex flex-col items-stretch gap-3 px-4 py-3.5 border-b border-slate-100 bg-white">
        <h2 className="text-sm font-semibold text-slate-800 whitespace-nowrap">Schema editor</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onLoadExample}
            aria-label="Load example schema"
            className="whitespace-nowrap px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors"
          >
            Load example
          </button>
          <button
            onClick={addTable}
            aria-label="Add new table"
            className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors"
          >
            <IconPlus />
            Add table
          </button>
        </div>
      </div>

      {/* Table list */}
      <div className="px-3 py-3 flex flex-col gap-2">
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
              className={`rounded-xl border bg-white overflow-hidden transition-colors ${
                hasError ? "border-red-200 shadow-sm shadow-red-50" : "border-slate-200/80 hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              {/* Table header row */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none bg-white hover:bg-slate-50/80 transition-colors"
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
                  {/* Column list */}
                  <div className="px-2.5 py-2 flex flex-col gap-2">
                    {table.columns.map((col, index) => {
                      const cErrors = getColErrors(errors, table.id, col.id);
                      return (
                        <ColumnRow
                          key={col.id}
                          col={col}
                          index={index}
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
                    <DependencyEditor table={table} onUpdate={updateFDs} />
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
// Column Row — two-line layout
// ---------------------------------------------------------------------------

interface ColumnRowProps {
  col: Column;
  index: number;
  table: Table;
  schema: Schema;
  errors: ValidationError[];
  onChange: (patch: Partial<Column>) => void;
  onRemove: () => void;
}

function ColumnRow({ col, index, table, schema, errors, onChange, onRemove }: ColumnRowProps) {
  const isIntType = INT_TYPES.includes(col.type);
  const showLength = HAS_LENGTH.includes(col.type);

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

  const ctrlCls = "text-xs border border-slate-200 rounded px-1.5 py-1 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 text-slate-800 bg-white";
  const hasError = errors.length > 0;

  return (
    <div className={`rounded-lg border p-2.5 flex flex-col gap-2 ${hasError ? "border-red-200 bg-red-50/70" : "border-slate-200 bg-slate-50/70"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center justify-center min-w-5 h-5 px-1 rounded text-[10px] font-semibold tabular-nums ${hasError ? "bg-red-100 text-red-700" : "bg-white border border-slate-200 text-slate-500"}`}>#{index + 1}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Column</span>
      </div>

      <div className="flex items-center gap-1.5">
        <input
          value={col.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="col_name"
          aria-label="Column name"
          className={`${ctrlCls} flex-1 min-w-0 font-medium placeholder:text-slate-300`}
        />
        <button
          onClick={onRemove}
          aria-label={`Remove column ${col.name}`}
          className="flex-none p-1 text-slate-400 hover:text-red-500 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 transition-colors"
        >
          <IconTrash />
        </button>
      </div>

      {/* Line 2: type, length, flags, FK — wraps freely */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">

        {/* Type select — fixed width so it never collapses */}
        <select
          value={col.type}
          onChange={(e) => {
            const newType = e.target.value as ColumnType;
            const patch: Partial<Column> = { type: newType };
            // reset autoIncrement when switching away from integer types
            if (!INT_TYPES.includes(newType)) patch.autoIncrement = false;
            // set a sensible default length when switching INTO a length type
            if (HAS_LENGTH.includes(newType) && !col.length) {
              patch.length = newType === "DECIMAL" ? 10 : 255;
            }
            onChange(patch);
          }}
          aria-label="Column type"
          className={`${ctrlCls} w-28 flex-none`}
        >
          {COLUMN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Length — only for VARCHAR / CHAR / DECIMAL */}
        {showLength && (
          <input
            type="number"
            value={col.length ?? ""}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              onChange({ length: Number.isFinite(v) && v > 0 ? v : undefined });
            }}
            aria-label="Column length"
            placeholder="len"
            className={`${ctrlCls} w-14 flex-none`}
          />
        )}

        {/* Constraint toggles */}
        {(
          [
            { field: "primaryKey",    label: "PK", amber: false, title: "Primary key" },
            { field: "notNull",       label: "NN", amber: false, title: "Not null" },
            { field: "unique",        label: "UQ", amber: false, title: "Unique" },
            { field: "autoIncrement", label: "AI", amber: true,  title: isIntType ? "Auto-increment" : "Auto-increment (integer types only)" },
          ] as const
        ).map(({ field, label, amber, title }) => {
          const disabled = field === "autoIncrement" && !isIntType;
          return (
            <label
              key={field}
              title={title}
              className={`flex items-center gap-0.5 text-[11px] font-semibold select-none ${
                disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer text-slate-600 hover:text-slate-900"
              }`}
            >
              <input
                type="checkbox"
                checked={col[field]}
                disabled={disabled}
                aria-label={title}
                onChange={(e) => {
                  if (field === "primaryKey") {
                    onChange({ primaryKey: e.target.checked, notNull: e.target.checked ? true : col.notNull });
                  } else {
                    onChange({ [field]: e.target.checked } as Partial<Column>);
                  }
                }}
                className={`w-3 h-3 rounded ${amber ? "accent-amber-500" : "accent-indigo-600"} cursor-pointer disabled:cursor-not-allowed`}
              />
              {label}
            </label>
          );
        })}

        {/* FK select — stretches to fill remaining space, min-width so it's usable */}
        {(fkTargets.length > 0 || col.foreignKey) && (
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
            className={`${ctrlCls} flex-1 min-w-[100px]`}
          >
            <option value="">FK: none</option>
            {fkTargets.map((t) => (
              <option key={`${t.tableId}::${t.colName}`} value={`${t.tableId}::${t.colName}`}>
                → {t.tableName}.{t.colName}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Validation errors */}
      {errors.map((e, i) => (
        <div key={i} className="text-[11px] text-red-600 flex items-center gap-1">
          <svg viewBox="0 0 16 16" className="w-3 h-3 flex-none" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 4a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 018 5zm0 6.5a.75.75 0 110-1.5.75.75 0 010 1.5z"/>
          </svg>
          {e.message}
        </div>
      ))}
    </div>
  );
}
