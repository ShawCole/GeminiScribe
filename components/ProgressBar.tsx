import React from 'react';
import { Loader2, CheckCircle2, Clock } from 'lucide-react';
import { AppStatus } from '../types';
import { formatTime } from '../utils/fileHelpers';

interface ProgressBarProps {
  status: AppStatus;
  progress: number;
  timeRemaining: number | null;
  fileName?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ status, progress, timeRemaining, fileName }) => {
  const isCompleted = status === AppStatus.COMPLETED;
  const isReading = status === AppStatus.READING;
  
  // Determine color and label based on status
  let statusColor = "bg-blue-600";
  let statusText = "Initializing...";
  
  if (status === AppStatus.READING) {
    statusText = "Reading file...";
    statusColor = "bg-purple-600";
  } else if (status === AppStatus.TRANSCRIBING) {
    statusText = "Transcribing with Gemini AI...";
    statusColor = "bg-blue-600";
  } else if (status === AppStatus.COMPLETED) {
    statusText = "Completed";
    statusColor = "bg-emerald-500";
  }

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-3">
          {status === AppStatus.TRANSCRIBING || status === AppStatus.READING ? (
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          ) : status === AppStatus.COMPLETED ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <div className="w-5 h-5" />
          )}
          <div>
            <h4 className="font-medium text-slate-200">{fileName || "Processing..."}</h4>
            <p className="text-xs text-slate-400">{statusText}</p>
          </div>
        </div>
        
        {timeRemaining !== null && status === AppStatus.TRANSCRIBING && (
           <div className="flex items-center text-xs text-slate-400 bg-slate-700/50 px-3 py-1.5 rounded-full">
             <Clock className="w-3.5 h-3.5 mr-1.5" />
             ~{formatTime(timeRemaining)} remaining
           </div>
        )}
      </div>

      <div className="relative h-2.5 w-full bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-300 ease-out ${statusColor} ${isReading ? '' : 'relative'}`}
          style={{ width: `${progress}%` }}
        >
            {/* Shimmer effect for transcribing state */}
            {status === AppStatus.TRANSCRIBING && (
                <div className="absolute top-0 left-0 bottom-0 right-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
            )}
        </div>
      </div>
      
      <div className="flex justify-between mt-2">
        <span className="text-xs text-slate-500 font-mono">0%</span>
        <span className="text-xs text-slate-500 font-mono">{Math.round(progress)}%</span>
      </div>
    </div>
  );
};

export default ProgressBar;