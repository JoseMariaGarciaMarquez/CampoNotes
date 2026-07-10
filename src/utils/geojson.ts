import type { LineData, Project } from '../types';
import { dist } from './geometry';

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: Record<string, any>;
}

export interface GeoJSONCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

const ORIGIN_LAT = 19.4326;
const ORIGIN_LNG = -99.1332;
const METER_PER_PX = 0.01;

function approximateLatLng(x: number, y: number, project: Project): [number, number] {
  if (project.scale) {
    const mPerPx = project.scale.meters / project.scale.pixels;
    const lng = ORIGIN_LNG + x * mPerPx * 0.00000899;
    const lat = ORIGIN_LAT - y * mPerPx * 0.00000899;
    return [lat, lng];
  }
  const lng = ORIGIN_LNG + x * METER_PER_PX * 0.00000899;
  const lat = ORIGIN_LAT - y * METER_PER_PX * 0.00000899;
  return [lat, lng];
}

export function exportGeoJSON(project: Project): GeoJSONCollection {
  return {
    type: 'FeatureCollection',
    features: project.lines.map(line => {
      let coords: [number, number][];
      if (line.lat1 != null && line.lng1 != null) {
        coords = [[line.lng1, line.lat1], [line.lng2 ?? line.lng1, line.lat2 ?? line.lat1]];
      } else {
        coords = [
          approximateLatLng(line.x1, line.y1, project),
          approximateLatLng(line.x2, line.y2, project),
        ].map(([lat, lng]) => [lng, lat]) as [number, number][];
      }
      return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {
          id: line.id,
          label: line.label,
          length_m: line.lengthMeters ?? null,
          method: line.method,
          notes: line.notes,
        },
      };
    }),
  };
}

export function exportCampoJSON(project: Project): object {
  return {
    _context: {
      app: "CampoNotes",
      version: "0.2.0",
      description: "Exportación de proyecto de campo. Cada línea representa un levantamiento (TRE, MASW, H/V, GPR, etc.) con coordenadas GPS opcionales.",
      fields: {
        line: {
          label: "Nombre o identificador de la línea",
          method: "Método de exploración (tre, masw, hv, gpr)",
          notes: "Notas de campo",
          lat1_lng1: "Coordenadas GPS del punto inicial (WGS84)",
          lat2_lng2: "Coordenadas GPS del punto final (WGS84)",
          length_m: "Longitud estimada en metros (requiere calibración de escala)",
          x1_y1_x2_y2: "Coordenadas en píxeles sobre el lienzo",
        },
        project: {
          operator: "Nombre del operador",
          date: "Fecha del levantamiento",
          equipment: "Equipo utilizado",
          weather: "Condiciones climáticas",
          sheet_width_height_m: "Dimensiones de la hoja en metros",
        },
      },
    },
    project: {
      name: project.name,
      operator: project.operator ?? null,
      date: project.date ?? null,
      equipment: project.equipment ?? null,
      weather: project.weather ?? null,
      sheet_width_m: project.sheetWidth ?? null,
      sheet_height_m: project.sheetHeight ?? null,
      scale: project.scale ? {
        line_id: project.scale.lineId,
        pixels: project.scale.pixels,
        meters: project.scale.meters,
      } : null,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    },
    lines: project.lines.map(line => ({
      id: line.id,
      label: line.label,
      method: line.method || null,
      notes: line.notes,
      gps_start: line.lat1 != null ? { lat: line.lat1, lng: line.lng1 } : null,
      gps_end: line.lat2 != null ? { lat: line.lat2, lng: line.lng2 } : null,
      length_m: line.lengthMeters ?? null,
      canvas: {
        x1: line.x1, y1: line.y1,
        x2: line.x2, y2: line.y2,
        points: line.points ?? null,
      },
      color: line.color,
      photos: line.photos.map(ph => ({
        id: ph.id,
        caption: ph.caption,
        timestamp: ph.timestamp,
      })),
    })),
  };
}

export function importGeoJSON(json: GeoJSONCollection): { x1: number; y1: number; x2: number; y2: number; lat1: number; lng1: number; lat2: number; lng2: number }[] {
  const features = json.features.filter(f => f.geometry.type === 'LineString');
  return features.map(f => {
    const coords = f.geometry.coordinates;
    const [lng1, lat1] = coords[0];
    const [lng2, lat2] = coords[coords.length - 1];
    const dx = (lng1 - ORIGIN_LNG) / 0.00000899 / 100;
    const dy = (ORIGIN_LAT - lat1) / 0.00000899 / 100;
    const dx2 = (lng2 - ORIGIN_LNG) / 0.00000899 / 100;
    const dy2 = (ORIGIN_LAT - lat2) / 0.00000899 / 100;
    return {
      x1: dx, y1: dy, x2: dx2, y2: dy2,
      lat1, lng1, lat2, lng2,
    };
  });
}

export function downloadGeoJSON(project: Project) {
  const geo = exportGeoJSON(project);
  const blob = new Blob([JSON.stringify(geo, null, 2)], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/\s+/g, '_')}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCampoJSON(project: Project) {
  const data = exportCampoJSON(project);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/\s+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function readGeoJSONFile(file: File): Promise<GeoJSONCollection> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result as string)); }
      catch (e) { reject(new Error('GeoJSON inválido')); }
    };
    reader.onerror = () => reject(new Error('Error al leer archivo'));
    reader.readAsText(file);
  });
}