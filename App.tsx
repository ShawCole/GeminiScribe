import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Zap, ListMusic, Trash2, Play, Circle, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import FileDropzone from './components/FileDropzone';
import TranscriptDisplay from './components/TranscriptDisplay';
import { AppStatus, QueueItem, PersistedQueueItem } from './types';
import { processAudioFile, generateId, formatTime, parseLastTimestamp, normalizeTranscript } from './utils/fileHelpers';
import { transcribeAudioStream } from './services/geminiService';
import useLocalStorage from './hooks/useLocalStorage';

const PERSISTABLE_STATUSES = new Set([AppStatus.COMPLETED, AppStatus.ERROR]);

function toPersistedItem(item: QueueItem): PersistedQueueItem {
  return {
    id: item.id,
    fileName: item.fileName,
    status: item.status,
    progress: item.progress,
    transcript: item.transcript,
    metadata: item.metadata,
  };
}

function fromPersistedItem(item: PersistedQueueItem): QueueItem {
  return {
    ...item,
    timeRemaining: null,
  };
}

const App: React.FC = () => {
  const [persistedQueue, setPersistedQueue] = useLocalStorage<PersistedQueueItem[]>('geminiscribe_queue', []);
  const [persistedActiveId, setPersistedActiveId] = useLocalStorage<string | null>('geminiscribe_active_item', null);

  const [queue, setQueue] = useState<QueueItem[]>(() => persistedQueue.map(fromPersistedItem));
  const [activeItemId, setActiveItemId] = useState<string | null>(persistedActiveId);
  
  // Ref to track if we are currently processing a file to prevent overlapping
  const isProcessingRef = useRef(false);

  // Sync completed/error items to localStorage
  useEffect(() => {
    const toPersist = queue.filter(item => PERSISTABLE_STATUSES.has(item.status)).map(toPersistedItem);
    setPersistedQueue(toPersist);
  }, [queue]);

  // Sync active item selection to localStorage
  useEffect(() => {
    setPersistedActiveId(activeItemId);
  }, [activeItemId]);

  // Helper to update a specific item in the queue
  const updateQueueItem = (id: string, updates: Partial<QueueItem>) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleFilesAccepted = useCallback((files: File[]) => {
    const newItems: QueueItem[] = files.map(file => ({
      id: generateId(),
      file,
      fileName: file.name,
      status: AppStatus.QUEUED,
      progress: 0,
      timeRemaining: null,
      transcript: '',
    }));

    setQueue(prev => {
        const updated = [...prev, ...newItems];
        // If this is the first item added and nothing is selected, select it
        if (!activeItemId && newItems.length > 0) {
            setActiveItemId(newItems[0].id);
        }
        return updated;
    });
  }, [activeItemId]);

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQueue(prev => prev.filter(item => item.id !== id));
    if (activeItemId === id) {
        setActiveItemId(null);
    }
  };

  const handleProcessItem = async (item: QueueItem) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const startTime = Date.now();

    // Reset Item State
    updateQueueItem(item.id, { 
      status: AppStatus.READING, 
      progress: 0, 
      error: undefined,
      startTime: startTime
    });

    try {
      // 1. Process File (Read + Duration) - Only if we don't have base64 yet
      let base64 = item.base64;
      let duration = item.metadata?.duration || 0;

      if (!base64) {
        const result = await processAudioFile(item.file!, (percent) => {
          updateQueueItem(item.id, { progress: percent / 2 });
        });
        base64 = result.base64;
        duration = result.duration;
        
        updateQueueItem(item.id, {
           base64,
           metadata: {
             name: item.fileName,
             size: item.file!.size,
             type: item.file!.type,
             duration
           }
        });
      }

      // 2. Start Transcription
      updateQueueItem(item.id, { 
        status: AppStatus.TRANSCRIBING,
        progress: 0, 
        timeRemaining: null // Will calculate based on first chunk
      });

      // Maintain local transcript to parse progress accurately without race conditions
      let localTranscript = "";

      // Streaming call
      await transcribeAudioStream(base64!, item.file!.type, (chunk) => {
        localTranscript += chunk;
        
        // --- DETERMINISTIC FIX ---
        // Normalize the transcript immediately. 
        // This converts AI output "1:5" into "01:05.000" automatically.
        const cleanTranscript = normalizeTranscript(localTranscript);
        
        // Calculate Progress based on Timestamp
        let currentProgress = 0;
        let estimatedTimeRemaining: number | null = null;
        
        // Parse time from the CLEAN transcript
        const lastSeconds = parseLastTimestamp(cleanTranscript);
        
        if (lastSeconds !== null && duration > 0) {
            currentProgress = Math.min(99, (lastSeconds / duration) * 100);
            
            // Calculate ETA
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            if (currentProgress > 1) { // Wait for at least 1% progress to estimate
                 const rate = elapsedSeconds / currentProgress; // seconds per percent
                 const remainingPercent = 100 - currentProgress;
                 estimatedTimeRemaining = rate * remainingPercent;
            }
        }

        setQueue(prev => prev.map(qItem => {
            if (qItem.id === item.id) {
                return { 
                    ...qItem, 
                    transcript: cleanTranscript, // Display the clean version
                    progress: Math.max(qItem.progress, currentProgress), // Don't go backwards
                    timeRemaining: estimatedTimeRemaining
                };
            }
            return qItem;
        }));
      });

      // 3. Complete
      updateQueueItem(item.id, {
        status: AppStatus.COMPLETED,
        progress: 100,
        timeRemaining: 0
      });

    } catch (error: any) {
      console.error(error);
      updateQueueItem(item.id, {
        status: AppStatus.ERROR,
        error: error.message || "An error occurred."
      });
    } finally {
      isProcessingRef.current = false;
    }
  };

  // Queue Processor Effect
  useEffect(() => {
    const processNext = async () => {
      if (isProcessingRef.current) return;

      // Find next queued item
      const nextItem = queue.find(item => item.status === AppStatus.QUEUED);
      if (nextItem) {
        // Auto-select the item being processed if none selected
        if (!activeItemId) setActiveItemId(nextItem.id); 
        await handleProcessItem(nextItem);
      }
    };

    processNext();
  }, [queue, activeItemId]);

  const selectedItem = queue.find(item => item.id === activeItemId);

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 bg-slate-950 text-slate-50 selection:bg-blue-500/30">
      
      {/* Header */}
      <div className="text-center mb-8 space-y-2">
        <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 rounded-2xl mb-2 ring-1 ring-blue-500/30">
          <Zap className="w-6 h-6 text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          Gemini Scribe
        </h1>
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Queue & Upload */}
        <div className="lg:col-span-4 space-y-6">
            <FileDropzone onFilesAccepted={handleFilesAccepted} />

            {queue.length > 0 && (
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col max-h-[600px]">
                    <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                        <div className="flex items-center space-x-2 text-slate-300">
                            <ListMusic className="w-4 h-4" />
                            <span className="font-semibold text-sm">Processing Queue ({queue.length})</span>
                        </div>
                        <button 
                            onClick={() => {
                                if (confirm("Clear all finished items?")) {
                                    setQueue(prev => prev.filter(i => i.status !== AppStatus.COMPLETED && i.status !== AppStatus.ERROR));
                                    setActiveItemId(null);
                                }
                            }}
                            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            Clear Finished
                        </button>
                    </div>
                    
                    <div className="overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {queue.map(item => (
                            <div 
                                key={item.id}
                                onClick={() => setActiveItemId(item.id)}
                                className={`
                                    group relative p-3 rounded-lg border cursor-pointer transition-all
                                    ${activeItemId === item.id 
                                        ? 'bg-blue-500/10 border-blue-500/50' 
                                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}
                                `}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-medium text-sm text-slate-200 truncate pr-6">{item.fileName}</h4>
                                    <button 
                                        onClick={(e) => handleDeleteItem(item.id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-opacity absolute top-2 right-2"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-400">
                                    <div className="flex items-center space-x-2">
                                        {item.status === AppStatus.QUEUED && <Circle className="w-3 h-3" />}
                                        {item.status === AppStatus.TRANSCRIBING && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
                                        {item.status === AppStatus.COMPLETED && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                                        {item.status === AppStatus.ERROR && <AlertTriangle className="w-3 h-3 text-red-400" />}
                                        
                                        <span>
                                            {item.status === AppStatus.QUEUED && "Queued"}
                                            {item.status === AppStatus.READING && "Reading..."}
                                            {item.status === AppStatus.TRANSCRIBING && `Transcribing...`}
                                            {item.status === AppStatus.COMPLETED && "Done"}
                                            {item.status === AppStatus.ERROR && "Failed"}
                                        </span>
                                    </div>
                                    {item.status === AppStatus.TRANSCRIBING && item.timeRemaining !== null && (
                                        <span>~{formatTime(item.timeRemaining)} remaining</span>
                                    )}
                                </div>
                                
                                {(item.status === AppStatus.TRANSCRIBING || item.status === AppStatus.READING) && (
                                    <div className="mt-2 h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-blue-500 transition-all duration-300"
                                            style={{ width: `${item.progress}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* RIGHT COLUMN: Transcript Editor */}
        <div className="lg:col-span-8 flex flex-col h-[700px]">
            {selectedItem ? (
                <div className="h-full flex flex-col">
                    {selectedItem.status === AppStatus.ERROR ? (
                         <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/50 p-8 text-center">
                            <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
                            <h3 className="text-xl font-semibold text-slate-200 mb-2">Transcription Failed</h3>
                            <p className="text-red-400 max-w-md">{selectedItem.error}</p>
                            <button 
                                onClick={() => handleProcessItem(selectedItem)}
                                className="mt-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-white transition-colors"
                            >
                                Retry
                            </button>
                         </div>
                    ) : (
                        <TranscriptDisplay 
                            fileName={selectedItem.fileName}
                            transcript={selectedItem.transcript}
                            status={selectedItem.status}
                            onChange={(newText) => updateQueueItem(selectedItem.id, { transcript: newText })}
                        />
                    )}
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/50 p-8 text-center text-slate-500">
                    <div className="bg-slate-800 p-4 rounded-full mb-4">
                        <Play className="w-8 h-8 text-slate-600" />
                    </div>
                    <p className="text-lg">Select a file from the queue to view or edit.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default App;