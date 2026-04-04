import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Activity } from 'lucide-react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { sosService } from '../../services/api';
import LiveTrackingMap from '../Maps/LiveTrackingMap';

const SosDashboard = () => {
  const [alerts, setAlerts] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const stompClientRef = useRef(null);

  useEffect(() => {
    connectStomp();

    return () => {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
      }
    };
  }, []);

  const connectStomp = () => {
    const socket = new SockJS(
      'https://ec2-13-220-53-209.compute-1.amazonaws.com/ws-browser'
    );

    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      debug: () => {}
    });

    client.onConnect = () => {
      console.log('SOS STOMP connected');
      setWsConnected(true);

      client.subscribe('/topic/sos-alerts', (message) => {
        try {
          const alert = JSON.parse(message.body);
          console.log('New SOS alert:', alert);

          setActiveAlerts(prev => [alert, ...prev]);
          setAlerts(prev => [alert, ...prev]);

          playAlertSound();
          showNotification(alert);
        } catch (error) {
          console.error('Error processing message', error);
        }
      });
    };

    client.onStompError = () => {
      setWsConnected(false);
    };

    client.onWebSocketError = () => {
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
    } catch (error) {
      console.error('Sound error', error);
    }
  };

  const showNotification = (alert) => {
    if (Notification.permission === 'granted') {
      new Notification('🚨 Emergency Alert', {
        body: `SOS Alert from ${alert.driverId || 'Unknown Driver'}`,
        icon: '/favicon.ico',
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
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
    } catch (error) {
      console.error('Error acknowledging alert:', error);
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

      await sosService.sendSosAlert(testAlert);
      alert('Test SOS alert sent');
    } catch (error) {
      console.error('Error sending test alert:', error);
    }
  };

  return (
    <div className="space-y-6">
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
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-blue-600" />
          Emergency Locations Map
        </h3>
        <div className="h-96 rounded-lg overflow-hidden">
          <LiveTrackingMap sosAlerts={activeAlerts} />
        </div>
      </div>
    </div>
  );
};

export default SosDashboard;
