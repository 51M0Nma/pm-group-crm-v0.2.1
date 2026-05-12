import React, { useState } from 'react';
import { AppProvider, useApp } from './AppContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import LeadsManager from './components/LeadsManager';
import Tasks from './components/Tasks';
import Chat from './components/Chat';
import SkippedLeads from './components/SkippedLeads';
import UserManagement from './components/UserManagement';
import AuditHistory from './components/AuditHistory';
import Settings from './components/Settings';
import Inventory from './components/Inventory';
import { Card, Button, Input } from './components/ui';
import { format } from 'date-fns';
import { Calendar, CheckCircle2, Circle, Clock, MessageSquare, AlertCircle, Bell } from 'lucide-react';
import { cn } from './lib/utils';
import { ToastContainer } from './components/Toast';

function DashboardContent() {
  const { user, theme, activeTab } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'leads': return <LeadsManager />;
      case 'tasks': return <Tasks />;
      case 'inventory': return <Inventory />;
      case 'chat': return <Chat />;
      case 'skipped': return <SkippedLeads />;
      case 'audit': return <AuditHistory />;
      case 'users': return <UserManagement />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-[var(--color-bg-main)] overflow-hidden text-[var(--color-text-main)] transition-colors" data-theme={theme}>
      <ToastContainer />
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-[var(--color-bg-sidebar)] border-b border-[var(--color-border-main)] z-30 text-[var(--color-text-sidebar)]">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </Button>
          <div className="flex-1 flex justify-center">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">CRM • IDR</span>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10 lg:p-16 relative">
          <div className="max-w-7xl mx-auto w-full">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

function Root() {
  const { user } = useApp();
  return user ? <DashboardContent /> : <Login />;
}

export default function App() {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}
