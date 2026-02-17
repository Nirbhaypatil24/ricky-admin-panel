import React, { useState, useEffect } from 'react';
import { MapPin, AlertTriangle, Activity, Users } from 'lucide-react';
import LiveTrackingMap from './LiveTrackingMap';
import { sosService } from '../../services/api';

const MapDashboard = () => {
  const [sosAlerts, setSosAlerts] = useState([]);
  const [stats, setStats] = useState({
    totalVehicles: 15,
    activeVehicles: 12,
    emergencyAlerts: 2,
    offlineVehicles: 3
  });

  useEffect(() => {
    fetchSosAlerts();
    
    const interval = setInterval(fetchSosAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchSosAlerts = async () => {
    try {
      const response = await sosService.getActiveAlerts();
      setSosAlerts(response.data);
      setStats(prev => ({
        ...prev,
        emergencyAlerts: response.data.length
      }));
    } catch (error) {
      console.error('Error fetching SOS alerts:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Live Vehicle Tracking Map</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <Activity className="h-5 w-5 text-green-500 mr-2" />
            <span className="text-sm text-green-600 font-medium">Live Updates</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Rickshaws</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalVehicles}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Now</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.activeVehicles}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Emergency Alerts</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.emergencyAlerts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <MapPin className="h-8 w-8 text-gray-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Offline</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.offlineVehicles}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Map */}
      <div className="bg-white rounded-lg shadow">
        <div className="h-[600px] w-full">
          <LiveTrackingMap sosAlerts={sosAlerts} />
        </div>
      </div>
    </div>
  );
};

export default MapDashboard;
