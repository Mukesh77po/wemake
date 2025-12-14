import React from 'react';
import { SmartDevice, DeviceType } from '../types';
import { Lightbulb, Fan, Lock, Thermometer, Tv, Power } from 'lucide-react';

interface DeviceCardProps {
  device: SmartDevice;
  isHighContrast: boolean;
  isHighlighted: boolean; // For scanning mode
  onToggle: (id: string) => void;
}

const getIcon = (type: DeviceType) => {
  switch (type) {
    case DeviceType.LIGHT: return Lightbulb;
    case DeviceType.FAN: return Fan;
    case DeviceType.LOCK: return Lock;
    case DeviceType.THERMOSTAT: return Thermometer;
    case DeviceType.TV: return Tv;
    default: return Power;
  }
};

const DeviceCard: React.FC<DeviceCardProps> = ({ 
  device, 
  isHighContrast, 
  isHighlighted, 
  onToggle 
}) => {
  const Icon = getIcon(device.type);

  // Dynamic classes based on state and accessibility mode
  const baseClasses = "relative flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-300 transform active:scale-95 cursor-pointer shadow-lg";
  
  const highContrastClasses = device.isOn 
    ? "bg-yellow-400 text-black border-4 border-white" 
    : "bg-black text-white border-4 border-white";
    
  const normalClasses = device.isOn 
    ? "bg-gradient-to-br from-access-accent to-blue-700 text-white shadow-blue-500/50" 
    : "bg-access-card text-gray-400 hover:bg-slate-700";

  const scanningRing = isHighlighted 
    ? "ring-4 ring-offset-4 ring-offset-access-dark ring-yellow-400 scale-105 z-10" 
    : "ring-0";

  return (
    <button
      onClick={() => onToggle(device.id)}
      className={`
        ${baseClasses} 
        ${isHighContrast ? highContrastClasses : normalClasses}
        ${scanningRing}
        h-40 w-full
      `}
      aria-label={`${device.name} in ${device.location} is ${device.isOn ? 'On' : 'Off'}`}
      aria-pressed={device.isOn}
    >
      <div className={`mb-3 ${device.isOn && device.type === DeviceType.FAN ? 'animate-spin' : ''}`}>
        <Icon size={isHighContrast ? 48 : 36} strokeWidth={isHighContrast ? 3 : 2} />
      </div>
      
      <span className={`text-lg font-bold ${isHighContrast ? 'uppercase tracking-widest' : ''}`}>
        {device.name}
      </span>
      
      <span className={`text-sm ${isHighContrast ? 'font-bold mt-1' : 'font-light opacity-80'}`}>
        {device.location}
      </span>

      <div className={`absolute top-4 right-4 h-3 w-3 rounded-full ${device.isOn ? 'bg-access-success' : 'bg-access-danger'}`} />
    </button>
  );
};

export default DeviceCard;
