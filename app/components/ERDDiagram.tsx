"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { Schema, Table } from "@/lib/types";

const TW = 240;          // table width
const ROW_H = 22;        // row height
const HDR_H = 34;        // header height
const PAD = 48;          // canvas padding around all tables

function tableHeight(table: Table): number {
  return HDR_H + Math.max(table.columns.length, 1) * ROW_H + 2;
}

function tableCenter(table: Table): { x: number; y: number } {
  return {
    x: table.position.x + TW / 2,
    y: table.position.y + tableHeight(table) / 2,
  };
}

/** Y-coordinate of the center of a specific row within the table in world coords */
function rowCenterY(table: Table, colIndex: number): number {
  return table.position.y + HDR_H + colIndex * ROW_H + ROW_H / 2;
}

interface Relationship {
  fromTableId: string;
  toTableId: string;
  fromColIndex: number;
  toColIndex: number;
  fromColName: string;
  toColName: string;
}

function extractRelationships(schema: Schema): Relationship[] {
  const rels: Relationship[] = [];
  for (const table of schema.tables) {
    table.columns.forEach((col, fromColIndex) => {
      if (!col.foreignKey) return;
      const toTable = schema.tables.find((t) => t.id === col.foreignKey!.tableId);
      if (!toTable) return;
      const toColIndex = toTable.columns.findIndex(
        (c) => c.name.toLowerCase() === col.foreignKey!.columnName.toLowerCase()
      );
      rels.push({
        fromTableId: table.id,
        toTableId: toTable.id,
        fromColIndex,
        toColIndex: Math.max(toColIndex, 0),
        fromColName: col.name,
        toColName: col.foreignKey!.columnName,
      });
    });
  }
  return rels;
}

/** Build an orthogonal path between two horizontal-exit points */
function orthogonalPath(x1: number, y1: number, x2: number, y2: number): string {
  const exitLen = 20;
  // Determine which side each table exits on
  const goRight1 = x2 > x1;
  const sx1 = x1 + (goRight1 ? exitLen : -exitLen);
  const sx2 = x2 + (goRight1 ? -exitLen : exitLen);
  const midX = (sx1 + sx2) / 2;
  return [
    `M ${x1} ${y1}`,
    `H ${sx1}`,
    `C ${midX} ${y1} ${midX} ${y2} ${sx2} ${y2}`,
    `H ${x2}`,
  ].join(" ");
}

/** Crow-foot many marker drawn inward from (x,y), going in direction (dx=±1) */
function CrowFootMany({ x, y, dir }: { x: number; y: number; dir: 1 | -1 }) {
  const len = 12;
  const spread = 6;
  const ex = x + dir * len;
  return (
    <g stroke="#818cf8" strokeWidth="1.5" fill="none">
      <line x1={x} y1={y} x2={ex} y2={y - spread} />
      <line x1={x} y1={y} x2={ex} y2={y + spread} />
      <line x1={x} y1={y} x2={ex} y2={y} />
    </g>
  );
}

/** One-bar marker drawn inward from (x,y) */
function OneBar({ x, y, dir }: { x: number; y: number; dir: 1 | -1 }) {
  const barX = x + dir * 10;
  return (
    <g stroke="#818cf8" strokeWidth="1.5" fill="none">
      <line x1={barX} y1={y - 6} x2={barX} y2={y + 6} />
    </g>
  );
}

interface Props {
  schema: Schema;
  onPositionChange: (tableId: string, pos: { x: number; y: number }) => void;
}

export default function ERDDiagram({ schema, onPositionChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);

  // Dragging a table
  const tableDrag = useRef<{
    tableId: string; startCX: number; startCY: number; origX: number; origY: number;
  } | null>(null);
  // Panning the canvas
  const panDrag = useRef<{ startCX: number; startCY: number; origPan: { x: number; y: number } } | null>(null);

  // -------------------------------------------------------------------------
  // Auto-fit: when schema changes, fit the bounding box of tables into the view
  // -------------------------------------------------------------------------
  const hasTables = schema.tables.length > 0;

  useEffect(() => {
    if (!containerRef.current || !hasTables) {
      setPan({ x: 0, y: 0 });
      setZoom(1);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const vw = rect.width;
    const vh = rect.height;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of schema.tables) {
      const th = tableHeight(t);
      minX = Math.min(minX, t.position.x);
      minY = Math.min(minY, t.position.y);
      maxX = Math.max(maxX, t.position.x + TW);
      maxY = Math.max(maxY, t.position.y + th);
    }

    const bw = maxX - minX + PAD * 2;
    const bh = maxY - minY + PAD * 2;
    const newZoom = Math.min(1.2, Math.max(0.3, Math.min(vw / bw, vh / bh)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    setPan({ x: vw / 2 - cx * newZoom, y: vh / 2 - cy * newZoom });
    setZoom(newZoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTables, schema.tables.length]);

  // -------------------------------------------------------------------------
  // Mouse handlers
  // -------------------------------------------------------------------------
  const worldPos = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  const handleTableMouseDown = useCallback((e: React.MouseEvent, tableId: string, table: Table) => {
    e.preventDefault();
    e.stopPropagation();
    tableDrag.current = {
      tableId,
      startCX: e.clientX,
      startCY: e.clientY,
      origX: table.position.x,
      origY: table.position.y,
    };
  }, []);

  const handleBgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    panDrag.current = { startCX: e.clientX, startCY: e.clientY, origPan: { ...pan } };
  }, [pan]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (tableDrag.current) {
        const { tableId, startCX, startCY, origX, origY } = tableDrag.current;
        const dx = (e.clientX - startCX) / zoom;
        const dy = (e.clientY - startCY) / zoom;
        onPositionChange(tableId, { x: Math.max(0, origX + dx), y: Math.max(0, origY + dy) });
      } else if (panDrag.current) {
        const { startCX, startCY, origPan } = panDrag.current;
        setPan({ x: origPan.x + e.clientX - startCX, y: origPan.y + e.clientY - startCY });
      }
    }
    function onUp() {
      tableDrag.current = null;
      panDrag.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [zoom, onPositionChange]);

  // Ctrl+Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.max(0.2, Math.min(2.5, zoom * (1 + delta)));
    // Zoom toward cursor
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setPan((p) => ({
      x: cx - (cx - p.x) * (newZoom / zoom),
      y: cy - (cy - p.y) * (newZoom / zoom),
    }));
    setZoom(newZoom);
  }, [zoom]);

  const handleFit = useCallback(() => {
    if (!containerRef.current || !hasTables) return;
    const rect = containerRef.current.getBoundingClientRect();
    const vw = rect.width, vh = rect.height;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of schema.tables) {
      const th = tableHeight(t);
      minX = Math.min(minX, t.position.x);
      minY = Math.min(minY, t.position.y);
      maxX = Math.max(maxX, t.position.x + TW);
      maxY = Math.max(maxY, t.position.y + th);
    }
    const bw = maxX - minX + PAD * 2;
    const bh = maxY - minY + PAD * 2;
    const newZoom = Math.min(1.2, Math.max(0.2, Math.min(vw / bw, vh / bh)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setPan({ x: vw / 2 - cx * newZoom, y: vh / 2 - cy * newZoom });
    setZoom(newZoom);
  }, [schema.tables, hasTables]);

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------
  const relationships = useMemo(() => extractRelationships(schema), [schema]);
  const tableById = useMemo(() => new Map(schema.tables.map((t) => [t.id, t])), [schema]);

  // Hovered relationships for highlight
  const highlightedRels = useMemo(() => {
    if (!hoveredTableId) return new Set<number>();
    return new Set(
      relationships
        .map((r, i) => (r.fromTableId === hoveredTableId || r.toTableId === hoveredTableId ? i : -1))
        .filter((i) => i >= 0)
    );
  }, [hoveredTableId, relationships]);

  // -------------------------------------------------------------------------
  // Canvas size (world space — large enough for all tables with margin)
  // -------------------------------------------------------------------------
  const canvasW = Math.max(2000, ...schema.tables.map((t) => t.position.x + TW + PAD * 4));
  const canvasH = Math.max(1400, ...schema.tables.map((t) => t.position.y + tableHeight(t) + PAD * 4));

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#f8fafc] select-none"
      onMouseDown={handleBgMouseDown}
      onWheel={handleWheel}
      style={{ cursor: panDrag.current ? "grabbing" : "default" }}
    >
      {/* Transformed world */}
      <div
        style={{
          position: "absolute",
          left: 0, top: 0,
          width: canvasW, height: canvasH,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <svg
          width={canvasW}
          height={canvasH}
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            <pattern id="erd-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="0.5" cy="0.5" r="0.5" fill="#cbd5e1" />
            </pattern>
          </defs>
          <rect width={canvasW} height={canvasH} fill="url(#erd-grid)" />

          {/* Relationship lines */}
          {relationships.map((rel, i) => {
            const fromTable = tableById.get(rel.fromTableId);
            const toTable = tableById.get(rel.toTableId);
            if (!fromTable || !toTable) return null;

            const isHighlighted = highlightedRels.has(i);
            const color = isHighlighted ? "#6366f1" : "#a5b4fc";
            const strokeW = isHighlighted ? 2 : 1.5;

            // Row-level attachment
            const fy = rowCenterY(fromTable, rel.fromColIndex);
            const ty = rowCenterY(toTable, rel.toColIndex);

            // Decide left or right exit based on horizontal positions
            const fromRight = fromTable.position.x + TW / 2 < toTable.position.x + TW / 2;
            const fx = fromRight ? fromTable.position.x + TW : fromTable.position.x;
            const tx = fromRight ? toTable.position.x : toTable.position.x + TW;
            const fromDir: 1 | -1 = fromRight ? 1 : -1;
            const toDir: 1 | -1 = fromRight ? -1 : 1;

            const path = orthogonalPath(fx, fy, tx, ty);

            return (
              <g key={i}>
                {/* Click/hover hit area */}
                <path d={path} fill="none" stroke="transparent" strokeWidth="10" />
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeW}
                  strokeLinejoin="round"
                />
                {/* Many (crow-foot) at FK end */}
                <CrowFootMany x={fx} y={fy} dir={fromDir} />
                {/* One (bar) at PK end */}
                <OneBar x={tx} y={ty} dir={toDir} />
              </g>
            );
          })}

          {/* Tables */}
          {schema.tables.map((table) => {
            const h = tableHeight(table);
            const isHovered = hoveredTableId === table.id;
            const isRelated =
              hoveredTableId !== null &&
              hoveredTableId !== table.id &&
              relationships.some(
                (r) =>
                  (r.fromTableId === hoveredTableId && r.toTableId === table.id) ||
                  (r.toTableId === hoveredTableId && r.fromTableId === table.id)
              );

            const borderColor = isHovered ? "#6366f1" : isRelated ? "#a5b4fc" : "#e2e8f0";
            const shadowBlur = isHovered ? "drop-shadow(0 4px 12px rgba(99,102,241,0.25))" : "drop-shadow(0 2px 6px rgba(0,0,0,0.08))";

            return (
              <g
                key={table.id}
                transform={`translate(${table.position.x}, ${table.position.y})`}
                style={{ cursor: "grab", filter: shadowBlur }}
                onMouseDown={(e) => handleTableMouseDown(e, table.id, table)}
                onMouseEnter={() => setHoveredTableId(table.id)}
                onMouseLeave={() => setHoveredTableId(null)}
              >
                {/* Card body */}
                <rect width={TW} height={h} rx="8" fill="white" stroke={borderColor} strokeWidth={isHovered ? 2 : 1} />

                {/* Header */}
                <rect width={TW} height={HDR_H} rx="8" fill={isHovered ? "#4338ca" : "#4f46e5"} />
                <rect y={HDR_H - 8} width={TW} height={8} fill={isHovered ? "#4338ca" : "#4f46e5"} />

                <text
                  x={TW / 2}
                  y={HDR_H / 2 + 5}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="600"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fill="white"
                  style={{ userSelect: "none" }}
                >
                  {table.name || "(unnamed)"}
                </text>

                {/* Column rows */}
                {table.columns.map((col, idx) => {
                  const cy = HDR_H + idx * ROW_H;
                  const isPK = col.primaryKey;
                  const isFK = !!col.foreignKey;
                  const rowFill = idx % 2 === 0 ? "#f8fafc" : "white";

                  return (
                    <g key={col.id}>
                      <rect x={0} y={cy} width={TW} height={ROW_H} fill={rowFill} />

                      {/* PK badge */}
                      {isPK && (
                        <g>
                          <rect x={6} y={cy + 4} width={18} height={13} rx="3" fill="#fef3c7" />
                          <text x={15} y={cy + 14} textAnchor="middle" fontSize="8" fontWeight="700"
                            fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#b45309"
                            style={{ userSelect: "none" }}>PK</text>
                        </g>
                      )}

                      {/* FK badge */}
                      {isFK && !isPK && (
                        <g>
                          <rect x={6} y={cy + 4} width={16} height={13} rx="3" fill="#e0e7ff" />
                          <text x={14} y={cy + 14} textAnchor="middle" fontSize="8" fontWeight="700"
                            fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#4338ca"
                            style={{ userSelect: "none" }}>FK</text>
                        </g>
                      )}

                      <text
                        x={isPK || isFK ? 28 : 10}
                        y={cy + ROW_H / 2 + 4}
                        fontSize="11"
                        fontFamily="ui-sans-serif, system-ui, sans-serif"
                        fill={isPK ? "#1e1b4b" : "#374151"}
                        fontWeight={isPK ? "600" : "400"}
                        style={{ userSelect: "none" }}
                      >
                        {col.name || "(col)"}
                      </text>

                      <text
                        x={TW - 6}
                        y={cy + ROW_H / 2 + 4}
                        textAnchor="end"
                        fontSize="9"
                        fontFamily="ui-monospace, monospace"
                        fill="#9ca3af"
                        style={{ userSelect: "none" }}
                      >
                        {col.type}{col.length ? `(${col.length})` : ""}
                      </text>
                    </g>
                  );
                })}

                {table.columns.length === 0 && (
                  <text
                    x={TW / 2} y={HDR_H + 14}
                    textAnchor="middle" fontSize="11"
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                    fill="#cbd5e1"
                    style={{ userSelect: "none" }}
                  >
                    no columns
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Empty state overlay */}
      {schema.tables.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 mb-3 text-slate-300">
            <rect x="4" y="12" width="40" height="28" rx="4"/>
            <path d="M4 20h40M16 20v20"/>
          </svg>
          <p className="text-sm font-medium text-slate-400">Diagram is empty</p>
          <p className="text-xs mt-1">Add tables in the Schema editor panel</p>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white border border-slate-200 rounded-lg shadow-sm p-0.5">
        <button
          onClick={() => setZoom((z) => Math.min(2.5, z * 1.2))}
          aria-label="Zoom in"
          className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-md transition-colors text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="7" cy="7" r="5"/><path d="M11 11l3 3M7 5v4M5 7h4" strokeLinecap="round"/>
          </svg>
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.2, z / 1.2))}
          aria-label="Zoom out"
          className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-md transition-colors text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="7" cy="7" r="5"/><path d="M11 11l3 3M5 7h4" strokeLinecap="round"/>
          </svg>
        </button>
        <div className="w-px h-5 bg-slate-200" />
        <button
          onClick={handleFit}
          aria-label="Fit diagram to view"
          className="px-2 h-8 flex items-center justify-center text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
        >
          Fit
        </button>
      </div>

      {/* Zoom percentage */}
      <div className="absolute bottom-4 left-4 text-[11px] text-slate-400 tabular-nums pointer-events-none bg-white/70 px-1.5 py-0.5 rounded">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
