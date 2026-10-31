"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { Schema, Table } from "@/lib/types";

const TABLE_WIDTH = 200;
const ROW_HEIGHT = 24;
const HEADER_HEIGHT = 32;

function tableHeight(table: Table): number {
  return HEADER_HEIGHT + Math.max(table.columns.length, 1) * ROW_HEIGHT + 4;
}

function tableCenter(table: Table): { x: number; y: number } {
  return {
    x: table.position.x + TABLE_WIDTH / 2,
    y: table.position.y + tableHeight(table) / 2,
  };
}

/** Compute the intersection of a line from center to outside the table rect. */
function rectEdgePoint(
  cx: number, cy: number, tw: number, th: number, tx: number, ty: number,
  toX: number, toY: number
): { x: number; y: number } {
  const dx = toX - cx;
  const dy = toY - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const hw = tw / 2;
  const hh = th / 2;

  const tRight = hw / Math.abs(dx);
  const tTop = hh / Math.abs(dy);
  const t = Math.min(tRight, tTop);

  return { x: cx + dx * t, y: cy + dy * t };
}

type CrowFootType = "one" | "many" | "zero-one" | "zero-many";

function CrowFoot({
  x, y, angle, type,
}: {
  x: number; y: number; angle: number; type: CrowFootType;
}) {
  const len = 14;
  const spread = 7;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Base point (end of line, where symbol is drawn)
  const bx = x;
  const by = y;

  // Back point (further along line)
  const ex = bx + cos * len;
  const ey = by + sin * len;

  // Perpendicular
  const px = -sin * spread;
  const py = cos * spread;

  const lines: React.ReactNode[] = [];

  if (type === "many" || type === "zero-many") {
    // Crow foot: two lines from end going back-and-perpendicular
    lines.push(
      <line key="cf1" x1={bx} y1={by} x2={ex + px} y2={ey + py} stroke="currentColor" strokeWidth="1.5" />,
      <line key="cf2" x1={bx} y1={by} x2={ex - px} y2={ey - py} stroke="currentColor" strokeWidth="1.5" />,
      <line key="cf3" x1={bx} y1={by} x2={ex} y2={ey} stroke="currentColor" strokeWidth="1.5" />
    );
  }

  if (type === "one" || type === "zero-one") {
    // Single vertical bar
    const mx = bx + cos * (len * 0.4);
    const my = by + sin * (len * 0.4);
    lines.push(
      <line key="bar" x1={mx + px * 0.6} y1={my + py * 0.6} x2={mx - px * 0.6} y2={my - py * 0.6}
        stroke="currentColor" strokeWidth="1.5" />
    );
  }

  if (type === "zero-one" || type === "zero-many") {
    // Circle for optional
    const cx2 = ex + cos * 6;
    const cy2 = ey + sin * 6;
    lines.push(
      <circle key="zero" cx={cx2} cy={cy2} r={4} fill="white" stroke="currentColor" strokeWidth="1.5" />
    );
  }

  return <g className="text-indigo-500">{lines}</g>;
}

interface Relationship {
  fromTableId: string;
  toTableId: string;
  fromColName: string;
  toColName: string;
}

function extractRelationships(schema: Schema): Relationship[] {
  const rels: Relationship[] = [];
  for (const table of schema.tables) {
    for (const col of table.columns) {
      if (col.foreignKey) {
        rels.push({
          fromTableId: table.id,
          toTableId: col.foreignKey.tableId,
          fromColName: col.name,
          toColName: col.foreignKey.columnName,
        });
      }
    }
  }
  return rels;
}

interface Props {
  schema: Schema;
  onPositionChange: (tableId: string, pos: { x: number; y: number }) => void;
}

export default function ERDDiagram({ schema, onPositionChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<{ tableId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, tableId: string, table: Table) => {
    e.preventDefault();
    dragging.current = {
      tableId,
      startX: e.clientX,
      startY: e.clientY,
      origX: table.position.x,
      origY: table.position.y,
    };
  }, []);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const { tableId, startX, startY, origX, origY } = dragging.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      onPositionChange(tableId, { x: Math.max(0, origX + dx), y: Math.max(0, origY + dy) });
    }
    function onMouseUp() {
      dragging.current = null;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onPositionChange]);

  const relationships = extractRelationships(schema);
  const tableById = new Map(schema.tables.map((t) => [t.id, t]));

  // Compute SVG canvas size
  const maxX = Math.max(600, ...schema.tables.map((t) => t.position.x + TABLE_WIDTH + 60));
  const maxY = Math.max(400, ...schema.tables.map((t) => t.position.y + tableHeight(t) + 60));

  return (
    <div className="w-full h-full overflow-auto bg-slate-50">
      <svg
        ref={svgRef}
        width={maxX}
        height={maxY}
        className="block"
        style={{ minWidth: "100%", minHeight: "100%" }}
      >
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Relationship lines */}
        {relationships.map((rel, i) => {
          const fromTable = tableById.get(rel.fromTableId);
          const toTable = tableById.get(rel.toTableId);
          if (!fromTable || !toTable) return null;

          const fc = tableCenter(fromTable);
          const tc = tableCenter(toTable);
          const fh = tableHeight(fromTable);
          const th = tableHeight(toTable);

          const fromPt = rectEdgePoint(fc.x, fc.y, TABLE_WIDTH, fh, fromTable.position.x, fromTable.position.y, tc.x, tc.y);
          const toPt = rectEdgePoint(tc.x, tc.y, TABLE_WIDTH, th, toTable.position.x, toTable.position.y, fc.x, fc.y);

          const dx = toPt.x - fromPt.x;
          const dy = toPt.y - fromPt.y;
          const fromAngle = (Math.atan2(fromPt.y - fc.y, fromPt.x - fc.x) * 180) / Math.PI;
          const toAngle = (Math.atan2(toPt.y - tc.y, toPt.x - tc.x) * 180) / Math.PI;

          // Curve path
          const midX = (fromPt.x + toPt.x) / 2;
          const midY = (fromPt.y + toPt.y) / 2;
          const path = `M ${fromPt.x} ${fromPt.y} Q ${midX} ${midY} ${toPt.x} ${toPt.y}`;

          return (
            <g key={i} className="text-indigo-400">
              <path d={path} fill="none" stroke="#818cf8" strokeWidth="1.5" strokeDasharray="4 2" />
              {/* Many side on the FK (from) end */}
              <CrowFoot x={fromPt.x} y={fromPt.y} angle={fromAngle} type="many" />
              {/* One side on the PK (to) end */}
              <CrowFoot x={toPt.x} y={toPt.y} angle={toAngle} type="one" />
              {/* Label */}
              <text
                x={midX}
                y={midY - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#6366f1"
                className="pointer-events-none select-none"
              >
                {rel.fromColName} → {rel.toColName}
              </text>
            </g>
          );
        })}

        {/* Tables */}
        {schema.tables.map((table) => {
          const h = tableHeight(table);
          const pkCols = table.columns.filter((c) => c.primaryKey);

          return (
            <g
              key={table.id}
              transform={`translate(${table.position.x}, ${table.position.y})`}
              style={{ cursor: "grab" }}
              onMouseDown={(e) => handleMouseDown(e, table.id, table)}
            >
              {/* Shadow */}
              <rect x="3" y="3" width={TABLE_WIDTH} height={h} rx="6" fill="rgba(0,0,0,0.06)" />
              {/* Body */}
              <rect width={TABLE_WIDTH} height={h} rx="6" fill="white" stroke="#c7d2fe" strokeWidth="1.5" />
              {/* Header */}
              <rect width={TABLE_WIDTH} height={HEADER_HEIGHT} rx="6" fill="#4f46e5" />
              <rect y={HEADER_HEIGHT - 6} width={TABLE_WIDTH} height={6} fill="#4f46e5" />
              <text
                x={TABLE_WIDTH / 2}
                y={HEADER_HEIGHT / 2 + 5}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="white"
                className="select-none"
              >
                {table.name || "(unnamed)"}
              </text>

              {/* Columns */}
              {table.columns.map((col, idx) => {
                const cy = HEADER_HEIGHT + idx * ROW_HEIGHT;
                const isPK = col.primaryKey;
                const isFK = !!col.foreignKey;
                return (
                  <g key={col.id}>
                    <rect
                      x={0} y={cy} width={TABLE_WIDTH} height={ROW_HEIGHT}
                      fill={idx % 2 === 0 ? "#f8fafc" : "white"}
                      stroke="none"
                    />
                    {isPK && (
                      <text x={8} y={cy + 15} fontSize="10" fill="#f59e0b">🔑</text>
                    )}
                    {isFK && !isPK && (
                      <text x={8} y={cy + 15} fontSize="10" fill="#818cf8">⇒</text>
                    )}
                    <text
                      x={isPK || isFK ? 22 : 10}
                      y={cy + 15}
                      fontSize="11"
                      fill={isPK ? "#1e1b4b" : "#374151"}
                      fontWeight={isPK ? "600" : "400"}
                      className="select-none"
                    >
                      {col.name || "(col)"}
                    </text>
                    <text
                      x={TABLE_WIDTH - 6}
                      y={cy + 15}
                      textAnchor="end"
                      fontSize="9"
                      fill="#9ca3af"
                      className="select-none"
                    >
                      {col.type}{col.length ? `(${col.length})` : ""}
                    </text>
                  </g>
                );
              })}

              {table.columns.length === 0 && (
                <text x={TABLE_WIDTH / 2} y={HEADER_HEIGHT + 16} textAnchor="middle" fontSize="11" fill="#cbd5e1" className="select-none">
                  no columns
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
