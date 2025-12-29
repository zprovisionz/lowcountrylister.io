import { useState, useCallback } from 'react';
import { apiCall } from '../lib/errorHandler';

interface Team {
  id: string;
  name: string;
  owner_id: string;
  subscription_tier: string;
  branding_logo_url?: string;
  branding_color_primary?: string;
}

interface TeamMember {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  name?: string;
}

export function useTeam() {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteMember = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);

    try {
      await apiCall('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to invite member');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeMember = useCallback(async (memberId: string) => {
    setLoading(true);
    setError(null);

    try {
      await apiCall(`/api/team/members?memberId=${memberId}`, {
        method: 'DELETE',
      });
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateMemberRole = useCallback(async (memberId: string, role: 'admin' | 'member') => {
    setLoading(true);
    setError(null);

    try {
      await apiCall(`/api/team/members?memberId=${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
    } catch (err: any) {
      setError(err.message || 'Failed to update role');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    team,
    members,
    inviteMember,
    removeMember,
    updateMemberRole,
    loading,
    error,
  };
}

