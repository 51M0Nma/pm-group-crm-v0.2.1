import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { Card, Button, Input } from './ui';
import { Upload, Trash2, Check, AlertCircle, Settings as SettingsIcon, XOctagon, Activity, Plus, ExternalLink, RefreshCw, Eye, Download, Loader2 } from 'lucide-react';
import SkippedLeads from './SkippedLeads';
import SyncLogs from './SyncLogs';
import { cn } from '../lib/utils';
import { SheetConfig } from '../types';

type SettingsTab = 'general' | 'skipped' | 'sync_logs';

export default function Settings() {
  const { 
    logoUrl, updateLogoUrl, theme, toggleTheme, showToast, 
    normalizeJunkLeads, leads, standardizeAssetTypes,
    sheetConfigs, addSheetConfig, updateSheetConfig, removeSheetConfig 
  } = useApp();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Sheet Management State
  const [isAddingSheet, setIsAddingSheet] = useState(false);
  const [editingSheet, setEditingSheet] = useState<SheetConfig | null>(null);
  const [sheetFormData, setSheetFormData] = useState({
    name: '',
    url: '',
    sheetIndex: 1,
    mappings: {} as Record<string, string>
  });
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSheet, setPreviewSheet] = useState<SheetConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDeleteClick = async (config: SheetConfig) => {
    if (confirmDelete !== config.id) {
      setConfirmDelete(config.id);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }

    setIsDeleting(config.id);
    try {
      await removeSheetConfig(config.id);
      setConfirmDelete(null);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogoUrl) return;
    
    setIsUploading(true);
    try {
      await updateLogoUrl(newLogoUrl);
      setMessage({ type: 'success', text: 'Logo updated successfully!' });
      setNewLogoUrl('');
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update logo.' });
    } finally {
      setIsUploading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) {
      setMessage({ type: 'error', text: 'File too large. Max 800KB.' });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = reader.result as string;
        await updateLogoUrl(base64String);
        setMessage({ type: 'success', text: 'Logo uploaded successfully!' });
      } catch (error) {
        setMessage({ type: 'error', text: 'Upload failed.' });
      } finally {
        setIsUploading(false);
        setTimeout(() => setMessage(null), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = async () => {
    try {
      await updateLogoUrl(null);
      setMessage({ type: 'success', text: 'Logo removed. Using default.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove logo.' });
    } finally {
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleSheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetFormData.name || !sheetFormData.url) return;

    if (editingSheet) {
      await updateSheetConfig(editingSheet.id, sheetFormData);
    } else {
      await addSheetConfig(sheetFormData);
    }
    
    setIsAddingSheet(false);
    setEditingSheet(null);
    setSheetFormData({ name: '', url: '', sheetIndex: 1, mappings: {} });
    setSheetHeaders([]);
  };

  const startEditSheet = (sheet: SheetConfig) => {
    setEditingSheet(sheet);
    setSheetFormData({
      name: sheet.name,
      url: sheet.url,
      sheetIndex: sheet.sheetIndex,
      mappings: sheet.mappings || {}
    });
    setSheetHeaders([]);
    setIsAddingSheet(true);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="grid gap-6 md:grid-cols-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="p-6 space-y-6 bg-[var(--color-bg-card)] border-[var(--color-border-main)]">
              <div>
                <h2 className="text-xl font-semibold mb-1">Branding</h2>
                <p className="text-sm text-[var(--color-text-dim)]">Customize the application logo.</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="h-20 w-20 rounded-lg border border-[var(--color-border-main)] bg-[var(--color-bg-main)] flex items-center justify-center overflow-hidden">
                    {logoUrl ? (
                      <img src={logoUrl} alt="App Logo" className="h-full w-full object-contain" />
                    ) : (
                      <div className="text-[var(--color-text-dim)] text-xs font-bold">DEFAULT LOGO</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">Application Logo</p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="relative overflow-hidden"
                        disabled={isUploading}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Image
                        <input 
                          type="file" 
                          className="absolute inset-0 opacity-0 cursor-pointer" 
                          accept="image/*"
                          onChange={handleFileUpload}
                        />
                      </Button>
                      {logoUrl && (
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={removeLogo}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-[var(--color-border-main)]" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[var(--color-bg-main)] px-2 text-[var(--color-text-dim)]">Or provide a URL</span>
                  </div>
                </div>

                <form onSubmit={handleUrlSubmit} className="flex gap-2">
                  <Input 
                    placeholder="https://example.com/logo.png" 
                    value={newLogoUrl}
                    onChange={(e) => setNewLogoUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isUploading || !newLogoUrl}>
                    Update
                  </Button>
                </form>

                {message && (
                  <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                    message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                  }`}>
                    {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {message.text}
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6 space-y-6 bg-[var(--color-bg-card)] border-[var(--color-border-main)]">
              <div>
                <h2 className="text-xl font-semibold mb-1">Appearance</h2>
                <p className="text-sm text-[var(--color-text-dim)]">Change how the application looks.</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Dark Mode</p>
                    <p className="text-sm text-[var(--color-text-dim)]">Switch between dark and light themes.</p>
                  </div>
                  <Button variant="outline" onClick={toggleTheme}>
                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-6 bg-[var(--color-bg-card)] border-[var(--color-border-main)] col-span-full">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Sheet Sync Configurations</h2>
                  <p className="text-sm text-[var(--color-text-dim)]">Manage multiple Google Sheet sync sources.</p>
                </div>
                {!isAddingSheet && (
                  <Button onClick={() => setIsAddingSheet(true)} className="bg-accent hover:bg-accent/90 text-white rounded-full">
                    <Plus className="w-4 h-4 mr-2" /> Add New Sheet
                  </Button>
                )}
              </div>

              {isAddingSheet ? (
                <form onSubmit={handleSheetSubmit} className="space-y-6 bg-[var(--color-bg-main)] p-6 rounded-2xl border border-[var(--color-border-main)] animate-in fade-in zoom-in-95 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-dim)]">Sheet Nickname</label>
                       <Input 
                         placeholder="e.g. Master Sync, Marketing Leads" 
                         value={sheetFormData.name} 
                         onChange={e => setSheetFormData({ ...sheetFormData, name: e.target.value })} 
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-dim)]">Sharing Link (Public CSV Link)</label>
                       <Input 
                         placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0" 
                         value={sheetFormData.url} 
                         onChange={e => setSheetFormData({ ...sheetFormData, url: e.target.value })} 
                       />
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border-main)]">
                    <Button variant="ghost" onClick={() => { setIsAddingSheet(false); setEditingSheet(null); setSheetFormData({ name: '', url: '', sheetIndex: 1, mappings: {} }); }}>Cancel</Button>
                    <Button type="submit" className="bg-accent hover:bg-accent/90 text-white">
                      {editingSheet ? 'Update Configuration' : 'Save & Enable Sync'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sheetConfigs.length === 0 ? (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-[var(--color-border-main)] rounded-3xl">
                      <Download className="w-12 h-12 text-[var(--color-text-dim)] mx-auto mb-4 opacity-20" />
                      <p className="text-[var(--color-text-dim)] italic">No sheet configurations established yet.</p>
                      <Button variant="ghost" className="mt-4 text-accent" onClick={() => setIsAddingSheet(true)}>Set up your first sync</Button>
                    </div>
                  ) : (
                    sheetConfigs.map(config => (
                      <div key={config.id} className="p-4 rounded-2xl border border-[var(--color-border-main)] bg-[var(--color-bg-card)] group hover:border-accent transition-all">
                        <div className="flex justify-between items-start mb-3">
                           <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
                              <Download className="w-5 h-5 text-accent" />
                           </div>
                           <div className="flex gap-1">
                              <button onClick={() => startEditSheet(config)} className="p-1.5 text-[var(--color-text-dim)] hover:text-accent rounded-lg">
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteClick(config)} 
                                disabled={isDeleting === config.id}
                                className={cn(
                                  "p-1.5 rounded-lg transition-all flex items-center justify-center min-w-[32px] h-8",
                                  isDeleting === config.id 
                                    ? "bg-rose-500/10 text-rose-500 animate-pulse" 
                                    : confirmDelete === config.id
                                      ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20 px-3"
                                      : "text-[var(--color-text-dim)] hover:text-rose-500"
                                )}
                              >
                                {isDeleting === config.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : confirmDelete === config.id ? (
                                  <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Confirm Delete?</span>
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                           </div>
                        </div>
                        <h4 className="font-bold text-[var(--color-text-main)] truncate">{config.name}</h4>
                        <p className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-widest mt-1">ID: ...{config.url.split('/d/')[1]?.substring(0,8)}</p>
                        <div className="mt-4 pt-4 border-t border-[var(--color-border-main)] flex items-center justify-between">
                           <span className={cn(
                             "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter",
                             config.isActive ? "bg-green-500/10 text-green-500" : "bg-rose-500/10 text-rose-500"
                           )}>
                             {config.isActive ? 'Sync Active' : 'Disconnected'}
                           </span>
                           <Button 
                             variant="ghost" 
                             size="sm" 
                             className="h-7 text-[9px] font-black uppercase tracking-widest gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                             onClick={() => {
                               setPreviewSheet(config);
                               setIsPreviewOpen(true);
                             }}
                           >
                             <Eye className="w-3.5 h-3.5" /> Preview Source
                           </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>

            <Card className="p-6 space-y-6 bg-[var(--color-bg-card)] border-rose-500/20 ring-4 ring-rose-500/5 col-span-full">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold mb-1 text-rose-500 flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Data Maintenance
                  </h2>
                  <p className="text-sm text-[var(--color-text-dim)]">Global operations to normalize existing datasets.</p>
                </div>
                {leads.filter(l => l.lifecycleStage?.toUpperCase() === 'JUNK').length > 0 && (
                   <span className="px-3 py-1 bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-widest rounded-full animate-pulse">
                     Detection: {leads.filter(l => l.lifecycleStage?.toUpperCase() === 'JUNK').length} anomalies
                   </span>
                )}
              </div>

              <div className="grid gap-4">
                <div className="bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-rose-600 uppercase tracking-tighter">Normalize Junk Lifecycle Stage</p>
                    <p className="text-[11px] text-[var(--color-text-dim)] mt-1">Converts all leads currently marked as <span className="font-bold text-rose-500">'JUNK'</span> to <span className="font-bold text-green-500">'Closed'</span> for backward compatibility.</p>
                  </div>
                  <Button 
                    onClick={async () => {
                      setIsNormalizing(true);
                      await normalizeJunkLeads();
                      setIsNormalizing(false);
                    }}
                    disabled={isNormalizing || leads.filter(l => l.lifecycleStage?.toUpperCase() === 'JUNK').length === 0}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest text-[10px] items-center gap-2"
                  >
                    {isNormalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {isNormalizing ? 'Processing' : 'Execute Recovery'}
                  </Button>
                </div>

                <div className="bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-amber-600 uppercase tracking-tighter">Standardize Asset Types</p>
                    <p className="text-[11px] text-[var(--color-text-dim)] mt-1">Normalizes property types to <span className="font-bold text-amber-600">'Plot'</span> or <span className="font-bold text-amber-600">'Villa'</span> based on project metadata for all existing leads.</p>
                  </div>
                  <Button 
                    onClick={async () => {
                      setIsNormalizing(true);
                      await standardizeAssetTypes();
                      setIsNormalizing(false);
                    }}
                    disabled={isNormalizing}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-widest text-[10px] items-center gap-2"
                  >
                    {isNormalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {isNormalizing ? 'Standardizing' : 'Sync Asset Metadata'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        );
      case 'skipped':
        return <SkippedLeads />;
      case 'sync_logs':
        return <SyncLogs />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-2">
        <div>
          <h3 className="text-[var(--color-text-dim)] text-[10px] uppercase tracking-widest font-black">Configuration</h3>
          <h1 className="serif text-4xl md:text-5xl lg:text-6xl italic text-[var(--color-text-main)] mt-2">Control Center</h1>
        </div>
        
        {/* Sub-tabs */}
        <div className="flex bg-[var(--color-bg-sidebar)] p-1 rounded-xl border border-[var(--color-border-main)] shadow-sm overflow-x-auto max-w-full">
          <TabButton 
            active={activeTab === 'general'} 
            onClick={() => setActiveTab('general')} 
            icon={SettingsIcon}
            label="General"
          />
          <TabButton 
            active={activeTab === 'skipped'} 
            onClick={() => setActiveTab('skipped')} 
            icon={XOctagon}
            label="Skipped Leads"
          />
          <TabButton 
            active={activeTab === 'sync_logs'} 
            onClick={() => setActiveTab('sync_logs')} 
            icon={Activity}
            label="Sync Journal"
          />
        </div>
      </header>

      <div className="relative">
        {renderContent()}
      </div>

      {isPreviewOpen && previewSheet && (
        <SyncPreviewModal 
          isOpen={isPreviewOpen} 
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewSheet(null);
          }} 
          sheet={previewSheet} 
        />
      )}
    </div>
  );
}

function SyncPreviewModal({ isOpen, onClose, sheet }: { isOpen: boolean; onClose: () => void; sheet: SheetConfig }) {
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [data, setData] = useState<{ leads: any[], updates: any[], skippedCount: number, skipped: any[] } | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'valid' | 'updates' | 'duplicates' | 'skipped'>('valid');
  const { showToast, refreshData } = useApp();

  React.useEffect(() => {
    const fetchPreview = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/sheets/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url: sheet.url, 
            name: sheet.name, 
            sheetIndex: sheet.sheetIndex,
            mappings: sheet.mappings || {} 
          })
        });
        const result = await response.json();
        if (result.success) {
          setData(result);
          // Auto switch tab priority: leads > updates > skipped
          if (result.leads.length > 0) {
            setActivePreviewTab('valid');
          } else if (result.updates.length > 0) {
            setActivePreviewTab('updates');
          } else if (result.skipped.length > 0) {
            setActivePreviewTab(result.skipped.some((s: any) => s.reason === 'Already in CRM') ? 'duplicates' : 'skipped');
          }
        } else {
          showToast(result.error || 'Failed to fetch preview', 'error');
          onClose();
        }
      } catch (e) {
        showToast('Network error during preview', 'error');
        onClose();
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) fetchPreview();
  }, [isOpen, sheet, onClose, showToast]);

  const handleConfirm = async () => {
    if (!data || (data.leads.length === 0 && data.updates.length === 0)) return;
    
    setImporting(true);
    try {
      const response = await fetch('/api/leads/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          leads: data.leads,
          updates: data.updates,
          skipped: data.skipped
        })
      });
      const result = await response.json();
      if (result.success) {
        showToast(`Successfully synced ${result.count} records (${result.imported} new, ${result.updated} updated)`, 'success');
        await refreshData();
        onClose();
      } else {
        showToast(result.error || 'Import failed', 'error');
      }
    } catch (e) {
      showToast('Import failed due to network error', 'error');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-[var(--color-border-main)] flex justify-between items-center bg-[var(--color-bg-card)]">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="serif text-3xl italic text-[var(--color-text-main)]">Sync Preview</h2>
              <span className="px-3 py-1 bg-accent/10 text-accent text-[10px] font-black uppercase tracking-widest rounded-full">{sheet.name} (Sheet #{sheet.sheetIndex})</span>
            </div>
            <p className="text-sm text-[var(--color-text-dim)] mt-1">Review the data identified in the source sheet before commit.</p>
          </div>
          <Button variant="ghost" onClick={onClose} className="rounded-full h-12 w-12 text-[var(--color-text-dim)]">✕</Button>
        </div>

        <div className="flex-1 overflow-auto p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-accent animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-dim)]">Analyzing Rows in Google Sheets...</p>
            </div>
          ) : data ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <button 
                  onClick={() => setActivePreviewTab('valid')}
                  className={cn(
                    "transition-all text-left",
                    activePreviewTab === 'valid' ? "scale-105" : "opacity-60"
                  )}
                >
                  <MetricCard label="Leads to Import" value={data.leads.length} color="text-accent" />
                </button>
                <button 
                  onClick={() => setActivePreviewTab('updates')}
                  className={cn(
                    "transition-all text-left",
                    activePreviewTab === 'updates' ? "scale-105" : "opacity-60"
                  )}
                >
                  <MetricCard label="Updates Detected" value={data.updates.length} color="text-amber-500" />
                </button>
                <button 
                  onClick={() => setActivePreviewTab('duplicates')}
                  className={cn(
                    "transition-all text-left",
                    activePreviewTab === 'duplicates' ? "scale-105" : "opacity-60"
                  )}
                >
                   <MetricCard label="Already Synchronized" value={data.skipped.filter(s => s.reason === 'Already in CRM').length} color="text-blue-500" />
                </button>
                <button 
                  onClick={() => setActivePreviewTab('skipped')}
                  className={cn(
                    "transition-all text-left",
                    activePreviewTab === 'skipped' ? "scale-105" : "opacity-60"
                  )}
                >
                  <MetricCard label="Invalid / Skipped" value={data.skipped.filter(s => s.reason !== 'Already in CRM').length} color="text-red-500" />
                </button>
              </div>

              <div className="flex gap-4 border-b border-[var(--color-border-main)] pb-px px-1">
                <button 
                  onClick={() => setActivePreviewTab('valid')}
                  className={cn(
                    "pb-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all",
                    activePreviewTab === 'valid' ? "border-accent text-accent" : "border-transparent text-[var(--color-text-dim)]"
                  )}
                >
                  New Leads ({data.leads.length})
                </button>
                <button 
                  onClick={() => setActivePreviewTab('updates')}
                  className={cn(
                    "pb-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all",
                    activePreviewTab === 'updates' ? "border-amber-500 text-amber-500" : "border-transparent text-[var(--color-text-dim)]"
                  )}
                >
                  Updates ({data.updates.length})
                </button>
                <button 
                  onClick={() => setActivePreviewTab('duplicates')}
                  className={cn(
                    "pb-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all",
                    activePreviewTab === 'duplicates' ? "border-blue-500 text-blue-500" : "border-transparent text-[var(--color-text-dim)]"
                  )}
                >
                  Identical ({data.skipped.filter(s => s.reason === 'Already in CRM').length})
                </button>
                <button 
                  onClick={() => setActivePreviewTab('skipped')}
                  className={cn(
                    "pb-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all",
                    activePreviewTab === 'skipped' ? "border-red-500 text-red-500" : "border-transparent text-[var(--color-text-dim)]"
                  )}
                >
                  Skipped Rows ({data.skipped.filter(s => s.reason !== 'Already in CRM').length})
                </button>
              </div>

              <div className="border border-[var(--color-border-main)] rounded-2xl overflow-hidden shadow-inner bg-[var(--color-bg-card)]/50">
                {activePreviewTab === 'valid' ? (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--color-bg-card)] border-b border-[var(--color-border-main)]">
                      <tr>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest opacity-50">Name</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest opacity-50">Phone</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest opacity-50">Project</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest opacity-50">Lifecycle Stage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-main)]">
                      {data.leads.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-10 text-center text-sm italic text-[var(--color-text-dim)]">No new leads identified.</td>
                        </tr>
                      ) : (
                        data.leads.map((l, i) => (
                          <tr key={i} className="hover:bg-accent/5 transition-colors">
                            <td className="px-4 py-3 font-medium text-[var(--color-text-main)]">{l.name}</td>
                            <td className="px-4 py-3 font-mono text-[var(--color-text-dim)]">{l.phone}</td>
                            <td className="px-4 py-3 italic text-accent">{l.project}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[9px] font-bold">
                                {l.lifecycleStage}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : activePreviewTab === 'updates' ? (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--color-bg-card)] border-b border-[var(--color-border-main)]">
                      <tr>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest opacity-50">Existing Lead</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest opacity-50">Updates Detected</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest opacity-50">Activity Record</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-main)]">
                      {data.updates.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-10 text-center text-sm italic text-[var(--color-text-dim)]">No data updates detected.</td>
                        </tr>
                      ) : (
                        data.updates.map((u, i) => (
                          <tr key={i} className="hover:bg-amber-500/5 transition-colors">
                            <td className="px-4 py-3">
                               <div className="font-bold text-[var(--color-text-main)] uppercase tracking-tight">{u.existingData.name}</div>
                               <div className="text-[9px] text-[var(--color-text-dim)] font-mono mt-0.5">{u.existingData.phone || u.existingData.email} • {u.existingData.project}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1.5">
                                {u.changes.lifecycleStage && (
                                  <div className="flex items-center gap-1.5 p-1 bg-amber-500/10 rounded border border-amber-500/20 w-fit">
                                    <span className="text-[8px] font-black uppercase text-amber-600">Stage:</span>
                                    <span className="opacity-50 line-through text-[9px]">{u.changes.lifecycleStage.from}</span>
                                    <span className="text-[9px]">→</span>
                                    <span className="text-amber-600 font-bold text-[9px]">{u.changes.lifecycleStage.to}</span>
                                  </div>
                                )}
                                {u.changes.other && (
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(u.updates || {}).map(([key, val]) => (
                                      key !== 'lifecycleStage' && (
                                        <div key={key} className="px-2 py-0.5 bg-blue-500/5 border border-blue-500/10 rounded text-[9px]">
                                          <span className="text-blue-500 font-black uppercase mr-1">{key}:</span>
                                          <span className="text-[var(--color-text-main)] truncate max-w-[100px] inline-block align-bottom">{String(val)}</span>
                                        </div>
                                      )
                                    ))}
                                  </div>
                                )}
                                {!u.changes.lifecycleStage && !u.changes.other && (
                                  <span className="opacity-30 italic text-[9px]">Status & info unchanged</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 max-w-xs">
                               {u.changes.remark ? (
                                 <div className="text-amber-700 italic text-[10px] line-clamp-2 px-3 py-1.5 bg-amber-100/50 dark:bg-amber-900/10 rounded-lg border border-amber-500/10">
                                   "{u.changes.remark}"
                                 </div>
                               ) : (
                                 <span className="opacity-30 italic text-[9px]">No new journal entry</span>
                               )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : activePreviewTab === 'duplicates' ? (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--color-bg-card)] border-b border-[var(--color-border-main)]">
                      <tr>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest opacity-50">Sheet Row</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest opacity-50">Lead Name</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest opacity-50">Identifier</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest opacity-50">System Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-main)]">
                      {data.skipped.filter(s => s.reason === 'Already in CRM').length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-10 text-center text-sm italic text-[var(--color-text-dim)]">No duplicate records found in this sheet.</td>
                        </tr>
                      ) : (
                        data.skipped.filter(s => s.reason === 'Already in CRM').map((s, i) => (
                          <tr key={i} className="hover:bg-blue-500/5 transition-colors">
                            <td className="px-4 py-3 font-black text-blue-500">Row #{s.row}</td>
                            <td className="px-4 py-3 font-medium text-[var(--color-text-main)]">{s.name}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight bg-blue-500/10 text-blue-500">
                                Duplicate
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[10px] text-[var(--color-text-dim)] italic">
                               Matched existing lead by phone and project.
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--color-bg-card)] border-b border-[var(--color-border-main)]">
                      <tr>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest opacity-50">Sheet Row</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest opacity-50">Lead Name</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest opacity-50">Reason for Skip</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest opacity-50">System Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-main)]">
                      {data.skipped.filter(s => s.reason !== 'Already in CRM').length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-10 text-center text-sm italic text-[var(--color-text-dim)]">No invalid rows found in this sheet.</td>
                        </tr>
                      ) : (
                        data.skipped.filter(s => s.reason !== 'Already in CRM').map((s, j) => (
                          <tr key={j} className="hover:bg-red-500/5 transition-colors">
                            <td className="px-4 py-3 font-black text-red-500">Row #{s.row}</td>
                            <td className="px-4 py-3 font-medium text-[var(--color-text-main)]">{s.name || 'Unknown'}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight bg-red-500/10 text-red-500">
                                {s.reason}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[10px] text-[var(--color-text-dim)] italic">
                              {s.reason === 'Missing Identity' ? 'Name or Phone number is empty in this row.' : 'This row contains invalid protocol data.'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-8 bg-[var(--color-bg-card)] border-t border-[var(--color-border-main)] flex justify-between items-center">
          <div className="text-xs text-[var(--color-text-dim)] italic">
            {data && (data.leads.length > 0 || data.updates.length > 0) && (
              <span>Proceeding will result in {data.leads.length} additions and {data.updates.length} updates.</span>
            )}
            {data && data.leads.length === 0 && data.updates.length === 0 && `No new data to synchronize.`}
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={onClose} disabled={importing}>Close</Button>
            <Button 
              onClick={handleConfirm} 
              disabled={importing || !data || (data.leads.length === 0 && data.updates.length === 0)}
              className="px-8 h-12 bg-accent hover:bg-accent/90 text-white font-black uppercase tracking-widest text-[10px] border-none shadow-lg shadow-accent/20 rounded-full gap-2 transition-all active:scale-95"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {importing ? 'Pushing Data...' : 'Confirm & Sync to CRM'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-main)] p-6 rounded-3xl">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-dim)] mb-1">{label}</p>
      <p className={cn("text-3xl font-bold font-mono", color)}>{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
        active 
          ? "bg-accent text-white shadow-lg" 
          : "text-[var(--color-text-dim)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-text-main)]/[0.05]"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
