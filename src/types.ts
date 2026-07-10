export interface LineData {
  id: string;
  label: string;
  x1: number; y1: number;
  x2: number; y2: number;
  points?: number[];
  lng1?: number; lat1?: number;
  lng2?: number; lat2?: number;
  lengthMeters?: number;
  notes: string;
  color: string;
  method: string;
  photos: PhotoData[];
}

export interface PhotoData {
  id: string;
  dataUrl: string;
  caption: string;
  timestamp: number;
}

export interface AnnotationData {
  id: string;
  points: number[];
  color: string;
}

export interface ScaleRef {
  lineId: string;
  pixels: number;
  meters: number;
}

export type Tool = 'select' | 'draw' | 'parallel' | 'perpendicular' | 'freehand';

export interface Project {
  id: string;
  name: string;
  lines: LineData[];
  annotations: AnnotationData[];
  scale?: ScaleRef;
  operator?: string;
  date?: string;
  weather?: string;
  equipment?: string;
  sheetWidth?: number;
  sheetHeight?: number;
  createdAt: number;
  updatedAt: number;
}
