import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { driverService } from '../../services/api';

const DriverForm = ({ driver, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    driverName: '',
    driverPhone: '',
    licenseNumber: '',
    active: true
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [phoneValidation, setPhoneValidation] = useState({ checking: false, available: true });

  useEffect(() => {
    if (driver) {
      setFormData({
        driverName: driver.driverName || '',
        driverPhone: driver.driverPhone || '',
        licenseNumber: driver.licenseNumber || '',
        active: driver.active !== undefined ? driver.active : true
      });
    }
  }, [driver]);

  // Phone validation with debounce
  useEffect(() => {
    const validatePhone = async () => {
      if (formData.driverPhone && formData.driverPhone.length === 10) {
        setPhoneValidation({ checking: true, available: true });
        try {
          const response = await driverService.validatePhoneNumber(
            formData.driverPhone, 
            driver?.driverId
          );
          setPhoneValidation({ checking: false, available: response.data.available });
        } catch (error) {
          console.error('Phone validation error:', error);
          setPhoneValidation({ checking: false, available: true });
        }
      }
    };

    const debounceTimer = setTimeout(validatePhone, 500);
    return () => clearTimeout(debounceTimer);
  }, [formData.driverPhone, driver?.driverId]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.driverName.trim()) {
      newErrors.driverName = 'Driver name is required';
    } else if (formData.driverName.length < 2) {
      newErrors.driverName = 'Driver name must be at least 2 characters';
    }

    if (!formData.driverPhone.trim()) {
      newErrors.driverPhone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(formData.driverPhone.replace(/\D/g, ''))) {
      newErrors.driverPhone = 'Please enter a valid 10-digit phone number';
    } else if (!phoneValidation.available) {
      newErrors.driverPhone = 'This phone number is already registered with another driver';
    }

    if (!formData.licenseNumber.trim()) {
      newErrors.licenseNumber = 'License number is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm() || phoneValidation.checking) return;

    setLoading(true);
    setErrors({});

    try {
      let response;
      
      if (driver) {
        // Update existing driver
        response = await driverService.updateDriver(driver.driverId, formData);
      } else {
        // Create new driver
        response = await driverService.createDriver(formData);
      }

      onSubmit(response.data);
      alert(`Driver ${driver ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error('Error saving driver:', error);
      
      if (error.response?.data?.error) {
        alert(`Failed to save driver: ${error.response.data.error}`);
      } else if (error.response?.status === 400) {
        alert('Invalid data provided. Please check your inputs.');
      } else {
        alert(`Failed to ${driver ? 'update' : 'create'} driver. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Only digits
    if (value.length <= 10) {
      handleChange({ target: { name: 'driverPhone', value } });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            {driver ? 'Edit Driver' : 'Add New Driver'}
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
              Driver Name *
            </label>
            <input
              type="text"
              name="driverName"
              value={formData.driverName}
              onChange={handleChange}
              className={`form-input ${errors.driverName ? 'border-red-500' : ''}`}
              placeholder="Enter driver's full name"
            />
            {errors.driverName && (
              <p className="text-red-500 text-sm mt-1">{errors.driverName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <div className="relative">
              <input
                type="tel"
                name="driverPhone"
                value={formData.driverPhone}
                onChange={handlePhoneChange}
                className={`form-input pr-10 ${errors.driverPhone ? 'border-red-500' : 
                  !phoneValidation.available ? 'border-red-500' : 
                  formData.driverPhone.length === 10 && phoneValidation.available ? 'border-green-500' : ''}`}
                placeholder="Enter 10-digit phone number"
                maxLength={10}
              />
              {phoneValidation.checking && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              )}
              {formData.driverPhone.length === 10 && !phoneValidation.checking && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {phoneValidation.available ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <span className="text-red-500">✗</span>
                  )}
                </div>
              )}
            </div>
            {errors.driverPhone && (
              <p className="text-red-500 text-sm mt-1">{errors.driverPhone}</p>
            )}
            {!phoneValidation.available && (
              <p className="text-red-500 text-sm mt-1">This phone number is already registered</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              License Number *
            </label>
            <input
              type="text"
              name="licenseNumber"
              value={formData.licenseNumber}
              onChange={handleChange}
              className={`form-input ${errors.licenseNumber ? 'border-red-500' : ''}`}
              placeholder="Enter license number"
            />
            {errors.licenseNumber && (
              <p className="text-red-500 text-sm mt-1">{errors.licenseNumber}</p>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="active"
              id="active"
              checked={formData.active}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="active" className="ml-2 text-sm text-gray-700">
              Active Driver
            </label>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={loading || phoneValidation.checking || !phoneValidation.available}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {loading ? 'Saving...' : (driver ? 'Update Driver' : 'Create Driver')}
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

export default DriverForm;
