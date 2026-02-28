/**
 * formatting bytes to human readable string
 */
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

/**
 * formatting seconds to H:MM:SS or MM:SS
 */
export const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const mStr = m.toString().padStart(2, '0');
  const sStr = s.toString().padStart(2, '0');

  if (h > 0) {
    return `${h}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

/**
 * Helper: Strictly pads a timestamp string to 00:00.000 format.
 * This is the deterministic engine that prevents dropped zeros.
 */
const enforceTimestampFormat = (ts: string): string => {
  // Remove any spaces or weird characters
  const clean = ts.trim().replace(/[^\d:.]/g, '');
  
  // Split into Time (HH:MM:SS) and Milliseconds (.mmm)
  const [timePart, msPart] = clean.split('.');

  // Split components (H:M:S)
  const parts = timePart.split(':').filter(p => p !== '');
  
  // Ensure we have at least 2 parts (M:S)
  while (parts.length < 2) {
    parts.unshift('00');
  }

  // Pad every time component (Hours, Minutes, Seconds) to exactly 2 digits
  const paddedParts = parts.map(p => p.padStart(2, '0'));
  
  // Handle Milliseconds: Force exactly 3 digits (e.g., .2 -> .200, .279 -> .279)
  let paddedMs = '000';
  if (msPart !== undefined) {
    paddedMs = msPart.padEnd(3, '0').substring(0, 3);
  }

  return `${paddedParts.join(':')}.${paddedMs}`;
};

/**
 * Deterministically fixes all timestamps in the text.
 * It scans the entire transcript and forces standard formatting on any found timestamps.
 */
export const normalizeTranscript = (text: string): string => {
  // Regex matches content inside brackets: [ digits:digits... ] or [ digits:digits --> digits:digits ]
  // It handles various separator styles used by different models.
  return text.replace(/\[\s*([\d:.]+)(\s*-->\s*([\d:.]+))?\s*\]/g, (match, start, arrowPart, end) => {
    try {
      const cleanStart = enforceTimestampFormat(start);
      if (end) {
        const cleanEnd = enforceTimestampFormat(end);
        return `[${cleanStart} --> ${cleanEnd}]`;
      }
      return `[${cleanStart}]`;
    } catch (e) {
      // If parsing fails, return original to avoid destructive editing
      return match;
    }
  });
};

/**
 * Parses the last timestamp from a transcript string to return total seconds.
 * Used for progress calculation.
 */
export const parseLastTimestamp = (text: string): number | null => {
  // Matches the start of the last timestamp block
  const matches = [...text.matchAll(/\[\s*(\d+):(\d+)(?::(\d+))?(?:\.(\d+))?/g)];
  
  if (matches.length === 0) return null;
  
  const lastMatch = matches[matches.length - 1];
  
  let seconds = 0;
  // If group 3 exists, format is H:M:S
  if (lastMatch[3]) {
    seconds += parseInt(lastMatch[1], 10) * 3600;
    seconds += parseInt(lastMatch[2], 10) * 60;
    seconds += parseInt(lastMatch[3], 10);
  } else {
    // Format is M:S
    seconds += parseInt(lastMatch[1], 10) * 60;
    seconds += parseInt(lastMatch[2], 10);
  }
  
  // Add fractional seconds if group 4 exists
  if (lastMatch[4]) {
    seconds += parseInt(lastMatch[4], 10) / 1000;
  }
  
  return seconds;
};

/**
 * Extracts audio duration and converts file to base64
 */
export const processAudioFile = (
  file: File,
  onProgress: (percent: number) => void
): Promise<{ base64: string; duration: number }> => {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    const objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;

    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      URL.revokeObjectURL(objectUrl);

      const reader = new FileReader();
      
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = (event.loaded / event.total) * 100;
          onProgress(percent);
        }
      };

      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve({ base64, duration });
      };

      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load audio file metadata."));
    };
  });
};