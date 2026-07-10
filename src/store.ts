import { create } from 'zustand';
import type { LineData, Tool, Project, PhotoData, ScaleRef, AnnotationData } from './types';
import { uid, dist } from './utils/geometry';

const COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#a855f7', '#ec4899', '#06b6d4', '#84cc16',
];

const STORAGE_KEY = 'camponotes_data';

export function hasSavedData(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return !!data.projects?.length;
    }
  } catch {}
  return false;
}

function persist(projects: Project[], currentProjectId: string | null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects, currentProjectId }));
  } catch {}
}

function load(): { projects: Project[]; currentProjectId: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.projects?.length) {
        return { projects: data.projects, currentProjectId: data.currentProjectId ?? data.projects[0].id };
      }
    }
  } catch {}
  return { projects: [], currentProjectId: null };
}

const saved = load();

interface Snapshot { lines: LineData[]; nextLabel: number; annotations: AnnotationData[] }

export interface StoreState {
  projects: Project[];
  currentProjectId: string | null;
  lines: LineData[];
  annotations: AnnotationData[];
  tool: Tool;
  selectedLineId: string | null;
  referenceLineId: string | null;
  drawingStart: { x: number; y: number; lng?: number; lat?: number } | null;
  nextLabel: number;
  showSidebar: boolean;
  _history: Snapshot[];
  _historyIndex: number;
  _save: () => void;
  _pushHistory: () => void;

  addProject: (name: string) => void;
  setCurrentProject: (id: string) => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  setProjectAttr: (id: string, attr: Partial<Pick<Project, 'operator' | 'date' | 'weather' | 'equipment' | 'client' | 'objective' | 'location' | 'municipality' | 'state'>>) => void;

  addLine: (data: {
    x1: number; y1: number; x2: number; y2: number;
    lng1?: number; lat1?: number; lng2?: number; lat2?: number;
    notes?: string; method?: string; label?: string; color?: string;
  }) => void;
  updateLine: (id: string, data: Partial<LineData>) => void;
  removeLine: (id: string) => void;

  addAnnotation: (points: number[]) => void;
  removeAnnotation: (id: string) => void;
  clearAnnotations: () => void;

  setTool: (tool: Tool) => void;
  setSelectedLine: (id: string | null) => void;
  setReferenceLine: (id: string | null) => void;
  setDrawingStart: (point: { x: number; y: number; lng?: number; lat?: number } | null) => void;
  toggleSidebar: () => void;

  undo: () => void;
  redo: () => void;

  setScale: (lineId: string, meters: number) => void;
  clearScale: () => void;
  setSheetSize: (widthMeters: number, heightMeters: number, viewportW?: number, viewportH?: number) => void;
  addPhoto: (lineId: string, dataUrl: string, caption?: string) => void;
  removePhoto: (lineId: string, photoId: string) => void;
}

const currentProj = saved.projects.find(p => p.id === saved.currentProjectId);
const initLines = currentProj?.lines ?? [];
const initNextLabel = initLines.length + 1;

export const useStore = create<StoreState>((set, get) => ({
  projects: saved.projects,
  currentProjectId: saved.currentProjectId,
  lines: initLines,
  annotations: currentProj?.annotations ?? [],
  tool: 'select',
  selectedLineId: null,
  referenceLineId: null,
  drawingStart: null,
  nextLabel: initNextLabel,
  showSidebar: false,
  _history: [{ lines: initLines, nextLabel: initNextLabel, annotations: currentProj?.annotations ?? [] }],
  _historyIndex: 0,

  _save() {
    const state = get();
    const projects = state.projects.map(p =>
      p.id === state.currentProjectId
        ? { ...p, lines: state.lines, annotations: state.annotations, updatedAt: Date.now() }
        : p
    );
    persist(projects, state.currentProjectId);
  },

  _pushHistory() {
    const state = get();
    const snap: Snapshot = { lines: [...state.lines], nextLabel: state.nextLabel, annotations: [...state.annotations] };
    const h = state._history.slice(0, state._historyIndex + 1);
    h.push(snap);
    if (h.length > 50) h.shift();
    set({ _history: h, _historyIndex: h.length - 1 });
  },

  addProject: (name) => {
    const id = uid();
    set({
      projects: [...get().projects, { id, name, lines: [], annotations: [], createdAt: Date.now(), updatedAt: Date.now() }],
      currentProjectId: id, lines: [], annotations: [], nextLabel: 1,
      selectedLineId: null, referenceLineId: null,
      _history: [{ lines: [], nextLabel: 1, annotations: [] }], _historyIndex: 0,
    });
    get()._save();
  },

  setCurrentProject: (id) => {
    const state = get();
    const updated = state.projects.map(p =>
      p.id === state.currentProjectId ? { ...p, lines: state.lines, annotations: state.annotations, updatedAt: Date.now() } : p
    );
    const next = updated.find(p => p.id === id);
    if (!next) return;
    const lines = [...next.lines];
    const annotations = [...(next.annotations ?? [])];
    const nextLabel = lines.length + 1;
    set({
      projects: updated, currentProjectId: id, lines, annotations, nextLabel,
      selectedLineId: null, referenceLineId: null,
      _history: [{ lines, nextLabel, annotations }], _historyIndex: 0,
    });
    get()._save();
  },

  deleteProject: (id) => {
    const state = get();
    const rem = state.projects.filter(p => p.id !== id);
    if (rem.length === 0) {
      set({ projects: [], currentProjectId: null, lines: [], annotations: [], nextLabel: 1, selectedLineId: null, referenceLineId: null, _history: [{ lines: [], nextLabel: 1, annotations: [] }], _historyIndex: 0 });
    } else {
      const isCur = state.currentProjectId === id;
      const newId = isCur ? rem[0].id : state.currentProjectId;
      const p = rem.find(x => x.id === newId);
      set({ projects: rem, currentProjectId: newId, lines: p?.lines ?? [], annotations: p?.annotations ?? [], nextLabel: (p?.lines.length ?? 0) + 1, selectedLineId: null, referenceLineId: null, _history: [{ lines: p?.lines ?? [], nextLabel: (p?.lines.length ?? 0) + 1, annotations: p?.annotations ?? [] }], _historyIndex: 0 });
    }
    get()._save();
  },

  renameProject: (id, name) => {
    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, name } : p) }));
    get()._save();
  },

  setProjectAttr: (id, attr) => {
    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, ...attr } : p) }));
    get()._save();
  },

  addLine: (data) => {
    const state = get();
    const line: LineData = {
      id: uid(),
      label: data.label || `L${state.nextLabel}`,
      color: data.color || COLORS[state.lines.length % COLORS.length],
      notes: data.notes || '',
      method: data.method || '',
      x1: data.x1, y1: data.y1, x2: data.x2, y2: data.y2,
      lng1: data.lng1, lat1: data.lat1, lng2: data.lng2, lat2: data.lat2,
      photos: [],
    };
    const project = state.projects.find(p => p.id === state.currentProjectId);
    if (project?.scale) {
      line.lengthMeters = (dist(data.x1, data.y1, data.x2, data.y2) / project.scale.pixels) * project.scale.meters;
    }
    set({ lines: [...state.lines, line], nextLabel: state.nextLabel + 1 });
    get()._pushHistory();
    get()._save();
  },

  updateLine: (id, data) => {
    set(s => ({ lines: s.lines.map(l => l.id === id ? { ...l, ...data } : l) }));
    get()._save();
  },

  removeLine: (id) => {
    const state = get();
    set({
      lines: state.lines.filter(l => l.id !== id),
      selectedLineId: state.selectedLineId === id ? null : state.selectedLineId,
      referenceLineId: state.referenceLineId === id ? null : state.referenceLineId,
    });
    get()._pushHistory();
    get()._save();
  },

  addAnnotation: (points) => {
    const state = get();
    const ann: AnnotationData = {
      id: uid(),
      points,
      color: COLORS[state.annotations.length % COLORS.length],
    };
    set({ annotations: [...state.annotations, ann] });
    get()._pushHistory();
    get()._save();
  },

  removeAnnotation: (id) => {
    const state = get();
    set({ annotations: state.annotations.filter(a => a.id !== id) });
    get()._save();
  },

  clearAnnotations: () => {
    set({ annotations: [] });
    get()._pushHistory();
    get()._save();
  },

  setTool: (t) => {
    set({ tool: t, referenceLineId: null, drawingStart: null });
    // Clean up any in-progress freehand state in Canvas via re-render
  },
  setSelectedLine: (id) => set({ selectedLineId: id }),
  setReferenceLine: (id) => set({ referenceLineId: id }),
  setDrawingStart: (pt) => set({ drawingStart: pt }),
  toggleSidebar: () => set(s => ({ showSidebar: !s.showSidebar })),

  undo: () => {
    const state = get();
    if (state._historyIndex > 0) {
      const i = state._historyIndex - 1;
      const snap = state._history[i];
      set({ lines: [...snap.lines], annotations: [...snap.annotations], nextLabel: snap.nextLabel, _historyIndex: i, selectedLineId: null, referenceLineId: null });
      get()._save();
    }
  },

  redo: () => {
    const state = get();
    if (state._historyIndex < state._history.length - 1) {
      const i = state._historyIndex + 1;
      const snap = state._history[i];
      set({ lines: [...snap.lines], annotations: [...snap.annotations], nextLabel: snap.nextLabel, _historyIndex: i, selectedLineId: null, referenceLineId: null });
      get()._save();
    }
  },

  setScale: (lineId, meters) => {
    const state = get();
    const line = state.lines.find(l => l.id === lineId);
    if (!line) return;
    const px = dist(line.x1, line.y1, line.x2, line.y2);
    if (px === 0) return;
    const scale: ScaleRef = { lineId, pixels: px, meters };
    const projects = state.projects.map(p =>
      p.id === state.currentProjectId ? { ...p, scale } : p
    );
    set({
      projects,
      lines: state.lines.map(l => ({
        ...l,
        lengthMeters: dist(l.x1, l.y1, l.x2, l.y2) / px * meters,
      })),
    });
    get()._save();
  },

  clearScale: () => {
    const state = get();
    const projects = state.projects.map(p =>
      p.id === state.currentProjectId ? { ...p, scale: undefined } : p
    );
    set({
      projects,
      lines: state.lines.map(l => ({ ...l, lengthMeters: undefined })),
    });
    get()._save();
  },

  setSheetSize: (widthMeters, heightMeters, viewportW?: number, viewportH?: number) => {
    const state = get();
    let scale = state.projects.find(p => p.id === state.currentProjectId)?.scale;
    if (viewportW && viewportH && viewportW > 0 && widthMeters > 0 && heightMeters > 0 && !scale) {
      const dpi = Math.min(viewportW / widthMeters, viewportH / heightMeters) * 0.85;
      scale = { lineId: '', pixels: dpi, meters: 1 };
    }
    const projects = state.projects.map(p =>
      p.id === state.currentProjectId
        ? { ...p, sheetWidth: widthMeters, sheetHeight: heightMeters, ...(scale ? { scale } : {}) }
        : p
    );
    set({ projects });
    get()._save();
  },

  addPhoto: (lineId, dataUrl, caption = '') => {
    const photo: PhotoData = { id: uid(), dataUrl, caption, timestamp: Date.now() };
    set(s => ({
      lines: s.lines.map(l =>
        l.id === lineId ? { ...l, photos: [...l.photos, photo] } : l
      ),
    }));
    get()._save();
  },

  removePhoto: (lineId, photoId) => {
    set(s => ({
      lines: s.lines.map(l =>
        l.id === lineId ? { ...l, photos: l.photos.filter(p => p.id !== photoId) } : l
      ),
    }));
    get()._save();
  },
}));
