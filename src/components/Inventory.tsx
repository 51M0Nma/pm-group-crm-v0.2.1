import React, { useState, useMemo } from 'react';
import { useApp } from '@/src/AppContext';
import { Button, Card, Input } from './ui';
import { cn } from '@/src/lib/utils';
import { 
  Building2, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  CheckCircle2, 
  XCircle,
  MoreVertical,
  Plus,
  RefreshCw,
  ShoppingBag,
  User,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Map,
  Grid,
  Trash2
} from 'lucide-react';
import { InventoryUnit, Project, InventoryStatus } from '@/src/types';
import { format } from 'date-fns';

export default function Inventory() {
  const { 
    inventory, 
    addInventoryUnit, 
    bulkImportInventory, 
    clearInventory,
    leads, 
    updateInventoryUnit, 
    hasPermission, 
    user, 
    showToast 
  } = useApp();
  const [activeProject, setActiveProject] = useState<Project>('PM UPLANDS');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | 'All'>('All');
  const [isSeeding, setIsSeeding] = useState(false);
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [isEditingAsset, setIsEditingAsset] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Quick Booking State
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingUnit, setBookingUnit] = useState<InventoryUnit | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [newStatus, setNewStatus] = useState<InventoryStatus>('Reserved');
  const [isSavingBooking, setIsSavingBooking] = useState(false);

  const [newAsset, setNewAsset] = useState<Partial<InventoryUnit>>({
    project: 'PM UPLANDS',
    unitNumber: '',
    unitType: 'PLOT',
    sizeSqFt: 0,
    sizeSqMt: 0,
    status: 'Available',
    plcDescription: '',
    plcPercentage: ''
  });

  const projects: Project[] = ['PM UPLANDS', 'PM ELITE', 'THE RISE'];

  const handleAddAsset = async () => {
    if (!newAsset.unitNumber || !newAsset.project) {
      showToast('Unit Number and Project are required.', 'error');
      return;
    }
    try {
      if (isEditingAsset && editingUnitId) {
        await updateInventoryUnit(editingUnitId, newAsset);
        showToast('Asset updated successfully.', 'success');
      } else {
        await addInventoryUnit(newAsset);
        showToast('Asset registered successfully.', 'success');
      }
      setIsAddingAsset(false);
      setIsEditingAsset(false);
      setEditingUnitId(null);
      setNewAsset({
        project: activeProject,
        unitNumber: '',
        unitType: 'PLOT',
        sizeSqFt: 0,
        sizeSqMt: 0,
        status: 'Available',
        plcDescription: '',
        plcPercentage: ''
      });
    } catch (e) {
      console.error('Failed to save asset:', e);
    }
  };

  const handleEditClick = (unit: InventoryUnit) => {
    setEditingUnitId(unit.id);
    setNewAsset({
      project: unit.project,
      unitNumber: unit.unitNumber,
      unitType: unit.unitType,
      sizeSqFt: unit.sizeSqFt,
      sizeSqMt: unit.sizeSqMt || 0,
      status: unit.status,
      plcDescription: unit.plcDescription,
      plcPercentage: unit.plcPercentage
    });
    setIsEditingAsset(true);
    setIsAddingAsset(true);
  };

  const handleQuickBook = async () => {
    if (!bookingUnit || !selectedLeadId) {
      showToast('Please select a lead first.', 'error');
      return;
    }

    setIsSavingBooking(true);
    try {
      const selectedLead = leads.find(l => l.id === selectedLeadId);
      if (!selectedLead) return;

      // 1. Update Inventory Unit
      await updateInventoryUnit(bookingUnit.id, {
        status: newStatus,
        soldToId: selectedLeadId,
        soldAt: newStatus === 'Sold' ? new Date().toISOString() : undefined
      });

      // 2. Link to Lead's Booking Details
      const paymentStatus = newStatus === 'Sold' ? 'Paid' : 'Pending';
      const bookingData = {
        property: {
          projectName: bookingUnit.project,
          unitNumber: bookingUnit.unitNumber,
          propertyType: bookingUnit.unitType,
          sizeSqFt: (bookingUnit.sizeSqFt || bookingUnit.sizeSqMt || '').toString(),
          totalCost: '' // User can fill this in lead tracker if needed
        },
        payment: {
          paymentStatus,
          paymentMode: 'Online',
          bookingAmount: '',
          transactionNo: '',
          bankName: '',
          paymentDate: new Date().toISOString().split('T')[0]
        }
      };

      await useApp().updateLead(selectedLeadId, {
        bookingDetails: bookingData as any
      });

      showToast(`Unit ${bookingUnit.unitNumber} is now ${newStatus} for ${selectedLead.name}`, 'success');
      setIsBookingOpen(false);
      setBookingUnit(null);
      setSelectedLeadId('');
    } catch (error) {
      console.error('Booking failed:', error);
      showToast('Failed to complete booking', 'error');
    } finally {
      setIsSavingBooking(false);
    }
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter(unit => {
      const matchesProject = unit.project === activeProject;
      const matchesSearch = unit.unitNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || unit.status === statusFilter;
      return matchesProject && matchesSearch && matchesStatus;
    }).sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0));
  }, [inventory, activeProject, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const projectUnits = inventory.filter(u => u.project === activeProject);
    const total = projectUnits.length;
    const sold = projectUnits.filter(u => u.status === 'Sold').length;
    const available = total - sold;
    const occupancy = total > 0 ? Math.round((sold / total) * 100) : 0;
    
    return { total, sold, available, occupancy };
  }, [inventory, activeProject]);

  const seedInitialData = async () => {
    setIsSeeding(true);
    try {
      const uplandsData: Partial<InventoryUnit>[] = [
        { id: 'UP_116', project: 'PM UPLANDS', unitNumber: '116', sizeSqFt: 3500, unitType: 'PLOT' as any, plcPercentage: '10%', plcDescription: 'Garden', status: 'Available' as any, serialNumber: 1 },
        { id: 'UP_215', project: 'PM UPLANDS', unitNumber: '215', sizeSqFt: 2328, unitType: 'PLOT' as any, plcPercentage: '12.50%', plcDescription: 'Corner+Garden', status: 'Available' as any, serialNumber: 2 },
        { id: 'UP_232', project: 'PM UPLANDS', unitNumber: '232', sizeSqFt: 1669, unitType: 'PLOT' as any, plcPercentage: '10%', plcDescription: 'Garden', status: 'Available' as any, serialNumber: 3 },
        { id: 'UP_130', project: 'PM UPLANDS', unitNumber: '130', sizeSqFt: 6156, unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 4 },
        { id: 'UP_72', project: 'PM UPLANDS', unitNumber: '72', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 5 },
        { id: 'UP_73', project: 'PM UPLANDS', unitNumber: '73', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 6 },
        { id: 'UP_74', project: 'PM UPLANDS', unitNumber: '74', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 7 },
        { id: 'UP_75', project: 'PM UPLANDS', unitNumber: '75', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 8 },
        { id: 'UP_76', project: 'PM UPLANDS', unitNumber: '76', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 9 },
        { id: 'UP_77', project: 'PM UPLANDS', unitNumber: '77', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 10 },
        { id: 'UP_78', project: 'PM UPLANDS', unitNumber: '78', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 11 },
        { id: 'UP_79', project: 'PM UPLANDS', unitNumber: '79', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 12 },
        { id: 'UP_80', project: 'PM UPLANDS', unitNumber: '80', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 13 },
        { id: 'UP_81', project: 'PM UPLANDS', unitNumber: '81', sizeSqFt: 2253, dimension: '90*25', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 14 },
        { id: 'UP_85', project: 'PM UPLANDS', unitNumber: '85', sizeSqFt: 2250, dimension: '90*25', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 15 },
        { id: 'UP_86', project: 'PM UPLANDS', unitNumber: '86', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 16 },
        { id: 'UP_87', project: 'PM UPLANDS', unitNumber: '87', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 17 },
        { id: 'UP_88', project: 'PM UPLANDS', unitNumber: '88', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 18 },
        { id: 'UP_89', project: 'PM UPLANDS', unitNumber: '89', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 19 },
        { id: 'UP_90', project: 'PM UPLANDS', unitNumber: '90', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 20 },
        { id: 'UP_91', project: 'PM UPLANDS', unitNumber: '91', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 21 },
        { id: 'UP_92', project: 'PM UPLANDS', unitNumber: '92', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 22 },
        { id: 'UP_93', project: 'PM UPLANDS', unitNumber: '93', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 23 },
        { id: 'UP_94', project: 'PM UPLANDS', unitNumber: '94', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 24 },
        { id: 'UP_95', project: 'PM UPLANDS', unitNumber: '95', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 25 },
        { id: 'UP_96', project: 'PM UPLANDS', unitNumber: '96', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 26 },
        { id: 'UP_97', project: 'PM UPLANDS', unitNumber: '97', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 27 },
        { id: 'UP_98', project: 'PM UPLANDS', unitNumber: '98', sizeSqFt: 1875, dimension: '25*75', unitType: 'PLOT' as any, status: 'Available' as any, serialNumber: 28 },
        { id: 'UP_99', project: 'PM UPLANDS', unitNumber: '99', sizeSqFt: 3037, dimension: '40*75', unitType: 'PLOT' as any, plcPercentage: '10%', plcDescription: 'Corner', status: 'Available' as any, serialNumber: 29 },
        { id: 'UP_65', project: 'PM UPLANDS', unitNumber: '65', sizeSqFt: 1875, dimension: '25*75', unitType: 'VILLA' as any, status: 'Available' as any, serialNumber: 30 },
        { id: 'UP_66', project: 'PM UPLANDS', unitNumber: '66', sizeSqFt: 1875, dimension: '25*75', unitType: 'VILLA' as any, status: 'Available' as any, serialNumber: 31 },
        { id: 'UP_67', project: 'PM UPLANDS', unitNumber: '67', sizeSqFt: 1875, dimension: '25*75', unitType: 'VILLA' as any, status: 'Available' as any, serialNumber: 32 },
        { id: 'UP_68', project: 'PM UPLANDS', unitNumber: '68', sizeSqFt: 1875, dimension: '25*75', unitType: 'VILLA' as any, status: 'Available' as any, serialNumber: 33 },
        { id: 'UP_69', project: 'PM UPLANDS', unitNumber: '69', sizeSqFt: 1875, dimension: '25*75', unitType: 'VILLA' as any, plcPercentage: '10%', plcDescription: 'Corner', status: 'Available' as any, serialNumber: 34 },
        { id: 'UP_100', project: 'PM UPLANDS', unitNumber: '100', sizeSqFt: 1875, dimension: '25*75', unitType: 'VILLA' as any, plcPercentage: '10%', plcDescription: 'Corner', status: 'Available' as any, serialNumber: 35 },
        { id: 'UP_101', project: 'PM UPLANDS', unitNumber: '101', sizeSqFt: 1875, dimension: '25*75', unitType: 'VILLA' as any, status: 'Available' as any, serialNumber: 36 },
        { id: 'UP_102', project: 'PM UPLANDS', unitNumber: '102', sizeSqFt: 1875, dimension: '25*75', unitType: 'VILLA' as any, status: 'Available' as any, serialNumber: 37 },
        { id: 'UP_103', project: 'PM UPLANDS', unitNumber: '103', sizeSqFt: 1875, dimension: '25*75', unitType: 'VILLA' as any, status: 'Available' as any, serialNumber: 38 },
        { id: 'UP_104', project: 'PM UPLANDS', unitNumber: '104', sizeSqFt: 1875, dimension: '25*75', unitType: 'VILLA' as any, status: 'Available' as any, serialNumber: 39 },
        { id: 'UP_105', project: 'PM UPLANDS', unitNumber: '105', sizeSqFt: 1875, dimension: '25*75', unitType: 'VILLA' as any, status: 'Available' as any, serialNumber: 40 },
      ];

      const villaData: Partial<InventoryUnit>[] = [];
      const riseData: Partial<InventoryUnit>[] = [];

      const eliteData: Partial<InventoryUnit>[] = [
        { id: 'EL_CR2', project: 'PM ELITE', unitNumber: 'CR-2', sizeSqMt: 95, sizeSqFt: 1023, status: 'Available', serialNumber: 1 },
        { id: 'EL_CR3', project: 'PM ELITE', unitNumber: 'CR-3', sizeSqMt: 134.28, sizeSqFt: 1445, status: 'Available', serialNumber: 2 },
        { id: 'EL_CR4', project: 'PM ELITE', unitNumber: 'CR-4', sizeSqMt: 158.98, sizeSqFt: 1711, status: 'Available', serialNumber: 3 },
        { id: 'EL_D11', project: 'PM ELITE', unitNumber: 'D-11', sizeSqMt: 128.79, sizeSqFt: 1386, status: 'Available', serialNumber: 4 },
        { id: 'EL_D23', project: 'PM ELITE', unitNumber: 'D-23', sizeSqMt: 120.07, sizeSqFt: 1292, status: 'Available', serialNumber: 5 },
        { id: 'EL_D59', project: 'PM ELITE', unitNumber: 'D-59', sizeSqMt: 92.96, sizeSqFt: 1001, status: 'Available', serialNumber: 6 },
        { id: 'EL_D73', project: 'PM ELITE', unitNumber: 'D-73', sizeSqMt: 92.96, sizeSqFt: 1001, status: 'Available', serialNumber: 7 },
        { id: 'EL_D74', project: 'PM ELITE', unitNumber: 'D-74', sizeSqMt: 92.96, sizeSqFt: 1001, status: 'Available', serialNumber: 8 },
        { id: 'EL_D82', project: 'PM ELITE', unitNumber: 'D-82', sizeSqMt: 92.96, sizeSqFt: 1001, status: 'Available', serialNumber: 9 },
        { id: 'EL_D93', project: 'PM ELITE', unitNumber: 'D-93', sizeSqMt: 92.96, sizeSqFt: 1001, status: 'Sold', serialNumber: 10 },
        { id: 'EL_D94', project: 'PM ELITE', unitNumber: 'D-94', sizeSqMt: 92.96, sizeSqFt: 1001, status: 'Available', serialNumber: 11 },
        { id: 'EL_D99', project: 'PM ELITE', unitNumber: 'D-99', sizeSqMt: 92.96, sizeSqFt: 1001, status: 'Available', serialNumber: 12 },
        { id: 'EL_D107', project: 'PM ELITE', unitNumber: 'D-107', sizeSqMt: 92.96, sizeSqFt: 1001, status: 'Available', serialNumber: 13 },
        { id: 'EL_D108', project: 'PM ELITE', unitNumber: 'D-108', sizeSqMt: 92.96, sizeSqFt: 1001, status: 'Available', serialNumber: 14 },
        { id: 'EL_D109', project: 'PM ELITE', unitNumber: 'D-109', sizeSqMt: 92.96, sizeSqFt: 1001, status: 'Available', serialNumber: 15 },
        { id: 'EL_D110', project: 'PM ELITE', unitNumber: 'D-110', sizeSqMt: 125.05, sizeSqFt: 1346, status: 'Available', serialNumber: 16 },
        { id: 'EL_D111', project: 'PM ELITE', unitNumber: 'D-111', sizeSqMt: 106.53, sizeSqFt: 1147, status: 'Available', serialNumber: 17 },
        { id: 'EL_D112', project: 'PM ELITE', unitNumber: 'D-112', sizeSqMt: 104.5, sizeSqFt: 1125, status: 'Available', serialNumber: 18 },
        { id: 'EL_D113', project: 'PM ELITE', unitNumber: 'D-113', sizeSqMt: 102.33, sizeSqFt: 1101, status: 'Available', serialNumber: 19 },
        { id: 'EL_D114', project: 'PM ELITE', unitNumber: 'D-114', sizeSqMt: 99.5, sizeSqFt: 1071, status: 'Available', serialNumber: 20 },
        { id: 'EL_D115', project: 'PM ELITE', unitNumber: 'D-115', sizeSqMt: 94.8, sizeSqFt: 1020, status: 'Available', serialNumber: 21 },
        { id: 'EL_D116', project: 'PM ELITE', unitNumber: 'D-116', sizeSqMt: 117.82, sizeSqFt: 1268, status: 'Available', serialNumber: 22 },
      ];

      await bulkImportInventory([...uplandsData, ...villaData, ...riseData, ...eliteData]);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="serif text-5xl font-light italic text-[var(--color-text-main)] mb-2">Inventory Ledger</h1>
          <p className="text-[11px] uppercase tracking-[0.3em] font-black text-slate-500 flex items-center gap-2">
            Asset Management <ChevronRight className="w-3 h-3 text-accent" /> {activeProject}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {hasPermission('manage_settings') && (
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={seedInitialData} 
                disabled={isSeeding}
                className="h-11 px-6 rounded-xl border-accent/20 text-accent hover:bg-accent/5 gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", isSeeding && "animate-spin")} />
                {isSeeding ? "Seeding..." : "Quick Boost Data"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowClearConfirm(true)}
                className="h-11 px-6 rounded-xl border-red-500/20 text-red-500 hover:bg-red-500/5 gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </Button>
            </div>
          )}
          <Button 
            onClick={() => {
              setNewAsset({
                project: activeProject,
                unitNumber: '',
                unitType: 'PLOT',
                sizeSqFt: 0,
                sizeSqMt: 0,
                status: 'Available',
                plcDescription: '',
                plcPercentage: ''
              });
              setIsEditingAsset(false);
              setIsAddingAsset(true);
            }}
            className="h-11 px-8 rounded-xl bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20 gap-2"
          >
            <Plus className="w-4 h-4" /> Add Asset
          </Button>
        </div>
      </div>

      {/* Confirmation Modal for Clear */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="max-w-md w-full p-8 bg-[var(--color-bg-card)] border-[var(--color-border-main)] rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="p-4 bg-red-500/10 rounded-full">
                <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-2">Purge Inventory Ledger?</h3>
                <p className="text-sm text-slate-500">This action is irreversible and will remove all inventory records from the system.</p>
              </div>
              <div className="flex w-full gap-4">
                <Button 
                  variant="outline" 
                  className="flex-1 h-12 rounded-xl"
                  onClick={() => setShowClearConfirm(false)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white"
                  onClick={() => {
                    clearInventory();
                    setShowClearConfirm(false);
                  }}
                >
                  Yes, Purge All
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal for Add/Edit Asset */}
      {isAddingAsset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="max-w-2xl w-full bg-[var(--color-bg-card)] border-[var(--color-border-main)] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-[var(--color-border-main)] bg-[var(--color-bg-sidebar)] flex justify-between items-center">
              <h2 className="serif text-3xl font-light italic text-[var(--color-text-main)]">
                {isEditingAsset ? 'Modify Asset Details' : 'Register New Asset'}
              </h2>
              <button 
                onClick={() => {
                  setIsAddingAsset(false);
                  setIsEditingAsset(false);
                  setEditingUnitId(null);
                }} 
                className="text-slate-500 hover:text-accent p-2"
              >
                ✕
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Target Project</label>
                  <select 
                    value={newAsset.project}
                    onChange={(e) => setNewAsset({ ...newAsset, project: e.target.value as Project })}
                    className="w-full h-12 bg-transparent border border-[var(--color-border-main)] rounded-xl px-4 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                  >
                    {projects.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Unit Number / Plot No.</label>
                  <Input 
                    placeholder="e.g. 116 or V-5"
                    value={newAsset.unitNumber}
                    onChange={(e) => setNewAsset({ ...newAsset, unitNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Asset Category</label>
                  <select 
                    value={newAsset.unitType}
                    onChange={(e) => setNewAsset({ ...newAsset, unitType: e.target.value })}
                    className="w-full h-12 bg-transparent border border-[var(--color-border-main)] rounded-xl px-4 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                  >
                    <option value="PLOT">PLOT</option>
                    <option value="VILLA">VILLA</option>
                    <option value="APARTMENT">APARTMENT</option>
                    <option value="COMMERCIAL">COMMERCIAL</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Status</label>
                  <select 
                    value={newAsset.status}
                    onChange={(e) => setNewAsset({ ...newAsset, status: e.target.value as InventoryStatus })}
                    className="w-full h-12 bg-transparent border border-[var(--color-border-main)] rounded-xl px-4 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                  >
                    <option value="Available">Available</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Sold">Sold</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Area (SqFt)</label>
                  <Input 
                    type="number"
                    placeholder="Total Square Feet"
                    value={newAsset.sizeSqFt || ''}
                    onChange={(e) => setNewAsset({ ...newAsset, sizeSqFt: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Area (SqMt)</label>
                  <Input 
                    type="number"
                    placeholder="Total Square Meters"
                    value={newAsset.sizeSqMt || ''}
                    onChange={(e) => setNewAsset({ ...newAsset, sizeSqMt: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">PLC Description</label>
                  <Input 
                    placeholder="e.g. Garden Facing, Corner"
                    value={newAsset.plcDescription}
                    onChange={(e) => setNewAsset({ ...newAsset, plcDescription: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">PLC Percentage (%)</label>
                  <Input 
                    placeholder="e.g. 10%"
                    value={newAsset.plcPercentage}
                    onChange={(e) => setNewAsset({ ...newAsset, plcPercentage: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-[var(--color-border-main)] bg-[var(--color-bg-sidebar)]/50 flex justify-end gap-4">
              <Button 
                variant="ghost" 
                onClick={() => {
                  setIsAddingAsset(false);
                  setIsEditingAsset(false);
                  setEditingUnitId(null);
                }} 
                className="h-12 px-8 rounded-xl font-black uppercase tracking-widest text-[10px]"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddAsset} 
                className="h-12 px-10 rounded-xl bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/40 font-black uppercase tracking-widest text-[10px]"
              >
                {isEditingAsset ? 'Update Asset' : 'Confirm Registration'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Booking Modal */}
      {isBookingOpen && bookingUnit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="max-w-md w-full p-8 bg-[var(--color-bg-card)] border-[var(--color-border-main)] rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="serif text-2xl font-light italic text-[var(--color-text-main)] mb-1">Manage Booking</h3>
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                    Unit {bookingUnit.unitNumber} • {bookingUnit.project}
                  </p>
                </div>
                <button onClick={() => setIsBookingOpen(false)} className="text-slate-400 hover:text-accent">✕</button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Select Lead</label>
                  <select 
                    value={selectedLeadId}
                    onChange={(e) => setSelectedLeadId(e.target.value)}
                    className="w-full h-12 bg-transparent border border-[var(--color-border-main)] rounded-xl px-4 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                  >
                    <option value="">-- Choose Lead --</option>
                    {leads
                      .filter(l => l.project === bookingUnit.project || !l.project)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(lead => (
                        <option key={lead.id} value={lead.id}>
                          {lead.name} ({lead.source})
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Update Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Available', 'Reserved', 'Sold', 'Blocked'] as const).map(status => (
                      <button
                        key={status}
                        onClick={() => setNewStatus(status)}
                        className={cn(
                          "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                          newStatus === status 
                            ? "bg-accent border-accent text-white shadow-lg" 
                            : "border-[var(--color-border-main)] text-slate-500 hover:border-accent/40"
                        )}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1 h-12 rounded-xl"
                  onClick={() => setIsBookingOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  disabled={isSavingBooking || !selectedLeadId}
                  className="flex-1 h-12 rounded-xl bg-accent text-white hover:bg-accent/90"
                  onClick={handleQuickBook}
                >
                  {isSavingBooking ? "Syncing..." : "Update Booking"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Units', value: stats.total, icon: Grid, color: 'text-slate-400' },
          { label: 'Units Sold', value: stats.sold, icon: ShoppingBag, color: 'text-accent' },
          { label: 'Available', value: stats.available, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Booking Rate', value: `${stats.occupancy}%`, icon: TrendingUp, color: 'text-amber-500' }
        ].map((stat, i) => (
          <Card key={i} className="p-6 bg-[var(--color-bg-card)] border-[var(--color-border-main)] rounded-2xl group hover:border-accent/40 transition-all duration-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[9px] uppercase tracking-widest font-black text-slate-500 mb-2">{stat.label}</p>
                <h3 className={cn("text-3xl font-black tabular-nums tracking-tighter", stat.color)}>{stat.value}</h3>
              </div>
              <div className="p-3 bg-slate-500/5 rounded-xl group-hover:scale-110 transition-transform">
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Main Controls */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-main)] rounded-3xl overflow-hidden shadow-xl">
        <div className="p-8 border-b border-[var(--color-border-main)] bg-[var(--color-bg-sidebar)]/30">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex bg-[var(--color-bg-sidebar)]/20 p-1 rounded-xl w-fit">
              {projects.map(proj => (
                <button
                  key={proj}
                  onClick={() => setActiveProject(proj)}
                  className={cn(
                    "px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    activeProject === proj ? "bg-accent text-white shadow-lg" : "text-slate-500 hover:text-[var(--color-text-main)]"
                  )}
                >
                  {proj}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="relative group min-w-[280px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-accent transition-colors" />
                <Input 
                  placeholder="Search plot number..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-11 bg-[var(--color-bg-sidebar)]/10 border-[var(--color-border-main)] rounded-xl focus:ring-accent/20"
                />
              </div>
              
              <div className="flex items-center gap-2 p-1 bg-[var(--color-bg-sidebar)]/10 rounded-xl">
                {(['All', 'Available', 'Sold', 'Reserved'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all",
                      statusFilter === status ? "bg-[var(--color-text-main)]/10 text-[var(--color-text-main)]" : "text-slate-500 hover:text-slate-400"
                    )}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-accent">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[var(--color-bg-sidebar)]/40">
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-[var(--color-border-main)] w-20">Sr.No</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-[var(--color-border-main)]">Plot No</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-[var(--color-border-main)]">Property Details</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-[var(--color-border-main)]">Size (SqFt/SqMt)</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-[var(--color-border-main)]">PLC Details</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-[var(--color-border-main)]">Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-[var(--color-border-main)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-main)]/30">
              {filteredInventory.map((unit) => (
                <tr key={unit.id} className="hover:bg-[var(--color-text-main)]/[0.02] transition-colors group">
                  <td className="px-8 py-5 text-sm font-mono text-slate-400">{unit.serialNumber}</td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent font-black text-xs">
                        #
                      </div>
                      <span className="text-sm font-bold text-[var(--color-text-main)]">{unit.unitNumber}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                      <p className="text-xs font-black uppercase tracking-tighter text-slate-400">
                        {unit.unitType || 'PLOT'} {unit.dimension ? `• ${unit.dimension}` : ''}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold tabular-nums">{unit.sizeSqFt} <span className="text-[10px] font-light text-slate-500 ml-0.5">SqFt</span></span>
                      {unit.sizeSqMt && (
                        <span className="text-[10px] text-slate-500 font-medium">{unit.sizeSqMt} SqMt</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {unit.plcDescription ? (
                      <div className="space-y-1">
                        <p className="text-[10px] italic font-serif text-accent">
                          {unit.plcDescription}
                        </p>
                        <p className="text-[9px] font-black text-slate-500 uppercase">{unit.plcPercentage} Applicable</p>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500/20 italic font-mono">-</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                      unit.status === 'Available' ? "bg-emerald-500/10 text-emerald-500" :
                      unit.status === 'Sold' ? "bg-accent/10 text-accent" :
                      "bg-amber-500/10 text-amber-500"
                    )}>
                      {unit.status === 'Available' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {unit.status}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="p-2 h-8 w-8 hover:bg-accent/10 text-slate-500 hover:text-accent"
                        onClick={() => handleEditClick(unit)}
                        title="Edit Asset Details"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={cn(
                          "px-3 h-8 flex items-center gap-2 rounded-lg transition-all",
                          unit.status === 'Available' 
                            ? "hover:bg-emerald-500/10 text-emerald-500" 
                            : "hover:bg-accent/10 text-accent"
                        )}
                        onClick={() => {
                          setBookingUnit(unit);
                          setNewStatus(unit.status === 'Available' ? 'Reserved' : unit.status);
                          setSelectedLeadId(unit.soldToId || '');
                          setIsBookingOpen(true);
                        }}
                        title="Manage Booking & Assign Lead"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Book</span>
                      </Button>

                      {unit.soldToId && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-bold text-slate-500">
                          <User className="w-3 h-3" />
                          {leads.find(l => l.id === unit.soldToId)?.name.split(' ')[0]}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-slate-500/5 rounded-full">
                        <Map className="w-10 h-10 text-slate-600" />
                      </div>
                      <p className="text-[10px] uppercase font-black tracking-[0.3em] text-slate-500">No assets discovered in this sector</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
