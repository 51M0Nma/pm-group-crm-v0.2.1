import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SyncLog } from '../types';
import { format } from 'date-fns';
import { 
  History, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw,
  Search,
  Activity,
  Zap,
  ToggleLeft as Toggle,
  Settings
} from 'lucide-react';
import { Card, Button } from './ui';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function SyncLogs() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'sync_logs'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as SyncLog[];
      setLogs(logsData);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error in SyncLogs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const triggerSync = async () => {
    console.log('--- [SyncLogs] triggerSync initiated ---');
    setIsSyncing(true);
    try {
      // Pre-check
      const health = await fetch('/api/health').catch(() => ({ ok: false }));
      if (!health.ok) {
        console.warn('Sync server appears unreachable via health check.');
      }

      const response = await fetch('/api/sync-sheets', { method: 'POST' });
      console.log('--- [SyncLogs] server responded ---', response.status);
      const data = await response.json();
      if (data.success) {
        if (data.skipped) {
          console.log('--- [SyncLogs] sync skipped ---', data.reason);
        }
      } else {
        console.error("Manual sync failed:", data.error);
      }
    } catch (err: any) {
      console.error("Failed to trigger sync:", err);
      if (err.message?.includes('Failed to fetch')) {
        console.warn('Sync request timed out or network failed. Check sheet sizes.');
      }
    } finally {
      console.log('--- [SyncLogs] triggerSync completed ---');
      setIsSyncing(false);
    }
  };

  const filteredLogs = logs.filter(log => 
    log.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.error && log.error.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h3 className="text-accent text-[10px] uppercase tracking-[0.3em] font-black flex items-center gap-2">
            <Activity className="w-3 h-3" />
            System Operations
          </h3>
          <h1 className="serif text-4xl md:text-5xl lg:text-6xl italic text-[var(--color-text-main)] mt-2">Sync Journal</h1>
          <p className="text-[10px] text-[var(--color-text-dim)] font-bold uppercase tracking-widest mt-2 max-w-md">
            Comprehensive audit of all manual synchronization task cycles from asset spreadsheets.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <button 
            onClick={triggerSync}
            disabled={isSyncing}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg w-full sm:w-auto justify-center",
              isSyncing 
                ? "bg-[var(--color-bg-sidebar)] text-[var(--color-text-dim)] cursor-not-allowed border border-[var(--color-border-main)]"
                : "bg-accent text-white hover:bg-amber-600 shadow-accent/10"
            )}
          >
            <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
            {isSyncing ? 'Syncing...' : 'Force Sync Now'}
          </button>
          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-dim)] group-focus-within:text-accent transition-colors" />
            <input 
              placeholder="FILTER LOGS..." 
              className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border-main)] rounded-xl pl-12 pr-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-main)] outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center bg-[var(--color-bg-card)] rounded-3xl border border-[var(--color-border-main)]">
          <RefreshCw className="w-10 h-10 text-accent animate-spin mb-4" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-dim)]">Retrieving Audit Rails...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center bg-[var(--color-bg-card)] rounded-3xl border border-[var(--color-border-main)] border-dashed">
          <History className="w-12 h-12 text-[var(--color-text-dim)] opacity-20 mb-4" />
          <h3 className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-tighter">No logs recorded</h3>
          <p className="text-[10px] text-[var(--color-text-dim)] font-medium mt-2">Sync operations have not been executed or logged yet.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence mode="popLayout">
            {filteredLogs.map((log, idx) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className={cn(
                  "relative overflow-hidden p-6 border-[var(--color-border-main)] bg-[var(--color-bg-card)] transition-all hover:border-accent/40",
                  log.status === 'Failed' ? "border-l-4 border-l-red-500" : "border-l-4 border-l-green-500"
                )}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shadow-lg",
                        log.status === 'Success' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                      )}>
                        {log.status === 'Success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                            log.status === 'Success' ? "text-green-500 border-green-500/20 bg-green-500/5" : "text-red-500 border-red-500/20 bg-red-500/5"
                          )}>
                            Cycle {log.status}
                          </span>
                          <span className="text-[10px] font-bold text-[var(--color-text-dim)] flex items-center gap-1.5 uppercase tracking-widest">
                            <Clock className="w-3 h-3" />
                            {format(new Date(log.timestamp), 'dd MMM yyyy • HH:mm:ss')}
                          </span>
                        </div>
                        {log.status === 'Failed' && log.error && (
                          <p className="text-xs text-red-400 font-medium mt-2 bg-red-500/5 p-3 rounded-lg border border-red-500/10 max-w-2xl font-mono">
                            {log.error}
                          </p>
                        )}
                        {log.status === 'Success' && (
                          <div className="flex flex-wrap items-center gap-6 mt-4">
                            <Stat label="Imported" value={log.imported} icon={ArrowUpRight} color="text-green-500" />
                            <Stat label="Updated" value={log.updated} icon={RefreshCw} color="text-accent" />
                            <Stat label="Skipped" value={log.skipped} icon={XCircle} color="text-[var(--color-text-dim)]" />
                            <div className="h-4 w-px bg-[var(--color-border-main)]" />
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-[var(--color-text-dim)] uppercase tracking-widest">Latency</span>
                              <span className="text-xs font-mono text-[var(--color-text-main)]">{log.duration}s</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="hidden md:block">
                      <div className="text-[10px] font-black text-[var(--color-text-dim)] uppercase tracking-[0.2em] opacity-30">
                        HASH: {log.id.slice(0, 8)}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon, color }: any) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("p-1.5 rounded-lg bg-[var(--color-bg-main)]", color)}>
        <Icon className="w-3 h-3" />
      </div>
      <div className="flex flex-col">
        <span className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-dim)] leading-none mb-1">{label}</span>
        <span className="text-sm font-black text-[var(--color-text-main)] leading-none">{value || 0}</span>
      </div>
    </div>
  );
}
