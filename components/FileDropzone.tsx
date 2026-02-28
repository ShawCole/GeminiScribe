import React, { useCallback, useState } from 'react';
import { UploadCloud, FileAudio, AlertCircle } from 'lucide-react';

interface FileDropzoneProps {
  onFilesAccepted: (files: File[]) => void;
  disabled?: boolean;
}

const MAX_SIZE_MB = 19.5; 
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const FileDropzone: React.FC<FileDropzoneProps> = ({ onFilesAccepted, disabled }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const validateAndAccept = useCallback((files: FileList | File[]) => {
    setError(null);
    const validFiles: File[] = [];
    
    Array.from(files).forEach(file => {
      // Check type
      if (!file.type.startsWith('audio/')) {
        setError("Some files were rejected. Please upload valid audio files.");
        return;
      }

      // Check size
      if (file.size > MAX_SIZE_BYTES) {
        setError(`Some files were too large. Limit is ${MAX_SIZE_MB}MB per file.`);
        return;
      }
      
      validFiles.push(file);
    });

    if (validFiles.length > 0) {
      onFilesAccepted(validFiles);
    }
  }, [onFilesAccepted]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAccept(e.dataTransfer.files);
    }
  }, [disabled, validateAndAccept]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAccept(e.target.files);
    }
    // Reset value so same file can be selected again if needed
    e.target.value = ''; 
  }, [validateAndAccept]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 ease-in-out
          flex flex-col items-center justify-center text-center cursor-pointer group
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-700' : ''}
          ${isDragOver 
            ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' 
            : 'border-slate-600 hover:border-slate-500 bg-slate-800/50 hover:bg-slate-800'}
        `}
      >
        <input
          type="file"
          accept="audio/*"
          multiple
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          onChange={handleFileInput}
          disabled={disabled}
        />
        
        <div className={`p-4 rounded-full mb-4 transition-colors ${isDragOver ? 'bg-blue-500/20' : 'bg-slate-700/50 group-hover:bg-slate-700'}`}>
          {isDragOver ? (
             <UploadCloud className="w-10 h-10 text-blue-400" />
          ) : (
             <FileAudio className="w-10 h-10 text-slate-400 group-hover:text-slate-200" />
          )}
        </div>

        <h3 className="text-xl font-semibold mb-2 text-slate-200">
          {isDragOver ? "Drop files here" : "Drag & drop audio files"}
        </h3>
        <p className="text-sm text-slate-400 max-w-xs mx-auto">
          Supports multiple files (MP3, M4A, WAV).<br/>Max size {MAX_SIZE_MB}MB each.
        </p>
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-center text-red-400 bg-red-400/10 p-3 rounded-lg animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}
    </div>
  );
};

export default FileDropzone;