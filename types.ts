
export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface MapLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  score: number;
  type: 'recommended' | 'competitor' | 'risk' | 'neutral' | 'user-data';
  description: string;
}

export interface MapPolygon {
  id: string;
  name: string;
  coordinates: number[][]; // Array of [lat, lng]
  type: 'trade-area' | 'risk-zone' | 'catchment';
  description: string;
}

export interface ChartMetric {
  name: string;
  value: number;
  category: string; // e.g., 'ROI', 'Risk', 'Cost'
}

export interface AnalysisResult {
  markdownResponse: string;
  mapCenter: { lat: number; lng: number };
  zoomLevel: number;
  locations: MapLocation[];
  polygons?: MapPolygon[]; // New field for spatial zones
  chartData: ChartMetric[];
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  image?: string; // Base64 string for multimodal input
  timestamp: Date;
  analysis?: AnalysisResult;
}

export type BasemapType = 'dark' | 'light' | 'satellite' | 'gray' | 'osm' | 'terrain';

export interface UploadedLayer {
  id: string;
  name: string;
  type: 'csv' | 'geojson' | 'arcgis';
  data: MapLocation[]; // Normalized to our format for simplicity
  rawSnippet?: string; // For AI context
  visible: boolean;
  color: string; // User defined color
  radius: number; // User defined point size
}

export interface AppState {
  messages: ChatMessage[];
  isLoading: boolean;
  isCleaning: boolean; // For "AI Cleaning" state
  currentAnalysis: AnalysisResult | null;
  activeTab: 'map' | 'data' | 'insights';
  basemap: BasemapType;
  uploadedLayers: UploadedLayer[];
  showDataManager: boolean;
  isHeatmapMode: boolean; // Toggle for heatmap visualization
}
