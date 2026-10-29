import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { fareService } from '../../services/api';

const FareForm = ({ fare, drivers, vehicles, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    driverId: '',
    vehicleId: '',
    fareDate: '',
    startTime: '',
    endTime: '',
    distanceKm: '',
    fareAmount: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (fare) {
      const formatDateTime = (dateTime) => {
        if (!dateTime) return '';
        const date = new Date(dateTime);
        return date.toISOString().slice(0, 16); // Format for datetime-local input
      };

      const formatDate = (date) => {
        if (!date) return '';
        return new Date(date).toISOString().slice(0, 10); // Format for date input
      };

      setFormData({
        driverId: fare.driver?.driverId || '',
        vehicleId: fare.vehicle?.vehicleId || '',
        fareDate: formatDate(fare.fareDate),
        startTime: formatDateTime(fare.startTime),
        endTime: formatDateTime(fare.endTime),
        distanceKm: fare.distanceKm || '',
        fareAmount: fare.fareAmount || ''
      });
    }
  }, [fare]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Find selected driver and vehicle objects
      const selectedDriver = drivers.find(d => d.driverId === formData.driverId);
      const selectedVehicle = vehicles.find(v => v.vehicleId === formData.vehicleId);

      if (!selectedDriver || !selectedVehicle) {
        alert('Please select both driver and vehicle');
        return;
      }

      const fareData = {
        driver: { driverId: selectedDriver.driverId },
        vehicle: { vehicleId: selectedVehicle.vehicleId },
        fareDate: formData.fareDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        distanceKm: parseFloat(formData.distanceKm) || 0,
        fareAmount: parseFloat(formData.fareAmount) || 0
      };

      let response;
      if (fare) {
        response = await fareService.updateFare(fare.fareId, fareData);
      } else {
        response = await fareService.createFare(fareData);
      }

      onSubmit(response.data);
      alert(`Fare ${fare ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error('Error saving fare:', error);
      alert(`Failed to ${fare ? 'update' : 'create'} fare. ${error.response?.data?.message || ''}`);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            {fare ? 'Edit Fare' : 'Add New Fare'}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Driver *
              </label>
              <select
                name="driverId"
                value={formData.driverId}
                onChange={handleChange}
                required
                className="form-input"
              >
                <option value="">Select a driver</option>
                {drivers.map((driver) => (
                  <option key={driver.driverId} value={driver.driverId}>
                    {driver.driverName} - {driver.driverPhone}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehicle *
              </label>
              <select
                name="vehicleId"
                value={formData.vehicleId}
                onChange={handleChange}
                required
                className="form-input"
              >
                <option value="">Select a vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.vehicleId} value={vehicle.vehicleId}>
                    {vehicle.plateNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fare Date *
            </label>
            <input
              type="date"
              name="fareDate"
              value={formData.fareDate}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="datetime-local"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Distance (km)
              </label>
              <input
                type="number"
                step="0.1"
                name="distanceKm"
                value={formData.distanceKm}
                onChange={handleChange}
                className="form-input"
                placeholder="0.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fare Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                name="fareAmount"
                value={formData.fareAmount}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {loading ? 'Saving...' : (fare ? 'Update Fare' : 'Create Fare')}
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

export default FareForm;
