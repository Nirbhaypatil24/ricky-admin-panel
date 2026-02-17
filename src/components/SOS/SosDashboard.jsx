import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, MapPin, Clock, Check, Activity } from 'lucide-react';
import { Client } from '@stomp/stompjs';
import { sosService } from '../../services/api';
import LiveTrackingMap from '../Maps/LiveTrackingMap';

const SosDashboard = () => {
  const [alerts, setAlerts] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const stompClientRef = useRef(null);

  useEffect(() => {
    fetchAlerts();
    connectStomp();

    return () => {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
      }
    };
  }, []);

  const fetchAlerts = async () => {
    try {
      console.log('Fetching SOS alerts...');

      const [allResponse, activeResponse] = await Promise.all([
        sosService.getAllAlerts().catch(err => {
          console.error('Error fetching all alerts:', err);
          return { data: [] };
        }),
        sosService.getActiveAlerts().catch(err => {
          console.error('Error fetching active alerts:', err);
          return { data: [] };
        }),
      ]);

      console.log('All alerts response:', allResponse.data);
      console.log('Active alerts response:', activeResponse.data);

      setAlerts(allResponse.data || []);
      setActiveAlerts(activeResponse.data || []);
    } catch (error) {
      console.error('Error in fetchAlerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectStomp = () => {
    const wsUrl = 'wss://ec2-13-220-53-209.compute-1.amazonaws.com/ws-ricky';

    const client = new Client({
      webSocketFactory: () => new WebSocket(wsUrl),
      reconnectDelay: 5000,
      debug: () => {}, // silence logs in prod
    });

    client.onConnect = () => {
      console.log('SOS STOMP connected');
      setWsConnected(true);

      client.subscribe('/topic/sos-alerts', (message) => {
        try {
          const alert = JSON.parse(message.body);
          console.log('New SOS alert received:', alert);

          setActiveAlerts(prev => [alert, ...prev]);
          setAlerts(prev => [alert, ...prev]);

          playAlertSound();
          showNotification(alert);
        } catch (error) {
          console.error('Error processing STOMP message:', error);
        }
      });
    };

    client.onStompError = (frame) => {
      console.error('STOMP error:', frame.headers['message']);
      setWsConnected(false);
    };

    client.onWebSocketError = (event) => {
      console.error('WebSocket/STOMP error:', event);
      setWsConnected(false);
    };

    client.onDisconnect = () => {
      setWsConnected(false);
    };

    client.activate();
    stompClientRef.current = client;
  };

  const playAlertSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);

      setTimeout(() => {
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();

        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);

        oscillator2.frequency.setValueAtTime(1000, audioContext.currentTime);
        gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);

        oscillator2.start();
        oscillator2.stop(audioContext.currentTime + 0.2);
      }, 300);
    } catch (error) {
      console.error('Error playing alert sound:', error);
    }
  };

  const showNotification = (alert) => {
    if (Notification.permission === 'granted') {
      new Notification('🚨 Emergency Alert', {
        body: `SOS Alert from ${alert.driverId || alert.driver_id || 'Unknown Driver'}`,
        icon: '/favicon.ico',
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          showNotification(alert);
        }
      });
    }
  };

  const acknowledgeAlert = async (alertId) => {
    try {
      await sosService.acknowledgeAlert(alertId);

      setActiveAlerts(prev => prev.filter(alert => alert.id !== alertId));
      setAlerts(prev =>
        prev.map(alert =>
          alert.id === alertId
            ? { ...alert, acknowledged: true, status: 'RESOLVED' }
            : alert
        )
      );

      console.log('Alert acknowledged successfully');
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      alert('Failed to acknowledge alert');
    }
  };

  const sendTestAlert = async () => {
    try {
      const testAlert = {
        type: 'SOS_BUTTON',
        latitude: 28.6139 + (Math.random() - 0.5) * 0.01,
        longitude: 77.209 + (Math.random() - 0.5) * 0.01,
        driverId: `TEST-DRIVER-${Date.now()}`,
      };

      const response = await sosService.sendSosAlert(testAlert);
      console.log('Test alert sent:', response.data);
      alert('Test SOS alert sent successfully');

      setTimeout(fetchAlerts, 1000);
    } catch (error) {
      console.error('Error sending test alert:', error);
      alert('Failed to send test alert');
    }
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'Invalid date';
    return new Date(timestamp).toLocaleString();
  };

  const getAlertTypeEmoji = (type) => {
    switch (type?.toUpperCase()) {
      case 'CRASH': return '🚗💥';
      case 'SOS_BUTTON': return '🆘';
      case 'GEOFENCE': return '⚠️🗺️';
      case 'OVERSPEED': return '⚡🏃';
      default: return '🚨';
    }
  };

  const getAlertTypeColor = (type) => {
    switch (type?.toUpperCase()) {
      case 'CRASH': return 'border-red-500 bg-red-50';
      case 'SOS_BUTTON': return 'border-orange-500 bg-orange-50';
      case 'GEOFENCE': return 'border-yellow-500 bg-yellow-50';
      case 'OVERSPEED': return 'border-purple-500 bg-purple-50';
      default: return 'border-red-500 bg-red-50';
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8">Loading SOS alerts...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header / status */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">SOS Emergency Dashboard</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {wsConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <button onClick={sendTestAlert} className="btn-outline text-sm">
            Send Test Alert
          </button>
          <button onClick={fetchAlerts} className="btn-secondary">
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Active alerts, map, history – unchanged from your version */}
      {/* ... keep your existing JSX for active alerts, map, and history ... */}
      {/* Make sure you didn’t remove the <LiveTrackingMap sosAlerts={activeAlerts} /> part */}

      <div className="card">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-blue-600" />
          Emergency Locations Map
        </h3>
        <div className="h-96 rounded-lg overflow-hidden">
          <LiveTrackingMap sosAlerts={activeAlerts} />
        </div>
      </div>

      {/* Recent alerts history block stays as you wrote it */}
      {/* ... */}
    </div>
  );
};

export default SosDashboard;
