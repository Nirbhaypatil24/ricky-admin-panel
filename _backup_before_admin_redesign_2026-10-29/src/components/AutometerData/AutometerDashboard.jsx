import React, { useState, useEffect } from 'react';
import { Activity, MapPin, DollarSign, Clock, TrendingUp, Users } from 'lucide-react';
import { rideFareService, driverService } from '../../services/api';

const AutometerDashboard = () => {
  const [recentRides, setRecentRides] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRides: 0,
    totalRevenue: 0,
    activeDrivers: 0,
    averageRideValue: 0
  });

  useEffect(() => {
    fetchData();
    
    // Set up real-time updates
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [ridesResponse, driversResponse] = await Promise.all([
        rideFareService.getRecentRides(),
        driverService.getAllDrivers()
      ]);

      const rides = ridesResponse.data;
      const drivers = driversResponse.data;

      setRecentRides(rides);
      setDrivers(drivers);

      // Calculate statistics
      const totalRevenue = rides.reduce((sum, ride) => sum + (ride.fareAmount || 0), 0);
      const activeDrivers = drivers.filter(driver => driver.active).length;

      setStats({
        totalRides: rides.length,
        totalRevenue,
        activeDrivers,
        averageRideValue: rides.length > 0 ? totalRevenue / rides.length : 0
      });

    } catch (error) {
      console.error('Error fetching autometer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitTestRide = async () => {
    try {
      const testRide = {
        rideId: `TEST-RIDE-${Date.now()}`,
        driverId: `DRIVER-${Math.floor(Math.random() * 100)}`,
        passengerId: `PASS-${Math.floor(Math.random() * 1000)}`,
        startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        endTime: new Date().toISOString(),
        startLatitude: 28.6139 + (Math.random() - 0.5) * 0.01,
        startLongitude: 77.2090 + (Math.random() - 0.5) * 0.01,
        endLatitude: 28.6519 + (Math.random() - 0.5) * 0.01,
        endLongitude: 77.2315 + (Math.random() - 0.5) * 0.01,
        distanceKm: Math.random() * 10 + 1,
        fareAmount: Math.random() * 200 + 50,
        fareRate: 25.0
      };

      await rideFareService.submitRideData(testRide);
      alert('Test ride data submitted successfully');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error submitting test ride:', error);
      alert('Failed to submit test ride data');
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const StatCard = ({ title, value, subtitle, icon: Icon, color = "text-blue-600" }) => (
    <div className="bg-white rounded-lg shadow p-6">
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
    return <div className="flex justify-center py-8">Loading autometer data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Autometer Data Dashboard</h2>
        <div className="flex space-x-3">
          <button
            onClick={submitTestRide}
            className="btn-outline"
          >
            Submit Test Ride
          </button>
          <button
            onClick={fetchData}
            className="btn-secondary flex items-center"
          >
            <Activity className="h-4 w-4 mr-2" />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Rides"
          value={stats.totalRides}
          subtitle="All time"
          icon={Activity}
          color="text-blue-600"
        />
        <StatCard
          title="Total Revenue"
          value={`₹${stats.totalRevenue.toFixed(2)}`}
          subtitle="From all rides"
          icon={DollarSign}
          color="text-green-600"
        />
        <StatCard
          title="Active Drivers"
          value={stats.activeDrivers}
          subtitle="Currently registered"
          icon={Users}
          color="text-purple-600"
        />
        <StatCard
          title="Avg Ride Value"
          value={`₹${stats.averageRideValue.toFixed(2)}`}
          subtitle="Per ride"
          icon={TrendingUp}
          color="text-orange-600"
        />
      </div>

      {/* Real-time Data Simulation */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Activity className="h-5 w-5 mr-2 text-blue-600" />
          Live Autometer Data Stream
        </h3>
        
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
          <div className="space-y-1">
            <div>🚗 Autometer Network Status: ONLINE</div>
            <div>📡 Connected Devices: {stats.activeDrivers} autometers</div>
            <div>📊 Data Stream: {stats.totalRides} ride records received</div>
            <div>💰 Total Revenue Processed: ₹{stats.totalRevenue.toFixed(2)}</div>
            <div className="animate-pulse">⚡ Real-time updates: ACTIVE</div>
          </div>
        </div>
      </div>

      {/* Recent Ride Data */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Clock className="h-5 w-5 mr-2 text-gray-600" />
          Recent Ride Data from Autometers
        </h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ride ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Route Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Distance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fare
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Received
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentRides.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    No ride data received from autometers
                  </td>
                </tr>
              ) : (
                recentRides.slice(0, 10).map((ride) => (
                  <tr key={ride.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {ride.rideId || ride.id}
                      </div>
                      <div className="text-xs text-gray-500">
                        Passenger: {ride.passengerId}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{ride.driverId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="flex items-center text-green-600 mb-1">
                          <MapPin className="h-3 w-3 mr-1" />
                          {ride.startLatitude?.toFixed(4)}, {ride.startLongitude?.toFixed(4)}
                        </div>
                        <div className="flex items-center text-red-600">
                          <MapPin className="h-3 w-3 mr-1" />
                          {ride.endLatitude?.toFixed(4)}, {ride.endLongitude?.toFixed(4)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {ride.distanceKm?.toFixed(1)} km
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ₹{ride.fareAmount}
                      </div>
                      <div className="text-xs text-gray-500">
                        @ ₹{ride.fareRate}/km
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDateTime(ride.receivedAt)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Autometer Network Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Network Health</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm text-green-800">Data Reception Rate</span>
              <span className="text-green-600 font-medium">98.5%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-800">Active Connections</span>
              <span className="text-blue-600 font-medium">{stats.activeDrivers}/100</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
              <span className="text-sm text-purple-800">Data Processing</span>
              <span className="text-purple-600 font-medium">Real-time</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentRides.slice(0, 5).map((ride) => (
              <div key={ride.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                <span>Ride completed by {ride.driverId}</span>
                <span className="text-green-600 font-medium">₹{ride.fareAmount}</span>
              </div>
            ))}
            {recentRides.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                No recent activity
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutometerDashboard;
