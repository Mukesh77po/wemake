export enum DeviceType {
  LIGHT = 'LIGHT',
  FAN = 'FAN',
  LOCK = 'LOCK',
  THERMOSTAT = 'THERMOSTAT',
  TV = 'TV'
}

export interface SmartDevice {
  id: string;
  name: string;
  type: DeviceType;
  location: string;
  isOn: boolean;
  value?: number; // For temp or brightness
  iconName: string;
}

export interface ActionLog {
  id: string;
  timestamp: Date;
  message: string;
  source: 'MANUAL' | 'VOICE' | 'SCANNING';
}

export interface AICommandResponse {
  targetDeviceId: string | null;
  action: 'TURN_ON' | 'TURN_OFF' | 'TOGGLE' | 'UNKNOWN';
  reasoning: string;
  conversationalResponse?: string; // New field for spoken greetings/chatter
}