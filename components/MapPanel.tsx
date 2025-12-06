
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { AnalysisResult, BasemapType, UploadedLayer } from '../types';

// Fix for default Leaflet markers in React
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapPanelProps {
  analysis: AnalysisResult | null;
  basemap: BasemapType;
  uploadedLayers: UploadedLayer[];
  isHeatmapMode: boolean;
  onToggleHeatmap: () => void;
}

type DrawMode = 'none' | 'polygon' | 'rectangle';

const MapPanel: React.FC<MapPanelProps> = ({ analysis, basemap, uploadedLayers, isHeatmapMode, onToggleHeatmap }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  
  // Track previous layers to detect new uploads for auto-zoom
  const prevLayerCountRef = useRef<number>(0);
  
  // Drawing Tool State Refs
  const drawLayerRef = useRef<L.LayerGroup | null>(null);
  
  // Polygon Refs
  const isDrawingPolyRef = useRef<boolean>(false);
  const polyPointsRef = useRef<L.LatLng[]>([]);
  const tempPolylineRef = useRef<L.Polyline | null>(null);

  // Rectangle Refs
  const isDrawingRectRef = useRef<boolean>(false);
  const rectStartPointRef = useRef<L.LatLng | null>(null);
  const tempRectLayerRef = useRef<L.Rectangle | null>(null);

  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [hasShape, setHasShape] = useState(false);

  // Basemap Definitions
  const BASEMAPS = {
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    light: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    gray: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    terrain: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
  };

  // Initialize Map
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView([47.6062, -122.3321], 12);

      tileLayerRef.current = L.tileLayer(BASEMAPS.dark, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 20
      }).addTo(map);

      // Pane for heatmap/markers
      map.createPane('customMarkers');
      map.getPane('customMarkers')!.style.zIndex = '600';
      
      // Pane for Polygons (below markers)
      map.createPane('customPolygons');
      map.getPane('customPolygons')!.style.zIndex = '450';

      markersRef.current = L.layerGroup().addTo(map);
      drawLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      // --- Interaction Handlers ---

      map.on('click', (e) => {
        // Polygon Logic: Add points on click
        if (isDrawingPolyRef.current) {
            polyPointsRef.current.push(e.latlng);
            if (drawLayerRef.current) {
                // Draw temp line
                if (tempPolylineRef.current) {
                    tempPolylineRef.current.setLatLngs(polyPointsRef.current);
                } else {
                    tempPolylineRef.current = L.polyline(polyPointsRef.current, { color: '#f59e0b', dashArray: '5, 10' }).addTo(drawLayerRef.current);
                }
                // Add vertex marker
                L.circleMarker(e.latlng, { radius: 4, color: '#f59e0b', fillColor: '#fff', fillOpacity: 1 }).addTo(drawLayerRef.current);
            }
        }
      });

      map.on('dblclick', () => {
         if (isDrawingPolyRef.current) finishPolygon();
      });

      // Rectangle Logic: Drag to draw
      map.on('mousedown', (e) => {
          if (isDrawingRectRef.current) {
              map.dragging.disable(); // Disable map pan while drawing rect
              rectStartPointRef.current = e.latlng;
          }
      });

      map.on('mousemove', (e) => {
          if (isDrawingRectRef.current && rectStartPointRef.current && drawLayerRef.current) {
              const bounds = L.latLngBounds(rectStartPointRef.current, e.latlng);
              if (tempRectLayerRef.current) {
                  tempRectLayerRef.current.setBounds(bounds);
              } else {
                  tempRectLayerRef.current = L.rectangle(bounds, { color: '#f59e0b', weight: 1, dashArray: '5, 5' }).addTo(drawLayerRef.current);
              }
          }
      });

      map.on('mouseup', (e) => {
          if (isDrawingRectRef.current && rectStartPointRef.current) {
              finishRectangle(e.latlng);
              map.dragging.enable();
          }
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // --- Drawing Logic ---

  const finishPolygon = () => {
      if (!drawLayerRef.current || polyPointsRef.current.length < 3) return;
      
      // Clear temp
      drawLayerRef.current.clearLayers();
      
      const polygon = L.polygon(polyPointsRef.current, {
          color: '#f59e0b',
          fillColor: '#f59e0b',
          fillOpacity: 0.2,
          weight: 2
      }).addTo(drawLayerRef.current);
      
      polygon.bindPopup("Custom Region (Polygon)");
      
      resetDrawState(true);
  };

  const finishRectangle = (endLatLng: L.LatLng) => {
      if (!drawLayerRef.current || !rectStartPointRef.current) return;

      const bounds = L.latLngBounds(rectStartPointRef.current, endLatLng);
      drawLayerRef.current.clearLayers(); // Clear temp dash box

      const rect = L.rectangle(bounds, {
          color: '#f59e0b',
          fillColor: '#f59e0b',
          fillOpacity: 0.2,
          weight: 2
      }).addTo(drawLayerRef.current);
      
      rect.bindPopup("Custom Region (Rectangle)");

      resetDrawState(true);
  };

  const resetDrawState = (shapeCreated: boolean) => {
      isDrawingPolyRef.current = false;
      isDrawingRectRef.current = false;
      polyPointsRef.current = [];
      rectStartPointRef.current = null;
      tempPolylineRef.current = null;
      tempRectLayerRef.current = null;
      
      setDrawMode('none');
      setHasShape(shapeCreated);
      
      if (mapInstanceRef.current) {
          mapInstanceRef.current.dragging.enable();
      }
  };

  const startDrawing = (mode: DrawMode) => {
      // Clear existing if starting new
      if (hasShape) {
          drawLayerRef.current?.clearLayers();
          setHasShape(false);
      }
      
      // Toggle off if same mode clicked
      if (drawMode === mode) {
          resetDrawState(false);
          return;
      }

      setDrawMode(mode);
      if (mode === 'polygon') {
          isDrawingPolyRef.current = true;
          isDrawingRectRef.current = false;
      } else if (mode === 'rectangle') {
          isDrawingPolyRef.current = false;
          isDrawingRectRef.current = true;
      }
  };

  const clearShape = () => {
      drawLayerRef.current?.clearLayers();
      resetDrawState(false);
  };

  // --- Effects ---

  useEffect(() => {
    if (tileLayerRef.current && mapInstanceRef.current) {
      tileLayerRef.current.setUrl(BASEMAPS[basemap]);
    }
  }, [basemap]);

  // Auto Zoom
  useEffect(() => {
    if (uploadedLayers.length > prevLayerCountRef.current && mapInstanceRef.current) {
        const newestLayer = uploadedLayers[uploadedLayers.length - 1];
        if (newestLayer.data.length > 0) {
            const bounds = L.latLngBounds(newestLayer.data.map(d => [d.lat, d.lng]));
            if (bounds.isValid()) {
                mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
            }
        }
    }
    prevLayerCountRef.current = uploadedLayers.length;
  }, [uploadedLayers]);

  // Render Data
  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current) return;

    const markers = markersRef.current;
    markers.clearLayers();

    const addMarker = (lat: number, lng: number, type: string, score: number, name: string, colorOverride?: string, radiusOverride?: number) => {
        let color = colorOverride || '#3b82f6'; 
        let radius = radiusOverride || 8;
        let zIndexOffset = 0;
        let className = '';

        if (!colorOverride) {
            if (type === 'recommended') { color = '#22c55e'; radius = 12; zIndexOffset = 1000; className = 'pulse-animation'; } // green
            if (type === 'risk') { color = '#ef4444'; zIndexOffset = 500; } // red
            if (type === 'competitor') { color = '#f59e0b'; zIndexOffset = 800; } // amber
        }

        if (isHeatmapMode) {
            const heatMarker = L.circleMarker([lat, lng], {
                radius: 35,
                fillColor: color,
                color: 'transparent',
                weight: 0,
                opacity: 0,
                fillOpacity: 0.4,
                className: 'heatmap-blob'
            });
            markers.addLayer(heatMarker);
        } else {
            const circleMarker = L.circleMarker([lat, lng], {
                radius: radius + (score / 25), 
                fillColor: color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9,
                className: className,
                zIndexOffset: zIndexOffset
            });

            const popupContent = `
                <div class="font-sans text-center min-w-[150px]">
                    <h3 class="font-extrabold text-2xl text-slate-800 tracking-tight leading-none">${name}</h3>
                    ${type === 'recommended' ? '<span class="inline-block mt-2 px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-bold uppercase tracking-wide">Top Pick</span>' : ''}
                    ${type === 'competitor' ? '<span class="inline-block mt-2 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wide">Competitor</span>' : ''}
                    ${type === 'risk' ? '<span class="inline-block mt-2 px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wide">Risk Area</span>' : ''}
                </div>
            `;
            circleMarker.bindPopup(popupContent, { closeButton: false, className: 'custom-popup' });
            markers.addLayer(circleMarker);
        }
    };

    if (analysis) {
        const sortedLocs = [...analysis.locations].sort((a, b) => {
             const typeScore = (t: string) => t === 'recommended' ? 3 : t === 'competitor' ? 2 : 1;
             return typeScore(a.type) - typeScore(b.type);
        });
        sortedLocs.forEach(loc => addMarker(loc.lat, loc.lng, loc.type, loc.score, loc.name));

        if (analysis.polygons && !isHeatmapMode) {
            analysis.polygons.forEach(poly => {
                if (poly.coordinates && poly.coordinates.length > 2) {
                     const color = poly.type === 'risk-zone' ? '#ef4444' : poly.type === 'trade-area' ? '#3b82f6' : '#a855f7';
                     const polygonLayer = L.polygon(poly.coordinates as L.LatLngExpression[], {
                         color: color,
                         fillColor: color,
                         fillOpacity: 0.15,
                         weight: 2,
                         dashArray: poly.type === 'catchment' ? '5, 5' : undefined,
                         pane: 'customPolygons'
                     });
                     polygonLayer.bindPopup(`
                        <div class="font-sans">
                            <h4 class="font-bold text-slate-800">${poly.name}</h4>
                            <p class="text-xs text-slate-600">${poly.description}</p>
                        </div>
                     `);
                     markers.addLayer(polygonLayer);
                }
            });
        }
    }

    uploadedLayers.forEach(layer => {
        if (!layer.visible) return;
        layer.data.forEach(item => {
            addMarker(item.lat, item.lng, 'user-data', 0, item.name, layer.color, layer.radius);
        });
    });

  }, [analysis, uploadedLayers, isHeatmapMode]); 

  // Fly to
  useEffect(() => {
      if (analysis && mapInstanceRef.current && prevLayerCountRef.current === uploadedLayers.length) {
         if(analysis.mapCenter.lat !== 0 || analysis.mapCenter.lng !== 0) {
            mapInstanceRef.current.flyTo([analysis.mapCenter.lat, analysis.mapCenter.lng], analysis.zoomLevel, { duration: 1.5 });
         }
      }
  }, [analysis]);

  return (
    <div className="relative w-full h-full bg-slate-800 rounded-lg overflow-hidden shadow-2xl border border-slate-700">
       <div ref={mapContainerRef} className="w-full h-full z-0" />
       
       <style>{`
         @keyframes pulse-ring { 0% { transform: scale(0.33); opacity: 0.8; } 80%, 100% { opacity: 0; } }
         .heatmap-blob { filter: blur(15px); mix-blend-mode: screen; }
         .leaflet-popup-content-wrapper { border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2); padding: 0; overflow: hidden; }
         .leaflet-popup-content { margin: 16px 20px; }
         .leaflet-popup-tip { background: white; }
       `}</style>

       {/* Widget Controls: Drawing + Heatmap */}
       <div className="absolute top-4 left-14 z-[400] flex flex-col gap-2">
           {/* Polygon Tool */}
           <button 
             onClick={() => startDrawing('polygon')}
             className={`p-2 rounded shadow-lg border border-slate-600 transition-all ${
                 drawMode === 'polygon' ? 'bg-amber-500 text-white animate-pulse' : 'bg-white text-slate-700 hover:bg-slate-100'
             }`}
             title="Draw Polygon (ROI)"
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clipRule="evenodd" />
             </svg>
           </button>

           {/* Rectangle Tool */}
           <button 
             onClick={() => startDrawing('rectangle')}
             className={`p-2 rounded shadow-lg border border-slate-600 transition-all ${
                 drawMode === 'rectangle' ? 'bg-amber-500 text-white animate-pulse' : 'bg-white text-slate-700 hover:bg-slate-100'
             }`}
             title="Draw Rectangle (Box Select)"
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
               <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
             </svg>
           </button>

           {/* Heatmap Widget Toggle */}
           <button
             onClick={onToggleHeatmap}
             className={`p-2 rounded shadow-lg border border-slate-600 transition-all ${
                 isHeatmapMode ? 'bg-orange-500 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
             }`}
             title="Toggle Heatmap"
           >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
           </button>

           {/* Clear Button */}
           {hasShape && (
               <button 
                 onClick={clearShape}
                 className="p-2 rounded shadow-lg border border-slate-600 bg-red-500 text-white hover:bg-red-600 transition-all"
                 title="Clear Drawings"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                 </svg>
               </button>
           )}
       </div>

       {/* Legend */}
       <div className="absolute bottom-6 right-4 z-[400] bg-white/95 p-4 rounded-xl backdrop-blur border border-slate-200 text-xs shadow-2xl text-slate-800 pointer-events-none">
          <h4 className="font-bold text-slate-900 mb-3 text-sm uppercase tracking-wide">Analysis Legend</h4>
          <div className="flex items-center gap-3 mb-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="font-semibold">Recommended Site</span>
          </div>
          <div className="flex items-center gap-3 mb-2"><div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm"></div> Competitor</div>
          <div className="flex items-center gap-3 mb-2"><div className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></div> High Risk</div>
          <div className="flex items-center gap-3 mb-2 border-t border-slate-200 pt-2"><div className="w-3 h-3 bg-blue-500/30 border border-blue-500"></div> Trade Area / ROI</div>
          {uploadedLayers.map((layer) => layer.visible && (
             <div key={layer.id} className="flex items-center gap-3 border-t border-slate-200 pt-2 mt-2">
                 <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: layer.color }}></div> 
                 {layer.name}
             </div>
          ))}
       </div>
    </div>
  );
};

export default MapPanel;
