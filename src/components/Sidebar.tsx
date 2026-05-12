import React, { useState } from 'react';
import { useApp } from '@/src/AppContext';
import { db } from '@/src/lib/firebase';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { 
  BarChart3, 
  Users, 
  UserPlus, 
  FileBox, 
  Calendar, 
  Settings, 
  LogOut,
  Bell,
  Building2,
  PieChart,
  Sun,
  Moon,
  Check,
  Activity,
  XOctagon,
  History
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Logo } from './Logo';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout, notifications, markNotificationRead, theme, toggleTheme, activeTab, setActiveTab, hasPermission } = useApp();
  const [showNotifs, setShowNotifs] = useState(false);
  const [skippedCount, setSkippedCount] = useState(0);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onClose();
  };

  React.useEffect(() => {
    if (!hasPermission('manage_settings')) return;
    
    const q = query(collection(db, 'skipped_leads'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSkippedCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [hasPermission]);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, permission: 'view_dashboard', num: '01' },
    { id: 'leads', label: 'Lead Tracker', icon: FileBox, permission: 'view_leads', num: '02' },
    { id: 'tasks', label: 'Task Board', icon: Activity, permission: 'view_tasks', num: '03' },
    { id: 'inventory', label: 'Inventory', icon: Building2, permission: 'view_leads', num: '04' },
    { id: 'chat', label: 'Team Chat', icon: Bell, permission: 'view_chat', num: '05' },
    { id: 'audit', label: 'Activity Feed', icon: History, permission: 'view_audit', num: '06' },
    { id: 'skipped', label: 'Skipped Leads', icon: XOctagon, permission: 'view_skipped', num: '07' },
    { id: 'users', label: 'User Management', icon: UserPlus, permission: 'view_users', num: '08' },
    { id: 'settings', label: 'Settings', icon: Settings, permission: 'manage_settings', num: '09' },
  ];

  const filteredItems = menuItems.filter(item => 
    hasPermission(item.permission as any)
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 w-64 bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border-main)] flex flex-col h-full transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:block z-50 text-slate-300 shadow-xl",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="p-8 pb-6 flex justify-between items-start">
        <div>
          <Logo theme="dark" className="h-9" />
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowNotifs(!showNotifs)}
            className="focus:outline-none p-1 rounded-full hover:bg-[var(--color-text-main)]/5 transition-colors"
          >
            <Bell className={cn(
              "w-5 h-5 transition-colors cursor-pointer",
              unreadCount > 0 ? "text-accent animate-pulse" : "text-[var(--color-text-sidebar-dim)] hover:text-[var(--color-text-sidebar)]"
            )} />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-[7px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border-2 border-[var(--color-bg-sidebar)] shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>
          
          {/* System Alerts Dropdown */}
          {showNotifs && (
            <div className="absolute left-0 mt-4 w-72 bg-[var(--color-bg-card)] border border-[var(--color-border-main)] rounded-2xl shadow-3xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-[var(--color-border-main)] bg-[var(--color-bg-sidebar)] flex justify-between items-center px-4">
                <p className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-sidebar-dim)]">System Alerts</p>
                {unreadCount > 0 && <span className="text-[8px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-bold uppercase">{unreadCount} New</span>}
              </div>
              <div className="max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-accent bg-[var(--color-bg-card)]">
                {notifications.length > 0 ? (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      className={cn(
                        "p-4 border-b border-[var(--color-border-main)]/30 hover:bg-[var(--color-text-main)]/[0.03] transition-colors group",
                        n.read ? "opacity-50" : "bg-accent/[0.03]"
                      )}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[8px] font-mono text-[var(--color-text-dim)] uppercase italic">
                          {format(new Date(n.createdAt), 'dd MMM, HH:mm')}
                        </span>
                        {!n.read && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); markNotificationRead(n.id); }}
                            className="p-1 text-accent hover:bg-accent/10 rounded transition-colors"
                            title="Mark as read"
                          >
                            <Check className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                      <h4 className="text-[10px] font-bold text-[var(--color-text-main)] uppercase tracking-tight mb-1">{n.title}</h4>
                      <p className="text-[10px] text-[var(--color-text-dim)] italic font-serif leading-tight line-clamp-2">
                        "{n.message}"
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-10 text-center">
                    <p className="text-[10px] italic text-[var(--color-text-dim)] uppercase tracking-widest">Sky is clear</p>
                  </div>
                )}
              </div>
              {notifications.length > 0 && (
                <div className="p-4 bg-[var(--color-bg-sidebar)]/30 text-center border-t border-[var(--color-border-main)]">
                  <p className="text-[8px] uppercase font-bold text-[var(--color-text-dim)] tracking-widest">Monitoring Link Active</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-6 pb-8">
        <button 
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-5 py-2.5 bg-[var(--color-bg-main)]/20 border border-[var(--color-border-main)]/5 rounded-full text-[9px] uppercase tracking-widest font-black text-slate-500 hover:border-accent/40 group transition-all"
        >
          <span className="group-hover:text-accent font-sans">{theme === 'dark' ? 'Matte Night' : 'Airy Light'}</span>
          {theme === 'dark' ? (
            <Moon className="w-3.5 h-3.5 text-accent" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-accent" />
          )}
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-none">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabChange(item.id)}
            className={cn(
              "w-full flex items-center px-4 py-3.5 text-sm font-medium transition-all group relative rounded-lg",
              activeTab === item.id 
                ? "text-[var(--color-text-sidebar)] bg-accent/10 border-r-2 border-accent" 
                : "text-slate-400 hover:bg-[var(--color-text-sidebar)]/5 hover:text-[var(--color-text-sidebar)]"
            )}
          >
            <span className={cn(
              "mr-4 italic font-serif transition-opacity text-base",
              activeTab === item.id ? "opacity-100 text-accent font-bold" : "opacity-30"
            )}>
              {item.num}
            </span>
            <span className={cn(
              "tracking-tight text-[11px] font-bold uppercase",
              activeTab === item.id ? "text-accent" : ""
            )}>{item.label}</span>
            {item.id === 'skipped' && skippedCount > 0 && (
              <span className="ml-auto bg-red-500/20 text-red-500 text-[9px] font-black px-2 py-0.5 rounded-full border border-red-500/20 group-hover:bg-red-500 group-hover:text-white transition-all">
                {skippedCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="p-6 mt-auto border-t border-[var(--color-border-main)]/10 bg-[var(--color-bg-main)]/10">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-black/20 border border-[var(--color-border-main)]/20">
            {user?.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--color-text-sidebar)] uppercase truncate leading-none">{user?.name}</p>
            <p className="text-[10px] text-[var(--color-text-sidebar-dim)] font-medium truncate mt-1.5">{user?.role}</p>
          </div>
        </div>
        
        <button 
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-[var(--color-border-main)]/20 rounded-lg text-[10px] uppercase tracking-widest text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all font-bold"
        >
          <LogOut className="w-3 h-3" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
