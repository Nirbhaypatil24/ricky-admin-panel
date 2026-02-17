import React, { useState, useEffect } from 'react';
import { Plus, Search, MapPin, Clock, User, DollarSign, Filter } from 'lucide-react';
import { rideFareService, driverService } from '../../services/api';

const FaresList = () => {
  const [rides, setRides] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [stats, setStats] = useState({
    totalRides: 0,
    totalRevenue: 0,
    averageFare: 0,
    averageDistance: 0
  });

  useEffect(() => {
    fetchRides();
    fetchDrivers();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [rides]);

  const fetchRides = async () => {
    try {
      setLoading(true);
      const response = await rideFareService.getRecentRides();
      setRides(response.data);
    } catch (error) {
      console.error('Error fetching rides:', error);
      alert('Failed to fetch ride data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const response = await driverService.getAllDrivers();
      setDrivers(response.data);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    }
  };

  const fetchRidesByDriver = async (driverId) => {
    if (!driverId) {
      fetchRides();
      return;
    }

    try {
      setLoading(true);
      const response = await rideFareService.getRidesByDriver(driverId);
      setRides(response.data);
    } catch (error) {
      console.error('Error fetching rides by driver:', error);
      alert('Failed to fetch driver rides');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    if (rides.length === 0) {
      setStats({ totalRides: 0, totalRevenue: 0, averageFare: 0, averageDistance: 0 });
      return;
    }

    const totalRevenue = rides.reduce((sum, ride) => sum + (ride.fareAmount || 0), 0);
    const totalDistance = rides.reduce((sum, ride) => sum + (ride.distanceKm || 0), 0);

    setStats({
      totalRides: rides.length,
      totalRevenue,
      averageFare: totalRevenue / rides.length,
      averageDistance: totalDistance / rides.length
    });
  };

  const filterRidesByDate = (rides) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    return rides.filter(ride => {
      const rideDate = new Date(ride.receivedAt);
      
      switch (dateFilter) {
        case 'today':
          return rideDate >= today;
        case 'yesterday':
          return rideDate >= yesterday && rideDate < today;
        case 'week':
          return rideDate >= weekAgo;
        default:
          return true;
      }
    });
  };

  const filteredRides = filterRidesByDate(rides);

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
    return <div className="flex justify-center py-8">Loading ride data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Ride Fare Data</h2>
        <button
          onClick={fetchRides}
          className="btn-secondary flex items-center"
        >
          <Search className="h-4 w-4 mr-2" />
          Refresh Data
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Rides"
          value={stats.totalRides}
          icon={User}
          color="text-blue-600"
        />
        <StatCard
          title="Total Revenue"
          value={`₹${stats.totalRevenue.toFixed(2)}`}
          icon={DollarSign}
          color="text-green-600"
        />
        <StatCard
          title="Average Fare"
          value={`₹${stats.averageFare.toFixed(2)}`}
          subtitle="per ride"
          icon={DollarSign}
          color="text-purple-600"
        />
        <StatCard
          title="Average Distance"
          value={`${stats.averageDistance.toFixed(1)} km`}
          subtitle="per ride"
          icon={MapPin}
          color="text-orange-600"
        />
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="sm:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Driver
            </label>
            <select
              value={selectedDriver}
              onChange={(e) => {
                setSelectedDriver(e.target.value);
                fetchRidesByDriver(e.target.value);
              }}
              className="form-input"
            >
              <option value="">All Drivers</option>
              {drivers.map((driver) => (
                <option key={driver.driverId} value={driver.driverId}>
                  {driver.driverName}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Period
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="form-input"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Last 7 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rides Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ride Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Route
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Distance & Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fare
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRides.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    {dateFilter !== 'all' ? 'No rides found for selected time period' : 'No ride data available'}
                  </td>
                </tr>
              ) : (
                filteredRides.map((ride) => (
                  <tr key={ride.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {ride.rideId || ride.id}
                        </div>
                        <div className="text-gray-500">
                          Passenger: {ride.passengerId || 'Unknown'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">{ride.driverId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="flex items-center text-gray-900">
                          <MapPin className="h-4 w-4 text-green-500 mr-1" />
                          {ride.startLatitude?.toFixed(4)}, {ride.startLongitude?.toFixed(4)}
                        </div>
                        <div className="flex items-center text-gray-500 mt-1">
                          <MapPin className="h-4 w-4 text-red-500 mr-1" />
                          {ride.endLatitude?.toFixed(4)}, {ride.endLongitude?.toFixed(4)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="text-gray-900">{ride.distanceKm} km</div>
                        <div className="text-gray-500">
                          {ride.startTime && ride.endTime && (
                            `${Math.round((new Date(ride.endTime) - new Date(ride.startTime)) / (1000 * 60))} min`
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">₹{ride.fareAmount}</div>
                        <div className="text-gray-500">@ ₹{ride.fareRate}/km</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 text-gray-400 mr-1" />
                          {formatDateTime(ride.receivedAt)}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FaresList;
