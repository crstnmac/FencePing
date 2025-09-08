'use client';

import { Bell, User, Building, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import { SocketStatus } from './SocketStatus';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user, organization } = useAuth();

  const { toggleSidebar, isCollapsed } = useSidebar();

  return (
    <div className="bg-white shadow-sm border-b border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Account info */}
          {organization && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-100 rounded-md flex items-center justify-center">
                <Building className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900 truncate max-w-32">{organization.name}</p>
                <p className="text-xs text-gray-500">Account</p>
              </div>
            </div>
          )}

          <div className="border-l border-gray-200 h-10 mx-1.5" />

          <div>
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SocketStatus />
          
          <button
            onClick={toggleSidebar}
            className="p-1.5 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-50 transition-all duration-200"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          
          <button className="p-1.5 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-50 transition-all duration-200">
            <Bell className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="text-right min-w-0">
              <div className="text-xs font-medium text-gray-900 truncate max-w-24">{user?.name || 'User'}</div>
              <div className="text-xs text-gray-500 truncate max-w-24">{user?.email || 'user@geofence.com'}</div>
            </div>
            <button className="p-1.5 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-50 transition-all duration-200">
              <User className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
