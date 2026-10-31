"use client";

import React, { useState, useCallback } from "react";
import type { Column, ColumnType, FunctionalDependency, Schema, Table, ValidationError } from "@/lib/types";
import { createColumn, createFD, createTable, newId } from "@/lib/schema";

const COLUMN_TYPES: ColumnType[] = [
  "INT","BIGINT","SMALLINT","TINYINT","DECIMAL","FLOAT","DOUBLE",
  "VARCHAR","CHAR","TEXT","BOOLEAN","DATE","DATETIME","TIMESTAMP","TIME","JSON",
];

const HAS_LENGTH: ColumnType[] = ["VARCHAR", "CHAR", "DECIMAL"];
const INT_TYPES: ColumnType[] = ["INT", "BIGINT", "SMALLINT", "TINYINT"];

interface Props {
  schema: Schema;
  onChange: (schema: Schema) => void;
  errors: ValidationError[];
  onLoadExample: () => void;
}

function getColErrors(errors: ValidationError[], tableId: string, colId?: string) {
  return errors.filter((e) => e.tableId === tableId && e.columnId === colId);
}

function getTableErrors(errors: ValidationError[], tableId: string) {
  return errors.filter((e) => e.tableId === tableId && !e.columnId);
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
    const t = createTable({ position: { x: 40 + schema.tables.length * 220, y: 40 } });
    setExpandedTables((prev) => new Set([...prev, t.id]));
    onChange({ tables: [...schema.tables, t] });
  }, [schema, onChange]);

  const updateTable = useCallback((id: string, patch: Partial<Table>) => {
    onChange({
      tables: schema.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
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
    onChange({
      tables: schema.tables.map((t) => (t.id === tableId ? { ...t, dependencies: fds } : t)),
    });
  }, [schema, onChange]);

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-indigo-900 uppercase tracking-wide">Schema Editor</h2>
        <div className="flex gap-2">
          <div className="relative group">
            <button
              onClick={onLoadExample}
              className="px-3 py-1.5 text-xs bg-amber-400 hover:bg-amber-500 text-amber-900 font-medium rounded transition-colors"
            >
              Load Example ▾
            </button>
          </div>
          <button
            onClick={addTable}
            className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded transition-colors"
          >
            + Add Table
          </button>
        </div>
      </div>

      {schema.tables.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          <div className="text-3xl mb-2">🗃</div>
          No tables yet. Click <strong>+ Add Table</strong> or load an example.
        </div>
      )}

      {schema.tables.map((table) => {
        const tErrors = getTableErrors(errors, table.id);
        const isExpanded = expandedTables.has(table.id);

        return (
          <div
            key={table.id}
            className={`border rounded-lg overflow-hidden ${tErrors.length > 0 ? "border-red-300" : "border-slate-200"}`}
          >
            {/* Table header */}
            <div
              className="flex items-center gap-2 px-3 py-2 bg-indigo-50 cursor-pointer select-none"
              onClick={() => toggleExpand(table.id)}
            >
              <span className="text-indigo-500 text-xs">{isExpanded ? "▾" : "▸"}</span>
              <input
                value={table.name}
                onChange={(e) => updateTable(table.id, { name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="table_name"
                className="flex-1 bg-transparent text-sm font-semibold text-indigo-900 outline-none placeholder:text-indigo-300"
              />
              <span className="text-xs text-slate-400">{table.columns.length} cols</span>
              <button
                onClick={(e) => { e.stopPropagation(); removeTable(table.id); }}
                className="text-red-400 hover:text-red-600 text-xs px-1"
                title="Remove table"
              >
                ✕
              </button>
            </div>

            {/* Table errors */}
            {tErrors.map((e, i) => (
              <div key={i} className="px-3 py-1 text-xs text-red-600 bg-red-50 border-t border-red-200">
                ⚠ {e.message}
              </div>
            ))}

            {isExpanded && (
              <div className="px-3 py-2 bg-white">
                {/* Columns header */}
                <div className="grid grid-cols-[1fr_100px_32px_32px_32px_32px_1fr_28px] gap-1 text-xs font-medium text-slate-500 mb-1 px-1">
                  <span>Name</span>
                  <span>Type</span>
                  <span title="Primary Key">PK</span>
                  <span title="Not Null">NN</span>
                  <span title="Unique">UQ</span>
                  <span title="Auto Increment">AI</span>
                  <span>FK → table.col</span>
                  <span></span>
                </div>

                {/* Columns */}
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

                <button
                  onClick={() => addColumn(table.id)}
                  className="mt-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                >
                  + Add Column
                </button>

                {/* Functional Dependencies */}
                <div className="mt-3 border-t border-slate-100 pt-2">
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Functional Dependencies{" "}
                    <span className="text-slate-400 font-normal">(one per line, e.g. "id → name")</span>
                  </label>
                  <textarea
                    rows={Math.max(2, table.dependencies.length + 1)}
                    defaultValue={table.dependencies.map((fd) => fd.raw).join("\n")}
                    onBlur={(e) => updateFDs(table.id, e.target.value)}
                    placeholder={"id_anggota -> nama_anggota\nid_buku -> judul_buku"}
                    className="w-full text-xs font-mono border border-slate-200 rounded p-1.5 resize-none outline-none focus:border-indigo-400 text-slate-700 placeholder:text-slate-300"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

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

  // Available FK targets: all columns in other tables that are PK or unique
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

  return (
    <div className={`mb-0.5 ${errors.length > 0 ? "rounded bg-red-50" : ""}`}>
      <div className="grid grid-cols-[1fr_100px_32px_32px_32px_32px_1fr_28px] gap-1 items-center">
        {/* Name */}
        <input
          value={col.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="col_name"
          className="text-xs border border-slate-200 rounded px-1.5 py-1 outline-none focus:border-indigo-400 text-slate-800 placeholder:text-slate-300"
        />
        {/* Type */}
        <div className="flex gap-0.5">
          <select
            value={col.type}
            onChange={(e) => {
              const t = e.target.value as ColumnType;
              onChange({ type: t, autoIncrement: col.autoIncrement && INT_TYPES.includes(t) ? col.autoIncrement : false });
            }}
            className="flex-1 text-xs border border-slate-200 rounded px-1 py-1 outline-none focus:border-indigo-400 text-slate-700"
          >
            {COLUMN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {hasLength && (
            <input
              type="number"
              value={col.length ?? ""}
              onChange={(e) => onChange({ length: parseInt(e.target.value) || undefined })}
              className="w-12 text-xs border border-slate-200 rounded px-1 py-1 outline-none focus:border-indigo-400 text-slate-700"
              placeholder="len"
            />
          )}
        </div>
        {/* PK */}
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={col.primaryKey}
            onChange={(e) => onChange({ primaryKey: e.target.checked, notNull: e.target.checked ? true : col.notNull })}
            className="accent-indigo-600"
          />
        </div>
        {/* NN */}
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={col.notNull}
            onChange={(e) => onChange({ notNull: e.target.checked })}
            className="accent-indigo-600"
          />
        </div>
        {/* UQ */}
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={col.unique}
            onChange={(e) => onChange({ unique: e.target.checked })}
            className="accent-indigo-600"
          />
        </div>
        {/* AI */}
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={col.autoIncrement}
            disabled={!isIntType}
            onChange={(e) => onChange({ autoIncrement: e.target.checked })}
            className="accent-amber-500 disabled:opacity-30"
            title={isIntType ? "Auto Increment" : "Only for integer types"}
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
          className="text-xs border border-slate-200 rounded px-1 py-1 outline-none focus:border-indigo-400 text-slate-700"
        >
          <option value="">— none —</option>
          {fkTargets.map((t) => (
            <option key={`${t.tableId}::${t.colName}`} value={`${t.tableId}::${t.colName}`}>
              {t.tableName}.{t.colName}
            </option>
          ))}
        </select>
        {/* Remove */}
        <button
          onClick={onRemove}
          className="text-red-400 hover:text-red-600 text-xs text-center"
          title="Remove column"
        >
          ✕
        </button>
      </div>
      {errors.map((e, i) => (
        <div key={i} className="text-xs text-red-600 px-1 py-0.5">⚠ {e.message}</div>
      ))}
    </div>
  );
}
