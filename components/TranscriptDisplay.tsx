import React, { useRef, useEffect } from 'react';
import { Copy, Download, FileText, Pencil, Check } from 'lucide-react';
import { AppStatus } from '../types';

interface TranscriptDisplayProps {
  fileName: string;
  transcript: string;
  status: AppStatus;
  onChange: (newText: string) => void;
}

const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({ fileName, transcript, status, onChange }) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = React.useState(false);

  // Auto-scroll to bottom as text streams in, but only if user isn't editing (focused)
  useEffect(() => {
    if (status === AppStatus.TRANSCRIBING && !isFocused && endRef.current) {
        endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, status, isFocused]);

  const handleCopy = () => {
    navigator.clipboard.writeText(transcript);
  };

  const handleDownload = () => {
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/\.[^/.]+$/, "")}_transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isEditable = status === AppStatus.COMPLETED || status === AppStatus.TRANSCRIBING;

  if (status === AppStatus.IDLE || status === AppStatus.QUEUED || status === AppStatus.READING) return null;

  return (
    <div className="w-full h-full flex flex-col animate-in slide-in-from-right-4 fade-in duration-500">
      <div className="bg-slate-800 rounded-t-xl border border-slate-700 p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-slate-200 truncate max-w-[200px] sm:max-w-md">{fileName}</h3>
          {status === AppStatus.TRANSCRIBING && (
              <span className="flex h-2 w-2 relative ml-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
          )}
          {status === AppStatus.COMPLETED && (
             <span className="ml-2 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full flex items-center">
               <Pencil className="w-3 h-3 mr-1" />
               Editable
             </span>
          )}
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={handleCopy}
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Copy to clipboard"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button 
            onClick={handleDownload}
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Download .txt"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="relative flex-grow min-h-[400px]">
        <textarea
            ref={textAreaRef}
            value={transcript}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={status === AppStatus.TRANSCRIBING ? "Transcribing..." : "Transcript will appear here..."}
            className="w-full h-full min-h-[400px] bg-slate-900/50 p-6 text-slate-300 font-mono text-sm leading-relaxed border-x border-b border-slate-700 rounded-b-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none custom-scrollbar"
        />
        {/* Invisible element to track scroll position */}
        <div ref={endRef} className="absolute bottom-0" />
      </div>
    </div>
  );
};

export default TranscriptDisplay;