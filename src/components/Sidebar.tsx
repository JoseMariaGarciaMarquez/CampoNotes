import { useRef, useState } from 'react';
import { useStore } from '../store';
import { dist, angle, bearing } from '../utils/geometry';

function LineItem({ line, isSelected, onSelect, onUpdate, onRemove }: {
  line: any; isSelected: boolean;
  onSelect: () => void; onUpdate: (d: any) => void; onRemove: () => void;
}) {
  const len = dist(line.x1, line.y1, line.x2, line.y2);
  const ang = angle(line.x1, line.y1, line.x2, line.y2);
  const { addPhoto, removePhoto } = useStore();
  const photoInputRef = useRef<HTMLInputElement>(null);

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
        <span className="text-xs text-slate-500 ml-auto">
          {line.lengthMeters != null ? `${line.lengthMeters.toFixed(1)}m` : '—'}
        </span>
      </div>
      <div className="text-xs text-slate-500 mt-0.5">{ang.toFixed(1)}° {bearing(ang)}</div>

      {/* GPS start */}
      <div className="flex gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
        <input type="number" step="any" value={line.lat1 ?? ''} placeholder="Lat ini"
          onChange={e => onUpdate({ lat1: e.target.value ? parseFloat(e.target.value) : undefined })}
          className="w-full text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500" />
        <input type="number" step="any" value={line.lng1 ?? ''} placeholder="Lng ini"
          onChange={e => onUpdate({ lng1: e.target.value ? parseFloat(e.target.value) : undefined })}
          className="w-full text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500" />
      </div>
      {/* GPS end */}
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <input type="number" step="any" value={line.lat2 ?? ''} placeholder="Lat fin"
          onChange={e => onUpdate({ lat2: e.target.value ? parseFloat(e.target.value) : undefined })}
          className="w-full text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500" />
        <input type="number" step="any" value={line.lng2 ?? ''} placeholder="Lng fin"
          onChange={e => onUpdate({ lng2: e.target.value ? parseFloat(e.target.value) : undefined })}
          className="w-full text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500" />
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
    projects, currentProjectId, setCurrentProject, addProject,
    toggleSidebar, showSidebar,
    setProjectAttr,
  } = useStore();

  const proj = projects.find(p => p.id === currentProjectId);
  const isMobile = propIsMobile ?? (typeof window !== 'undefined' && window.innerWidth < 768);
  const scale = proj?.scale;

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
        {/* Field attributes */}
        <div className="grid grid-cols-2 gap-1.5">
          <input type="date" value={proj?.date || ''} onChange={e => proj && setProjectAttr(proj.id, { date: e.target.value })}
            className="text-xs bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300" placeholder="Fecha" />
          <input type="text" value={proj?.operator || ''} onChange={e => proj && setProjectAttr(proj.id, { operator: e.target.value })}
            className="text-xs bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 placeholder-slate-600" placeholder="Operador" />
          <input type="text" value={proj?.equipment || ''} onChange={e => proj && setProjectAttr(proj.id, { equipment: e.target.value })}
            className="text-xs bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 placeholder-slate-600" placeholder="Equipo" />
          <input type="text" value={proj?.weather || ''} onChange={e => proj && setProjectAttr(proj.id, { weather: e.target.value })}
            className="text-xs bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 placeholder-slate-600" placeholder="Clima" />
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
