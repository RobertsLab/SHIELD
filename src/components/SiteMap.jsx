import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { MAP_CENTER, MAP_ZOOM } from '../data/mockShellfishData';
import 'leaflet/dist/leaflet.css';

export default function SiteMap({ sites, selectedSite, onSelectSite }) {
  const bounds = useMemo(() => {
    const lats = sites.map((s) => s.lat);
    const lngs = sites.map((s) => s.lng);
    return [
      [Math.min(...lats) - 0.15, Math.min(...lngs) - 0.25],
      [Math.max(...lats) + 0.15, Math.max(...lngs) + 0.25],
    ];
  }, [sites]);

  return (
    <div className="site-map-wrapper">
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [40, 40] }}
        center={[MAP_CENTER.lat, MAP_CENTER.lng]}
        zoom={MAP_ZOOM}
        scrollWheelZoom
        className="site-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {sites.map((site) => {
          const isSelected = selectedSite === site.site;
          return (
            <CircleMarker
              key={site.site}
              center={[site.lat, site.lng]}
              radius={isSelected ? 14 : 10}
              pathOptions={{
                color: site.color,
                fillColor: site.color,
                fillOpacity: isSelected ? 0.9 : 0.65,
                weight: isSelected ? 3 : 2,
              }}
              eventHandlers={{
                click: () => onSelectSite(site.site),
              }}
            >
              <Popup>
                <div className="map-popup">
                  <strong>{site.site}</strong>
                  <p className="map-popup-region">{site.region}</p>
                  <dl className="map-popup-stats">
                    <div>
                      <dt>Mean growth volume</dt>
                      <dd>{site.meanGrowth?.toLocaleString() ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Mean temp</dt>
                      <dd>{site.meanTemp} °C</dd>
                    </div>
                    <div>
                      <dt>Final survival</dt>
                      <dd>{site.finalSurvival}%</dd>
                    </div>
                  </dl>
                  <Link
                    to={`/?site=${encodeURIComponent(site.site)}`}
                    className="map-popup-link"
                  >
                    View site data →
                  </Link>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
