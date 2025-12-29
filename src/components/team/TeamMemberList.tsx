import { User, Mail, MoreVertical, Trash2, Shield, Crown } from 'lucide-react';
import RoleBadge from './RoleBadge';
import { useState } from 'react';
import Button from '../ui/Button';

interface TeamMember {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  name?: string;
  avatar_url?: string;
  joined_at: string;
}

interface TeamMemberListProps {
  members: TeamMember[];
  currentUserRole?: 'owner' | 'admin' | 'member';
  onRemove?: (memberId: string) => void;
  onRoleChange?: (memberId: string, newRole: 'admin' | 'member') => void;
}

export default function TeamMemberList({
  members,
  currentUserRole = 'member',
  onRemove,
  onRoleChange
}: TeamMemberListProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canRemove = currentUserRole === 'owner';

  const handleRoleChange = (memberId: string, newRole: 'admin' | 'member') => {
    if (onRoleChange) {
      onRoleChange(memberId, newRole);
    }
    setMenuOpenId(null);
  };

  const handleRemove = (memberId: string) => {
    if (onRemove && confirm('Are you sure you want to remove this member?')) {
      onRemove(memberId);
    }
    setMenuOpenId(null);
  };

  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-[#00f5ff]/30 transition"
          onMouseEnter={() => setHoveredId(member.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
              {member.avatar_url ? (
                <img src={member.avatar_url} alt={member.name || member.email} className="w-full h-full rounded-full" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-white font-medium truncate">
                  {member.name || member.email}
                </p>
                <RoleBadge role={member.role} size="sm" />
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Mail className="w-4 h-4" />
                <span className="truncate">{member.email}</span>
              </div>
            </div>
          </div>

          {canManage && hoveredId === member.id && member.role !== 'owner' && (
            <div className="relative">
              <button
                onClick={() => setMenuOpenId(menuOpenId === member.id ? null : member.id)}
                className="p-2 text-gray-400 hover:text-white transition"
                aria-label="Member actions"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {menuOpenId === member.id && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg border border-gray-700 shadow-xl z-10">
                  {member.role !== 'owner' && (
                    <>
                      {member.role === 'member' ? (
                        <button
                          onClick={() => handleRoleChange(member.id, 'admin')}
                          className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-700 text-gray-300 transition text-left text-sm"
                        >
                          <Shield className="w-4 h-4" />
                          Make Admin
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRoleChange(member.id, 'member')}
                          className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-700 text-gray-300 transition text-left text-sm"
                        >
                          <User className="w-4 h-4" />
                          Make Member
                        </button>
                      )}
                    </>
                  )}
                  {canRemove && (
                    <button
                      onClick={() => handleRemove(member.id)}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-700 text-red-400 transition text-left text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

