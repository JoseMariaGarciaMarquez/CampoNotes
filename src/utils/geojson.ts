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
          azimuth: line.azimuth ?? null,
          station_count: line.stationCount ?? null,
          station_spacing_m: line.stationSpacing ?? null,
          terrain: line.terrain ?? null,
          topography: line.topography ?? null,
          elevation_m: line.elevation ?? null,
          depth_m: line.depth ?? null,
          frequency_range: line.frequencyRange ?? null,
          time_window: line.timeWindow ?? null,
          stacks: line.stackCount ?? null,
          survey_mode: line.surveyMode ?? null,
          antenna_freq: line.antennaFreq ?? null,
        },
      };
    }),
  };
}

export function exportCampoJSON(project: Project): object {
  return {
    _context: {
      app: "CampoNotes",
      version: "0.3.0",
      description: "Exportación completa de proyecto de campo geofísico. Contiene toda la información capturada por el operador en campo.",
      fields: {
        project: {
          name: "Nombre del proyecto",
          client: "Nombre del cliente",
          objective: "Objetivo del levantamiento",
          operator: "Nombre del operador",
          date: "Fecha del levantamiento",
          equipment: "Equipo utilizado (ej: SuperSting R8, Geode, Tromino)",
          weather: "Condiciones climáticas",
          location: "Nombre del sitio o ubicación",
          municipality: "Municipio",
          state: "Estado / entidad federativa",
          sheet_width_height_m: "Dimensiones de la hoja de dibujo en metros",
          scale: "Referencia de escala (línea base, píxeles, metros)",
        },
        line: {
          label: "Identificador de la línea (L1, L2, ...)",
          method: "Método de exploración: tre, masw, hv, gpr",
          notes: "Notas de campo del operador",
          azimuth: "Orientación de la línea en grados (0-360)",
          elevation_m: "Elevación del punto inicial en metros sobre el nivel del mar",
          station_count: "Número de estaciones o electrodos",
          station_spacing_m: "Separación entre estaciones en metros",
          terrain: "Tipo de terreno (arcilloso, arenoso, rocoso, etc.)",
          topography: "Descripción de la topografía (plana, con ladera, etc.)",
          depth_m: "Profundidad máxima de investigación",
          gps_start: "Coordenadas GPS del punto inicial (WGS84)",
          gps_end: "Coordenadas GPS del punto final (WGS84)",
          length_m: "Longitud de la línea en metros",
          frequency_range: "Rango de frecuencias (ej: 0.5-20 Hz para H/V)",
          time_window: "Ventana de tiempo (ej: 1024 ms para TRE/MASW)",
          stacks: "Número de apilamientos (stacks)",
          survey_mode: "Modo de adquisición (Reflexión, CMP, etc.)",
          antenna_freq: "Frecuencia de antena GPR (ej: 100 MHz, 400 MHz)",
          photos: "Fotos tomadas en campo (metadata)",
        },
      },
    },
    project: {
      name: project.name,
      client: project.client ?? null,
      objective: project.objective ?? null,
      operator: project.operator ?? null,
      date: project.date ?? null,
      equipment: project.equipment ?? null,
      weather: project.weather ?? null,
      location: project.location ?? null,
      municipality: project.municipality ?? null,
      state: project.state ?? null,
      sheet_width_m: project.sheetWidth ?? null,
      sheet_height_m: project.sheetHeight ?? null,
      scale: project.scale ? {
        line_id: project.scale.lineId,
        pixels: project.scale.pixels,
        meters: project.scale.meters,
      } : null,
      total_lines: project.lines.length,
      total_length_m: project.lines.reduce((sum, l) => sum + (l.lengthMeters ?? 0), 0),
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    },
    lines: project.lines.map(line => ({
      id: line.id,
      label: line.label,
      method: line.method || null,
      notes: line.notes,
      azimuth: line.azimuth ?? null,
      elevation_m: line.elevation ?? null,
      station_count: line.stationCount ?? null,
      station_spacing_m: line.stationSpacing ?? null,
      terrain: line.terrain ?? null,
      topography: line.topography ?? null,
      depth_m: line.depth ?? null,
      gps_start: line.lat1 != null ? { lat: line.lat1, lng: line.lng1 } : null,
      gps_end: line.lat2 != null ? { lat: line.lat2, lng: line.lng2 } : null,
      length_m: line.lengthMeters ?? null,
      frequency_range: line.frequencyRange ?? null,
      time_window: line.timeWindow ?? null,
      stacks: line.stackCount ?? null,
      survey_mode: line.surveyMode ?? null,
      antenna_freq: line.antennaFreq ?? null,
      canvas: {
        x1: line.x1, y1: line.y1,
        x2: line.x2, y2: line.y2,
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
