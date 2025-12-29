import { useState, useCallback } from 'react';
import { apiCall } from '../lib/errorHandler';

interface BulkGenerationJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_listings: number;
  generated_count: number;
  failed_count: number;
  started_at?: string;
  completed_at?: string;
}

export function useBulkGeneration() {
  const [isUploading, setIsUploading] = useState(false);
  const [job, setJob] = useState<BulkGenerationJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiCall('/api/bulk/upload', {
        method: 'POST',
        body: formData,
      });

      setJob(response);
      return response;
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const checkStatus = useCallback(async (jobId: string) => {
    try {
      const response = await apiCall(`/api/bulk/status?id=${jobId}`);
      setJob(response);
      return response;
    } catch (err: any) {
      setError(err.message || 'Failed to check status');
      throw err;
    }
  }, []);

  const downloadResults = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/bulk/download?id=${jobId}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulk-results-${jobId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Download failed');
      throw err;
    }
  }, []);

  return {
    uploadFile,
    checkStatus,
    downloadResults,
    job,
    isUploading,
    error,
  };
}

