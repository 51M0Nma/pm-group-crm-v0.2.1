import React, { useState } from 'react';
import { useApp } from '@/src/AppContext';
import { Button, Input, Card } from '@/src/components/ui';
import { cn } from '@/src/lib/utils';
import { User, Role, Permission } from '@/src/types';
import { Shield, UserPlus, Key, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export default function UserManagement() {
  const { user: currentUser, users, addUser, updateUser, deleteUser, purgeUsers, hasPermission } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPurgingConfirm, setIsPurgingConfirm] = useState(false);

  const handleOpenModal = (user: User | null = null) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h3 className="text-[var(--color-text-dim)] text-[10px] uppercase tracking-widest font-black">Access Matrix</h3>
          <h1 className="serif text-4xl md:text-5xl lg:text-6xl italic text-[var(--color-text-main)] mt-2">Administrative Control</h1>
        </div>
        <div className="flex gap-4">
          {currentUser?.role === 'SuperAdmin' && (
            <div className="flex items-center gap-2">
              {!isPurgingConfirm ? (
                <Button 
                  variant="ghost" 
                  className="text-red-500 hover:bg-red-500/10 text-[10px] h-10 px-6 uppercase font-bold"
                  onClick={() => setIsPurgingConfirm(true)}
                >
                  Purge Security Cluster
                </Button>
              ) : (
                <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
                   <Button 
                    size="sm"
                    className="bg-red-600 text-white hover:bg-red-700 text-[10px] h-10 px-6 uppercase font-black"
                    onClick={async () => {
                      await purgeUsers();
                      setIsPurgingConfirm(false);
                    }}
                  >
                    Confirm Wipe
                  </Button>
                  <Button 
                    variant="ghost"
                    size="sm"
                    className="text-[var(--color-text-dim)] text-[10px] h-10 px-4 uppercase font-bold"
                    onClick={() => setIsPurgingConfirm(false)}
                  >
                    Abort
                  </Button>
                </div>
              )}
            </div>
          )}
          {hasPermission('add_user') && (
            <Button size="sm" className="gap-2 bg-accent text-white hover:bg-amber-600 text-[10px] h-10 px-6" onClick={() => handleOpenModal()}>
              <UserPlus className="w-4 h-4" /> provision identity
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {users.map((user) => (
          <UserCard key={user.id} user={user} onEdit={() => handleOpenModal(user)} />
        ))}
      </div>

      {isModalOpen && (
        <UserModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          user={editingUser}
          onSave={async (data: any) => {
            if (editingUser) {
              await updateUser(editingUser.id, data);
            } else {
              await addUser(data);
            }
            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

interface UserCardProps {
  user: User;
  onEdit: () => void;
  key?: string | number;
}

function UserCard({ user, onEdit }: UserCardProps) {
  const { deleteUser, hasPermission: globalHasPermission } = useApp();
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <Card className="p-8 space-y-6 group hover:border-accent/40 transition-all bg-[var(--color-bg-card)] border-[var(--color-border-main)] rounded-2xl shadow-2xl relative overflow-hidden">
      <div className="flex justify-between items-start">
        <div className="w-12 h-12 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] flex items-center justify-center rounded-xl">
          <Shield className={cn("w-6 h-6", (user.role === 'SuperAdmin' || user.role === 'SubAdmin') ? "text-accent" : "text-[var(--color-text-dim)]")} />
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={cn(
            "text-[9px] uppercase tracking-[0.2em] font-black px-3 py-1 rounded-full border",
            (user.role === 'SuperAdmin' || user.role === 'SubAdmin') ? "bg-accent/10 text-accent border-accent/20" : 
            user.role === 'SalesTeamLead' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
            "bg-[var(--color-bg-main)] text-[var(--color-text-dim)] border-[var(--color-border-main)]"
          )}>
            {user.role}
          </span>
          {globalHasPermission('edit_user') && (
            <div className="flex gap-3">
              <button 
                onClick={onEdit} 
                disabled={isConfirming}
                className={cn("text-[10px] text-accent hover:underline uppercase font-bold tracking-tighter", isConfirming && "opacity-30")}
              >
                Edit Access
              </button>
              {globalHasPermission('delete_user') && user.id !== '1' && (
                <div className="flex items-center gap-2">
                  {!isConfirming ? (
                    <button 
                      onClick={() => setIsConfirming(true)} 
                      className="text-[10px] text-red-500 hover:underline uppercase font-bold tracking-tighter"
                    >
                      Delete
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                      <Button 
                        size="sm"
                        className="bg-red-500 text-white hover:bg-red-600 text-[9px] h-7 px-3 uppercase font-black"
                        onClick={async () => {
                          await deleteUser(user.id);
                        }} 
                      >
                        Confirm
                      </Button>
                      <Button 
                        variant="ghost"
                        size="sm"
                        className="text-[var(--color-text-dim)] text-[9px] h-7 px-3 uppercase font-bold"
                        onClick={() => setIsConfirming(false)} 
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div>
        <h3 className="serif text-2xl font-light italic text-[var(--color-text-main)]">{user.name}</h3>
        <p className="text-xs font-mono text-[var(--color-text-dim)] mt-2">SYSTEM_ID: {user.username.toUpperCase()}</p>
      </div>

      <div className="pt-6 border-t border-[var(--color-border-main)]/50">
        <p className="text-[9px] uppercase tracking-widest font-black text-[var(--color-text-dim)] mb-3">Module Permissions</p>
        <div className="flex flex-wrap gap-2">
          {user.permissions.map(p => (
            <span key={p} className="text-[9px] uppercase font-bold px-2 py-0.5 bg-[var(--color-bg-main)] text-[var(--color-text-dim)] border border-[var(--color-border-main)] rounded">
              {p.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

function UserModal({ isOpen, onClose, onSave, user }: any) {
  const getDefaultPermissions = (role: Role): Permission[] => {
    switch (role) {
      case 'SuperAdmin':
        return ['all'];
      case 'SubAdmin':
        return ['view_dashboard', 'view_leads', 'view_skipped', 'view_audit', 'add_lead', 'edit_lead', 'delete_lead', 'assign_lead', 'bulk_assign_lead', 'import_leads', 'export_leads', 'sync_sheets', 'view_users', 'add_user', 'edit_user', 'delete_user', 'view_tasks', 'add_task', 'view_chat', 'manage_settings'];
      case 'SalesTeamLead':
        return ['view_dashboard', 'view_leads', 'view_skipped', 'view_audit', 'add_lead', 'edit_lead', 'delete_lead', 'assign_lead', 'bulk_assign_lead', 'import_leads', 'export_leads', 'sync_sheets', 'view_tasks', 'add_task', 'view_chat'];
      case 'SalesAssociate':
        return ['view_dashboard', 'view_leads', 'add_lead', 'edit_lead', 'view_tasks', 'add_task', 'view_chat'];
      default:
        return ['view_dashboard'];
    }
  };

  const [formData, setFormData] = useState({
    username: user?.username || '',
    password: user?.password || '',
    name: user?.name || '',
    role: (user?.role || 'SalesAssociate') as Role,
    permissions: (user?.permissions || getDefaultPermissions('SalesAssociate')) as Permission[]
  });

  const availablePermissions: Permission[] = [
    'view_dashboard',
    'view_leads',
    'view_skipped',
    'view_audit',
    'add_lead',
    'edit_lead',
    'delete_lead',
    'assign_lead',
    'bulk_assign_lead',
    'import_leads',
    'export_leads',
    'purge_leads',
    'sync_sheets',
    'view_users',
    'add_user',
    'edit_user',
    'delete_user',
    'view_tasks',
    'add_task',
    'view_chat',
    'manage_settings',
    'all'
  ];

  const togglePermission = (p: Permission) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(p) 
        ? prev.permissions.filter(item => item !== p)
        : [...prev.permissions, p]
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-[var(--color-bg-card)] max-w-lg w-full max-h-[90vh] overflow-y-auto border border-[var(--color-border-main)] rounded-3xl shadow-2xl">
        <div className="p-8 border-b border-[var(--color-border-main)] flex justify-between items-center bg-[var(--color-bg-sidebar)]/50">
          <h2 className="serif text-3xl font-light italic text-[var(--color-text-main)]">
            {user ? 'Modify Security Profile' : 'Create Security Profile'}
          </h2>
          <button onClick={onClose} className="text-[var(--color-text-dim)] hover:text-accent transition-colors">✕</button>
        </div>
        
        <div className="p-12 space-y-10">
          <div className="space-y-6">
             <div className="space-y-2">
               <label className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)]">Legal Name</label>
               <Input className="bg-[var(--color-bg-main)] border-[var(--color-border-main)] text-[var(--color-text-main)]" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Agent Smith" />
             </div>
             <div className="grid grid-cols-2 gap-6">
               <div className="space-y-2">
                 <label className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)]">System Alias</label>
                 <Input className="bg-[var(--color-bg-main)] border-[var(--color-border-main)] text-[var(--color-text-main)]" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="asmith" />
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)]">Security Phrase</label>
                 <Input className="bg-[var(--color-bg-main)] border-[var(--color-border-main)] text-[var(--color-text-main)]" type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="SecureKey.2024" />
               </div>
             </div>
               <div className="space-y-2">
                 <label className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)]">Authorization Level</label>
                 <select 
                   value={formData.role} 
                   onChange={e => {
                     const role = e.target.value as Role;
                     setFormData({
                       ...formData, 
                       role,
                       permissions: getDefaultPermissions(role)
                     });
                   }}
                   className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-main)] h-11 rounded-lg outline-none focus:border-accent text-sm px-4 text-[var(--color-text-main)]"
                 >
                   <option value="SuperAdmin">Super Administrator (Full Power)</option>
                   <option value="SubAdmin">Sub Administrator (Management)</option>
                   <option value="SalesTeamLead">Sales Team Lead</option>
                   <option value="SalesAssociate">Sales Associate</option>
                 </select>
               </div>
          </div>

          <div className="space-y-4 pt-10 border-t border-[var(--color-border-main)]">
            <h4 className="serif text-xl italic text-[var(--color-text-dim)]">Access Privileges</h4>
            <div className="grid grid-cols-1 gap-3">
              {availablePermissions.map(p => (
                <label key={p} className="flex items-center gap-3 p-4 bg-[var(--color-bg-sidebar)]/5 border border-[var(--color-border-main)] rounded-xl hover:bg-[var(--color-bg-sidebar)]/10 cursor-pointer transition-all">
                  <input 
                    type="checkbox" 
                    checked={formData.permissions.includes(p)} 
                    onChange={() => togglePermission(p)}
                    className="w-4 h-4 accent-accent rounded"
                  />
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--color-text-dim)]">{p.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-10 border-t border-[var(--color-border-main)]">
            <Button variant="ghost" className="text-[var(--color-text-dim)] hover:text-accent" onClick={onClose}>Abort</Button>
            <Button className="bg-accent text-white hover:bg-amber-600 px-8 border-none" onClick={() => onSave(formData)}>Activate Identity</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
