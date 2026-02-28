export enum AppStatus {
  IDLE = 'IDLE',
  QUEUED = 'QUEUED',
  READING = 'READING',
  TRANSCRIBING = 'TRANSCRIBING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface AudioMetadata {
  name: string;
  size: number; // bytes
  type: string;
  duration: number; // seconds
}

export interface QueueItem {
  id: string;
  file: File;
  status: AppStatus;
  progress: number; // 0-100
  timeRemaining: number | null; // estimated seconds remaining
  transcript: string;
  error?: string;
  metadata?: AudioMetadata;
  base64?: string; // Cache base64 to avoid re-reading
  startTime?: number;
}