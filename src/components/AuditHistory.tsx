import React from 'react';
import { useApp } from '../AppContext';
import { 
  History, 
  User, 
  Calendar, 
  Info, 
  Search,
  Plus,
  Edit,
  Trash2,
  Users,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { Card } from '@/src/components/ui';

export default function AuditHistory() {
  const { auditLogs } = useApp();
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredLogs = auditLogs.filter(log => 
    log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getLogIcon = (action: string) => {
    switch (action) {
      case 'create_lead': return <Plus className="w-4 h-4 text-green-500" />;
      case 'update_lead': return <Edit className="w-4 h-4 text-blue-500" />;
      case 'delete_lead': return <Trash2 className="w-4 h-4 text-red-500" />;
      case 'user_management': return <Users className="w-4 h-4 text-purple-500" />;
      case 'sync_sheets': return <RefreshCw className="w-4 h-4 text-orange-500" />;
      default: return <Info className="w-4 h-4 text-[var(--color-text-dim)]" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-[var(--color-text-main)] mb-1 uppercase italic">Activity Feed</h1>
          <p className="text-[var(--color-text-dim)] font-medium">History of all actions performed in CRM</p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-dim)]" />
          <input 
            type="text" 
            placeholder="Search activity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border-main)] h-11 pl-10 pr-4 rounded-xl outline-none focus:border-accent text-sm transition-all"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <Card className="p-12 border-dashed border-2 grow flex flex-col items-center justify-center text-center bg-transparent border-[var(--color-border-main)]">
            <div className="w-16 h-16 bg-[var(--color-bg-main)] rounded-full flex items-center justify-center mb-4 border border-[var(--color-border-main)]">
              <History className="w-8 h-8 text-[var(--color-text-dim)]" />
            </div>
            <h3 className="text-lg font-bold text-[var(--color-text-main)]">No activity found</h3>
            <p className="text-[var(--color-text-dim)] max-w-xs">There are no records matching your current filter.</p>
          </Card>
        ) : (
          filteredLogs.map((log) => (
            <Card key={log.id} className="p-4 bg-[var(--color-bg-card)] border-[var(--color-border-main)] hover:border-accent/30 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-main)] border border-[var(--color-border-main)] flex items-center justify-center shrink-0">
                  {getLogIcon(log.action)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-1">
                    <h4 className="font-bold text-[var(--color-text-main)] flex items-center gap-2">
                      {log.username}
                      <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] font-black text-[var(--color-text-dim)] rounded-full">
                        {log.action.replace('_', ' ')}
                      </span>
                    </h4>
                    <span className="text-xs text-[var(--color-text-dim)] flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(log.timestamp), 'dd MMM yyyy, hh:mm a')}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-dim)] leading-relaxed italic">
                    "{log.details}"
                  </p>
                  {log.entityName && (
                    <div className="mt-2 text-[10px] text-accent font-bold uppercase tracking-widest flex items-center gap-1">
                      Target: {log.entityName}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
