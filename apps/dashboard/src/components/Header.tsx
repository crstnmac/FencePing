'use client';

import { Bell, User, Building, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
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
    <header className="bg-white border-b border-neutral-200" style={{ padding: 'var(--space-lg) var(--space-xl)' }}>
      <div className="flex items-center justify-between max-w-full">
        <div className="flex items-center" style={{ gap: 'var(--space-md)' }}>
          {organization && (
            <div className="flex items-center" style={{ gap: 'var(--space-md)' }}>
              <div className="w-8 h-8 bg-neutral-100 rounded-md flex items-center justify-center">
                <Building className="h-4 w-4 text-neutral-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-neutral-500">{user?.email}</p>
              </div>
            </div>
          )}

          <div className="h-6 w-px bg-neutral-200" />

          <div className="min-w-0">
            <h1 className="text-2xl font-light text-neutral-900 tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-neutral-600 font-light" style={{ marginTop: 'var(--space-xs)' }}>{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
          <SocketStatus />

          <button
            onClick={toggleSidebar}
            className="text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-all duration-150"
            style={{ padding: 'var(--space-sm)' }}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>

          <button className="text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-all duration-150" style={{ padding: 'var(--space-sm)' }}>
            <Bell className="h-4 w-4" />
          </button>

          <div className="flex items-center" style={{ gap: 'var(--space-md)', marginLeft: 'var(--space-sm)' }}>
            <div className="text-right min-w-0">
              <div className="text-sm font-medium text-neutral-900 truncate">{user?.name || 'User'}</div>
              <div className="text-xs text-neutral-500 truncate">{user?.email || 'user@geofence.com'}</div>
            </div>
            <button className="text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-all duration-150" style={{ padding: 'var(--space-sm)' }}>
              <User className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
