'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import { useSidebar } from '../contexts/SidebarContext';
import {
  Map,
  Smartphone,
  Zap,
  Settings,
  Activity,
  MapPin,
  Webhook,
  BarChart3,
  LogOut,
  User,
  TrendingUp,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Devices', href: '/devices', icon: Smartphone },
  { name: 'Geofences', href: '/geofences', icon: MapPin },
  { name: 'Events', href: '/events', icon: Activity },
  { name: 'Automations', href: '/automations', icon: Zap },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'Integrations', href: '/integrations', icon: Webhook },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, organization, logout } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();

  const handleLogout = () => {
    logout()
  };

  return (
    <div className={`bg-white shadow-sm border-r border-gray-200 h-full flex flex-col transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-44'}`}>
      <div className="flex-1">
        <div className="p-3 flex items-center justify-between">
          <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : ''}`}>
            <MapPin className="h-7 w-7 text-blue-600 flex-shrink-0" />
            {!isCollapsed && <h1 className="text-lg font-semibold text-gray-900 ml-2">GeoFence</h1>}
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-gray-50 transition-all duration-200 flex-shrink-0"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-600" /> : <ChevronLeft className="h-4 w-4 text-gray-600" />}
          </button>
        </div>

        <nav className="px-2">
          <ul className="space-y-0.5">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`
                      flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-200
                      ${isActive
                        ? 'bg-blue-50 text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                      }
                    `}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* User section */}
      <div className="p-2 border-t border-gray-200">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{organization?.name}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-2.5">
            <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-blue-600" />
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-2.5 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200`}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span className="whitespace-nowrap">Sign out</span>}
        </button>
      </div>
    </div>
  );
}
