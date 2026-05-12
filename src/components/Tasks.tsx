import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { Task, User, TaskStatus } from '../types';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  User as UserIcon, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MoreVertical,
  Check,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { Button } from './ui';
import { Input } from './ui';

export default function Tasks() {
  const { tasks, users, user, addTask, updateTaskStatus, setActiveTab } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'All'>('All');

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || t.status === filterStatus;
    
    // Non-admins only see tasks assigned to them or created by them
    const isOwner = t.assignedTo === user?.id || t.assignedBy === user?.id;
    const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'SubAdmin';
    
    return matchesSearch && matchesStatus && (isAdmin || isOwner);
  });

  const stats = {
    total: filteredTasks.length,
    pending: filteredTasks.filter(t => t.status === 'Pending').length,
    inProgress: filteredTasks.filter(t => t.status === 'In Progress').length,
    ongoing: filteredTasks.filter(t => t.status === 'Ongoing').length,
    complete: filteredTasks.filter(t => t.status === 'Complete').length
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-[var(--color-text-main)] tracking-tighter uppercase mb-2">Internal Task Board</h1>
          <p className="text-[11px] text-[var(--color-text-dim)] font-bold uppercase tracking-widest italic font-sans">Strategic alignment and operational velocity</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="bg-accent text-white hover:bg-accent/90 px-6 font-bold uppercase tracking-tighter text-[11px]"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Operation
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending', count: stats.pending, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'In Progress', count: stats.inProgress, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Ongoing', count: stats.ongoing, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'Complete', count: stats.complete, color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
        ].map((stat, i) => (
          <div key={i} className={cn("p-4 rounded-2xl border border-[var(--color-border-main)]", stat.bg)}>
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-dim)] mb-1">{stat.label}</p>
            <p className={cn("text-2xl font-black tracking-tighter", stat.color)}>{stat.count}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-4 items-center bg-[var(--color-text-main)]/[0.03] p-4 rounded-2xl border border-[var(--color-border-main)]">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-dim)]" />
          <Input 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search operations..."
            className="pl-11 bg-[var(--color-bg-main)] border-[var(--color-border-main)] text-[11px] font-bold uppercase tracking-widest h-11 rounded-xl text-[var(--color-text-main)]"
          />
        </div>
        <div className="flex gap-2">
          {['All', 'Pending', 'In Progress', 'Ongoing', 'Complete'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s as any)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                filterStatus === s 
                  ? "bg-accent border-accent text-white shadow-lg shadow-accent/20" 
                  : "bg-[var(--color-bg-main)] border-[var(--color-border-main)] text-[var(--color-text-dim)] hover:text-accent"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTasks.length > 0 ? (
          filteredTasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))
        ) : (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-[var(--color-border-main)] rounded-3xl">
            <p className="text-[var(--color-text-dim)] font-black uppercase tracking-widest text-[10px]">No active operations found in this sector</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <TaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
}

function TaskCard({ task }: { task: Task; key?: string | number }) {
  const { users, user, updateTaskStatus, setActiveTab } = useApp();
  const assignee = users.find(u => u.id === task.assignedTo);
  const creator = users.find(u => u.id === task.assignedBy);

  const statusColors = {
    'Pending': 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    'In Progress': 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    'Ongoing': 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    'Complete': 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
  };

  const typeIcons = {
    'follow_up': <Calendar className="w-3 h-3" />,
    'meeting': <UserIcon className="w-3 h-3" />,
    'call': <Clock className="w-3 h-3" />,
    'site_visit': <AlertCircle className="w-3 h-3" />,
    'general': <CheckCircle2 className="w-3 h-3" />
  };

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-main)] rounded-3xl p-6 hover:shadow-2xl hover:shadow-black/40 transition-all group flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <div className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center gap-1.5", statusColors[task.status])}>
          <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", task.status === 'Complete' ? 'bg-emerald-500' : 'bg-current')} />
          {task.status}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('chat')}
            className="p-2 text-[var(--color-text-dim)] hover:text-accent transition-colors bg-[var(--color-bg-main)] rounded-xl border border-[var(--color-border-main)]"
            title="Discuss in Chat"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <div className="text-[10px] bg-[var(--color-bg-main)] text-[var(--color-text-dim)] px-3 py-1 rounded-full font-black uppercase tracking-widest border border-[var(--color-border-main)] flex items-center gap-2">
            {typeIcons[task.type]}
            {task.type.replace('_', ' ')}
          </div>
        </div>
      </div>

      <h3 className="text-sm font-black text-[var(--color-text-main)] uppercase tracking-tight mb-2 group-hover:text-accent transition-colors">{task.title}</h3>
      <p className="text-[10px] text-[var(--color-text-dim)] italic font-serif leading-relaxed line-clamp-3 mb-6 flex-grow">
        "{task.description}"
      </p>

      <div className="space-y-4 pt-4 border-t border-[var(--color-border-main)]">
        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
          <span className="text-[var(--color-text-dim)]">Target User</span>
          <span className="text-[var(--color-text-main)]">{assignee?.name || 'Unknown'}</span>
        </div>
        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
          <span className="text-[var(--color-text-dim)]">Operation Deadline</span>
          <span className="text-accent underline underline-offset-4">{format(new Date(task.dueDate), 'dd MMM yyyy')}</span>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        {task.status !== 'Complete' && (
          <>
            {task.status === 'Pending' && (
              <Button 
                onClick={() => updateTaskStatus(task.id, 'In Progress')}
                className="flex-1 bg-blue-500 text-white text-[9px] font-black uppercase h-9 rounded-xl transition-all"
              >
                Incept Operation
              </Button>
            )}
            {(task.status === 'In Progress' || task.status === 'Ongoing') && (
              <Button 
                onClick={() => updateTaskStatus(task.id, 'Complete')}
                className="flex-1 bg-emerald-500 text-white text-[9px] font-black uppercase h-9 rounded-xl transition-all"
              >
                Finalize Operation
              </Button>
            )}
            {task.status === 'In Progress' && (
              <Button 
                onClick={() => updateTaskStatus(task.id, 'Ongoing')}
                className="px-3 bg-purple-500 text-white text-[9px] font-black uppercase h-9 rounded-xl transition-all"
              >
                Sustain
              </Button>
            )}
          </>
        )}
        {task.status === 'Complete' && (
          <div className="flex-1 flex items-center justify-center gap-2 text-[9px] font-black uppercase text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 py-2 rounded-xl">
            <Check className="w-3.5 h-3.5" />
            Mission Accomplished
          </div>
        )}
      </div>
    </div>
  );
}

function TaskModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { users, user, addTask, showToast } = useApp();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    assignedTo: '',
    type: 'general' as Task['type']
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assignedTo) {
      showToast('Assignment target terminal required', 'error');
      return;
    }
    await addTask(formData);
    onClose();
    showToast('Operational parameters successfully deployed', 'success');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-main)] rounded-[40px] w-full max-w-lg p-10 relative shadow-3xl shadow-black overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-accent/30" />
        
        <button onClick={onClose} className="absolute top-8 right-8 text-[var(--color-text-dim)] hover:text-accent transition-colors">
          <Plus className="w-6 h-6 rotate-45" />
        </button>

        <h2 className="text-2xl font-black text-[var(--color-text-main)] tracking-tighter uppercase mb-2">Initialize Operation</h2>
        <p className="text-[10px] text-[var(--color-text-dim)] font-bold uppercase tracking-widest mb-8 italic">Deployment of strategic assets into field operations</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)]">Operation Title</label>
            <Input 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
              placeholder="e.g., Client Follow-up Matrix"
              required
              className="h-12 bg-[var(--color-bg-main)] border-[var(--color-border-main)] text-[11px] font-bold uppercase tracking-widest rounded-2xl focus:border-accent/50 text-[var(--color-text-main)]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)]">Mission Description</label>
            <textarea 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})}
              rows={4}
              placeholder="Strategic details and tactical objectives..."
              className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-main)] text-[11px] font-bold uppercase tracking-widest rounded-3xl p-5 focus:outline-none focus:border-accent/50 text-[var(--color-text-main)] placeholder-[var(--color-text-dim)]/30 font-sans"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)]">Target Associate</label>
              <select 
                value={formData.assignedTo}
                onChange={e => setFormData({...formData, assignedTo: e.target.value})}
                className="w-full h-12 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] text-[11px] font-bold uppercase tracking-widest rounded-2xl p-3 focus:outline-none focus:border-accent/50 text-[var(--color-text-main)]"
                required
              >
                <option value="" className="bg-[var(--color-bg-sidebar)]">Select Terminal</option>
                {users.map(u => (
                  <option key={u.id} value={u.id} className="bg-[var(--color-bg-sidebar)]">{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)]">Mission Deadline</label>
              <Input 
                type="date"
                value={formData.dueDate} 
                onChange={e => setFormData({...formData, dueDate: e.target.value})}
                className="h-12 bg-[var(--color-bg-main)] border-[var(--color-border-main)] text-[11px] font-bold uppercase tracking-widest rounded-2xl focus:border-accent/50 text-[var(--color-text-main)]"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)]">Operation Type</label>
            <div className="grid grid-cols-3 gap-2">
              {['follow_up', 'meeting', 'call', 'site_visit', 'general'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({...formData, type: type as any})}
                  className={cn(
                    "py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                    formData.type === type 
                      ? "bg-accent/20 border-accent text-accent" 
                      : "bg-[var(--color-bg-main)] border-[var(--color-border-main)] text-[var(--color-text-dim)] hover:text-accent"
                  )}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6 flex gap-3">
            <Button 
              type="button"
              onClick={onClose}
              className="flex-1 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] text-[var(--color-text-dim)] hover:text-accent transition-all text-[10px] font-black uppercase h-12 rounded-2xl"
            >
              Abort
            </Button>
            <Button 
              type="submit"
              className="flex-2 bg-accent text-white hover:bg-accent/90 transition-all text-[10px] font-black uppercase h-12 rounded-2xl shadow-lg shadow-accent/20 border-none"
            >
              Initialize Deployment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
