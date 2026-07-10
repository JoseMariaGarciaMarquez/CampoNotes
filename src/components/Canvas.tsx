import { useRef, useState, useEffect, useCallback, useMemo, useReducer, useLayoutEffect } from 'react';
import { Stage, Layer, Line, Circle, Text, Group, Rect } from 'react-konva';
import { useStore } from '../store';
import {
  dist, angle, parallelLineData, perpendicularLineData,
  hitTestLine, bearing, projectPointOnLine,
} from '../utils/geometry';
import { tapVerb } from '../utils/platform';

function snapToEndpoint(px: number, py: number, lines: any[], threshold = 12): { x: number; y: number; snap: boolean; lineId?: string } {
  for (const l of lines) {
    const d1 = dist(px, py, l.x1, l.y1);
    if (d1 < threshold) return { x: l.x1, y: l.y1, snap: true, lineId: l.id };
    const d2 = dist(px, py, l.x2, l.y2);
    if (d2 < threshold) return { x: l.x2, y: l.y2, snap: true, lineId: l.id };
  }
  return { x: px, y: py, snap: false };
}

interface SheetConfig {
  sheetPxW: number;
  sheetPxH: number;
  dpi: number;
  offX: number;
  offY: number;
  gridInterval: number;
}

function calcSheet(sw: number, sh: number, vw: number, vh: number): SheetConfig {
  if (sw <= 0 || sh <= 0 || vw <= 0 || vh <= 0) {
    return { sheetPxW: vw, sheetPxH: vh, dpi: 1, offX: 0, offY: 0, gridInterval: 10 };
  }
  const dpi = Math.min(vw / sw, vh / sh) * 0.85;
  const sheetPxW = Math.round(sw * dpi);
  const sheetPxH = Math.round(sh * dpi);
  const offX = Math.max(0, Math.round((vw - sheetPxW) / 2));
  const offY = Math.max(0, Math.round((vh - sheetPxH) / 2));

  let gridInterval = 10;
  const pxPerInterval = dpi * gridInterval;
  if (pxPerInterval < 40) {
    gridInterval = 50;
  } else if (pxPerInterval < 20) {
    gridInterval = 100;
  } else if (pxPerInterval > 120) {
    gridInterval = 5;
  } else if (pxPerInterval > 200) {
    gridInterval = 1;
  }

  return { sheetPxW, sheetPxH, dpi, offX, offY, gridInterval };
}

function SheetDialog({ onConfirm }: { onConfirm: (w: number, h: number) => void }) {
  const [w, setW] = useState('100');
  const [h, setH] = useState('50');
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/80">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-2xl w-72">
        <h2 className="text-base font-bold text-white mb-1">Dimensiones de la hoja</h2>
        <p className="text-xs text-slate-400 mb-4">Tamaño del área de trabajo en metros</p>
        <label className="block text-xs text-slate-300 mb-1">Ancho (m)</label>
        <input value={w} onChange={e => setW(e.target.value)} type="number" min="1" step="1"
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white mb-3" />
        <label className="block text-xs text-slate-300 mb-1">Alto (m)</label>
        <input value={h} onChange={e => setH(e.target.value)} type="number" min="1" step="1"
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white mb-4" />
        <button onClick={() => { const nw = parseFloat(w) || 100; const nh = parseFloat(h) || 50; onConfirm(nw, nh); }}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
          Crear hoja
        </button>
      </div>
    </div>
  );
}

type WorldTransform = { x: number; y: number; scale: number };

export default function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<any>(null);
  const lastDown = useRef<{ x: number; y: number } | null>(null);
  const wasDrag = useRef(false);
  const touchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const panning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panTransformStart = useRef<WorldTransform>({ x: 0, y: 0, scale: 1 });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [preview, setPreview] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [snapPt, setSnapPt] = useState<{ x: number; y: number } | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [freehandPoints, setFreehandPoints] = useState<number[]>([]);
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  const transform = useRef<WorldTransform>({ x: 0, y: 0, scale: 1 });

  const {
    lines, annotations, tool, selectedLineId, referenceLineId, drawingStart,
    addLine, addAnnotation, removeAnnotation, setSelectedLine, setReferenceLine, setDrawingStart,
    updateLine, removeLine, nextLabel,
    projects, currentProjectId, setScale, clearScale, setSheetSize,
  } = useStore();

  const currentProject = projects.find(p => p.id === currentProjectId);
  const sheetW = currentProject?.sheetWidth;
  const sheetH = currentProject?.sheetHeight;
  const sheetIsSet = sheetW != null && sheetH != null;
  const refLine = referenceLineId ? lines.find(l => l.id === referenceLineId) : null;
  const scale = currentProject?.scale;
  const scaleLine = scale ? lines.find(l => l.id === scale.lineId) : null;

  const updateSize = useCallback(() => {
    if (containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    }
  }, []);

  useEffect(() => {
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [updateSize]);

  useEffect(() => {
    if (sheetW == null || sheetH == null) {
      setShowDialog(true);
    } else {
      setShowDialog(false);
    }
  }, [sheetW, sheetH]);

  const sheet = useMemo(() => {
    if (sheetW && sheetH) return calcSheet(sheetW, sheetH, size.w, size.h);
    return calcSheet(100, 50, size.w, size.h);
  }, [sheetW, sheetH, size.w, size.h]);

  // When sheet or size changes, update transform and center the sheet in viewport
  // useLayoutEffect ensures the Group position is set before the browser paints,
  // avoiding a flash of the sheet at the wrong position.
  useLayoutEffect(() => {
    if (sheetW && sheetH && size.w > 0 && size.h > 0) {
      transform.current = {
        x: sheet.offX,
        y: sheet.offY,
        scale: 1,
      };
      syncGroup();
    }
  }, [sheet, sheetW, sheetH, size.w, size.h]);

  function syncGroup() {
    const g = groupRef.current;
    if (!g) return;
    const t = transform.current;
    g.x(t.x);
    g.y(t.y);
    g.scaleX(t.scale);
    g.scaleY(t.scale);
  }

  function getViewportPos(e: any): { x: number; y: number } | null {
    const stage = e.target.getStage();
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    return pos;
  }

  function viewportToWorld(vx: number, vy: number): { x: number; y: number } {
    const t = transform.current;
    return {
      x: (vx - t.x) / t.scale,
      y: (vy - t.y) / t.scale,
    };
  }

  function getWorldPos(e: any): { x: number; y: number } | null {
    const vp = getViewportPos(e);
    if (!vp) return null;
    return viewportToWorld(vp.x, vp.y);
  }

  function hitLineAt(pos: { x: number; y: number }, l: any): boolean {
    return dist(pos.x, pos.y, l.x1, l.y1) < 10 || dist(pos.x, pos.y, l.x2, l.y2) < 10 ||
      hitTestLine(pos.x, pos.y, l.x1, l.y1, l.x2, l.y2);
  }

  function hitAnnotation(pos: { x: number; y: number }, pts: number[], threshold = 15): boolean {
    for (let i = 0; i < pts.length; i += 2) {
      if (dist(pos.x, pos.y, pts[i], pts[i + 1]) < threshold) return true;
    }
    return false;
  }

  const processClick = useCallback((pos: { x: number; y: number }) => {
    if (tool === 'select') {
      const clicked = lines.find(l => hitLineAt(pos, l));
      if (clicked && scaleLine && clicked.id === scaleLine.id && scale) {
        setSelectedLine(clicked.id === selectedLineId ? null : clicked.id);
      } else if (clicked) {
        setSelectedLine(clicked.id === selectedLineId ? null : clicked.id);
      } else {
        setSelectedLine(null);
        // Check if an annotation was clicked
        const ann = annotations.find(a => hitAnnotation(pos, a.points));
        if (ann) removeAnnotation(ann.id);
      }
    } else if (tool === 'parallel' || tool === 'perpendicular') {
      const clicked = lines.find(l => hitTestLine(pos.x, pos.y, l.x1, l.y1, l.x2, l.y2));
      if (clicked) {
        setReferenceLine(clicked.id);
        return;
      }
      if (refLine) {
        const snapped = snapToEndpoint(pos.x, pos.y, lines);
        const p = snapped.snap ? snapped : pos;
        if (tool === 'parallel') {
          const pd = parallelLineData(refLine.x1, refLine.y1, refLine.x2, refLine.y2, p.x, p.y);
          addLine({
            x1: pd.x1, y1: pd.y1, x2: pd.x2, y2: pd.y2,
            notes: `Paralela a ${refLine.label} d=${pd.distance.toFixed(0)}`,
          });
        } else {
          const pd = perpendicularLineData(refLine.x1, refLine.y1, refLine.x2, refLine.y2, p.x, p.y);
          addLine({
            x1: pd.x1, y1: pd.y1, x2: pd.x2, y2: pd.y2,
            notes: `Perpendicular a ${refLine.label}`,
          });
        }
        setReferenceLine(null);
      }
    }
  }, [tool, lines, annotations, refLine, selectedLineId, addLine, removeAnnotation, setReferenceLine, setSelectedLine, scaleLine, scale]);

  function hitAnyShape(wx: number, wy: number): boolean {
    return lines.some(l =>
      dist(wx, wy, l.x1, l.y1) < 12 || dist(wx, wy, l.x2, l.y2) < 12 ||
      hitTestLine(wx, wy, l.x1, l.y1, l.x2, l.y2)
    );
  }

  const handleDown = useCallback((e: any) => {
    const pos = getWorldPos(e);
    if (!pos) return;
    lastDown.current = pos;
    wasDrag.current = false;

    if (tool === 'select' && !hitAnyShape(pos.x, pos.y)) {
      panning.current = true;
      const vp = getViewportPos(e);
      if (vp) {
        panStart.current = vp;
        panTransformStart.current = { ...transform.current };
      }
    }

    if (tool === 'draw') {
      setDrawing(true);
      setDrawingStart(pos);
    }

    if (tool === 'freehand') {
      setDrawing(true);
      setFreehandPoints([pos.x, pos.y]);
    }
  }, [tool, setDrawingStart, lines]);

  const handleMove = useCallback((e: any) => {
    const pos = getWorldPos(e);
    if (!pos) return;

    if (lastDown.current) {
      const d = dist(lastDown.current.x, lastDown.current.y, pos.x, pos.y);
      if (d > 5) wasDrag.current = true;
    }

    if (panning.current && tool === 'select') {
      const vp = getViewportPos(e);
      if (vp) {
        const pt = panTransformStart.current;
        const dx = vp.x - panStart.current.x;
        const dy = vp.y - panStart.current.y;
        transform.current.x = pt.x + dx;
        transform.current.y = pt.y + dy;
        syncGroup();
      }
      return;
    }

    if (tool === 'draw' || tool === 'freehand') {
      const snapped = snapToEndpoint(pos.x, pos.y, lines.filter(l => l.id !== (lines.find(x => x.id === selectedLineId)?.id)));
      if (snapped.snap) setSnapPt({ x: snapped.x, y: snapped.y });
      else setSnapPt(null);
    } else {
      setSnapPt(null);
    }

    if (tool === 'freehand' && drawing) {
      setFreehandPoints(prev => {
        const last = prev.length >= 2 ? { x: prev[prev.length - 2], y: prev[prev.length - 1] } : null;
        if (last && dist(last.x, last.y, pos.x, pos.y) < 5) return prev;
        return [...prev, pos.x, pos.y];
      });
    } else if (tool === 'draw' && drawingStart) {
      const snapped = snapToEndpoint(pos.x, pos.y, lines);
      const p = snapped.snap ? snapped : pos;
      setPreview({ x1: drawingStart.x, y1: drawingStart.y, x2: p.x, y2: p.y });
    } else if ((tool === 'parallel' || tool === 'perpendicular') && refLine) {
      const snapped = snapToEndpoint(pos.x, pos.y, lines);
      const p = snapped.snap ? snapped : pos;
      if (tool === 'parallel') {
        const pd = parallelLineData(refLine.x1, refLine.y1, refLine.x2, refLine.y2, p.x, p.y);
        setPreview({ x1: pd.x1, y1: pd.y1, x2: pd.x2, y2: pd.y2 });
      } else {
        const pd = perpendicularLineData(refLine.x1, refLine.y1, refLine.x2, refLine.y2, p.x, p.y);
        setPreview({ x1: pd.x1, y1: pd.y1, x2: pd.x2, y2: pd.y2 });
      }
    } else {
      setPreview(null);
    }
  }, [tool, drawingStart, refLine, lines, selectedLineId, drawing]);

  const handleUp = useCallback((e: any) => {
    const pos = getWorldPos(e);
    if (!pos) { lastDown.current = null; panning.current = false; return; }

    panning.current = false;

    if (!wasDrag.current && pos) {
      processClick(pos);
    }

    if (tool === 'freehand' && drawing && freehandPoints.length >= 6) {
      addAnnotation(freehandPoints);
      setDrawing(false);
      setFreehandPoints([]);
      setPreview(null);
      setSnapPt(null);
    } else if (tool === 'draw' && drawingStart && pos) {
      const snapped = snapToEndpoint(pos.x, pos.y, lines);
      const p = snapped.snap ? snapped : pos;
      const d = dist(drawingStart.x, drawingStart.y, p.x, p.y);
      if (d > 10) {
        const snappedStart = snapToEndpoint(drawingStart.x, drawingStart.y, lines);
        const s = snappedStart.snap ? snappedStart : drawingStart;
        addLine({ x1: s.x, y1: s.y, x2: p.x, y2: p.y });
      }
      setDrawing(false);
      setDrawingStart(null);
      setPreview(null);
      setSnapPt(null);
    }

    lastDown.current = null;
  }, [tool, drawingStart, processClick, addLine, setDrawingStart, lines, freehandPoints, drawing]);

  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault();
    const vp = getViewportPos(e);
    if (!vp) return;
    const by = 1.1;
    const t = transform.current;
    const ns = Math.max(0.1, Math.min(5, e.evt.deltaY < 0 ? t.scale * by : t.scale / by));
    t.x = vp.x - (vp.x - t.x) * (ns / t.scale);
    t.y = vp.y - (vp.y - t.y) * (ns / t.scale);
    t.scale = ns;
    syncGroup();
  }, []);

  const handleTouchStart = useCallback((e: any) => {
    const touches = e.evt.touches;
    if (touches.length === 2) {
      const t1 = touches[0], t2 = touches[1];
      const d = Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2);
      touchRef.current = { dist: d, cx: (t1.clientX + t2.clientX) / 2, cy: (t1.clientY + t2.clientY) / 2 };
    }
  }, []);

  const handleTouchMove = useCallback((e: any) => {
    const touches = e.evt.touches;
    if (touches.length === 2 && touchRef.current) {
      e.evt.preventDefault();
      const t1 = touches[0], t2 = touches[1];
      const newDist = Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2);
      const t = transform.current;
      const ns = Math.max(0.1, Math.min(5, t.scale * (newDist / touchRef.current.dist)));
      const cx = (t1.clientX + t2.clientX) / 2;
      const cy = (t1.clientY + t2.clientY) / 2;
      t.x = cx - (cx - t.x) * (ns / t.scale);
      t.y = cy - (cy - t.y) * (ns / t.scale);
      t.scale = ns;
      syncGroup();
      touchRef.current = { dist: newDist, cx, cy };
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchRef.current = null;
  }, []);

  const selectedLine = lines.find(l => l.id === selectedLineId);

  function lineLabel(ln: any): string {
    if (ln.lengthMeters != null) return `${ln.lengthMeters.toFixed(1)} m`;
    return '—';
  }

  const selInfo = selectedLine ? (
    <div className="absolute bottom-3 left-3 bg-slate-900/90 px-3 py-2 rounded-lg text-xs text-slate-300 pointer-events-none z-10 max-w-60">
      <div className="font-semibold text-white mb-1">{selectedLine.label}</div>
      <div>L: {lineLabel(selectedLine)}</div>
      <div>∠: {angle(selectedLine.x1, selectedLine.y1, selectedLine.x2, selectedLine.y2).toFixed(1)}°</div>
      <div>Rumbo: {bearing(angle(selectedLine.x1, selectedLine.y1, selectedLine.x2, selectedLine.y2))}</div>
      {selectedLine.lat1 != null && <div>GPS: {selectedLine.lat1.toFixed(6)}, {selectedLine.lng1?.toFixed(6)}</div>}
      {selectedLine.notes && <div className="text-slate-400 mt-1 italic">{selectedLine.notes}</div>}
    </div>
  ) : null;

  const hints = (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none z-10">
      {!refLine && tool !== 'select' && !drawingStart && (
        <span className="bg-slate-900/80 px-3 py-1.5 rounded-lg text-sm text-slate-300">
          {tool === 'draw' && 'Arrastra para dibujar'}
          {tool === 'freehand' && 'Escribe una nota en el lienzo'}
          {tool === 'parallel' && `${tapVerb()} una línea como referencia`}
          {tool === 'perpendicular' && `${tapVerb()} una línea como referencia`}
        </span>
      )}
      {refLine && (
        <span className="bg-slate-900/80 px-3 py-1.5 rounded-lg text-sm text-amber-300">
          {tool === 'parallel' && `${refLine.label}: ${tapVerb()} el lienzo para crear paralela`}
          {tool === 'perpendicular' && `${refLine.label}: ${tapVerb()} el lienzo para crear perpendicular`}
        </span>
      )}
    </div>
  );

  const scaleBarPx = 100;
  const scaleBarLabel = scale ? `${(100 / scale.pixels * scale.meters).toFixed(1)} m` : '';

  const gridLines = useMemo(() => {
    const els: JSX.Element[] = [];
    const int = sheet.gridInterval * sheet.dpi;
    const maxX = sheet.sheetPxW;
    const maxY = sheet.sheetPxH;
    for (let x = 0; x <= maxX; x += int) {
      els.push(<Line key={`gv${x}`} points={[x, 0, x, maxY]} stroke="#334155" strokeWidth={1} listening={false} />);
    }
    for (let y = 0; y <= maxY; y += int) {
      els.push(<Line key={`gh${y}`} points={[0, y, maxX, y]} stroke="#334155" strokeWidth={1} listening={false} />);
    }
    return els;
  }, [sheet]);

  return (
    <div ref={containerRef} className="flex-1 relative bg-slate-900 overflow-hidden touch-none">
      {showDialog && size.w > 0 && <SheetDialog onConfirm={(w, h) => setSheetSize(w, h, size.w, size.h)} />}

      <Stage
        width={size.w}
        height={size.h}
        draggable={false}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: tool === 'draw' || tool === 'freehand' ? 'crosshair' : tool === 'select' ? 'grab' : 'pointer' }}
      >
        <Layer>
          <Group
            ref={groupRef}
            x={transform.current.x}
            y={transform.current.y}
            scaleX={transform.current.scale}
            scaleY={transform.current.scale}
          >
            {/* Sheet background */}
            {sheetW && sheetH && (
              <Rect
                x={0} y={0}
                width={sheet.sheetPxW} height={sheet.sheetPxH}
                fill="#1e293b"
                listening={false}
              />
            )}

            {/* Grid within sheet */}
            {sheetW && sheetH && gridLines}

            {/* Sheet border */}
            {sheetW && sheetH && (
              <Line
                points={[0, 0, sheet.sheetPxW, 0, sheet.sheetPxW, sheet.sheetPxH, 0, sheet.sheetPxH, 0, 0]}
                stroke="#475569"
                strokeWidth={2}
                listening={false}
                closed
              />
            )}

            {lines.map((line) => {
              const isSel = line.id === selectedLineId;
              const isRef = line.id === referenceLineId;
              const isScale = scaleLine?.id === line.id;
              const pts = [line.x1, line.y1, line.x2, line.y2];
              const mx = (line.x1 + line.x2) / 2;
              const my = (line.y1 + line.y2) / 2;
              const dx = line.x2 - line.x1;
              const dy = line.y2 - line.y1;
              const ln2 = Math.sqrt(dx * dx + dy * dy) || 1;
              const nx = -dy / ln2 * 14;
              const ny = dx / ln2 * 14;

              const canShowLen = line.lengthMeters != null;
              const displayLen = canShowLen ? `${line.lengthMeters!.toFixed(1)}m` : '';

              return (
                <Group key={line.id}>
                  <Line
                    points={pts}
                    stroke={isRef ? '#fbbf24' : isSel ? '#fff' : line.color}
                    strokeWidth={isSel || isRef ? 4 : isScale ? 4 : 3}
                    hitStrokeWidth={20}
                    lineCap="round"
                    lineJoin="round"
                    closed={false}
                    dash={isRef ? [6, 3] : isScale ? [8, 4] : undefined}
                  />
                  <Circle
                    x={line.x1} y={line.y1}
                    radius={isSel ? 7 : 4}
                    fill={line.color}
                    stroke="#1e293b" strokeWidth={2}
                    draggable={isSel && tool === 'select'}
                    onDragEnd={(e) => updateLine(line.id, { x1: e.target.x(), y1: e.target.y() })}
                  />
                  <Circle
                    x={line.x2} y={line.y2}
                    radius={isSel ? 7 : 4}
                    fill={line.color}
                    stroke="#1e293b" strokeWidth={2}
                    draggable={isSel && tool === 'select'}
                    onDragEnd={(e) => updateLine(line.id, { x2: e.target.x(), y2: e.target.y() })}
                  />
                  <Text x={line.x1 + 6} y={line.y1 - 20} text={line.label} fontSize={12} fill={line.color} fontStyle="bold" listening={false} />
                  {canShowLen && <Text x={mx + nx} y={my + ny - 6} text={displayLen} fontSize={11} fill={isSel ? '#fff' : '#94a3b8'} listening={false} />}
                  {isScale && (
                    <Text x={mx - 30} y={my + ny + 8} text="ESCALA" fontSize={8} fill="#f59e0b" listening={false} />
                  )}
                </Group>
              );
            })}

            {/* Annotations (notas a mano alzada) */}
            {annotations.map((ann) => (
              <Line
                key={ann.id}
                points={ann.points}
                tension={0.3}
                stroke={ann.color}
                strokeWidth={3}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            ))}

            {snapPt && tool === 'draw' && drawingStart && (
              <Circle x={snapPt.x} y={snapPt.y} radius={8} stroke="#3b82f6" strokeWidth={2} dash={[3, 2]} listening={false} />
            )}

            {tool === 'freehand' && drawing && freehandPoints.length >= 4 && (
              <Line points={freehandPoints} tension={0.3} stroke="#94a3b8" strokeWidth={3} listening={false} />
            )}

            {preview && (
              <>
                <Line points={[preview.x1, preview.y1, preview.x2, preview.y2]} stroke="#94a3b8" strokeWidth={2} dash={[5, 3]} listening={false} />
                <Text x={(preview.x1 + preview.x2) / 2 + 10} y={(preview.y1 + preview.y2) / 2 - 10} text={`${dist(preview.x1, preview.y1, preview.x2, preview.y2).toFixed(0)}`} fontSize={11} fill="#94a3b8" listening={false} />
              </>
            )}
          </Group>
        </Layer>
      </Stage>

      {hints}
      {selInfo}

      {/* Debug pointer indicator */}
      {snapPt && (tool === 'draw' || tool === 'freehand') && (
        <div className="absolute" style={{ left: snapPt.x * transform.current.scale + transform.current.x - 4, top: snapPt.y * transform.current.scale + transform.current.y - 4, width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', pointerEvents: 'none', zIndex: 10 }} />
      )}

      {/* North arrow (fixed to viewport) */}
      <div className="absolute top-3 right-3 z-10 pointer-events-none" style={{ transform: 'none' }}>
        <svg width="22" height="32" viewBox="0 0 22 32">
          <polygon points="11,0 0,32 11,24 22,32" fill="#94a3b8" />
          <text x="11" y="0" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="bold" dy="-2">N</text>
        </svg>
      </div>

      {/* Scale bar (fixed to viewport) */}
      <div className="absolute bottom-10 right-4 z-10 pointer-events-none flex flex-col items-center">
        <div className="relative" style={{ width: Math.min(scaleBarPx, 200), height: 2, background: '#94a3b8' }}>
          <div style={{ position: 'absolute', top: -4, left: 0, width: 2, height: 10, background: '#94a3b8' }} />
          <div style={{ position: 'absolute', top: -4, right: 0, width: 2, height: 10, background: '#94a3b8' }} />
        </div>
        <span className="text-[9px] text-slate-400 mt-0.5">{scaleBarLabel}</span>
      </div>

      <div className="absolute top-3 left-3 text-xs text-slate-500 pointer-events-none z-10">
        {sheetW && sheetH ? `${sheetW}×${sheetH} m` : ''}
      </div>
    </div>
  );
}
