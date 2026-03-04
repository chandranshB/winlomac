import React, { useState, useEffect, useRef } from 'react';
import type { VehicleTelemetry } from '../types';

interface GaugeDisplayProps {
  telemetry: VehicleTelemetry;
}

export const GaugeDisplay: React.FC<GaugeDisplayProps> = ({ telemetry }) => {
  const [smoothedRPM, setSmoothedRPM] = useState(telemetry.rpm);
  const lastUpdateTime = useRef(0);

  // Initialize lastUpdateTime on mount
  useEffect(() => {
    lastUpdateTime.current = Date.now();
  }, []);

  // Smooth RPM needle animation over 0.05 seconds
  useEffect(() => {
    const targetRPM = telemetry.rpm;
    const smoothingTime = 0.05; // 50ms smoothing
    
    const animate = () => {
      const now = Date.now();
      const deltaTime = lastUpdateTime.current === 0 ? 0 : (now - lastUpdateTime.current) / 1000;
      lastUpdateTime.current = now;

      setSmoothedRPM(current => {
        const diff = targetRPM - current;
        const smoothingFactor = Math.min(deltaTime / smoothingTime, 1);
        return current + diff * smoothingFactor;
      });
    };

    const intervalId = setInterval(animate, 1000 / 60); // 60 FPS animation
    return () => clearInterval(intervalId);
  }, [telemetry.rpm]);

  // Format gear display
  const formatGear = (gear: number | 'N' | 'R'): string => {
    if (gear === 'N') return 'N';
    if (gear === 'R') return 'R';
    return gear.toString();
  };

  // Determine if RPM is in redline (above 7000)
  const isRedline = telemetry.rpm > 7000;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: '20px',
      borderRadius: '10px',
      color: 'white',
      fontFamily: 'monospace',
      fontSize: '16px',
      minWidth: '250px',
      userSelect: 'none'
    }}>
      {/* RPM Gauge */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{ 
          fontSize: '12px', 
          marginBottom: '5px',
          color: isRedline ? '#ff4444' : '#ffffff'
        }}>
          RPM
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            flex: 1,
            height: '30px',
            backgroundColor: '#333',
            borderRadius: '5px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* RPM Bar */}
            <div style={{
              height: '100%',
              width: `${(smoothedRPM / 8000) * 100}%`,
              backgroundColor: isRedline ? '#ff4444' : '#44ff44',
              transition: 'background-color 0.1s',
              position: 'relative'
            }}>
              {/* Redline marker at 7000 RPM */}
              <div style={{
                position: 'absolute',
                left: `${(7000 / smoothedRPM) * 100}%`,
                top: 0,
                bottom: 0,
                width: '2px',
                backgroundColor: '#ff0000',
                opacity: smoothedRPM > 6000 ? 1 : 0
              }} />
            </div>
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: 'bold',
            minWidth: '60px',
            textAlign: 'right',
            color: isRedline ? '#ff4444' : '#ffffff'
          }}>
            {Math.round(smoothedRPM)}
          </div>
        </div>
      </div>

      {/* Speed Display */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{ fontSize: '12px', marginBottom: '5px' }}>SPEED</div>
        <div style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#44aaff'
        }}>
          {telemetry.speed.toFixed(1)} <span style={{ fontSize: '14px' }}>km/h</span>
        </div>
      </div>

      {/* Gear Display */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{ fontSize: '12px', marginBottom: '5px' }}>GEAR</div>
        <div style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#ffaa44',
          textAlign: 'center',
          padding: '10px',
          backgroundColor: '#222',
          borderRadius: '5px'
        }}>
          {formatGear(telemetry.gear)}
        </div>
      </div>

      {/* Drift State Indicator */}
      {telemetry.isDrifting && (
        <div style={{
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#ff4444',
          borderRadius: '5px',
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '18px',
          animation: 'pulse 0.5s infinite alternate'
        }}>
          DRIFTING
        </div>
      )}

      {/* CSS Animation for drift indicator */}
      <style>{`
        @keyframes pulse {
          from { opacity: 0.8; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
