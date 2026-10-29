import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, User, Phone, CreditCard, Car } from 'lucide-react';
import { driverService } from '../../services/api';
import DriverForm from './DriverForm';

const DriversList = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('name');

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const response = await driverService.getAllDrivers();
      setDrivers(response.data);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      alert('Failed to fetch drivers');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      fetchDrivers();
      return;
    }

    try {
      setLoading(true);
      let response;
      
      switch (searchType) {
        case 'name':
          response = await driverService.searchDriversByName(searchTerm);
          break;
        case 'phone':
          response = await driverService.searchDriversByPhone(searchTerm);
          break;
        case 'license':
          response = await driverService.searchDriversByLicense(searchTerm);
          break;
        case 'vehicle':
          response = await driverService.searchDriversByVehicle(searchTerm);
          break;
        default:
          response = await driverService.getAllDrivers();
      }
      
      setDrivers(response.data);
    } catch (error) {
      console.error('Error searching drivers:', error);
      alert('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (driverId) => {
    if (!window.confirm('Are you sure you want to delete this driver?')) return;
    
    try {
      await driverService.deleteDriver(driverId);
      setDrivers(drivers.filter(driver => driver.driverId !== driverId));
      alert('Driver deleted successfully');
    } catch (error) {
      console.error('Error deleting driver:', error);
      alert('Failed to delete driver. Driver may have associated data.');
    }
  };

  const handleFormSubmit = (driverData) => {
    if (editingDriver) {
      setDrivers(drivers.map(d => 
        d.driverId === editingDriver.driverId 
          ? { ...driverData, driverId: editingDriver.driverId }
          : d
      ));
    } else {
      fetchDrivers(); // Refresh to get the new driver
    }
    setShowForm(false);
    setEditingDriver(null);
  };

  const filteredDrivers = drivers;

  if (loading) {
    return <div className="flex justify-center py-8">Loading drivers...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Driver Management</h2>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Driver
        </button>
      </div>

      {/* Search Bar */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            className="form-input sm:w-48"
          >
            <option value="name">Search by Name</option>
            <option value="phone">Search by Phone</option>
            <option value="license">Search by License</option>
            <option value="vehicle">Search by Vehicle</option>
          </select>
          
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder={`Enter ${searchType}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input flex-1"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              className="btn-secondary flex items-center px-4"
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </button>
            <button
              onClick={() => {
                setSearchTerm('');
                fetchDrivers();
              }}
              className="btn-outline px-4"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Drivers Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Driver Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  License
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vehicle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    {searchTerm ? 'No drivers found matching your search' : 'No drivers found'}
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((driver) => (
                  <tr key={driver.driverId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {driver.driverName}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {driver.driverId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">{driver.driverPhone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <CreditCard className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">{driver.licenseNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {driver.vehicle ? (
                        <div className="flex items-center">
                          <Car className="h-4 w-4 mr-2 text-green-500" />
                          <span className="text-green-700">{driver.vehicle.plateNumber}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 flex items-center">
                          <Car className="h-4 w-4 mr-2" />
                          No vehicle assigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        driver.active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {driver.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingDriver(driver);
                            setShowForm(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(driver.driverId)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Driver Form Modal */}
      {showForm && (
        <DriverForm
          driver={editingDriver}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingDriver(null);
          }}
        />
      )}
    </div>
  );
};

export default DriversList;
