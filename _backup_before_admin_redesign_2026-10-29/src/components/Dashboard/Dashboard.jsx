import React, { useState, useEffect } from 'react';
import { 
  Car, 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  MapPin, 
  DollarSign,
  Activity,
  Clock
} from 'lucide-react';
import { driverService, vehicleService, sosService, rideFareService, fareRateService } from '../../services/api';
import LiveTrackingMap from '../Maps/LiveTrackingMap';

const Dashboard = ({ setActiveTab }) => {
  const [stats, setStats] = useState({
    totalDrivers: 0,
    totalVehicles: 0,
    activeAlerts: 0,
    todayRides: 0,
    currentFareRate: 12.0,
    totalRevenue: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backgroundRefresh, setBackgroundRefresh] = useState(false); // NEW: For background updates

  useEffect(() => {
    // Initial data load
    fetchDashboardData(true); // true = initial load
    
    // Set up background refresh (no loader)
    const interval = setInterval(() => {
      fetchDashboardData(false); // false = background refresh
    }, 60000); // Changed to 60 seconds (1 minute) instead of 30
    
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async (isInitialLoad = false) => {
    try {
      // Only show loader on initial load, not background refreshes
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setBackgroundRefresh(true);
      }
      
      // Fetch all data in parallel
      const [
        driversResponse,
        vehiclesResponse, 
        alertsResponse,
        ridesResponse,
        fareRateResponse
      ] = await Promise.all([
        driverService.getAllDrivers().catch(() => ({ data: [] })),
        vehicleService.getAllVehicles().catch(() => ({ data: [] })),
        sosService.getActiveAlerts().catch(() => ({ data: [] })),
        rideFareService.getRecentRides().catch(() => ({ data: [] })),
        fareRateService.getCurrentRate().catch(() => ({ data: { fare_rate: 12.0 } }))
      ]);

      const rides = ridesResponse.data;
      const todayRides = rides.filter(ride => {
        const rideDate = new Date(ride.receivedAt);
        const today = new Date();
        return rideDate.toDateString() === today.toDateString();
      });

      const totalRevenue = todayRides.reduce((sum, ride) => sum + (ride.fareAmount || 0), 0);

      setStats({
        totalDrivers: driversResponse.data.length,
        totalVehicles: vehiclesResponse.data.length,
        activeAlerts: alertsResponse.data.length,
        todayRides: todayRides.length,
        currentFareRate: fareRateResponse.data.fare_rate,
        totalRevenue: totalRevenue
      });

      // Set active alerts for the map
      setActiveAlerts(alertsResponse.data);

      // Set recent activity
      const activities = [
        ...todayRides.slice(0, 3).map(ride => ({
          id: ride.id,
          type: 'ride',
          message: `Ride completed by ${ride.driverId} - ₹${ride.fareAmount}`,
          timestamp: ride.receivedAt,
          icon: '🚗'
        })),
        ...alertsResponse.data.slice(0, 2).map(alert => ({
          id: alert.id,
          type: 'alert',
          message: `SOS Alert from ${alert.driverId || alert.driver_id} at ${alert.latitude}, ${alert.longitude}`,
          timestamp: alert.timestamp,
          icon: '🚨'
        }))
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);

      setRecentActivity(activities);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setBackgroundRefresh(false);
      }
    }
  };

  // Manual refresh function
  const handleManualRefresh = () => {
    fetchDashboardData(true);
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, color, onClick }) => (
    <div 
      className={`bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow ${onClick ? 'hover:bg-gray-50' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center">
        <div className={`flex-shrink-0 ${color}`}>
          <Icon className="h-8 w-8" />
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">
              {title}
            </dt>
            <dd className="text-lg font-medium text-gray-900">
              {value}
            </dd>
            {subtitle && (
              <dd className="text-sm text-gray-600">
                {subtitle}
              </dd>
            )}
          </dl>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-lg text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Ricky Autometer Dashboard
        </h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <Activity className="h-5 w-5 text-green-500" />
            <span className="text-sm text-green-600 font-medium">
              {backgroundRefresh ? 'Updating...' : 'System Online'}
            </span>
          </div>
          <button 
            onClick={handleManualRefresh}
            className="btn-secondary text-sm"
            disabled={backgroundRefresh}
          >
            <Activity className={`h-4 w-4 mr-1 ${backgroundRefresh ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Users}
          title="Total Drivers"
          value={stats.totalDrivers}
          subtitle="Registered drivers"
          color="text-blue-600"
          onClick={() => setActiveTab('drivers')}
        />
        <StatCard
          icon={Car}
          title="Total Vehicles"
          value={stats.totalVehicles}
          subtitle="Active autometers"
          color="text-green-600"
          onClick={() => setActiveTab('vehicles')}
        />
        <StatCard
          icon={AlertTriangle}
          title="Active Alerts"
          value={stats.activeAlerts}
          subtitle={stats.activeAlerts > 0 ? "Requires attention" : "All clear"}
          color={stats.activeAlerts > 0 ? "text-red-600" : "text-green-600"}
          onClick={() => setActiveTab('sos')}
        />
        <StatCard
          icon={TrendingUp}
          title="Today's Rides"
          value={stats.todayRides}
          subtitle={`Revenue: ₹${stats.totalRevenue.toFixed(2)}`}
          color="text-purple-600"
          onClick={() => setActiveTab('fares')}
        />
      </div>

      {/* Live Vehicle Tracking Map */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-blue-600" />
          Live Vehicle Tracking
        </h3>
        <div className="h-96 rounded-lg overflow-hidden">
          <LiveTrackingMap 
            vehicles={[]} 
            sosAlerts={activeAlerts}
          />
        </div>
      </div>

      {/* Current Fare Rate & Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Current Fare Rate</h3>
            <DollarSign className="h-6 w-6 text-green-600" />
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">
              ₹{stats.currentFareRate}/km
            </div>
            <p className="text-gray-600">Active across all autometers</p>
            <button 
              onClick={() => setActiveTab('settings')}
              className="mt-4 btn-primary text-sm"
            >
              Update Rate
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Today's Revenue</h3>
            <TrendingUp className="h-6 w-6 text-purple-600" />
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">
              ₹{stats.totalRevenue.toFixed(2)}
            </div>
            <p className="text-gray-600">From {stats.todayRides} completed rides</p>
            <button 
              onClick={() => setActiveTab('autometer')}
              className="mt-4 btn-secondary text-sm"
            >
              View Details
            </button>
          </div>
        </div>
      </div>

      {/* Emergency Alerts Section */}
      {stats.activeAlerts > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2 animate-pulse" />
              <h3 className="text-lg font-semibold text-red-800">
                Active Emergency Alerts ({stats.activeAlerts})
              </h3>
            </div>
            <button 
              onClick={() => setActiveTab('sos')}
              className="btn-danger text-sm"
            >
              View All Alerts
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeAlerts.slice(0, 3).map((alert) => (
              <div key={alert.id} className="bg-white border border-red-300 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium text-red-800">
                    🚨 {alert.driverId || alert.driver_id}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </div>
                
                <div className="text-sm text-gray-700 mb-3">
                  <div className="flex items-center mb-1">
                    <MapPin className="h-4 w-4 mr-1" />
                    {alert.latitude?.toFixed(6)}, {alert.longitude?.toFixed(6)}
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
                
                <button
                  onClick={() => setActiveTab('sos')}
                  className="w-full btn-outline text-sm"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
          
          {activeAlerts.length > 3 && (
            <div className="text-center mt-4">
              <button 
                onClick={() => setActiveTab('sos')}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                View {activeAlerts.length - 3} more alerts →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Clock className="h-5 w-5 text-gray-400" />
          </div>
        </div>
        <div className="px-6 py-4">
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No recent activity
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center space-x-4">
                  <div className="text-2xl">{activity.icon}</div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.message}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button 
            onClick={() => setActiveTab('drivers')}
            className="btn-outline flex items-center justify-center py-3"
          >
            <Users className="h-5 w-5 mr-2" />
            Manage Drivers
          </button>
          <button 
            onClick={() => setActiveTab('vehicles')}
            className="btn-outline flex items-center justify-center py-3"
          >
            <Car className="h-5 w-5 mr-2" />
            Manage Vehicles
          </button>
          <button 
            onClick={() => setActiveTab('sos')}
            className="btn-outline flex items-center justify-center py-3"
          >
            <AlertTriangle className="h-5 w-5 mr-2" />
            SOS Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className="btn-outline flex items-center justify-center py-3"
          >
            <DollarSign className="h-5 w-5 mr-2" />
            Fare Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;