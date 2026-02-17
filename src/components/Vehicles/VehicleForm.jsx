import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { vehicleService } from '../../services/api';

const VehicleForm = ({ vehicle, drivers, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    plateNumber: '',
    driverId: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (vehicle) {
      setFormData({
        plateNumber: vehicle.plateNumber || '',
        driverId: vehicle.driver?.driverId || ''
      });
    }
  }, [vehicle]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let response;
      
      if (formData.driverId) {
        // Assign vehicle to driver
        const vehicleData = {
          plateNumber: formData.plateNumber
        };
        response = await vehicleService.assignVehicleToDriver(formData.driverId, vehicleData);
      } else {
        alert('Please select a driver to assign the vehicle');
        return;
      }

      onSubmit(response.data);
      alert(`Vehicle ${vehicle ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error('Error saving vehicle:', error);
      alert(`Failed to ${vehicle ? 'update' : 'create'} vehicle. ${error.response?.data?.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Filter out drivers that already have vehicles assigned (for new vehicles)
  const availableDrivers = !vehicle 
    ? drivers.filter(driver => !driver.vehicle)
    : drivers;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            {vehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plate Number *
            </label>
            <input
              type="text"
              name="plateNumber"
              value={formData.plateNumber}
              onChange={handleChange}
              required
              className="form-input"
              placeholder="Enter plate number (e.g., DL01AB1234)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign to Driver *
            </label>
            <select
              name="driverId"
              value={formData.driverId}
              onChange={handleChange}
              required
              className="form-input"
            >
              <option value="">Select a driver</option>
              {availableDrivers.map((driver) => (
                <option key={driver.driverId} value={driver.driverId}>
                  {driver.driverName} - {driver.driverPhone}
                </option>
              ))}
            </select>
            {availableDrivers.length === 0 && (
              <p className="text-sm text-red-600 mt-1">
                No drivers available. Please add drivers first.
              </p>
            )}
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={loading || availableDrivers.length === 0}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {loading ? 'Saving...' : (vehicle ? 'Update Vehicle' : 'Create Vehicle')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VehicleForm;
