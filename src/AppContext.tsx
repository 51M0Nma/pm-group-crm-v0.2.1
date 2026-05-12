import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Lead, Task, Notification, Role, LifecycleStage, Project, Permission, SkippedLead, AuditLog, ChatMessage, TaskStatus, Remark, SheetConfig, InventoryUnit, InventoryStatus } from './types';

import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where,
  limit,
  getDocs,
  writeBatch,
  deleteDoc,
  getDocFromServer
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './lib/firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { onAuthStateChanged, signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { format, parseISO, isValid } from 'date-fns';

function cleanObject(obj: any) {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    }
  });
  return newObj;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  user: User | null;
  leads: Lead[];
  skippedLeads: SkippedLead[];
  auditLogs: AuditLog[];
  tasks: Task[];
  notifications: Notification[];
  chats: ChatMessage[];
  users: User[];
  inventory: InventoryUnit[];
  sheetConfigs: SheetConfig[];
  theme: 'dark' | 'light';
  logoUrl: string | null;
  activeTab: string;
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setActiveTab: (tab: string) => void;
  toggleTheme: () => void;
  updateLogoUrl: (url: string | null) => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  addLead: (lead: Partial<Lead>) => Promise<void>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  bulkUpdateLeads: (ids: string[], updates: Partial<Lead>) => Promise<void>;
  importLeads: (leads: Partial<Lead>[]) => Promise<void>;
  normalizeJunkLeads: () => Promise<void>;
  clearLeads: () => Promise<void>;
  clearSkippedLeads: () => Promise<void>;
  bulkDeleteSkippedLeads: (ids: string[]) => Promise<void>;
  addUser: (userData: any) => Promise<void>;
  updateUser: (id: string, updates: any) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  purgeUsers: () => Promise<void>;
  addTask: (task: Partial<Task>) => Promise<void>;
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  sendChatMessage: (receiverId: string, text: string, taskId?: string) => Promise<void>;
  markNotificationRead: (id: string) => void;
  deleteLead: (id: string) => Promise<void>;
  bulkDeleteLeads: (ids: string[]) => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  refreshData: () => Promise<void>;
  standardizeAssetTypes: () => Promise<void>;
  addSheetConfig: (config: any) => Promise<void>;
  updateSheetConfig: (id: string, config: any) => Promise<void>;
  removeSheetConfig: (id: string) => Promise<void>;
  sendEODReport: (reportData: any) => Promise<void>;
  saveBookingDetails: (leadId: string, details: any) => Promise<void>;
  addInventoryUnit: (unit: Partial<InventoryUnit>) => Promise<void>;
  updateInventoryUnit: (id: string, updates: Partial<InventoryUnit>) => Promise<void>;
  deleteInventoryUnit: (id: string) => Promise<void>;
  bulkImportInventory: (units: Partial<InventoryUnit>[]) => Promise<void>;
  clearInventory: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [skippedLeads, setSkippedLeads] = useState<SkippedLead[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [inventory, setInventory] = useState<InventoryUnit[]>([]);
  const [sheetConfigs, setSheetConfigs] = useState<SheetConfig[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('pm_theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
    }
    const savedLogo = localStorage.getItem('pm_logo_url');
    if (savedLogo) {
      setLogoUrl(savedLogo);
    }

    // Ensure session-level authentication for security rules
    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      if (!authUser) {
        signInAnonymously(auth).catch(err => {
          if (err.code === 'auth/admin-restricted-operation') {
            console.log("Anonymous Authentication is disabled in Firebase Console. Using fallback session mode.");
          } else {
            console.warn("Firebase Auth initialization issue:", err);
          }
        });
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('pm_theme', newTheme);
  };

  const updateLogoUrl = async (url: string | null) => {
    setLogoUrl(url);
    try {
      if (url) {
        localStorage.setItem('pm_logo_url', url);
        if (user) {
          await setDoc(doc(db, 'settings', 'appearance'), { logoUrl: url }, { merge: true });
        }
      } else {
        localStorage.removeItem('pm_logo_url');
        if (user) {
          await setDoc(doc(db, 'settings', 'appearance'), { logoUrl: null }, { merge: true });
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'settings/appearance');
    }
  };

  useEffect(() => {
    async function testConnection() {
      try {
        // Try to reach Firestore server directly to verify connectivity
        // Using a non-existent document in a safe collection
        await getDocFromServer(doc(db, 'system', 'connection_test'));
        console.log('Firebase connection verified.');
      } catch (error: any) {
        if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('unavailable'))) {
          console.error("CRITICAL: Firestore is offline or unreachable. Please check your network or configuration.");
          showToast("Network Error: Could not reach lead database. Check your connection.", "error");
        } else if (error.code === 'permission-denied') {
          // Permission denied means it DID reach the server but was rejected (which is fine for a connection test)
          console.log('Firestore reachability confirmed.');
        } else {
          console.warn("Firestore connection check produced an error:", error.code || error.message);
        }
      }
    }
    
    // Defer the check slightly to give auth some time to initialize
    const timer = setTimeout(testConnection, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Initial check for local session
    const savedUser = localStorage.getItem('pm_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setLeads([]);
      setTasks([]);
      setNotifications([]);
      setUsers([]);
      return;
    }

    // Real-time Listeners
    let leadsQuery = query(collection(db, 'leads'));
    if (user.role === 'SalesAssociate') {
      leadsQuery = query(collection(db, 'leads'), where('assignedTo', '==', user.id));
    }

    const unsubLeads = onSnapshot(leadsQuery, (sn) => {
      setLeads(sn.docs.map(d => {
        const data = d.data();
        return { 
          ...data, 
          id: d.id,
          remarks: data.remarks || [],
          reminders: data.reminders || []
        } as Lead;
      }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'leads'));

    let unsubSkipped: (() => void) | undefined;
    if (hasPermission('view_skipped')) {
      unsubSkipped = onSnapshot(query(collection(db, 'skipped_leads'), limit(200)), (sn) => {
        setSkippedLeads(sn.docs.map(d => ({ ...d.data(), id: d.id } as SkippedLead)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'skipped_leads'));
    }

    const unsubTasks = onSnapshot(user.role === 'SalesAssociate' ? query(collection(db, 'tasks'), where('assignedTo', '==', user.id)) : collection(db, 'tasks'), (sn) => {
      setTasks(sn.docs.map(d => ({ ...d.data(), id: d.id } as Task)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tasks'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (sn) => {
      setUsers(sn.docs.map(d => ({ ...d.data(), id: d.id } as User)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const unsubSheets = onSnapshot(collection(db, 'sheetConfigs'), (sn) => {
      setSheetConfigs(sn.docs.map(d => ({ ...d.data(), id: d.id } as SheetConfig)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sheetConfigs'));

    const unsubInventory = onSnapshot(collection(db, 'inventory'), (sn) => {
      setInventory(sn.docs.map(d => ({ ...d.data(), id: d.id } as InventoryUnit)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'inventory'));

    const unsubNotifs = onSnapshot(user.role === 'SalesAssociate' ? query(collection(db, 'notifications'), where('userId', '==', user.id)) : collection(db, 'notifications'), (sn) => {
      setNotifications(sn.docs.map(d => ({ ...d.data(), id: d.id } as Notification)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'notifications'));

    const unsubChats = onSnapshot(query(collection(db, 'chats'), limit(500)), (sn) => {
      setChats(sn.docs.map(d => ({ ...d.data(), id: d.id } as ChatMessage)).sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'chats'));

    let unsubAudit: (() => void) | undefined;
    if (hasPermission('view_audit')) {
      unsubAudit = onSnapshot(query(collection(db, 'audit_logs'), limit(200)), (sn) => {
        setAuditLogs(sn.docs.map(d => ({ ...d.data(), id: d.id } as AuditLog)).sort((a,b) => b.timestamp.localeCompare(a.timestamp)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'audit_logs'));
    }

    const unsubSettings = onSnapshot(doc(db, 'settings', 'appearance'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.logoUrl) {
          setLogoUrl(data.logoUrl);
          localStorage.setItem('pm_logo_url', data.logoUrl);
        }
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/appearance'));

    return () => {
      unsubLeads();
      unsubSkipped?.();
      unsubTasks();
      unsubUsers();
      unsubSheets();
      unsubInventory();
      unsubNotifs();
      unsubChats();
      unsubAudit?.();
      unsubSettings();
    };
  }, [user]);

  // Backfill Lead IDs for existing leads
  useEffect(() => {
    if (!user || leads.length === 0) return;
    if (user.role !== 'SuperAdmin' && user.role !== 'SubAdmin' && user.role !== 'SalesTeamLead') return;

    const backfillLeads = async () => {
      const missingIdLeads = leads.filter(l => !l.leadId);
      if (missingIdLeads.length === 0) return;

      console.log(`[MAINTENANCE] Found ${missingIdLeads.length} leads missing unique IDs. Initiating backfill...`);
      
      const CHUNK_SIZE = 450;
      for (let i = 0; i < missingIdLeads.length; i += CHUNK_SIZE) {
        const chunk = missingIdLeads.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(lead => {
          const autoId = `LID-${Math.floor(100000 + Math.random() * 900000)}`;
          batch.update(doc(db, 'leads', lead.id), { leadId: autoId });
        });
        
        try {
          await batch.commit();
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, 'leads/backfill');
        }
      }
      
      showToast(`Automatically generated unique IDs for ${missingIdLeads.length} existing leads.`, 'success');
    };

    const timer = setTimeout(backfillLeads, 2000); // Wait for initial data to settle
    return () => clearTimeout(timer);
  }, [user, leads.length]); // Specifically watch leads.length to trigger when new ones arrive without ID

  // Reminder Monitor
  useEffect(() => {
    if (!user || leads.length === 0) return;

    const interval = setInterval(async () => {
      const now = new Date();
      
      for (const lead of leads) {
        if (!lead.reminders || lead.reminders.length === 0) continue;

        const dueReminders = lead.reminders.filter(r => !r.triggered && new Date(r.dateTime) <= now);

        if (dueReminders.length > 0) {
          const batch = writeBatch(db);
          
          const updatedReminders = lead.reminders.map(r => 
            dueReminders.find(dr => dr.id === r.id) ? { ...r, triggered: true } : r
          );

          // Update lead in Firestore
          batch.update(doc(db, 'leads', lead.id), { 
            reminders: updatedReminders,
            updatedAt: new Date().toISOString()
          });

          // Create notification for each due reminder
          for (const reminder of dueReminders) {
            const notifId = Math.random().toString(36).substr(2, 9);
            batch.set(doc(db, 'notifications', notifId), {
              id: notifId,
              userId: user.id, // Current user gets the notification
              title: 'CRM Reminder',
              message: `Callback scheduled for ${lead.name}: ${reminder.comment}`,
              read: false,
              createdAt: new Date().toISOString().split('T')[0]
            });
          }
          
          try {
            await batch.commit();
          } catch (err) {
            console.error('Reminder batch commit failed:', err);
          }
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [user, leads]);

  const refreshData = async () => {
    if (!user) return;
    console.log('Force refreshing data...');
    try {
      let q = query(collection(db, 'leads'));
      if (user.role === 'SalesAssociate') {
        q = query(collection(db, 'leads'), where('assignedTo', '==', user.id));
      }
      const sn = await getDocs(q);
      setLeads(sn.docs.map(d => {
        const data = d.data();
        return { 
          ...data, 
          id: d.id,
          remarks: data.remarks || [],
          reminders: data.reminders || []
        } as Lead;
      }));

      const scSnapshot = await getDocs(collection(db, 'sheetConfigs'));
      setSheetConfigs(scSnapshot.docs.map(d => ({ ...d.data(), id: d.id } as SheetConfig)));
    } catch (e) {
      console.error('Refresh failed:', e);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      console.log('--- Login Attempt ---', { username, dbId: (firebaseConfig as any).firestoreDatabaseId });
      // For MVP persistence, we'll check against a users collection in Firestore
      const q = query(collection(db, 'users'), where('username', '==', username), where('password', '==', password), limit(1));
      const sn = await getDocs(q);
      
      console.log('Login Query Result:', { empty: sn.empty, size: sn.size });

      // Seed SuperAdmin if database is empty or no user found with these specific credentials
    if (sn.empty && username === 'initial_admin' && password === 'crm-idr.pmgroup') {
        console.log('Seeding SuperAdmin user...');
        const adminId = auth.currentUser?.uid || '1';
        const admin = {
          id: adminId,
          name: 'Super Administrator',
          username: 'initial_admin',
          password: 'crm-idr.pmgroup',
          role: 'SuperAdmin' as Role,
          permissions: ['all']
        };
        await setDoc(doc(db, 'users', adminId), admin);
        setUser(admin);
        localStorage.setItem('pm_user', JSON.stringify(admin));
        return true;
      }

      if (!sn.empty) {
        const docData = sn.docs[0].data();
        const userData: User = { 
          id: sn.docs[0].id,
          name: docData.name,
          username: docData.username,
          role: docData.role,
          permissions: docData.permissions || []
        };
        setUser(userData);
        localStorage.setItem('pm_user', JSON.stringify(userData));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const authUser = result.user;
      
      if (authUser) {
        // Check if user exists in our users collection
        const userDoc = await getDocs(query(collection(db, 'users'), where('username', '==', authUser.email)));
        
        let userData: User;
        
        if (userDoc.empty) {
          // If it's the bootstrapped admin email, auto-create as SuperAdmin
          const isAdminEmail = authUser.email === 'digital@patelmotors.com';
          
          userData = {
            id: authUser.uid,
            name: authUser.displayName || 'Google User',
            username: authUser.email || '',
            role: isAdminEmail ? 'SuperAdmin' : 'SalesAssociate',
            permissions: isAdminEmail ? ['all'] : ['view_dashboard', 'view_leads', 'view_tasks']
          };
          
          // Seed the user in Firestore if it doesn't exist
          await setDoc(doc(db, 'users', authUser.uid), {
            ...userData,
            email: authUser.email // Adding email for record
          });
        } else {
          const docData = userDoc.docs[0].data();
          userData = {
            id: userDoc.docs[0].id,
            name: docData.name,
            username: docData.username,
            role: docData.role,
            permissions: docData.permissions || []
          };
        }
        
        setUser(userData);
        localStorage.setItem('pm_user', JSON.stringify(userData));
        showToast(`Authorized as ${userData.name}`, 'success');
      }
    } catch (error: any) {
      console.error('Google Login Error:', error);
      showToast(`Google Auth failed: ${error.message}`, 'error');
    }
  };

  const removeSheetConfig = async (id: string) => {
    try {
      showToast('Initiating removal of sync source...', 'info');
      await deleteDoc(doc(db, 'sheetConfigs', id));
      await logAction('sheet_config', `Removed sheet configuration: ${id}`);
      showToast('Configuration removed successfully. The view will update shortly.', 'success');
    } catch (e: any) {
      console.error('Failed to remove sheet config:', e);
      showToast(`Removal failed: ${e.message}`, 'error');
      handleFirestoreError(e, OperationType.DELETE, `sheetConfigs/${id}`);
    }
  };

  const sendEODReport = async (reportData: any) => {
    if (!user) return;
    try {
      const response = await fetch('/api/send-eod-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id,
          userName: user.name,
          reportData
        })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      showToast('EOD Report sent successfully', 'success');
      await logAction('eod_report', `Sent End of Day report`);
    } catch (e: any) {
      console.error('Failed to send EOD report:', e);
      showToast(`Failed to send report: ${e.message}`, 'error');
    }
  };

  const addSheetConfig = async (config: any) => {
    const id = Math.random().toString(36).substr(2, 9);
    try {
      await setDoc(doc(db, 'sheetConfigs', id), { ...config, id, isActive: true });
      await logAction('sheet_config', `Added sheet configuration: ${config.name}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `sheetConfigs/${id}`);
    }
  };

  const updateSheetConfig = async (id: string, config: any) => {
    try {
      await updateDoc(doc(db, 'sheetConfigs', id), config);
      await logAction('sheet_config', `Updated sheet configuration: ${config.name || id}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `sheetConfigs/${id}`);
    }
  };

  const saveBookingDetails = async (leadId: string, details: any) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        bookingDetails: details,
        updatedAt: new Date().toISOString()
      });
      await logAction('booking_form', `Saved booking details for lead ID: ${leadId}`, leadId);
      showToast('Booking details saved successfully', 'success');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, `leads/${leadId}/booking`);
      showToast(`Failed to save booking details: ${e.message}`, 'error');
    }
  };

  const addInventoryUnit = async (unit: Partial<InventoryUnit>) => {
    if (!user) return;
    const id = unit.id || Math.random().toString(36).substr(2, 9);
    try {
      await setDoc(doc(db, 'inventory', id), {
        ...unit,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      showToast('Inventory unit added successfully', 'success');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `inventory/${id}`);
    }
  };

  const updateInventoryUnit = async (id: string, updates: Partial<InventoryUnit>) => {
    try {
      await updateDoc(doc(db, 'inventory', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `inventory/${id}`);
    }
  };

  const deleteInventoryUnit = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'inventory', id));
      showToast('Inventory unit removed', 'info');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `inventory/${id}`);
    }
  };

  const bulkImportInventory = async (units: Partial<InventoryUnit>[]) => {
    if (!user) return;
    const batch = writeBatch(db);
    
    // Filter out units that already exist in the inventory to prevent duplicate uploads/updates
    const existingIds = new Set(inventory.map(u => u.id));
    const existingKeys = new Set(inventory.map(u => `${u.project}|${u.unitNumber}`));

    const newUnits = units.filter(unit => {
      // If unit has a fixed ID, check if it already exists
      if (unit.id && existingIds.has(unit.id)) {
        return false;
      }
      // Also check for Project + Unit Number combination to prevent logical duplicates
      if (unit.project && unit.unitNumber) {
        const key = `${unit.project}|${unit.unitNumber}`;
        if (existingKeys.has(key)) {
          return false;
        }
      }
      return true;
    });

    if (newUnits.length === 0) {
      showToast('All units already exist in the system.', 'info');
      return;
    }

    newUnits.forEach(unit => {
      const id = unit.id || Math.random().toString(36).substr(2, 9);
      const unitRef = doc(db, 'inventory', id);
      batch.set(unitRef, {
        ...unit,
        id,
        status: unit.status || 'Available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });

    try {
      await batch.commit();
      showToast(`Successfully imported ${newUnits.length} new units to inventory.`, 'success');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'inventory/bulk_import');
    }
  };

  const clearInventory = async () => {
    if (!user) return;
    try {
      showToast('Initiating inventory purge...', 'info');
      setInventory([]); // Immediate local clear
      
      const colRef = collection(db, 'inventory');
      const sn = await getDocs(colRef);
      const docIds = sn.docs.map(d => d.id);
      
      if (docIds.length === 0) {
        showToast('Inventory is already empty.', 'info');
        return;
      }

      const CHUNK_SIZE = 100;
      for (let i = 0; i < docIds.length; i += CHUNK_SIZE) {
        const chunk = docIds.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.delete(doc(db, 'inventory', id));
        });
        await batch.commit();
      }
      
      await logAction('inventory_management', 'Purged entire inventory ledger');
      showToast('Inventory ledger cleared successfully.', 'success');
    } catch (e: any) {
      showToast(`Purge failed: ${e.message}`, 'error');
      handleFirestoreError(e, OperationType.DELETE, 'inventory/purge');
    }
  };

  const logout = () => {
    logAction('logout', `User ${user?.username} logged out`);
    setUser(null);
    localStorage.removeItem('pm_user');
  };

  const logAction = async (action: string, details: string, entityId?: string, entityName?: string) => {
    if (!user) return;
    const id = Math.random().toString(36).substr(2, 9);
    const log: AuditLog = cleanObject({
      id,
      userId: user.id,
      username: user.name || user.username,
      action,
      details,
      entityId,
      entityName,
      timestamp: new Date().toISOString()
    });
    try {
      await setDoc(doc(db, 'audit_logs', id), log);
    } catch (e) {
      console.error('Logging failed:', e);
    }
  };

const ALLOWED_LEAD_FIELDS: (keyof Lead)[] = [
  'id', 'name', 'email', 'phone', 'project', 'lifecycleStage', 'source', 'remarks', 
  'reminders', 'siteVisits', 'assignedTo', 'createdBy', 'createdAt', 'updatedAt', 
  'lastFollowUp', 'propertyType', 'budget', 'preferredSiteVisit', 
  'plotSize', 'month', 'date', 'leadId', 'campaignName', 
  'originationSource', 'walkinSource', 'employmentType', 'occupation', 'manuallyEditedFields',
  'bookingDetails'
];

function sanitizeLead(data: Partial<Lead>): Partial<Lead> {
  const sanitized: any = {};
  ALLOWED_LEAD_FIELDS.forEach(field => {
    if (data[field] !== undefined) {
      sanitized[field] = data[field];
    }
  });
  return sanitized;
}

  const addLead = async (leadData: Partial<Lead>) => {
    if (!user) return;
    const id = Math.random().toString(36).substr(2, 9);
    const leadId = `LID-${Math.floor(100000 + Math.random() * 900000)}`;
    
    const createdAt = leadData.createdAt || new Date().toISOString();
    const dateInput = leadData.date || createdAt.split('T')[0];
    const derivedMonth = isValid(parseISO(dateInput)) ? format(parseISO(dateInput), 'MMMM') : format(new Date(), 'MMMM');

    const newLead = sanitizeLead({ 
      ...leadData, 
      id, 
      leadId: leadData.leadId || leadId,
      month: leadData.month || derivedMonth,
      date: dateInput,
      assignedTo: leadData.assignedTo || user.id, // Manual leads assigned to creator by default
      createdBy: user.id,
      createdAt: createdAt,
      updatedAt: new Date().toISOString(),
      reminders: leadData.reminders || []
    });
    try {
      await setDoc(doc(db, 'leads', id), newLead);
      await logAction('create_lead', `Created lead: ${newLead.name}`, id, newLead.name);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `leads/${id}`);
    }
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    try {
      const sanitizedUpdates = sanitizeLead(updates);
      const currentLead = leads.find(l => l.id === id);
      
      // Track manually edited fields to "lock" them from sync overwrites
      const manuallyEdited = new Set(currentLead?.manuallyEditedFields || []);
      Object.keys(sanitizedUpdates).forEach(key => {
        if (key !== 'updatedAt' && key !== 'remarks' && key !== 'manuallyEditedFields') {
          manuallyEdited.add(key);
        }
      });

      await updateDoc(doc(db, 'leads', id), {
        ...sanitizedUpdates,
        manuallyEditedFields: Array.from(manuallyEdited),
        updatedAt: new Date().toISOString()
      });
      await logAction('update_lead', `Updated lead: ${currentLead?.name || id}`, id, currentLead?.name);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `leads/${id}`);
    }
  };

  const bulkUpdateLeads = async (ids: string[], updates: Partial<Lead>) => {
    if (!user) return;
    const batch = writeBatch(db);
    const timestamp = new Date().toISOString();

    const sanitizedUpdates = sanitizeLead(updates);
    ids.forEach(id => {
      const leadRef = doc(db, 'leads', id);
      const currentLead = leads.find(l => l.id === id);
      
      const manuallyEdited = new Set(currentLead?.manuallyEditedFields || []);
      Object.keys(sanitizedUpdates).forEach(key => {
        if (key !== 'updatedAt' && key !== 'remarks' && key !== 'manuallyEditedFields') {
          manuallyEdited.add(key);
        }
      });

      batch.update(leadRef, {
        ...sanitizedUpdates,
        manuallyEditedFields: Array.from(manuallyEdited),
        updatedAt: timestamp
      });
    });

    try {
      await batch.commit();
      await logAction('bulk_assign', `Bulk updated ${ids.length} leads with: ${JSON.stringify(updates)}`);
      showToast(`Successfully updated ${ids.length} leads.`, 'success');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'leads/bulk_update');
    }
  };

  const importLeads = async (leadsToImport: Partial<Lead>[], skippedLeadsToImport?: any[]) => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/leads/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          leads: leadsToImport,
          updates: [],
          skipped: skippedLeadsToImport || []
        })
      });
      
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      
      await logAction('sync_sheets', `Imported/Synced ${leadsToImport.length} leads`);
    } catch (e) {
      console.error('Import failed:', e);
      throw e;
    }
  };

  const normalizeJunkLeads = async () => {
    if (!user) return;
    const junkLeads = leads.filter(l => l.lifecycleStage?.toUpperCase() === 'JUNK');
    if (junkLeads.length === 0) {
      showToast("No leads with 'Junk' status detected in current cluster.", "info");
      return;
    }
    
    try {
      const ids = junkLeads.map(l => l.id);
      await bulkUpdateLeads(ids, { lifecycleStage: 'Closed' });
      await logAction('maintenance', `Normalized ${ids.length} junk leads to Closed status`);
      showToast(`Normalization complete. ${ids.length} records transitioned.`, 'success');
    } catch (e: any) {
      showToast(`Normalization failed: ${e.message}`, 'error');
    }
  };

  const standardizeAssetTypes = async () => {
    if (!user) return;
    
    const CHUNK_SIZE = 450;
    let count = 0;
    
    const leadsToUpdate = leads.filter(l => {
      const currentType = (l.propertyType || '').toLowerCase();
      const proj = (l.project || '').toUpperCase();
      
      let correctType = 'Plot';
      if (proj.includes('VILLA') || currentType.includes('villa')) correctType = 'Villa';
      else if (currentType.includes('residential')) correctType = 'Plot';
      else if (proj === 'PM UPLANDS' || proj === 'PM ELITE' || proj === 'THE RISE') correctType = 'Plot';
      
      return l.propertyType !== correctType;
    });

    if (leadsToUpdate.length === 0) {
      showToast("Asset types are already synchronized with project metadata.", "info");
      return;
    }

    for (let i = 0; i < leadsToUpdate.length; i += CHUNK_SIZE) {
      const chunk = leadsToUpdate.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      
      chunk.forEach(lead => {
        const proj = (lead.project || '').toUpperCase();
        const currentType = (lead.propertyType || '').toLowerCase();
        let finalType = 'Plot';
        if (proj.includes('VILLA') || currentType.includes('villa')) finalType = 'Villa';
        
        batch.update(doc(db, 'leads', lead.id), { 
          propertyType: finalType,
          updatedAt: new Date().toISOString()
        });
        count++;
      });
      
      await batch.commit();
    }

    await logAction('maintenance', `Standardized property types for ${count} leads.`);
    showToast(`Portfolio optimization complete. Updated ${count} assets to standard types (Plot/Villa).`, 'success');
  };

  const clearLeads = async () => {
    try {
      console.log('--- Terminal Purge Started ---');
      setLeads([]); // Immediate local clear
      
      const collectionsToPurge = ['leads', 'sync_logs', 'skipped_leads', 'tasks', 'notifications'];
      
      for (const colName of collectionsToPurge) {
        console.log(`Purging collection: ${colName}`);
        const colRef = collection(db, colName);
        let sn;
        try {
          sn = await getDocs(colRef);
        } catch (e) {
          console.error(`Purge step fetch failed for ${colName}:`, e);
          continue;
        }
        
        const docIds = sn.docs.map(d => d.id);
        if (docIds.length === 0) continue;

        console.log(`Purging ${docIds.length} documents from ${colName}...`);
        const CHUNK_SIZE = 100;
        for (let i = 0; i < docIds.length; i += CHUNK_SIZE) {
          const chunk = docIds.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          chunk.forEach(id => {
            batch.delete(doc(db, colName, id));
          });
          await batch.commit();
        }
      }
      
      console.log('--- Terminal Purge Complete ---');
    } catch (error) {
      console.error('Terminal Purge Error:', error);
      throw error;
    }
  };

  const addUser = async (userData: any) => {
    // Generate a unique ID or use provided one
    const id = userData.id || Math.random().toString(36).substr(2, 9);
    try {
      await setDoc(doc(db, 'users', id), cleanObject({
        ...userData,
        permissions: userData.permissions || [],
        id
      }));
      await logAction('user_management', `Added new user: ${userData.username}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${id}`);
    }
  };

  const updateUser = async (id: string, updates: any) => {
    try {
      await updateDoc(doc(db, 'users', id), updates);
      await logAction('user_management', `Updated user: ${updates.username || id}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${id}`);
    }
  };
  
  const deleteUser = async (id: string) => {
    try {
      if (id === '1') {
        showToast("System Root Identity (ID: 1) is immutable.", "error");
        return;
      }
      const targetUser = users.find(u => u.id === id);
      console.log(`[USER_MGMT] Initiating termination for: ${id} (${targetUser?.username})`);
      
      await deleteDoc(doc(db, 'users', id));
      await logAction('user_management', `Deleted user: ${targetUser?.username || id}`);
      showToast(`Identity for ${targetUser?.name || id} terminated successfully.`, "success");
    } catch (error: any) {
      console.error('[USER_MGMT] Termination failed:', error);
      showToast(`Failed to terminate identity: ${error.message}`, "error");
    }
  };

  const purgeUsers = async () => {
    try {
      console.log('Initiating Bulk Security Purge...');
      const survivors = ['1', user?.id].filter(Boolean);
      const candidates = users.filter(u => !survivors.includes(u.id));
      
      if (candidates.length === 0) {
        showToast("No disposable identities found in cluster.", "info");
        return;
      }

      const batch = writeBatch(db);
      candidates.forEach(u => {
        batch.delete(doc(db, 'users', u.id));
      });
      
      await batch.commit();
      await logAction('user_management', `Bulk purge of ${candidates.length} users completed.`);
      showToast(`Cluster purge complete. ${candidates.length} identities terminated.`, "success");
    } catch (error: any) {
      console.error('Purge failed:', error);
      showToast(`Security purge failed: ${error.message}`, "error");
    }
  };

  const addTask = async (taskData: Partial<Task>) => {
    if (!user) return;
    const id = Math.random().toString(36).substr(2, 9);
    const timestamp = new Date().toISOString();
    const newTask: Task = cleanObject({
      ...taskData as any,
      id,
      assignedBy: user.id,
      status: 'Pending',
      createdAt: timestamp,
      updatedAt: timestamp
    });
    
    try {
      await setDoc(doc(db, 'tasks', id), newTask);
      
      // Create notification for assignee
      const notifId = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: taskData.assignedTo!,
        title: 'New Task Assigned',
        message: `${user.name} assigned you a task: ${taskData.title}`,
        read: false,
        createdAt: timestamp
      });

      // Send chat message as task notification
      await sendChatMessage(
        taskData.assignedTo!, 
        `I assigned you a task: ${taskData.title}. Due date: ${taskData.dueDate}`,
        id
      );

      await logAction('task_management', `Created task: ${taskData.title} assigned to ${taskData.assignedTo}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `tasks/${id}`);
    }
  };

  const updateTaskStatus = async (id: string, status: TaskStatus) => {
    if (!user) return;
    try {
      const task = tasks.find(t => t.id === id);
      if (!task) return;

      const timestamp = new Date().toISOString();
      const updates: any = { status, updatedAt: timestamp };
      if (status === 'Complete') {
        updates.completedAt = timestamp;
      }

      await updateDoc(doc(db, 'tasks', id), updates);

      // Notify the person who assigned the task if it's completed
      if (status === 'Complete' && task.assignedBy !== user.id) {
        const notifId = Math.random().toString(36).substr(2, 9);
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: task.assignedBy,
          title: 'Task Completed',
          message: `${user.name} has completed the task: ${task.title}`,
          read: false,
          createdAt: timestamp
        });

        await sendChatMessage(
          task.assignedBy,
          `I've completed the task you assigned: ${task.title}`,
          id
        );
      }

      // Add to lead history if linked to a lead
      if (status === 'Complete' && task.leadId) {
        const lead = leads.find(l => l.id === task.leadId);
        if (lead) {
          const remark: Remark = {
            id: Math.random().toString(36).substr(2, 9),
            text: `[TASK COMPLETED] ${task.title}: ${task.description}`,
            createdAt: timestamp,
            createdBy: user.name
          };
          await updateDoc(doc(db, 'leads', lead.id), {
            remarks: [...lead.remarks, remark],
            updatedAt: timestamp
          });
        }
      }

      await logAction('task_management', `Updated task status: ${task.title} to ${status}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `tasks/${id}`);
    }
  };

  const sendChatMessage = async (receiverId: string, text: string, taskId?: string) => {
    if (!user) return;
    const id = Math.random().toString(36).substr(2, 9);
    const message: ChatMessage = cleanObject({
      id,
      senderId: user.id,
      receiverId,
      text,
      taskId,
      read: false,
      timestamp: new Date().toISOString()
    });
    try {
      await setDoc(doc(db, 'chats', id), message);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `chats/${id}`);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `notifications/${id}`);
    }
  };

  const deleteLead = async (id: string) => {
    try {
      const currentLead = leads.find(l => l.id === id);
      console.log(`[LEAD_MGMT] Deleting lead: ${id} (${currentLead?.name})`);
      await deleteDoc(doc(db, 'leads', id));
      await logAction('delete_lead', `Deleted lead: ${currentLead?.name || id}`, id, currentLead?.name);
      showToast(`Lead ${currentLead?.name || 'record'} deleted successfully.`, "success");
    } catch (error: any) {
      console.error('[LEAD_MGMT] Delete failed:', error);
      showToast(`Lead deletion failed: ${error.message}`, "error");
    }
  };

  const bulkDeleteLeads = async (ids: string[]) => {
    if (!user) return;
    try {
      const CHUNK_SIZE = 450;
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.delete(doc(db, 'leads', id));
        });
        await batch.commit();
      }
      await logAction('bulk_delete', `Deleted ${ids.length} leads from cluster`);
      showToast(`Successfully purged ${ids.length} records.`, "success");
    } catch (error: any) {
      console.error('[LEAD_MGMT] Bulk delete failed:', error);
      showToast(`Bulk deletion failed: ${error.message}`, "error");
    }
  };

  const clearSkippedLeads = async () => {
    if (!user) return;
    try {
      setSkippedLeads([]);
      const colRef = collection(db, 'skipped_leads');
      const sn = await getDocs(colRef);
      const CHUNK_SIZE = 100;
      const docIds = sn.docs.map(d => d.id);
      
      for (let i = 0; i < docIds.length; i += CHUNK_SIZE) {
        const chunk = docIds.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.delete(doc(db, 'skipped_leads', id));
        });
        await batch.commit();
      }
      await logAction('clear_skipped', 'Purged all skipped lead logs');
      showToast('Skipped leads log cleared successfully.', 'success');
    } catch (e: any) {
      showToast(`Failed to clear logs: ${e.message}`, 'error');
    }
  };

  const bulkDeleteSkippedLeads = async (ids: string[]) => {
    if (!user) return;
    try {
      const CHUNK_SIZE = 100;
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.delete(doc(db, 'skipped_leads', id));
        });
        await batch.commit();
      }
      await logAction('clear_skipped', `Purged ${ids.length} selected skipped lead logs`);
      showToast(`${ids.length} entries removed successfully.`, 'success');
    } catch (e: any) {
      showToast(`Failed to delete selected logs: ${e.message}`, 'error');
    }
  };

  const dismissLead = async (leadId: string) => {
    if (!user) return;
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      const skipId = Math.random().toString(36).substr(2, 9);
      const skippedLead: SkippedLead = {
        id: skipId,
        source: lead.source || 'Manual Dismiss',
        row: 0,
        reason: 'Permanently Dismissed',
        info: `${lead.name} - ${lead.phone || lead.email} (${lead.project})`,
        timestamp: new Date().toISOString()
      };

      // 1. Save to skipped_leads
      await setDoc(doc(db, 'skipped_leads', skipId), skippedLead);
      
      // 2. Delete from leads
      await deleteDoc(doc(db, 'leads', leadId));
      
      await logAction('dismiss_lead', `Permanently dismissed lead: ${lead.name}`, leadId, lead.name);
      showToast(`Lead moved to skipped archives.`, "success");
    } catch (e: any) {
      showToast(`Dismissal failed: ${e.message}`, "error");
    }
  };

  const restoreSkippedLead = async (skippedId: string) => {
    if (!user) return;
    try {
      const skipped = skippedLeads.find(s => s.id === skippedId);
      if (!skipped) return;

      // info format is typically "Name - Contact (Project)"
      // We'll try to extract what we can, but usually we just want to put it back as a lead
      // However, skipped leads don't have full lead data. 
      // If the user wants them "back", we should probably just notify that they can't be fully restored 
      // UNLESS we still have the lead ID.
      // But typically, a skipped lead is just a LOG.
      
      // For now, let's just delete it from skipped and notify
      await deleteDoc(doc(db, 'skipped_leads', skippedId));
      showToast("Log entry removed. Sync will catch this lead again if it still exists in the sheet.", "info");
    } catch (e: any) {
      showToast(`Restore failed: ${e.message}`, "error");
    }
  };

  const hasPermission = (permission: Permission) => {
    if (!user) return false;
    if (user.role === 'SuperAdmin' || user.permissions.includes('all')) return true;
    
    // Explicit Role-Based Overrides
    if (user.role === 'SubAdmin') return true; // SubAdmin matches SuperAdmin
    
    if (user.role === 'SalesTeamLead') {
      const leadPermissions: Permission[] = [
        'view_dashboard', 'view_leads', 'view_skipped', 'view_audit', 
        'add_lead', 'edit_lead', 'assign_lead', 'bulk_assign_lead', 'import_leads', 
        'export_leads', 'purge_leads', 'sync_sheets', 'view_tasks', 'add_task', 'view_chat'
      ];
      if (leadPermissions.includes(permission)) return true;
    }

    if (user.role === 'SalesAssociate') {
      const associatePermissions: Permission[] = [
        'view_dashboard', 'view_leads', 'add_lead', 'edit_lead', 'view_tasks', 'view_chat'
      ];
      if (associatePermissions.includes(permission)) return true;
    }
    
    return user.permissions.includes(permission);
  };

  return (
    <AppContext.Provider value={{
      user, leads, skippedLeads, auditLogs, tasks, notifications, chats, users, inventory, sheetConfigs, theme, logoUrl, activeTab, toasts, showToast, setActiveTab, toggleTheme, updateLogoUrl,
      login, loginWithGoogle, logout, addLead, updateLead, bulkUpdateLeads, importLeads, normalizeJunkLeads, clearLeads, clearSkippedLeads, bulkDeleteSkippedLeads, addUser, updateUser, deleteUser, purgeUsers, addTask, updateTaskStatus, sendChatMessage, markNotificationRead, refreshData, deleteLead, bulkDeleteLeads, hasPermission, standardizeAssetTypes, addSheetConfig, updateSheetConfig, removeSheetConfig, sendEODReport, saveBookingDetails, addInventoryUnit, updateInventoryUnit, deleteInventoryUnit, bulkImportInventory, clearInventory, dismissLead, restoreSkippedLead
    }}>
      {children}
    </AppContext.Provider>
  );
};


export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
