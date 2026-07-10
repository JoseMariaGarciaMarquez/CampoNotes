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
  azimuth?: number;
  stationCount?: number;
  stationSpacing?: number;
  terrain?: string;
  topography?: string;
  elevation?: number;
  frequencyRange?: string;
  timeWindow?: string;
  stackCount?: string;
  surveyMode?: string;
  antennaFreq?: string;
  depth?: string;
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
  client?: string;
  objective?: string;
  location?: string;
  municipality?: string;
  state?: string;
  sheetWidth?: number;
  sheetHeight?: number;
  createdAt: number;
  updatedAt: number;
}
