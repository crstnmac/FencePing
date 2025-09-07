'use client';

import { Bell, User, Building } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user, organization } = useAuth();

  return (
    <div className="bg-white shadow-sm border-b border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Account info */}
          {organization && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                <Building className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900">{organization.name}</p>
                <p className="text-xs text-gray-500">Account</p>
              </div>
            </div>
          )}

          <div className="border-l border-gray-200 h-12 mx-2" />

          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-xs text-gray-600 mt-1">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
            <Bell className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-medium text-gray-900">{user?.name || 'User'}</div>
              <div className="text-xs text-gray-500">{user?.email || 'user@geofence.com'}</div>
            </div>
            <button className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
              <User className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
