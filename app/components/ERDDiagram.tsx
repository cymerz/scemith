"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import type { Schema, Table } from "@/lib/types";

// ---------------------------------------------------------------------------
// Table geometry (must match the SVG rendering below)
// ---------------------------------------------------------------------------
const TW = 240;   // table width
const ROW_H = 22; // row height
const HDR_H = 34; // header height
const PAD = 56;   // padding around all tables when fitting

function tableHeight(t: Table): number {
  return HDR_H + Math.max(t.columns.length, 1) * ROW_H + 2;
}

/** Y of the vertical centre of column row `colIndex` in world space */
function rowY(t: Table, colIndex: number): number {
  return t.position.y + HDR_H + colIndex * ROW_H + ROW_H / 2;
}

// ---------------------------------------------------------------------------
// Auto-layout: topological layering + equal column spacing
// ---------------------------------------------------------------------------
function autoLayout(tables: Table[]): Table[] {
  if (tables.length === 0) return tables;

  // Build FK graph: table id -> set of ids it references
  const refs = new Map<string, Set<string>>();
  for (const t of tables) {
    const s = new Set<string>();
    for (const c of t.columns) {
      if (c.foreignKey && c.foreignKey.tableId !== t.id) s.add(c.foreignKey.tableId);
    }
    refs.set(t.id, s);
  }

  // Kahn's algorithm for layers (column = layer)
  const inDegree = new Map<string, number>();
  for (const t of tables) inDegree.set(t.id, 0);
  for (const [, deps] of refs) {
    for (const dep of deps) {
      inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
    }
  }

  const layers: string[][] = [];
  let frontier = tables.filter((t) => inDegree.get(t.id) === 0).map((t) => t.id);
  const visited = new Set<string>();

  while (frontier.length > 0) {
    layers.push(frontier);
    for (const id of frontier) visited.add(id);
    const next: string[] = [];
    for (const id of frontier) {
      // tables that reference `id` (id is a parent; "child" tables reference it)
      for (const t of tables) {
        if (visited.has(t.id)) continue;
        if (refs.get(t.id)?.has(id)) {
          inDegree.set(t.id, (inDegree.get(t.id) ?? 1) - 1);
          if (inDegree.get(t.id) === 0) next.push(t.id);
        }
      }
    }
    // deduplicate next
    frontier = [...new Set(next)];
  }

  // Any remaining (cycles) go in a last layer
  const remaining = tables.filter((t) => !visited.has(t.id)).map((t) => t.id);
  if (remaining.length > 0) layers.push(remaining);

  const COL_GAP = 120;
  const ROW_GAP = 48;
  const tableById = new Map(tables.map((t) => [t.id, t]));

  // Compute column heights
  const colHeights = layers.map((layer) =>
    layer.reduce((h, id) => h + tableHeight(tableById.get(id)!), 0) +
    Math.max(0, layer.length - 1) * ROW_GAP
  );
  const maxColHeight = Math.max(...colHeights);

  let xCursor = 0;
  const positioned: Table[] = [];

  for (let col = 0; col < layers.length; col++) {
    const layer = layers[col];
    const colH = colHeights[col];
    const yStart = (maxColHeight - colH) / 2; // vertically center each column
    let yCursor = yStart;
    for (const id of layer) {
      const t = tableById.get(id)!;
      positioned.push({ ...t, position: { x: xCursor, y: yCursor } });
      yCursor += tableHeight(t) + ROW_GAP;
    }
    const maxTW = TW; // all same width
    xCursor += maxTW + COL_GAP;
  }

  return positioned;
}

// ---------------------------------------------------------------------------
// Relationship extraction
// ---------------------------------------------------------------------------
interface Rel {
  fromTableId: string;
  toTableId: string;
  fromColIdx: number;
  toColIdx: number;
}

function extractRels(schema: Schema): Rel[] {
  const out: Rel[] = [];
  for (const t of schema.tables) {
    t.columns.forEach((col, fi) => {
      if (!col.foreignKey) return;
      const toTable = schema.tables.find((x) => x.id === col.foreignKey!.tableId);
      if (!toTable) return;
      const ti = toTable.columns.findIndex(
        (c) => c.name.toLowerCase() === col.foreignKey!.columnName.toLowerCase()
      );
      out.push({
        fromTableId: t.id,
        toTableId: toTable.id,
        fromColIdx: fi,
        toColIdx: Math.max(ti, 0),
      });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Connector path: orthogonal stub→curve→stub
// Exits left or right based on which table center is further left.
// stub: 16px horizontal segment before any turn.
// ---------------------------------------------------------------------------
const STUB = 16;

function connectorPath(
  fx: number, fy: number, // exit point (edge of from-table)
  tx: number, ty: number, // entry point (edge of to-table)
  fromExitsRight: boolean
): string {
  // After the stub, we do a smooth S-curve to the entry stub
  const sx1 = fx + (fromExitsRight ? STUB : -STUB);
  const sx2 = tx + (fromExitsRight ? -STUB : STUB);
  const midX = (sx1 + sx2) / 2;
  return [
    `M ${fx} ${fy}`,
    `H ${sx1}`,
    `C ${midX} ${fy} ${midX} ${ty} ${sx2} ${ty}`,
    `H ${tx}`,
  ].join(" ");
}

// ---------------------------------------------------------------------------
// Markers — always draw inward from the edge point
//
// CrowFoot (many): prongs open OUTWARD from the table edge — i.e. in the
//   same direction as the line leaving the table.
//   exitDir = +1 means line exits to the right, so prongs fan rightward.
//
// OneBar: a perpendicular bar drawn just inside the table edge.
// ---------------------------------------------------------------------------

function CrowFoot({
  x,
  y,
  exitDir,
  color,
}: {
  x: number;
  y: number;
  exitDir: 1 | -1;
  color: string;
}) {
  const spread = 6;
  const len = 12;
  // The prong tips are STUB pixels inside the table (inward), so toward -exitDir
  const tipX = x + exitDir * STUB;

  return (
    <g stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round">
      {/* centre prong */}
      <line x1={x} y1={y} x2={tipX} y2={y} />
      {/* upper prong */}
      <line x1={x} y1={y} x2={tipX} y2={y - spread} />
      {/* lower prong */}
      <line x1={x} y1={y} x2={tipX} y2={y + spread} />
    </g>
  );
}

function OneBar({
  x,
  y,
  exitDir,
  color,
}: {
  x: number;
  y: number;
  exitDir: 1 | -1;
  color: string;
}) {
  // Bar is STUB/2 pixels inside the table
  const barX = x + exitDir * (STUB / 2);
  return (
    <g stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round">
      <line x1={barX} y1={y - 7} x2={barX} y2={y + 7} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Fit logic
// ---------------------------------------------------------------------------
function computeFit(
  tables: Table[],
  vw: number,
  vh: number
): { zoom: number; pan: { x: number; y: number } } {
  if (tables.length === 0) return { zoom: 1, pan: { x: 0, y: 0 } };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of tables) {
    const th = tableHeight(t);
    minX = Math.min(minX, t.position.x);
    minY = Math.min(minY, t.position.y);
    maxX = Math.max(maxX, t.position.x + TW);
    maxY = Math.max(maxY, t.position.y + th);
  }

  const bw = maxX - minX;
  const bh = maxY - minY;
  const availW = vw - PAD * 2;
  const availH = vh - PAD * 2;

  const newZoom = Math.max(0.3, Math.min(1.0, availW / bw, availH / bh));

  // Center of bounding box → center of viewport
  const bcx = (minX + maxX) / 2;
  const bcy = (minY + maxY) / 2;
  const pan = {
    x: vw / 2 - bcx * newZoom,
    y: vh / 2 - bcy * newZoom,
  };

  return { zoom: newZoom, pan };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  schema: Schema;
  onPositionChange: (tableId: string, pos: { x: number; y: number }) => void;
  /** Increment to trigger an auto-fit (e.g. after loading an example or decomposing) */
  fitKey?: number;
}

export default function ERDDiagram({ schema, onPositionChange, fitKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);

  // Canvas viewport size tracked by ResizeObserver
  const [vpSize, setVpSize] = useState({ w: 0, h: 0 });

  // Tracks whether the user has manually interacted (zoom/pan) — suppresses auto-fit
  const userInteracted = useRef(false);

  // Dragging
  const tableDrag = useRef<{
    tableId: string;
    startCX: number; startCY: number;
    origX: number; origY: number;
  } | null>(null);
  const panDrag = useRef<{
    startCX: number; startCY: number;
    origPan: { x: number; y: number };
  } | null>(null);

  // -----------------------------------------------------------------------
  // Viewport size tracking
  // -----------------------------------------------------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setVpSize({ w: width, h: height });
      }
    });
    ro.observe(el);
    // Initial read
    const rect = el.getBoundingClientRect();
    setVpSize({ w: rect.width, h: rect.height });
    return () => ro.disconnect();
  }, []);

  // -----------------------------------------------------------------------
  // Auto-fit: triggered by fitKey prop change, or first time viewport is ready
  // -----------------------------------------------------------------------
  const doFit = useCallback(
    (tables: Table[], vw: number, vh: number) => {
      if (!tables.length || !vw || !vh) return;
      const { zoom: z, pan: p } = computeFit(tables, vw, vh);
      setZoom(z);
      setPan(p);
    },
    []
  );

  // On first viewport measurement (first render with actual size)
  const didInitialFit = useRef(false);
  useEffect(() => {
    if (!didInitialFit.current && vpSize.w > 0 && schema.tables.length > 0) {
      didInitialFit.current = true;
      userInteracted.current = false;
      doFit(schema.tables, vpSize.w, vpSize.h);
    }
  }, [vpSize, schema.tables, doFit]);

  // Respond to fitKey changes (example load, decomposition, undo)
  const prevFitKey = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (fitKey === undefined) return;
    if (fitKey !== prevFitKey.current) {
      prevFitKey.current = fitKey;
      userInteracted.current = false;
      if (vpSize.w > 0 && schema.tables.length > 0) {
        doFit(schema.tables, vpSize.w, vpSize.h);
      }
    }
  }, [fitKey, schema.tables, vpSize, doFit]);

  // Respond to viewport resize — only re-fit if user hasn't manually panned/zoomed
  const prevVpSize = useRef({ w: 0, h: 0 });
  useEffect(() => {
    if (vpSize.w === 0 || vpSize.h === 0) return;
    if (vpSize.w === prevVpSize.current.w && vpSize.h === prevVpSize.current.h) return;
    prevVpSize.current = vpSize;
    if (!userInteracted.current && schema.tables.length > 0) {
      doFit(schema.tables, vpSize.w, vpSize.h);
    }
  }, [vpSize, schema.tables, doFit]);

  // -----------------------------------------------------------------------
  // Manual Fit button
  // -----------------------------------------------------------------------
  const handleFit = useCallback(() => {
    userInteracted.current = false;
    doFit(schema.tables, vpSize.w, vpSize.h);
  }, [schema.tables, vpSize, doFit]);

  // -----------------------------------------------------------------------
  // Mouse: table drag
  // -----------------------------------------------------------------------
  const handleTableMouseDown = useCallback(
    (e: React.MouseEvent, tableId: string, table: Table) => {
      e.preventDefault();
      e.stopPropagation();
      userInteracted.current = true;
      tableDrag.current = {
        tableId,
        startCX: e.clientX,
        startCY: e.clientY,
        origX: table.position.x,
        origY: table.position.y,
      };
    },
    []
  );

  // -----------------------------------------------------------------------
  // Mouse: background pan
  // -----------------------------------------------------------------------
  const handleBgMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      userInteracted.current = true;
      panDrag.current = {
        startCX: e.clientX,
        startCY: e.clientY,
        origPan: { ...pan },
      };
    },
    [pan]
  );

  // -----------------------------------------------------------------------
  // Global mouse move / up
  // -----------------------------------------------------------------------
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (tableDrag.current) {
        const { tableId, startCX, startCY, origX, origY } = tableDrag.current;
        const dx = (e.clientX - startCX) / zoom;
        const dy = (e.clientY - startCY) / zoom;
        // No clamping — tables can go anywhere in world space
        onPositionChange(tableId, { x: origX + dx, y: origY + dy });
        return;
      }
      if (panDrag.current) {
        const { startCX, startCY, origPan } = panDrag.current;
        setPan({
          x: origPan.x + e.clientX - startCX,
          y: origPan.y + e.clientY - startCY,
        });
      }
    };
    const onUp = () => {
      tableDrag.current = null;
      panDrag.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [zoom, onPositionChange]);

  // -----------------------------------------------------------------------
  // Wheel: Ctrl → zoom toward cursor, plain → vertical pan
  // -----------------------------------------------------------------------
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        userInteracted.current = true;
        const factor = 1 - e.deltaY * 0.0008;
        setZoom((z) => {
          const newZ = Math.max(0.3, Math.min(2.0, z * factor));
          if (!containerRef.current) return newZ;
          const rect = containerRef.current.getBoundingClientRect();
          const cx = e.clientX - rect.left;
          const cy = e.clientY - rect.top;
          setPan((p) => ({
            x: cx - (cx - p.x) * (newZ / z),
            y: cy - (cy - p.y) * (newZ / z),
          }));
          return newZ;
        });
      } else {
        // Plain wheel: pan vertically (and horizontally with shift)
        userInteracted.current = true;
        setPan((p) => ({
          x: p.x - (e.shiftKey ? e.deltaY : e.deltaX),
          y: p.y - (e.shiftKey ? 0 : e.deltaY),
        }));
      }
    },
    []
  );

  // -----------------------------------------------------------------------
  // +/- zoom buttons (zoom around canvas center)
  // -----------------------------------------------------------------------
  const zoomAround = useCallback(
    (factor: number) => {
      userInteracted.current = true;
      const cx = vpSize.w / 2;
      const cy = vpSize.h / 2;
      setZoom((z) => {
        const newZ = Math.max(0.3, Math.min(2.0, z * factor));
        setPan((p) => ({
          x: cx - (cx - p.x) * (newZ / z),
          y: cy - (cy - p.y) * (newZ / z),
        }));
        return newZ;
      });
    },
    [vpSize]
  );

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------
  const rels = useMemo(() => extractRels(schema), [schema]);
  const tableById = useMemo(() => new Map(schema.tables.map((t) => [t.id, t])), [schema.tables]);

  const highlightedRelIdxs = useMemo(() => {
    if (!hoveredTableId) return new Set<number>();
    return new Set(
      rels
        .map((r, i) =>
          r.fromTableId === hoveredTableId || r.toTableId === hoveredTableId ? i : -1
        )
        .filter((i) => i >= 0)
    );
  }, [hoveredTableId, rels]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#f8fafc] select-none"
      onMouseDown={handleBgMouseDown}
      onWheel={handleWheel}
      style={{ cursor: panDrag.current ? "grabbing" : "default" }}
    >
      {/*
        World layer: position absolute, zero intrinsic size, overflow visible.
        The transform positions and scales the world — no fixed large div width.
      */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          overflow: "visible",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* Background dot grid — large enough to fill any view */}
        <svg
          style={{
            position: "absolute",
            left: -4000,
            top: -4000,
            width: 8000,
            height: 8000,
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          <defs>
            <pattern id="erd-dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.75" fill="#dde3ed" />
            </pattern>
          </defs>
          <rect x={0} y={0} width={8000} height={8000} fill="url(#erd-dots)" />
        </svg>

        {/* Main SVG for all content — 1×1 anchor, overflows visually */}
        <svg
          width={1}
          height={1}
          style={{ display: "block", overflow: "visible" }}
        >
          {/* Relationship connectors — drawn UNDER tables */}
          {rels.map((rel, i) => {
            const fromTable = tableById.get(rel.fromTableId);
            const toTable = tableById.get(rel.toTableId);
            if (!fromTable || !toTable) return null;

            const isHighlighted = highlightedRelIdxs.has(i);
            const lineColor = isHighlighted ? "#6366f1" : "#a5b4fc";
            const strokeW = isHighlighted ? 2 : 1.5;

            // Attach at the exact row Y
            const fy = rowY(fromTable, rel.fromColIdx);
            const ty = rowY(toTable, rel.toColIdx);

            // Determine exit/entry sides by comparing table CENTER X positions
            // If from-table center is to the LEFT of to-table center, exit right → enter left
            const fromCenterX = fromTable.position.x + TW / 2;
            const toCenterX = toTable.position.x + TW / 2;
            const fromExitsRight = fromCenterX <= toCenterX;

            // X of the edge point on the from-table
            const fx = fromExitsRight
              ? fromTable.position.x + TW
              : fromTable.position.x;
            // X of the edge point on the to-table
            const tx = fromExitsRight
              ? toTable.position.x
              : toTable.position.x + TW;

            // exitDir: direction the line LEAVES the table (+1 = rightward, -1 = leftward)
            const fromExitDir: 1 | -1 = fromExitsRight ? 1 : -1;
            // entryDir: direction the line ENTERS the to-table (opposite of fromExitDir)
            const toExitDir: 1 | -1 = fromExitsRight ? -1 : 1;

            const path = connectorPath(fx, fy, tx, ty, fromExitsRight);

            return (
              <g key={i}>
                {/* Wide invisible hit area */}
                <path d={path} fill="none" stroke="transparent" strokeWidth="12" />
                <path
                  d={path}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={strokeW}
                  strokeLinejoin="round"
                />
                {/* Crow-foot at FK (child) end */}
                <CrowFoot x={fx} y={fy} exitDir={fromExitDir} color={lineColor} />
                {/* One-bar at PK (parent) end */}
                <OneBar x={tx} y={ty} exitDir={toExitDir} color={lineColor} />
              </g>
            );
          })}

          {/* Tables — drawn on top of connectors */}
          {schema.tables.map((table) => {
            const h = tableHeight(table);
            const isHovered = hoveredTableId === table.id;
            const isRelated =
              hoveredTableId !== null &&
              hoveredTableId !== table.id &&
              rels.some(
                (r) =>
                  (r.fromTableId === hoveredTableId && r.toTableId === table.id) ||
                  (r.toTableId === hoveredTableId && r.fromTableId === table.id)
              );

            const borderColor = isHovered
              ? "#6366f1"
              : isRelated
              ? "#a5b4fc"
              : "#e2e8f0";
            const filter = isHovered
              ? "drop-shadow(0 4px 12px rgba(99,102,241,0.3))"
              : "drop-shadow(0 2px 6px rgba(0,0,0,0.09))";

            return (
              <g
                key={table.id}
                transform={`translate(${table.position.x}, ${table.position.y})`}
                style={{ cursor: "grab", filter }}
                onMouseDown={(e) => handleTableMouseDown(e, table.id, table)}
                onMouseEnter={() => setHoveredTableId(table.id)}
                onMouseLeave={() => setHoveredTableId(null)}
              >
                {/* Card body */}
                <rect
                  width={TW}
                  height={h}
                  rx="8"
                  fill="white"
                  stroke={borderColor}
                  strokeWidth={isHovered ? 2 : 1}
                />

                {/* Header bar */}
                <rect
                  width={TW}
                  height={HDR_H}
                  rx="8"
                  fill={isHovered ? "#4338ca" : "#4f46e5"}
                />
                {/* Square off the bottom corners of the header */}
                <rect
                  y={HDR_H - 8}
                  width={TW}
                  height={8}
                  fill={isHovered ? "#4338ca" : "#4f46e5"}
                />

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

                  return (
                    <g key={col.id}>
                      <rect
                        x={0}
                        y={cy}
                        width={TW}
                        height={ROW_H}
                        fill={idx % 2 === 0 ? "#f8fafc" : "white"}
                      />

                      {/* PK pill */}
                      {isPK && (
                        <g>
                          <rect
                            x={6}
                            y={cy + 4}
                            width={18}
                            height={13}
                            rx="3"
                            fill="#fef3c7"
                          />
                          <text
                            x={15}
                            y={cy + 14}
                            textAnchor="middle"
                            fontSize="8"
                            fontWeight="700"
                            fontFamily="ui-sans-serif, system-ui, sans-serif"
                            fill="#b45309"
                            style={{ userSelect: "none" }}
                          >
                            PK
                          </text>
                        </g>
                      )}

                      {/* FK pill */}
                      {isFK && !isPK && (
                        <g>
                          <rect
                            x={6}
                            y={cy + 4}
                            width={16}
                            height={13}
                            rx="3"
                            fill="#e0e7ff"
                          />
                          <text
                            x={14}
                            y={cy + 14}
                            textAnchor="middle"
                            fontSize="8"
                            fontWeight="700"
                            fontFamily="ui-sans-serif, system-ui, sans-serif"
                            fill="#4338ca"
                            style={{ userSelect: "none" }}
                          >
                            FK
                          </text>
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
                        {col.type}
                        {col.length ? `(${col.length})` : ""}
                      </text>
                    </g>
                  );
                })}

                {table.columns.length === 0 && (
                  <text
                    x={TW / 2}
                    y={HDR_H + 14}
                    textAnchor="middle"
                    fontSize="11"
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

      {/* ------------------------------------------------------------------ */}
      {/* Empty state                                                         */}
      {/* ------------------------------------------------------------------ */}
      {schema.tables.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none">
          <svg
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="w-12 h-12 mb-3 text-slate-300"
          >
            <rect x="4" y="12" width="40" height="28" rx="4" />
            <path d="M4 20h40M16 20v20" />
          </svg>
          <p className="text-sm font-medium text-slate-400">Diagram is empty</p>
          <p className="text-xs mt-1">Add tables in the Schema editor panel</p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Zoom controls                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white border border-slate-200 rounded-lg shadow-sm p-0.5 z-10">
        <button
          onClick={() => zoomAround(1.2)}
          aria-label="Zoom in"
          className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l3 3M7 5v4M5 7h4" strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={() => zoomAround(1 / 1.2)}
          aria-label="Zoom out"
          className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l3 3M5 7h4" strokeLinecap="round" />
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

      {/* Zoom % */}
      <div className="absolute bottom-4 left-4 text-[11px] text-slate-400 tabular-nums pointer-events-none bg-white/80 px-1.5 py-0.5 rounded z-10">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}

// Re-export autoLayout for use by page.tsx when loading examples / decomposing
export { autoLayout };
