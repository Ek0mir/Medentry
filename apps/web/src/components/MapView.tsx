import { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  label: string;
  status: 'working' | 'idle' | 'stopped' | 'offline';
}

interface Props {
  markers: MapMarker[];
  /** Harita uzerinde cizilecek gun izi. */
  track?: Array<{ lat: number; lon: number }>;
  tall?: boolean;
  onMarkerClick?: (id: string) => void;
}

const STATUS_COLOR: Record<MapMarker['status'], string> = {
  working: '#22c55e',
  idle: '#f59e0b',
  stopped: '#64748b',
  offline: '#475569',
};

function markerIcon(status: MapMarker['status'], label: string): L.DivIcon {
  const color = STATUS_COLOR[status];
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;gap:6px;transform:translate(-11px,-11px)">
      <span style="width:22px;height:22px;border-radius:50%;background:${color};
        border:3px solid #0b1220;box-shadow:0 0 0 2px ${color}55"></span>
      <span style="background:#131c2eee;border:1px solid #253453;border-radius:6px;
        padding:1px 6px;font:600 12px system-ui;color:#e8eefc;white-space:nowrap">${label}</span>
    </div>`,
    iconSize: [0, 0],
  });
}

/**
 * Leaflet haritasi.
 * OSM raster dosemesi kullanilir - anahtar gerektirmez. Uretimde kendi
 * dosem sunucunuza veya ticari bir saglayiciya gecmelisiniz (OSM kullanim
 * politikasi yogun ticari trafige izin vermez).
 */
export function MapView({ markers, track, tall, onMarkerClick }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([39.0, 35.0], 6);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (track && track.length > 1) {
      L.polyline(
        track.map((p) => [p.lat, p.lon] as [number, number]),
        { color: '#3b82f6', weight: 3, opacity: 0.75 },
      ).addTo(layer);
    }

    for (const marker of markers) {
      const m = L.marker([marker.lat, marker.lon], {
        icon: markerIcon(marker.status, marker.label),
      }).addTo(layer);
      if (onMarkerClick) m.on('click', () => onMarkerClick(marker.id));
    }

    // Ilk veri geldiginde odaklan; sonraki yenilemelerde kullanicinin
    // kaydirdigi gorunumu bozma.
    if (!fittedRef.current) {
      const points: Array<[number, number]> = [
        ...markers.map((m) => [m.lat, m.lon] as [number, number]),
        ...(track ?? []).map((p) => [p.lat, p.lon] as [number, number]),
      ];
      if (points.length === 1) {
        map.setView(points[0]!, 15);
        fittedRef.current = true;
      } else if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points).pad(0.25));
        fittedRef.current = true;
      }
    }
  }, [markers, track, onMarkerClick]);

  // Kap boyutu degistiginde (sekme gecisi) haritayi yeniden olcumle.
  useEffect(() => {
    const timer = setTimeout(() => mapRef.current?.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [tall]);

  return <div ref={containerRef} className={tall ? 'map tall' : 'map'} />;
}
