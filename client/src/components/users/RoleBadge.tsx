import React from 'react';
import { UserRole } from '../../types/user';

interface RoleBadgeProps {
  role: UserRole;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  const roleConfig = {
    admin: {
      label: 'Administrator',
      className: 'bg-red-100 text-red-800'
    },
    user: {
      label: 'User',
      className: 'bg-blue-100 text-blue-800'
    },
    'view-only': {
      label: 'View Only',
      className: 'bg-gray-100 text-gray-800'
    }
  };

  const config = roleConfig[role];

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
};
