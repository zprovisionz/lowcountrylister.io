import { Crown, Shield, User } from 'lucide-react';

interface RoleBadgeProps {
  role: 'owner' | 'admin' | 'member';
  size?: 'sm' | 'md';
}

export default function RoleBadge({ role, size = 'md' }: RoleBadgeProps) {
  const roleConfig = {
    owner: {
      label: 'Owner',
      icon: Crown,
      color: 'text-[#ff00ff] border-[#ff00ff]/30 bg-[#ff00ff]/10',
      iconColor: 'text-[#ff00ff]'
    },
    admin: {
      label: 'Admin',
      icon: Shield,
      color: 'text-[#00f5ff] border-[#00f5ff]/30 bg-[#00f5ff]/10',
      iconColor: 'text-[#00f5ff]'
    },
    member: {
      label: 'Member',
      icon: User,
      color: 'text-gray-400 border-gray-600 bg-gray-800/50',
      iconColor: 'text-gray-400'
    }
  };

  const config = roleConfig[role];
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${config.color} ${sizeClasses} font-medium`}>
      <Icon className={`w-3 h-3 ${config.iconColor}`} />
      {config.label}
    </span>
  );
}

