import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Client } from '@stomp/stompjs';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icons
const rickshawIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const emergencyIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const geofenceViolationIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const LiveTrackingMap = ({
  vehicles = [],
  sosAlerts = [],
  center = [28.6139, 77.209],
}) => {
  const [mapCenter, setMapCenter] = useState(center);
  const [liveLocations, setLiveLocations] = useState({});
  const [liveVehicles, setLiveVehicles] = useState([
    {
      id: 'DRIVER-001',
      name: 'Rajesh Kumar',
      lat: 28.6139,
      lng: 77.209,
      status: 'active',
      speed: 25,
    },
    {
      id: 'DRIVER-002',
      name: 'Suresh Sharma',
      lat: 28.6519,
      lng: 77.2315,
      status: 'active',
      speed: 30,
    },
    {
      id: 'DRIVER-003',
      name: 'Amit Singh',
      lat: 28.5355,
      lng: 77.391,
      status: 'active',
      speed: 20,
    },
    {
      id: 'DRIVER-004',
      name: 'Mohan Lal',
      lat: 28.7041,
      lng: 77.1025,
      status: 'emergency',
      speed: 0,
    },
  ]);

  const mapRef = useRef();
  const stompClientRef = useRef(null);

  useEffect(() => {
    connectStomp();
    const cleanupSim = simulateRealTimeUpdates();

    return () => {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
      }
      cleanupSim();
    };
  }, []);

  const connectStomp = () => {
    const wsUrl = 'wss://ec2-13-220-53-209.compute-1.amazonaws.com/ws-ricky';

    const client = new Client({
      webSocketFactory: () => new WebSocket(wsUrl),
      reconnectDelay: 5000,
      debug: () => {}, // disable console spam
    });

    client.onConnect = () => {
      console.log('STOMP connected to /ws-ricky');

      client.subscribe('/topic/sos-alerts', (message) => {
        try {
          const data = JSON.parse(message.body);

          if (data.driverId) {
            setLiveLocations((prev) => ({
              ...prev,
              [data.driverId]: {
                lat: data.latitude,
                lng: data.longitude,
                insideGeofence: data.insideGeofence,
                timestamp: data.timestamp,
              },
            }));
          }
        } catch (err) {
          console.error('Error parsing STOMP message', err);
        }
      });
    };

    client.onStompError = (frame) => {
      console.error('STOMP error', frame.headers['message']);
    };

    client.onWebSocketError = (event) => {
      console.error('WebSocket error', event);
    };

    client.activate();
    stompClientRef.current = client;
  };

  const simulateRealTimeUpdates = () => {
    const interval = setInterval(() => {
      setLiveVehicles((prev) =>
        prev.map((vehicle) => {
          if (vehicle.status === 'emergency') return vehicle;

          const live = liveLocations[vehicle.id];
          if (live) {
            return {
              ...vehicle,
              lat: live.lat,
              lng: live.lng,
            };
          }

          return {
            ...vehicle,
            lat: vehicle.lat + (Math.random() - 0.5) * 0.001,
            lng: vehicle.lng + (Math.random() - 0.5) * 0.001,
            speed: Math.floor(Math.random() * 40) + 10,
          };
        })
      );
    }, 3000);

    return () => clearInterval(interval);
  };

  const getMarkerIcon = (vehicle, alert) => {
    if (alert && alert.type === 'GEOFENCE') return geofenceViolationIcon;
    if (vehicle?.status === 'emergency' || alert) return emergencyIcon;
    return rickshawIcon;
  };

  return (
    <div className="relative h-full w-full">
      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-4">
        <div className="space-y-2">
          <div className="flex items-center text-sm">
            <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
            <span>
              Active: {liveVehicles.filter((v) => v.status === 'active').length}
            </span>
          </div>
          <div className="flex items-center text-sm">
            <div className="w-4 h-4 bg-red-500 rounded-full mr-2 animate-pulse"></div>
            <span>
              Emergency:{' '}
              {liveVehicles.filter((v) => v.status === 'emergency').length +
                sosAlerts.length}
            </span>
          </div>
          <div className="flex items-center text-sm">
            <div className="w-4 h-4 bg-orange-500 rounded-full mr-2"></div>
            <span>Geofence Violations</span>
          </div>
        </div>
      </div>

      <MapContainer
        center={mapCenter}
        zoom={12}
        ref={mapRef}
        className="h-full w-full"
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        {/* Vehicle Markers */}
        {liveVehicles.map((vehicle) => {
          const relatedAlert = sosAlerts.find(
            (alert) =>
              alert.driverId === vehicle.id ||
              alert.driver_id === vehicle.id
          );

          return (
            <React.Fragment key={vehicle.id}>
              <Marker
                position={[vehicle.lat, vehicle.lng]}
                icon={getMarkerIcon(vehicle, relatedAlert)}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold text-lg">{vehicle.name}</h3>
                    <p className="text-sm text-gray-600">ID: {vehicle.id}</p>
                    <p className="text-sm">Speed: {vehicle.speed} km/h</p>
                    <p
                      className={`text-sm font-medium ${
                        vehicle.status === 'emergency'
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      Status: {vehicle.status.toUpperCase()}
                    </p>
                    {relatedAlert && relatedAlert.type === 'GEOFENCE' && (
                      <div className="mt-2 p-2 bg-orange-50 rounded text-orange-800 text-xs">
                        ⚠️ GEOFENCE VIOLATION
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>

              {(vehicle.status === 'emergency' || relatedAlert) && (
                <Circle
                  center={[vehicle.lat, vehicle.lng]}
                  radius={relatedAlert?.type === 'GEOFENCE' ? 200 : 500}
                  pathOptions={{
                    color:
                      relatedAlert?.type === 'GEOFENCE'
                        ? '#f97316'
                        : '#ef4444',
                    fillColor:
                      relatedAlert?.type === 'GEOFENCE'
                        ? '#f97316'
                        : '#ef4444',
                    fillOpacity: 0.1,
                    weight: 2,
                  }}
                  className="animate-pulse"
                />
              )}
            </React.Fragment>
          );
        })}

        {/* SOS Alert Markers */}
        {sosAlerts.map((alert) => (
          <React.Fragment key={alert.id}>
            <Marker
              position={[alert.latitude, alert.longitude]}
              icon={getMarkerIcon(null, alert)}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-red-600">
                    {alert.type === 'GEOFENCE'
                      ? '⚠️ GEOFENCE VIOLATION'
                      : '🚨 SOS ALERT'}
                  </h3>
                  <p className="text-sm">
                    Driver: {alert.driverId || alert.driver_id}
                  </p>
                  <p className="text-sm">
                    Type: {alert.type?.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                  {alert.type === 'GEOFENCE' && (
                    <div className="mt-2 text-xs bg-orange-50 p-2 rounded text-orange-800">
                      Vehicle exited authorized area
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>

            <Circle
              center={[alert.latitude, alert.longitude]}
              radius={alert.type === 'GEOFENCE' ? 200 : 300}
              pathOptions={{
                color:
                  alert.type === 'GEOFENCE' ? '#f97316' : '#dc2626',
                fillColor:
                  alert.type === 'GEOFENCE' ? '#f97316' : '#dc2626',
                fillOpacity: 0.15,
                weight: 3,
              }}
            />
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  );
};

export default LiveTrackingMap;
