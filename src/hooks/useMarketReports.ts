import { useState, useCallback } from 'react';
import { apiCall } from '../lib/errorHandler';

interface MarketReport {
  id: string;
  report_type: 'neighborhood' | 'zip' | 'comps';
  parameters: Record<string, any>;
  report_url?: string;
  generated_at: string;
}

export function useMarketReports() {
  const [reports, setReports] = useState<MarketReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = useCallback(async (
    type: 'neighborhood' | 'zip' | 'comps',
    parameters: Record<string, any>
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, parameters }),
      });

      setReports(prev => [response, ...prev]);
      return response;
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall('/api/reports/history');
      setReports(response);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    reports,
    generateReport,
    fetchReports,
    loading,
    error,
  };
}

