import { useState, useEffect, useCallback } from 'react';
import { apiCall } from '../lib/errorHandler';

interface AnalyticsData {
  generations: Array<{ date: string; count: number }>;
  topCopied: Array<{ id: string; address: string; copies: number }>;
  engagement: {
    totalViews: number;
    totalCopies: number;
    averageEngagement: number;
  };
  recentActivity: Array<{
    id: string;
    address: string;
    views: number;
    copies: number;
    lastViewed: string;
  }>;
}

export function useAnalytics(timeRange: '7d' | '30d' | '90d' = '30d') {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall(`/api/analytics/dashboard?range=${timeRange}`);
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    data,
    loading,
    error,
    refetch: fetchAnalytics,
  };
}

