'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
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
  User
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Map', href: '/map', icon: Map },
  { name: 'Devices', href: '/devices', icon: Smartphone },
  { name: 'Geofences', href: '/geofences', icon: MapPin },
  { name: 'Automations', href: '/automations', icon: Zap },
  { name: 'Integrations', href: '/integrations', icon: Webhook },
  { name: 'Events', href: '/events', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, organization, logout } = useAuth();

  const handleLogout = () => {
    logout()
  };

  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200 h-full flex flex-col">
      <div className="flex-1">
        <div className="p-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-8 w-8 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">GeoFence</h1>
          </div>
        </div>

        <nav className="px-3">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
                      ${isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* User section */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{organization?.name}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}