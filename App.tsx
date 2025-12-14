import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SmartDevice, DeviceType, ActionLog, AICommandResponse } from './types';
import DeviceCard from './components/DeviceCard';
import ScanningControl from "./components/ScanningControl.tsx";
import { parseVoiceCommand } from './services/aiService';
import { Mic, Eye, Grid, Activity, Volume2, Settings, Accessibility, MicOff, Loader2 } from 'lucide-react';

// Polyfill for TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Initial Mock Data
const INITIAL_DEVICES: SmartDevice[] = [
  { id: '1', name: 'Main Light', type: DeviceType.LIGHT, location: 'Living Room', isOn: false, iconName: 'Lightbulb' },
  { id: '2', name: 'Ceiling Fan', type: DeviceType.FAN, location: 'Bedroom', isOn: true, iconName: 'Fan' },
  { id: '3', name: 'Door Lock', type: DeviceType.LOCK, location: 'Entrance', isOn: false, iconName: 'Lock' },
  { id: '4', name: 'TV', type: DeviceType.TV, location: 'Living Room', isOn: false, iconName: 'Tv' },
  { id: '5', name: 'Thermostat', type: DeviceType.THERMOSTAT, location: 'Hallway', isOn: true, iconName: 'Thermometer' },
  { id: '6', name: 'Desk Lamp', type: DeviceType.LIGHT, location: 'Office', isOn: false, iconName: 'Lightbulb' },
];

// Helper for Text-to-Speech with "Soft/Friendly" voice selection
const speak = (text: string) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // Stop previous speech
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Attempt to select a softer/friendlier voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.name.includes("Google US English") || // Often softer than default
      v.name.includes("Samantha") ||
      v.name.includes("Zira") 
    ) || voices.find(v => v.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    // Adjust pitch and rate for a friendlier tone
    utterance.pitch = 1.05; 
    utterance.rate = 1.0; 
    
    window.speechSynthesis.speak(utterance);
  }
};

export default function App() {
  const [devices, setDevices] = useState<SmartDevice[]>(INITIAL_DEVICES);
  const [highContrast, setHighContrast] = useState(false);
  const [scanningMode, setScanningMode] = useState(false);
  const [scannedIndex, setScannedIndex] = useState(0);
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs for stable access inside event listeners/intervals
  const devicesRef = useRef(devices);
  const scannedIndexRef = useRef(scannedIndex);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Sync refs with state
  useEffect(() => { devicesRef.current = devices; }, [devices]);
  useEffect(() => { scannedIndexRef.current = scannedIndex; }, [scannedIndex]);

  // Pre-load voices on mount (Chrome requirement)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // --- Actions ---

  const addLog = (message: string, source: ActionLog['source']) => {
    const newLog: ActionLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      message,
      source
    };
    setLogs(prev => [...prev, newLog]);
  };

  const toggleDevice = useCallback((id: string, source: ActionLog['source'] = 'MANUAL') => {
    setDevices(prev => prev.map(d => {
      if (d.id === id) {
        const newState = !d.isOn;
        return { ...d, isOn: newState };
      }
      return d;
    }));
    
    const device = devicesRef.current.find(d => d.id === id);
    if (device) {
       const newStateString = !device.isOn ? 'ON' : 'OFF';
       const message = `${device.name} turned ${newStateString}`;
       addLog(message, source);
       
       if (source === 'VOICE' || source === 'SCANNING') {
         speak(message);
       }
    }
  }, []);

  const setDeviceState = useCallback((id: string, state: boolean, source: ActionLog['source'] = 'VOICE') => {
    setDevices(prev => prev.map(d => {
      if (d.id === id) {
        return { ...d, isOn: state };
      }
      return d;
    }));
    
    const device = devicesRef.current.find(d => d.id === id);
    if (device) {
        let message = '';
        if (device.isOn !== state) {
            message = `${device.name} turned ${state ? 'ON' : 'OFF'}`;
        } else {
            message = `${device.name} is already ${state ? 'ON' : 'OFF'}`;
        }
        addLog(message, source);
        
        if (source === 'VOICE' || source === 'SCANNING') {
            speak(message);
        }
    }
  }, []);

  // --- Scanning Logic (Optimized) ---

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (scanningMode) {
      interval = setInterval(() => {
        setScannedIndex(prev => (prev + 1) % devicesRef.current.length);
      }, 2000); 
    } else {
      setScannedIndex(-1);
    }
    return () => clearInterval(interval);
  }, [scanningMode]); 

  const handleScanningSelect = useCallback(() => {
    if (scanningMode && scannedIndexRef.current >= 0) {
      const targetDevice = devicesRef.current[scannedIndexRef.current];
      if (targetDevice) {
        toggleDevice(targetDevice.id, 'SCANNING');
      }
    }
  }, [scanningMode, toggleDevice]); 

  // --- Voice / AI Logic (Web Speech API) ---

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setVoiceText(transcript);
        handleAIProcessing(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        addLog(`Voice error: ${event.error}`, 'VOICE');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []); 

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      const manualCommand = prompt("Enter command manually:");
      if (manualCommand) handleAIProcessing(manualCommand);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleAIProcessing = async (command: string) => {
    setIsProcessing(true);
    addLog(`Heard: "${command}"`, 'VOICE');

    try {
      const result: AICommandResponse = await parseVoiceCommand(command, devicesRef.current);
      
      // If AI provides a conversational response (e.g., for Hello/Errors), speak it.
      if (result.conversationalResponse) {
          addLog(`AI says: "${result.conversationalResponse}"`, 'VOICE');
          speak(result.conversationalResponse);
      }
      
      // If AI identifies a device action
      if (result.targetDeviceId && result.action !== 'UNKNOWN') {
        const target = devicesRef.current.find(d => d.id === result.targetDeviceId);
        if (target) {
          // Note: toggleDevice/setDeviceState handles the "success" speech automatically.
          if (result.action === 'TOGGLE') {
            toggleDevice(target.id, 'VOICE');
          } else {
            const desiredState = result.action === 'TURN_ON';
            setDeviceState(target.id, desiredState, 'VOICE');
          }
        }
      } else if (!result.conversationalResponse) {
        // Fallback if no conversation AND no action
        const msg = "I'm not sure what you mean.";
        addLog(msg, 'VOICE');
        speak(msg);
      }
    } catch (e) {
      const msg = "Sorry, I had trouble processing that.";
      addLog(msg, 'VOICE');
      speak(msg);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setVoiceText(''), 3000);
    }
  };

  // --- Auto Scroll Logs ---
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [logs]);

  // --- Global Event Listener for Scanning Selection ---
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (scanningMode && !(e.target as HTMLElement).closest('button')) {
         handleScanningSelect();
      }
    };
    
    const handleGlobalKey = (e: KeyboardEvent) => {
        if (scanningMode && (e.code === 'Space' || e.code === 'Enter')) {
            e.preventDefault();
            handleScanningSelect();
        }
    }
    
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalKey);
    return () => {
        window.removeEventListener('click', handleGlobalClick);
        window.removeEventListener('keydown', handleGlobalKey);
    };
  }, [scanningMode, handleScanningSelect]); 


  return (
    <div className={`h-screen w-screen transition-colors duration-500 flex flex-col overflow-hidden ${highContrast ? 'bg-black text-yellow-400' : 'bg-access-dark text-slate-100'}`}>
      
      {/* Header */}
      <header className={`p-6 flex-shrink-0 flex justify-between items-center ${highContrast ? 'border-b-4 border-white' : 'bg-access-card shadow-lg'}`}>
        <div className="flex items-center gap-3">
          <Accessibility size={32} className={highContrast ? 'text-yellow-400' : 'text-access-accent'} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AccessiHome</h1>
            <p className={`text-xs ${highContrast ? 'text-white' : 'text-slate-400'}`}>Assistive Control Prototype</p>
          </div>
        </div>
        
        <div className="flex gap-4">
            <button 
                onClick={() => setHighContrast(!highContrast)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${highContrast ? 'bg-white text-black' : 'bg-slate-700 hover:bg-slate-600'}`}
            >
                <Eye size={20} />
                <span className="hidden md:inline">High Contrast</span>
            </button>

            <button 
                onClick={() => setScanningMode(!scanningMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${scanningMode ? 'bg-yellow-500 text-black ring-2 ring-white' : 'bg-slate-700 hover:bg-slate-600'}`}
            >
                <Grid size={20} />
                <span className="hidden md:inline">Switch Scanning</span>
            </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 p-6 md:p-8 flex flex-col md:flex-row gap-8 overflow-hidden min-h-0">
        
        {/* Device Grid */}
        <section className="flex-1 overflow-y-auto scrollbar-hide pb-20 rounded-2xl">
          <h2 className={`text-xl font-semibold mb-6 flex items-center gap-2 ${highContrast ? 'text-white uppercase decoration-4 underline' : 'text-slate-300'}`}>
            <Settings size={20} />
            My Devices
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {devices.map((device, index) => (
              <DeviceCard 
                key={device.id} 
                device={device} 
                isHighContrast={highContrast}
                isHighlighted={scanningMode && scannedIndex === index}
                onToggle={(id) => scanningMode ? handleScanningSelect() : toggleDevice(id)}
              />
            ))}
          </div>
        </section>

        {/* Sidebar: Voice & Logs */}
        <aside className={`
            w-full md:w-96 flex flex-col gap-6 flex-shrink-0 
            h-[40vh] md:h-auto md:max-h-full overflow-hidden
            ${highContrast ? 'border-l-4 border-white pl-8' : ''}
        `}>
            
            {/* Voice Control Card - Fixed Height */}
            <div className={`p-6 rounded-2xl flex-shrink-0 ${highContrast ? 'border-4 border-white' : 'bg-gradient-to-br from-indigo-900 to-slate-900 shadow-xl'}`}>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Mic size={24} />
                    Voice Assistant
                </h3>
                <p className="text-sm mb-4 opacity-80">
                    Use natural language to control your home. Speak clearly.
                </p>
                <button 
                    onClick={toggleListening}
                    disabled={isProcessing}
                    className={`
                        w-full py-6 rounded-xl font-bold text-xl flex items-center justify-center gap-3 transition-all
                        ${isListening ? 'bg-red-500 animate-pulse' : ''}
                        ${!isListening && !isProcessing ? 'bg-access-accent hover:bg-blue-600 active:scale-95' : ''}
                        ${isProcessing ? 'bg-slate-600 cursor-wait' : ''}
                        ${highContrast ? 'bg-white text-black border-4 border-yellow-400' : 'text-white shadow-lg shadow-blue-500/30'}
                    `}
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="animate-spin" /> Processing...
                        </>
                    ) : isListening ? (
                        <>
                            <MicOff /> Stop Listening
                        </>
                    ) : (
                        <>
                            <Volume2 /> Speak Command
                        </>
                    )}
                </button>
                {voiceText && (
                    <div className="mt-4 p-3 bg-black/20 rounded-lg text-sm italic border border-white/10 animate-fadeIn">
                        "{voiceText}"
                    </div>
                )}
            </div>

            {/* Activity Log - Flex grow with scroll */}
            <div className={`flex-1 min-h-0 rounded-2xl p-6 flex flex-col ${highContrast ? 'border-4 border-white' : 'bg-access-card'}`}>
                <h3 className="text-lg font-bold mb-4 flex-shrink-0 flex items-center gap-2">
                    <Activity size={20} />
                    Activity Log
                </h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar relative">
                    {logs.length === 0 && (
                        <p className="text-gray-500 text-center mt-10 italic">No activity yet.</p>
                    )}
                    {logs.map((log) => (
                        <div key={log.id} className={`p-3 rounded-lg text-sm border-l-4 animate-fadeIn ${
                            log.source === 'VOICE' ? 'border-purple-500 bg-purple-500/10' :
                            log.source === 'SCANNING' ? 'border-yellow-500 bg-yellow-500/10' :
                            'border-blue-500 bg-blue-500/10'
                        }`}>
                            <div className="flex justify-between items-start mb-1 opacity-60 text-xs uppercase font-bold tracking-wider">
                                <span>{log.source}</span>
                                <span>{log.timestamp.toLocaleTimeString()}</span>
                            </div>
                            <p className="font-medium leading-relaxed">{log.message}</p>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            </div>

        </aside>

      </main>

      {/* Scanning Mode Overlay */}
      <ScanningControl 
        itemCount={devices.length} 
        isActive={scanningMode} 
        onSelect={handleScanningSelect} 
      />

    </div>
  );
}