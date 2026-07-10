import { useState, useEffect } from 'react';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import { useStore, hasSavedData } from './store';

function ProjectMenu({ onClose }: { onClose: () => void }) {
  const { projects, currentProjectId, setCurrentProject, addProject, deleteProject, renameProject } = useStore();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  return (
    <div className="absolute top-full left-0 mt-1 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 p-3">
      <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Proyectos</div>
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {projects.map(p => (
          <div
            key={p.id}
            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm ${
              p.id === currentProjectId ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-slate-700'
            }`}
            onClick={() => { setCurrentProject(p.id); onClose(); }}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            {editingId === p.id ? (
              <input value={editName} onChange={e => setEditName(e.target.value)}
                onBlur={() => { renameProject(p.id, editName); setEditingId(null); }}
                onKeyDown={e => { if (e.key === 'Enter') { renameProject(p.id, editName); setEditingId(null); } }}
                className="flex-1 bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white" autoFocus
                onClick={e => e.stopPropagation()} />
            ) : (
              <span className="flex-1 truncate" onDoubleClick={() => { setEditingId(p.id); setEditName(p.name); }}>{p.name}</span>
            )}
            <span className="text-xs text-slate-500">{p.lines.length}</span>
            <button onClick={e => { e.stopPropagation(); deleteProject(p.id); }} className="text-red-400 hover:text-red-300 text-xs">✕</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <input value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="Nuevo proyecto..."
          className="flex-1 text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white placeholder-slate-500"
          onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { addProject(newName.trim()); setNewName(''); onClose(); } }} />
        <button onClick={() => { if (newName.trim()) { addProject(newName.trim()); setNewName(''); onClose(); } }}
          className="text-xs bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-500">+</button>
      </div>
    </div>
  );
}

function WelcomeDialog({ onLoad, onNew }: { onLoad: () => void; onNew: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/90">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-2xl w-80 text-center">
        <h1 className="text-lg font-bold text-white mb-2">CampoNotes</h1>
        <p className="text-sm text-slate-400 mb-6">Se encontró un proyecto guardado.</p>
        <div className="flex flex-col gap-3">
          <button onClick={onLoad}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors">
            Cargar proyecto anterior
          </button>
          <button onClick={onNew}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors">
            Empezar nuevo
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onNewProject }: { onNewProject: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-2">CampoNotes</h2>
        <p className="text-sm text-slate-400 mb-4">Cuaderno de campo para levantamientos geofísicos</p>
        <div className="flex gap-2 justify-center">
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Nombre del proyecto..."
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 w-56 focus:outline-none focus:border-blue-500"
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onNewProject(name.trim()); } }} />
          <button onClick={() => { if (name.trim()) onNewProject(name.trim()); }}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(hasSavedData());
  const {
    projects, currentProjectId, toggleSidebar,
    undo, redo, lines, selectedLineId, removeLine,
    addProject,
  } = useStore();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const proj = projects.find(p => p.id === currentProjectId);
  const hasProjects = projects.length > 0;

  if (showWelcome) {
    return (
      <div className="w-full h-full bg-slate-900 relative">
        <WelcomeDialog
          onLoad={() => setShowWelcome(false)}
          onNew={() => {
            addProject('Nuevo proyecto');
            setShowWelcome(false);
          }}
        />
      </div>
    );
  }

  if (!hasProjects) {
    return (
      <div className="w-full h-full bg-slate-900">
        <EmptyState onNewProject={(name) => addProject(name)} />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 overflow-hidden pb-14 md:pb-0">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 px-3 py-1.5 flex items-center gap-2 shrink-0 safe-top z-20">
        <h1 className="text-sm font-bold text-white whitespace-nowrap">CampoNotes</h1>

        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-300 transition-colors">
            <span className="truncate max-w-24">{proj?.name || 'Sin proyecto'}</span>
            <span className="text-slate-500">▾</span>
          </button>
          {menuOpen && <ProjectMenu onClose={() => setMenuOpen(false)} />}
        </div>

        <div className="flex-1" />

        {/* Desktop buttons */}
        {!isMobile && (
          <div className="flex gap-1">
            <button onClick={undo} className="text-xs text-slate-400 hover:text-white px-1.5 py-1" title="Deshacer">↩</button>
            <button onClick={redo} className="text-xs text-slate-400 hover:text-white px-1.5 py-1" title="Rehacer">↪</button>
          </div>
        )}

        {isMobile && (
          <div className="flex gap-1">
            <button onClick={toggleSidebar} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800" title="Líneas">
              ⊞ {lines.length}
            </button>
            <button onClick={() => { if (selectedLineId) removeLine(selectedLineId); }} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-slate-800" title="Eliminar">✕</button>
          </div>
        )}
      </header>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        <Toolbar />
        <Canvas />
        <Sidebar isMobile={isMobile} />
      </div>
    </div>
  );
}