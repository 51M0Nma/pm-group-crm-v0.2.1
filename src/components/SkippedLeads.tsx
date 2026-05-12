import React, { useState, useMemo } from 'react';
import { useApp } from '@/src/AppContext';
import { Button, Card, Input, Checkbox } from '@/src/components/ui';
import { cn } from '@/src/lib/utils';
import { ShieldCheck, XOctagon, ChevronLeft, Trash2, Search, Filter, RefreshCw, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function SkippedLeads() {
  const { skippedLeads, setActiveTab, clearSkippedLeads, bulkDeleteSkippedLeads, hasPermission, restoreSkippedLead } = useApp();
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [isDeleteSelectedOpen, setIsDeleteSelectedOpen] = React.useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [reasonFilter, setReasonFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const reasons = useMemo(() => {
    const r = new Set(skippedLeads.map(l => l.reason));
    return ['All', ...Array.from(r)].sort();
  }, [skippedLeads]);

  const sources = useMemo(() => {
    const s = new Set(skippedLeads.map(l => l.source));
    return ['All', ...Array.from(s)].sort();
  }, [skippedLeads]);

  const filteredLeads = useMemo(() => {
    return skippedLeads.filter(lead => {
      const matchesSearch = searchTerm === '' || 
        lead.info.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.reason.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesReason = reasonFilter === 'All' || lead.reason === reasonFilter;
      const matchesSource = sourceFilter === 'All' || lead.source === sourceFilter;
      
      let matchesDate = true;
      if (startDate || endDate) {
        const timestamp = new Date(lead.timestamp || '').getTime();
        if (startDate) {
          const start = new Date(startDate).getTime();
          if (timestamp < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (timestamp > end.getTime()) matchesDate = false;
        }
      }

      return matchesSearch && matchesReason && matchesSource && matchesDate;
    }).sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  }, [skippedLeads, searchTerm, reasonFilter, sourceFilter, startDate, endDate]);

  const handleClearLog = async () => {
    await clearSkippedLeads();
    setIsConfirmOpen(false);
    setSelectedIds([]);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    await bulkDeleteSkippedLeads(selectedIds);
    setSelectedIds([]);
    setIsDeleteSelectedOpen(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredLeads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLeads.map(l => l.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-0 h-auto hover:bg-transparent text-amber-500/50 hover:text-amber-500 transition-colors"
              onClick={() => setActiveTab('leads')}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-widest font-black ml-1">Back to Portfolio</span>
            </Button>
          </div>
          <h1 className="serif text-4xl md:text-5xl italic text-[var(--color-text-main)]">
            Skipped Assets
          </h1>
          <p className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-[0.2em] font-black mt-2">
            Audit Log of Filtered Resource Synchronizations
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          {hasPermission('purge_leads') && selectedIds.length > 0 && (
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteSelectedOpen(true)}
              className="bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500 hover:text-white text-[10px] h-10 px-6 rounded-full uppercase font-black transition-all shadow-lg shadow-orange-900/10"
            >
              <Trash2 className="w-3 h-3 mr-2" />
              Delete Selected ({selectedIds.length})
            </Button>
          )}
          {hasPermission('purge_leads') && skippedLeads.length > 0 && (
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmOpen(true)}
              className="bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500 hover:text-white text-[10px] h-10 px-6 rounded-full uppercase font-black transition-all shadow-lg shadow-rose-900/10"
            >
              <Trash2 className="w-3 h-3 mr-2" />
              Purge Log
            </Button>
          )}
        </div>
      </header>

      {/* Filter Section */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-main)] rounded-3xl p-6 shadow-xl mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-1 border-r border-[var(--color-border-main)] pr-6 space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-black text-accent ml-1 mb-3">Resource Search</p>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-dim)] group-focus-within:text-accent transition-colors" />
              <Input 
                placeholder="Search Row info..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 h-12 bg-[var(--color-bg-main)] border-[var(--color-border-main)] rounded-xl text-[11px] font-bold uppercase tracking-widest outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)] ml-1">Skip Reason</p>
            <select 
              value={reasonFilter}
              onChange={e => setReasonFilter(e.target.value)}
              className="w-full h-12 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none px-4 focus:border-accent text-[var(--color-text-dim)] appearance-none cursor-pointer"
            >
              {reasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)] ml-1">Data Source</p>
            <select 
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="w-full h-12 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none px-4 focus:border-accent text-[var(--color-text-dim)] appearance-none cursor-pointer"
            >
              {sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)] ml-1">Range Start</p>
            <Input 
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="h-12 bg-[var(--color-bg-main)] border-[var(--color-border-main)] rounded-xl text-[11px] font-bold uppercase tracking-widest outline-none px-4 focus:border-accent"
            />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)] ml-1">Range End</p>
              <Input 
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="h-12 bg-[var(--color-bg-main)] border-[var(--color-border-main)] rounded-xl text-[11px] font-bold uppercase tracking-widest outline-none px-4 focus:border-accent"
              />
            </div>
            <Button 
              variant="outline"
              className="h-12 w-12 p-0 border-[var(--color-border-main)] hover:bg-accent/5 hover:text-accent rounded-xl"
              onClick={() => {
                setSearchTerm('');
                setReasonFilter('All');
                setSourceFilter('All');
                setStartDate('');
                setEndDate('');
              }}
              title="Reset Filters"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {filteredLeads.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border-main)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox 
                id="select-all-skipped" 
                checked={selectedIds.length === filteredLeads.length && filteredLeads.length > 0} 
                onCheckedChange={toggleSelectAll}
                className="border-[var(--color-border-main)] data-[state=checked]:bg-accent data-[state=checked]:border-accent"
              />
              <label htmlFor="select-all-skipped" className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)] cursor-pointer hover:text-accent transition-colors">
                Select All Filtered ({filteredLeads.length})
              </label>
            </div>
            {selectedIds.length > 0 && (
              <span className="text-[10px] uppercase tracking-[0.2em] font-black text-orange-500/70">
                {selectedIds.length} items staged for removal
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bulk Delete Selected Modal */}
      {isDeleteSelectedOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[var(--color-bg-card)] max-w-md w-full border border-orange-500/30 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-orange-500/10 bg-orange-500/5">
              <div className="flex items-center gap-3 text-orange-500 mb-2">
                <Trash2 className="w-6 h-6" />
                <h2 className="serif text-2xl italic font-light">Delete Selected?</h2>
              </div>
              <p className="text-[10px] text-orange-400 uppercase tracking-widest font-black font-mono">Selective Removal</p>
            </div>
            
            <div className="p-8 space-y-6">
              <p className="text-sm text-[var(--color-text-dim)] leading-relaxed italic">
                You are about to remove {selectedIds.length} selected entries from the audit log. This action cannot be reversed.
              </p>
              
              <div className="flex flex-col gap-3 mt-6">
                <Button 
                   className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest text-[10px] border-none shadow-lg shadow-orange-900/20"
                  onClick={handleBulkDelete}
                >
                  DELETE {selectedIds.length} ENTRIES
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full text-[var(--color-text-dim)] hover:text-accent font-bold uppercase tracking-widest text-[9px]"
                  onClick={() => setIsDeleteSelectedOpen(false)}
                >
                  CANCEL
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[var(--color-bg-card)] max-w-md w-full border border-rose-500/30 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-rose-500/10 bg-rose-500/5">
              <div className="flex items-center gap-3 text-rose-500 mb-2">
                <Trash2 className="w-6 h-6" />
                <h2 className="serif text-2xl italic font-light">Purge Logs?</h2>
              </div>
              <p className="text-[10px] text-rose-400 uppercase tracking-widest font-black font-mono">DANGER ZONE</p>
            </div>
            
            <div className="p-8 space-y-6">
              <p className="text-sm text-[var(--color-text-dim)] leading-relaxed italic">
                You are about to eliminate the entire audit trail for skipped leads. This action is terminal and cannot be reversed.
              </p>
              
              <div className="flex flex-col gap-3 mt-6">
                <Button 
                   className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest text-[10px] border-none shadow-lg shadow-rose-900/20"
                  onClick={handleClearLog}
                >
                  EXECUTE LOG PURGE
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full text-[var(--color-text-dim)] hover:text-accent font-bold uppercase tracking-widest text-[9px]"
                  onClick={() => setIsConfirmOpen(false)}
                >
                  ABORT SEQUENCE
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card className="p-0 overflow-hidden border-[var(--color-border-main)] bg-[var(--color-bg-card)] shadow-2xl">
        <div className="p-8 border-b border-[var(--color-border-main)] bg-gradient-to-r from-amber-500/5 to-transparent">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[var(--color-text-main)] uppercase tracking-widest">Integrity Guard Active</h3>
              <p className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-tight font-medium mt-0.5">
                The system has filtered {filteredLeads.length} of {skippedLeads.length} entries.
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-[var(--color-border-main)] bg-[var(--color-bg-card)]">
          {filteredLeads.length === 0 ? (
            <div className="p-24 text-center">
              <div className="w-16 h-16 bg-[var(--color-bg-main)] rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--color-border-main)]">
                <ShieldCheck className="w-8 h-8 text-[var(--color-text-dim)]" />
              </div>
              <p className="text-[var(--color-text-dim)] italic text-sm">No skipped leads matching your criteria were found.</p>
              <p className="text-[9px] text-accent uppercase tracking-widest font-black cursor-pointer hover:underline mt-2" onClick={() => {
                setSearchTerm('');
                setReasonFilter('All');
                setSourceFilter('All');
                setStartDate('');
                setEndDate('');
              }}>Clear all filters</p>
            </div>
          ) : (
            filteredLeads.map((item) => (
              <div key={item.id} className={cn(
                "p-8 hover:bg-[var(--color-text-main)]/[0.02] transition-all group relative overflow-hidden",
                selectedIds.includes(item.id) && "bg-accent/5 ring-1 ring-inset ring-accent/20"
              )}>
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-1 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300",
                  selectedIds.includes(item.id) ? "bg-accent translate-x-0" : "bg-amber-500"
                )} />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-start gap-5">
                    <div className="pt-3">
                      <Checkbox 
                        checked={selectedIds.includes(item.id)} 
                        onCheckedChange={() => toggleSelectOne(item.id)}
                        className="border-[var(--color-border-main)] data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                      />
                    </div>
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300",
                      selectedIds.includes(item.id)
                        ? "bg-accent/10 text-accent border-accent/20 shadow-[0_0_15px_rgba(var(--color-accent-rgb),0.2)]"
                        : item.reason === 'Already in CRM' 
                          ? "bg-amber-500/5 text-amber-500 border-amber-500/20 group-hover:bg-amber-500/10" 
                          : "bg-orange-500/5 text-orange-500 border-orange-500/20 group-hover:bg-orange-500/10"
                    )}>
                      {item.reason === 'Already in CRM' ? <ShieldCheck className="w-6 h-6" /> : <XOctagon className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className={cn(
                          "text-base font-bold transition-colors",
                          selectedIds.includes(item.id) ? "text-accent" : "text-[var(--color-text-main)] group-hover:text-accent"
                        )}>
                          {item.info.split(' - ')[0]}
                        </h4>
                        <span className="px-2 py-0.5 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded text-[9px] text-[var(--color-text-dim)] font-black tracking-widest uppercase">
                          Row {item.row}
                        </span>
                        {selectedIds.includes(item.id) && (
                          <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-accent animate-in fade-in zoom-in-95 duration-300">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Selected
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--color-text-dim)] font-medium mt-1 group-hover:text-[var(--color-text-main)] transition-colors">
                        {item.info}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[9px] text-[var(--color-text-dim)] uppercase tracking-widest font-black">
                          {item.timestamp ? format(new Date(item.timestamp), 'MMM dd, HH:mm') : 'Unknown Time'}
                        </span>
                        <span className="w-1 h-1 bg-[var(--color-border-main)] rounded-full" />
                        <span className="text-[9px] text-accent uppercase tracking-widest font-black group-hover:text-accent/80 transition-colors">
                          {item.source}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {item.reason === 'Permanently Dismissed' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 border-accent/20 text-accent hover:bg-accent hover:text-white transition-all text-[8px] uppercase tracking-widest font-black"
                        onClick={() => {
                          if (window.confirm("Remove this entry? If the lead is still in the source sheet, it will re-appear during the next sync.")) {
                            restoreSkippedLead(item.id);
                          }
                        }}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Restore Logic
                      </Button>
                    )}
                    <span className={cn(
                      "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border shadow-sm",
                      item.reason === 'Already in CRM' 
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                        : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                    )}>
                      {item.reason}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="p-10 bg-amber-500/5 border border-amber-500/10 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
        <div className="absolute right-0 top-0 bottom-0 w-64 bg-gradient-to-l from-amber-500/5 to-transparent pointer-events-none" />
        <div className="relative z-10 text-center md:text-left">
          <h4 className="text-base font-black text-amber-500 uppercase tracking-widest">Maintenance Protocol</h4>
          <p className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-[0.2em] mt-1 font-bold">
            Audit logs are retained for 30 days to ensure synchronization transparency and prevent resource drift.
          </p>
        </div>
        <div className="relative z-10 shrink-0">
          <Button 
            variant="outline" 
            className="border-amber-500/20 hover:bg-amber-500 text-amber-500 hover:text-white transition-all duration-300 font-black text-[10px] uppercase tracking-widest h-12 px-8 rounded-xl"
            onClick={() => setActiveTab('leads')}
          >
            Acknowledge & Exit
          </Button>
        </div>
      </div>
    </div>
  );
}
