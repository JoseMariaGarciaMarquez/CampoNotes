import { useRef, useState } from 'react';
import { useStore } from '../store';
import { dist, angle, bearing } from '../utils/geometry';
import type { ScaleRef } from '../types';

const inputCls = "w-full text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500";

function LineItem({ line, isSelected, onSelect, onUpdate, onRemove, scale }: {
  line: any; isSelected: boolean;
  onSelect: () => void; onUpdate: (d: any) => void; onRemove: () => void;
  scale?: ScaleRef;
}) {
  const ang = angle(line.x1, line.y1, line.x2, line.y2);
  const { addPhoto, removePhoto } = useStore();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [editingLen, setEditingLen] = useState(false);
  const [lenInput, setLenInput] = useState('');
  const [editingAng, setEditingAng] = useState(false);
  const [angInput, setAngInput] = useState('');

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') addPhoto(line.id, reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleLenSubmit = () => {
    const newMeters = parseFloat(lenInput);
    if (!scale || isNaN(newMeters) || newMeters <= 0) {
      setEditingLen(false);
      return;
    }
    const angRad = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
    const newPx = newMeters * scale.pixels / scale.meters;
    const nx2 = line.x1 + Math.cos(angRad) * newPx;
    const ny2 = line.y1 + Math.sin(angRad) * newPx;
    onUpdate({ x2: nx2, y2: ny2, lengthMeters: newMeters });
    setEditingLen(false);
  };

  const handleAngSubmit = () => {
    const newDeg = parseFloat(angInput);
    if (isNaN(newDeg)) {
      setEditingAng(false);
      return;
    }
    const newRad = newDeg * Math.PI / 180;
    const pxLen = dist(line.x1, line.y1, line.x2, line.y2);
    const nx2 = line.x1 + Math.cos(newRad) * pxLen;
    const ny2 = line.y1 + Math.sin(newRad) * pxLen;
    const newMeters = scale ? (pxLen / scale.pixels * scale.meters) : line.lengthMeters;
    onUpdate({ x2: nx2, y2: ny2, lengthMeters: newMeters });
    setEditingAng(false);
  };

  const inp = (label: string, key: string, val: any, opts?: { type?: string; placeholder?: string; step?: string }) => (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <span className="text-[9px] text-slate-500 w-14 shrink-0">{label}</span>
      <input
        type={opts?.type ?? 'text'}
        step={opts?.step}
        value={val ?? ''}
        placeholder={opts?.placeholder ?? ''}
        onChange={e => onUpdate({ [key]: e.target.value === '' ? undefined : (opts?.type === 'number' ? parseFloat(e.target.value) : e.target.value) })}
        className={inputCls}
      />
    </div>
  );

  return (
    <div
      onClick={onSelect}
      className={`p-2.5 rounded-lg cursor-pointer border transition-colors ${
        isSelected ? 'border-blue-500 bg-blue-500/10' : 'border-transparent hover:bg-slate-800'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: line.color }} />
        <span className="font-medium text-sm text-white">{line.label}</span>
        {scale && line.lengthMeters != null && !editingLen ? (
          <button
            onClick={(e) => { e.stopPropagation(); setEditingLen(true); setLenInput(line.lengthMeters!.toFixed(1)); }}
            className="text-xs text-slate-400 hover:text-white ml-auto tabular-nums bg-slate-800 hover:bg-slate-700 rounded px-1.5 py-0.5 transition-colors"
            title="Clic para editar longitud"
          >
            {line.lengthMeters!.toFixed(1)}m ✎
          </button>
        ) : scale && editingLen ? (
          <div className="flex items-center gap-0.5 ml-auto" onClick={e => e.stopPropagation()}>
            <input
              type="number" step="any" min="0.1" value={lenInput}
              onChange={e => setLenInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleLenSubmit(); if (e.key === 'Escape') setEditingLen(false); }}
              onBlur={handleLenSubmit}
              className="w-16 text-[10px] bg-slate-800 border border-blue-500 rounded px-1 py-0.5 text-white text-right tabular-nums focus:outline-none"
              autoFocus
            />
            <span className="text-[10px] text-slate-400">m</span>
          </div>
        ) : (
          <span className="text-xs text-slate-500 ml-auto">
            {line.lengthMeters != null ? `${line.lengthMeters.toFixed(1)}m` : '—'}
          </span>
        )}
      </div>
      {!editingAng ? (
        <button
          onClick={(e) => { e.stopPropagation(); setEditingAng(true); setAngInput(ang.toFixed(1)); }}
          className="text-xs text-slate-500 hover:text-slate-300 mt-0.5 text-left transition-colors"
          title="Clic para editar azimut"
        >
          {ang.toFixed(1)}° {bearing(ang)} ✎
        </button>
      ) : (
        <div className="flex items-center gap-0.5 mt-0.5" onClick={e => e.stopPropagation()}>
          <input
            type="number" step="any" min="0" max="360" value={angInput}
            onChange={e => setAngInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAngSubmit(); if (e.key === 'Escape') setEditingAng(false); }}
            onBlur={handleAngSubmit}
            className="w-16 text-[10px] bg-slate-800 border border-blue-500 rounded px-1 py-0.5 text-white text-right tabular-nums focus:outline-none"
            autoFocus
          />
          <span className="text-[10px] text-slate-400">°</span>
        </div>
      )}

      {/* GPS start */}
      <div className="flex gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
        <input type="number" step="any" value={line.lat1 ?? ''} placeholder="Lat ini"
          onChange={e => onUpdate({ lat1: e.target.value ? parseFloat(e.target.value) : undefined })}
          className={inputCls} />
        <input type="number" step="any" value={line.lng1 ?? ''} placeholder="Lng ini"
          onChange={e => onUpdate({ lng1: e.target.value ? parseFloat(e.target.value) : undefined })}
          className={inputCls} />
      </div>
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <input type="number" step="any" value={line.lat2 ?? ''} placeholder="Lat fin"
          onChange={e => onUpdate({ lat2: e.target.value ? parseFloat(e.target.value) : undefined })}
          className={inputCls} />
        <input type="number" step="any" value={line.lng2 ?? ''} placeholder="Lng fin"
          onChange={e => onUpdate({ lng2: e.target.value ? parseFloat(e.target.value) : undefined })}
          className={inputCls} />
      </div>

      <input
        type="text" value={line.notes}
        onChange={(e) => { e.stopPropagation(); onUpdate({ notes: e.target.value }); }}
        placeholder="Nota..."
        className="mt-1.5 w-full text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500"
        onClick={(e) => e.stopPropagation()}
      />

      <div className="flex gap-2 mt-1.5">
        <select
          value={line.method}
          onChange={(e) => { e.stopPropagation(); onUpdate({ method: e.target.value }); }}
          className="flex-1 text-xs bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-400 focus:outline-none focus:border-blue-500"
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">Método</option>
          <option value="tre">TRE</option>
          <option value="masw">MASW</option>
          <option value="hv">H/V</option>
          <option value="gpr">GPR</option>
        </select>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-xs text-red-400 hover:text-red-300 px-1">
          Eliminar
        </button>
      </div>

      {/* Detail toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); setShowDetail(!showDetail); }}
        className="mt-1.5 w-full text-[10px] text-slate-500 hover:text-slate-300 text-left flex items-center gap-1"
      >
        <span>{showDetail ? '▾' : '▸'}</span> Detalle de línea
      </button>

      {showDetail && (
        <div className="mt-1.5 space-y-1" onClick={e => e.stopPropagation()}>
          {inp('Azimut', 'azimuth', line.azimuth, { type: 'number', placeholder: '°', step: 'any' })}
          {inp('Elevación', 'elevation', line.elevation, { type: 'number', placeholder: 'm', step: 'any' })}
          {inp('Estaciones', 'stationCount', line.stationCount, { type: 'number', placeholder: '#', step: '1' })}
          {inp('Sep. electro.', 'stationSpacing', line.stationSpacing, { type: 'number', placeholder: 'm', step: 'any' })}
          {inp('Terreno', 'terrain', line.terrain, { placeholder: 'arcilloso, arenoso...' })}
          {inp('Topografía', 'topography', line.topography, { placeholder: 'plana, con ladera...' })}
          {inp('Profundidad', 'depth', line.depth, { placeholder: 'máx investigada' })}
          <div className="text-[9px] text-slate-500 uppercase pt-1 border-t border-slate-800">Parámetros del método</div>
          {inp('Rango freq.', 'frequencyRange', line.frequencyRange, { placeholder: 'ej: 0.5-20 Hz' })}
          {inp('Ventana t.', 'timeWindow', line.timeWindow, { placeholder: 'ej: 1024 ms' })}
          {inp('Stacks', 'stackCount', line.stackCount, { placeholder: 'ej: 4' })}
          {inp('Modo', 'surveyMode', line.surveyMode, { placeholder: 'Reflexión, CMP...' })}
          {inp('Antena', 'antennaFreq', line.antennaFreq, { placeholder: 'ej: 100 MHz' })}
        </div>
      )}

      {/* Photos */}
      <div className="flex flex-wrap gap-1 mt-1.5">
        {line.photos?.map((ph: any) => (
          <div key={ph.id} className="relative group">
            <img src={ph.dataUrl} className="w-10 h-10 rounded object-cover cursor-pointer"
              onClick={(e) => { e.stopPropagation(); window.open(ph.dataUrl); }} />
            <button
              onClick={(e) => { e.stopPropagation(); removePhoto(line.id, ph.id); }}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100"
            >✕</button>
          </div>
        ))}
        <button
          onClick={(e) => { e.stopPropagation(); photoInputRef.current?.click(); }}
          className="w-10 h-10 rounded border border-dashed border-slate-600 text-slate-500 text-lg flex items-center justify-center hover:border-slate-400"
          title="Añadir foto"
        >+</button>
        <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
      </div>
    </div>
  );
}

export default function Sidebar({ isMobile: propIsMobile }: { isMobile?: boolean }) {
  const {
    lines, selectedLineId, setSelectedLine, removeLine, updateLine,
    projects, currentProjectId, toggleSidebar, showSidebar,
    setProjectAttr,
  } = useStore();

  const proj = projects.find(p => p.id === currentProjectId);
  const isMobile = propIsMobile ?? (typeof window !== 'undefined' && window.innerWidth < 768);
  const scale = proj?.scale;

  const projInp = (label: string, key: string, val: string | undefined) => (
    <input
      type="text"
      value={val || ''}
      onChange={e => proj && setProjectAttr(proj.id, { [key]: e.target.value || undefined })}
      className="text-xs bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 placeholder-slate-600 w-full"
      placeholder={label}
    />
  );

  const panel = (
    <div className="flex flex-col overflow-hidden h-full">
      {/* Project info */}
      <div className="p-3 border-b border-slate-700 space-y-1.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Líneas</h2>
          <span className="text-xs text-slate-500">{lines.length}</span>
        </div>
        {scale && (
          <div className="text-xs text-amber-400/80">Escala: {scale.meters}m / {scale.pixels.toFixed(0)}px</div>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          <input type="date" value={proj?.date || ''} onChange={e => proj && setProjectAttr(proj.id, { date: e.target.value })}
            className="text-xs bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300" placeholder="Fecha" />
          {projInp('Operador', 'operator', proj?.operator)}
          {projInp('Equipo', 'equipment', proj?.equipment)}
          {projInp('Clima', 'weather', proj?.weather)}
          {projInp('Cliente', 'client', proj?.client)}
          {projInp('Objetivo', 'objective', proj?.objective)}
          {projInp('Ubicación', 'location', proj?.location)}
          {projInp('Municipio', 'municipality', proj?.municipality)}
          {projInp('Estado', 'state', proj?.state)}
        </div>
      </div>

      {/* Lines list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {lines.length === 0 && (
          <div className="p-4 text-sm text-slate-500 text-center">
            Sin líneas. Usa <span className="text-blue-400">Dibujar</span>.
          </div>
        )}
        {lines.map(line => (
          <LineItem
            key={line.id} line={line}
            isSelected={line.id === selectedLineId}
            onSelect={() => setSelectedLine(line.id === selectedLineId ? null : line.id)}
            onUpdate={(d) => updateLine(line.id, d)}
            onRemove={() => removeLine(line.id)}
            scale={scale}
          />
        ))}
      </div>

      {/* Summary */}
      {lines.length > 0 && (
        <div className="p-3 border-t border-slate-700 text-xs text-slate-500">
          {['tre', 'masw', 'hv', 'gpr'].map(m => {
            const n = lines.filter(l => l.method === m).length;
            return n ? <div key={m}>{m.toUpperCase()}: {n}</div> : null;
          })}
          <div className="text-slate-600 mt-1">Total: {lines.length} líneas</div>
        </div>
      )}
    </div>
  );

  if (!isMobile) {
    return (
      <div className="desktop-sidebar w-72 bg-slate-900 border-l border-slate-700 shrink-0 overflow-hidden">
        {panel}
      </div>
    );
  }

  return (
    <>
      <div className={`sheet-overlay bg-black/50 ${showSidebar ? 'open' : 'closed'}`} onClick={toggleSidebar} />
      <div className={`bottom-sheet bg-slate-900 border-t border-slate-700 ${showSidebar ? 'open' : 'closed'}`}>
        <div className="drag-handle bg-slate-600" />
        {panel}
      </div>
    </>
  );
}
