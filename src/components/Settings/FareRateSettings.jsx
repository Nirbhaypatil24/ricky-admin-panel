import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, TrendingUp } from 'lucide-react';
import { fareRateService } from '../../services/api';

const FareRateSettings = () => {
  const [currentRate, setCurrentRate] = useState(12.0);
  const [newRate, setNewRate] = useState(12.0);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchCurrentRate();
  }, []);

  const fetchCurrentRate = async () => {
    try {
      setLoading(true);
      const response = await fareRateService.getCurrentRate();
      const rate = response.data.fare_rate || 12.0;
      setCurrentRate(rate);
      setNewRate(rate);
    } catch (error) {
      console.error('Error fetching current rate:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateFareRate = async () => {
    if (newRate <= 0) {
      alert('Fare rate must be greater than 0');
      return;
    }

    if (newRate === currentRate) {
      alert('New rate is same as current rate');
      return;
    }

    try {
      setUpdating(true);
      const response = await fareRateService.updateRate(newRate);
      
      if (response.status === 200) {
        // Add to history
        const historyEntry = {
          id: Date.now(),
          oldRate: currentRate,
          newRate: newRate,
          timestamp: new Date().toLocaleString(),
          status: 'SUCCESS'
        };
        setHistory(prev => [historyEntry, ...prev]);
        
        setCurrentRate(newRate);
        alert(`Fare rate updated successfully to ₹${newRate}/km`);
        
        // In a real implementation, this would trigger updates to all autometers
        console.log('🚀 Fare rate update sent to all autometers:', newRate);
      }
    } catch (error) {
      console.error('Error updating fare rate:', error);
      alert('Failed to update fare rate. Please try again.');
      
      const historyEntry = {
        id: Date.now(),
        oldRate: currentRate,
        newRate: newRate,
        timestamp: new Date().toLocaleString(),
        status: 'FAILED'
      };
      setHistory(prev => [historyEntry, ...prev]);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Fare Rate Management</h2>
        <button
          onClick={fetchCurrentRate}
          className="btn-secondary flex items-center"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Current Rate Display */}
      <div className="card">
        <div className="flex items-center mb-4">
          <Settings className="h-6 w-6 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold">Current Fare Rate</h3>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              ₹{currentRate}/km
            </div>
            <p className="text-blue-800">Active across all autometers</p>
          </div>
        </div>

        {/* Update Rate Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Fare Rate (₹ per km)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={newRate}
              onChange={(e) => setNewRate(parseFloat(e.target.value) || 0)}
              className="form-input"
              placeholder="Enter new rate"
            />
          </div>
          
          <button
            onClick={updateFareRate}
            disabled={updating || newRate <= 0}
            className="btn-primary flex items-center justify-center disabled:opacity-50"
          >
            {updating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Update Rate
              </>
            )}
          </button>
        </div>

        {newRate !== currentRate && newRate > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <TrendingUp className="h-5 w-5 text-yellow-600 mt-0.5 mr-2" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Rate Change Preview
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Current: ₹{currentRate}/km → New: ₹{newRate}/km 
                  ({newRate > currentRate ? '+' : ''}
                  {((newRate - currentRate) / currentRate * 100).toFixed(1)}%)
                </p>
                <p className="text-xs text-yellow-600 mt-2">
                  This will update the rate on all connected autometers instantly.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rate Change History */}
      {history.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Rate Change History</h3>
          <div className="space-y-3">
            {history.slice(0, 10).map((entry) => (
              <div
                key={entry.id}
                className={`flex justify-between items-center p-3 rounded-lg border ${
                  entry.status === 'SUCCESS'
                    ? 'border-green-300 bg-green-50'
                    : 'border-red-300 bg-red-50'
                }`}
              >
                <div>
                  <p className="text-sm font-medium">
                    ₹{entry.oldRate}/km → ₹{entry.newRate}/km
                  </p>
                  <p className="text-xs text-gray-600">{entry.timestamp}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  entry.status === 'SUCCESS'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {entry.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FareRateSettings;
