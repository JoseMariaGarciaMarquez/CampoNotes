import { useRef, useState } from 'react';
import { useStore } from '../store';
import { downloadGeoJSON, downloadCampoJSON, readGeoJSONFile, importGeoJSON } from '../utils/geojson';

const tools = [
  { id: 'select' as const, icon: '⊡', label: 'Seleccionar' },
  { id: 'draw' as const, icon: '╱', label: 'Dibujar' },
  { id: 'freehand' as const, icon: '✎', label: 'Mano alzada' },
  { id: 'parallel' as const, icon: '∥', label: 'Paralela' },
  { id: 'perpendicular' as const, icon: '⟂', label: 'Perpendicular' },
];

function Btn({ icon, label, active, onClick, className }: {
  icon: string; label: string; active?: boolean; onClick: () => void; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center rounded-lg transition-colors touch-manipulation ${
        active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700'
      } ${className || 'w-11 h-11 text-lg'}`}
      title={label} aria-label={label}
    >
      {icon}
    </button>
  );
}

export default function Toolbar() {
  const {
    tool, setTool,
    selectedLineId, removeLine, lines, annotations,
    undo, redo,
    projects, currentProjectId, setScale, clearScale,
    updateLine, clearAnnotations,
  } = useStore();
  const geoInputRef = useRef<HTMLInputElement>(null);
  const [calibrating, setCalibrating] = useState(false);

  const proj = projects.find(p => p.id === currentProjectId);

  const handleExportGeoJSON = () => {
    if (!proj) return;
    downloadGeoJSON(proj);
  };

  const handleExportCampoJSON = () => {
    if (!proj) return;
    downloadCampoJSON(proj);
  };

  const handleImportGeoJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const geo = await readGeoJSONFile(file);
      const imported = importGeoJSON(geo);
      imported.forEach((data) => {
        useStore.getState().addLine({
          x1: data.x1, y1: data.y1, x2: data.x2, y2: data.y2,
          lng1: data.lng1, lat1: data.lat1,
          lng2: data.lng2, lat2: data.lat2,
          notes: `Importado GeoJSON`,
        });
      });
    } catch (err) {
      alert('Error al importar GeoJSON');
    }
    if (geoInputRef.current) geoInputRef.current.value = '';
  };

  const handleScaleCalibrate = () => {
    const sel = selectedLineId;
    if (!sel) {
      setCalibrating(true);
      setTool('draw');
      return;
    }
    const meters = prompt('¿Cuántos metros mide esta línea?');
    if (meters && !isNaN(Number(meters)) && Number(meters) > 0) {
      setScale(sel, Number(meters));
    }
  };

  const handleRename = () => {
    const sel = selectedLineId;
    if (!sel) return;
    const line = lines.find(l => l.id === sel);
    if (!line) return;
    const name = prompt('Nuevo nombre:', line.label || '');
    if (name && name.trim()) {
      updateLine(sel, { label: name.trim() });
    }
  };

  const desktopBtns = (
    <>
      {tools.map(t => (
        <Btn key={t.id} icon={t.icon} label={t.label} active={tool === t.id} onClick={() => {
          if (calibrating) setCalibrating(false);
          setTool(t.id);
        }} />
      ))}
      <div className="w-8 border-t border-slate-700 my-2" />
      {/* Scale */}
      <Btn icon="📏" label="Calibrar escala" onClick={handleScaleCalibrate} className="w-11 h-11 text-sm" />
      {proj?.scale && (
        <Btn icon="⌫" label="Limpiar escala" onClick={clearScale} className="w-11 h-11 text-sm text-amber-400" />
      )}
      <div className="w-8 border-t border-slate-700 my-2" />
      {/* Export */}
      <Btn icon="⬇" label="Exportar GeoJSON" onClick={handleExportGeoJSON} className="w-11 h-11 text-sm" />
      <Btn icon="🐍" label="Exportar JSON (Python)" onClick={handleExportCampoJSON} className="w-11 h-11 text-sm" />
      <Btn icon="⬆" label="Importar GeoJSON" onClick={() => geoInputRef.current?.click()} className="w-11 h-11 text-sm" />
      <input ref={geoInputRef} type="file" accept=".geojson,.json" onChange={handleImportGeoJSON} className="hidden" />
      <div className="w-8 border-t border-slate-700 my-2" />
      {selectedLineId && (
        <Btn icon="✎" label="Renombrar" onClick={handleRename} className="w-11 h-11 text-sm text-blue-400 hover:text-blue-300" />
      )}
      <Btn icon="✕" label="Eliminar seleccionada" onClick={() => { if (selectedLineId) removeLine(selectedLineId); }} className="w-11 h-11 text-lg text-red-400 hover:text-red-300" />
      <Btn icon="∅" label="Limpiar todo" onClick={() => lines.forEach(l => removeLine(l.id))} className="w-11 h-11 text-sm text-red-500/60 hover:text-red-400" />
      {annotations.length > 0 && (
        <Btn icon="🗑" label="Limpiar notas" onClick={clearAnnotations} className="w-11 h-11 text-sm text-red-400 hover:text-red-300" />
      )}
    </>
  );

  const mobileBtns = (
    <>
      {tools.map(t => (
        <Btn key={t.id} icon={t.icon} label={t.label} active={tool === t.id} onClick={() => setTool(t.id)} />
      ))}
      <div className="h-6 w-px bg-slate-700 mx-1" />
      <Btn icon="↩" label="Deshacer" onClick={undo} className="w-10 h-10 text-base" />
      <Btn icon="↪" label="Rehacer" onClick={redo} className="w-10 h-10 text-base" />
      {selectedLineId && (
        <Btn icon="✎" label="Renombrar" onClick={handleRename} className="w-10 h-10 text-xs text-blue-400 hover:text-blue-300" />
      )}
      <Btn icon="✕" label="Eliminar" onClick={() => { if (selectedLineId) removeLine(selectedLineId); }} className="w-10 h-10 text-base text-red-400 hover:text-red-300" />
      <Btn icon="∅" label="Limpiar todo" onClick={() => lines.forEach(l => removeLine(l.id))} className="w-10 h-10 text-xs text-red-500/60 hover:text-red-400" />
      {annotations.length > 0 && (
        <Btn icon="🗑" label="Limpiar notas" onClick={clearAnnotations} className="w-10 h-10 text-xs text-red-400 hover:text-red-300" />
      )}
    </>
  );

  return (
    <>
      {/* Desktop */}
      <div className="desktop-sidebar flex-col items-center gap-1 p-2 bg-slate-900 border-r border-slate-700 shrink-0 overflow-y-auto">
        {desktopBtns}
      </div>
      {/* Mobile */}
      <div className="mobile-toolbar bg-slate-900 shrink-0">
        {mobileBtns}
      </div>
    </>
  );
}
