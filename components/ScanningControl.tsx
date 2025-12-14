import React, { useEffect } from 'react';
import { Play } from 'lucide-react';

interface ScanningControlProps {
  itemCount: number;
  isActive: boolean;
  onSelect: (index: number) => void;
  scanInterval?: number;
}

const ScanningControl: React.FC<ScanningControlProps> = ({ 
  isActive, 
}) => {
  // This component now purely handles the visual overlay explanation.
  // The actual scanning tick logic is handled in App.tsx for better state synchronization.
  
  if (!isActive) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-yellow-400 text-black p-4 text-center z-50 font-bold border-t-4 border-black animate-slideUp">
      <div className="flex items-center justify-center gap-4">
        <Play size={24} className="animate-pulse" />
        <span>SCANNING MODE ACTIVE</span>
        <span className="text-sm font-normal block md:inline">(Tap anywhere or press SPACE to select highlighted item)</span>
      </div>
    </div>
  );
};

export default ScanningControl;