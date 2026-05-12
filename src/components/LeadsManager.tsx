import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '@/src/AppContext';
import { Button, Input, Card } from '@/src/components/ui';
import { cn } from '@/src/lib/utils';
import { Lead, LifecycleStage, Project } from '@/src/types';
import BookingForm from './BookingForm';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  FileCheck,
  MoreHorizontal,
  Mail,
  Phone,
  MessageSquare,
  ChevronRight,
  TrendingUp,
  Tag,
  Trash2,
  ArrowLeft,
  ShieldCheck,
  Activity,
  XOctagon,
  PhoneCall,
  CheckSquare,
  RefreshCw,
  History,
  MessageCircle,
  Smartphone,
  Share,
  Calendar,
  MapPin
} from 'lucide-react';
import Papa from 'papaparse';
import { format, parseISO, isValid } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

const normalizePhone = (input: string) => {
  if (!input) return '';
  let clean = input.toString().replace(/\D/g, '');
  if (clean.length === 11 && clean.startsWith('0')) clean = clean.substring(1);
  if (clean.length === 12 && clean.startsWith('91')) clean = clean.substring(2);
  if (clean.length > 10) clean = clean.slice(-10);
  return clean;
};

export default function LeadsManager() {
  const { 
    leads, 
    skippedLeads,
    addLead, 
    updateLead, 
    bulkUpdateLeads,
    importLeads, 
    clearLeads, 
    user, 
    users, 
    inventory,
    updateInventoryUnit,
    addTask, 
    showToast, 
    deleteLead, 
    bulkDeleteLeads,
    sheetConfigs,
    hasPermission, 
    setActiveTab,
    dismissLead
  } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkAssignTo, setBulkAssignTo] = useState<string>('');
  const [bulkStatusTo, setBulkStatusTo] = useState<LifecycleStage>('Cold');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [projectFilter, setProjectFilter] = useState<string>('All');
  const [assignedToFilter, setAssignedToFilter] = useState<string>('All');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [walkinSourceFilter, setWalkinSourceFilter] = useState<string>('All');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState<string>('All');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBookingFormOpen, setIsBookingFormOpen] = useState(false);
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [remarkLead, setRemarkLead] = useState<Lead | null>(null);
  const [taskLead, setTaskLead] = useState<Lead | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep editing contexts in sync with fresh data from leads array
  React.useEffect(() => {
    if (editingLead) {
      const fresh = leads.find(l => l.id === editingLead.id);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(editingLead)) {
        setEditingLead(fresh);
      }
    }
    if (remarkLead) {
      const fresh = leads.find(l => l.id === remarkLead.id);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(remarkLead)) {
        setRemarkLead(fresh);
      }
    }
    if (taskLead) {
      const fresh = leads.find(l => l.id === taskLead.id);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(taskLead)) {
        setTaskLead(fresh);
      }
    }
  }, [leads, editingLead, remarkLead, taskLead]);

  const statuses: (LifecycleStage | 'All')[] = ['All', 'Cold', 'Warm', 'Intent', 'Site Visit', 'Converted', 'CP', 'Closed', 'Duplicate'];
  const projects: (Project | 'All')[] = ['All', 'PM UPLANDS', 'PM ELITE', 'THE RISE'];

  const dynamicSources = useMemo(() => {
    const s = new Set(leads.map(l => l.source || l.originationSource).filter(Boolean));
    return ['All', ...Array.from(s)].sort();
  }, [leads]);

  const dynamicPropertyTypes = useMemo(() => {
    const t = new Set(leads.map(l => l.propertyType).filter(Boolean));
    return ['All', ...Array.from(t)].sort();
  }, [leads]);

  const dynamicWalkinSources = useMemo(() => {
    const s = new Set(leads.map(l => l.walkinSource).filter(Boolean));
    return ['All', ...Array.from(s)].sort();
  }, [leads]);

  const employmentTypes = ['All', 'Salaried', 'Business', 'Self-Employed', 'Professional', 'Other'];

  const filteredLeads = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    
    const scoredLeads = leads
      .map(lead => {
        let score = 0;
        let matchesSearch = true;

        if (term) {
          matchesSearch = false;
          const name = (lead.name || '').toLowerCase();
          const email = (lead.email || '').toLowerCase();
          const phone = (lead.phone || '').toLowerCase();
          const source = (lead.source || lead.originationSource || '').toLowerCase();
          const project = (lead.project || '').toLowerCase();
          const campaign = (lead.campaignName || '').toLowerCase();

          // 1. Exact matches (Highest Priority)
          if (name === term) score += 100;
          else if (name.startsWith(term)) score += 80;
          else if (name.includes(term)) score += 60;

          if (email === term) score += 90;
          else if (email.includes(term)) score += 50;

          if (phone === term) score += 95;
          else if (phone.includes(term)) score += 70;

          // 2. Source & Project Priority
          if (source.includes(term)) score += 40;
          if (project.includes(term)) score += 30;
          if (campaign.includes(term)) score += 20;

          // 3. Typo Tolerance (Simple)
          if (score === 0 && term.length > 3) {
            // Check if name has typo (Levenshtein distance 1)
            const parts = name.split(' ');
            for (const part of parts) {
              if (part.length < 3) continue;
              // Check if distance is 1
              if (Math.abs(part.length - term.length) <= 1) {
                let diff = 0;
                let i = 0, j = 0;
                while (i < part.length && j < term.length) {
                  if (part[i] !== term[j]) {
                    diff++;
                    if (part.length > term.length) i++;
                    else if (term.length > part.length) j++;
                    else { i++; j++; }
                  } else { i++; j++; }
                  if (diff > 1) break;
                }
                diff += (part.length - i) + (term.length - j);
                if (diff <= 1) {
                  score += 10;
                  break;
                }
              }
            }
          }

          matchesSearch = score > 0;
        }

        return { lead, score, matchesSearch };
      })
      .filter(item => {
        const { lead, matchesSearch } = item;
        const matchesStatus = statusFilter === 'All' || lead.lifecycleStage === statusFilter;
        const matchesProject = projectFilter === 'All' || lead.project === projectFilter;
        const matchesAssigned = assignedToFilter === 'All' 
          ? true 
          : assignedToFilter === 'Unassigned' 
            ? (!lead.assignedTo || lead.assignedTo === '') 
            : lead.assignedTo === assignedToFilter;
        const matchesPropertyType = propertyTypeFilter === 'All' || lead.propertyType === propertyTypeFilter;
        const matchesSource = sourceFilter === 'All' || (lead.source || lead.originationSource) === sourceFilter;
        const matchesWalkin = walkinSourceFilter === 'All' || lead.walkinSource === walkinSourceFilter;
        const matchesEmployment = employmentTypeFilter === 'All' || lead.employmentType === employmentTypeFilter;
        
        let matchesDateRange = true;
        if (startDateFilter || endDateFilter) {
          const createdAt = lead.createdAt ? new Date(lead.createdAt).getTime() : 0;
          if (startDateFilter) {
            const start = new Date(startDateFilter).getTime();
            if (createdAt < start) matchesDateRange = false;
          }
          if (endDateFilter) {
            // Set to end of day
            const end = new Date(endDateFilter);
            end.setHours(23, 59, 59, 999);
            if (createdAt > end.getTime()) matchesDateRange = false;
          }
        }
        
        return matchesSearch && matchesStatus && matchesProject && matchesAssigned && matchesPropertyType && matchesSource && matchesWalkin && matchesEmployment && matchesDateRange;
      });

    return scoredLeads
      .sort((a, b) => {
        // If searching, sort by score first
        if (term && b.score !== a.score) {
          return b.score - a.score;
        }
        // Then by newest
        const dateA = new Date(a.lead.createdAt || 0).getTime();
        const dateB = new Date(b.lead.createdAt || 0).getTime();
        return dateB - dateA;
      })
      .map(item => item.lead);
  }, [leads, searchTerm, statusFilter, projectFilter, assignedToFilter, propertyTypeFilter, sourceFilter, walkinSourceFilter, employmentTypeFilter, startDateFilter, endDateFilter]);

  const [showConfirmPurge, setShowConfirmPurge] = useState(false);

  const handleClearAll = async () => {
    setShowConfirmPurge(true);
  };

  const executeTerminalPurge = async () => {
    setShowConfirmPurge(false);
    setIsClearing(true);
    try {
      console.log('--- [Terminal Purge] Starting database sanitization ---');
      if (!clearLeads) throw new Error('Erase logic not connected');
      await clearLeads();
      
      // Clear specific caches instead of everything to avoid unexpected logout/state loss
      localStorage.removeItem('pm_leads_cache');
      localStorage.removeItem('pm_sync_cache');
      
      showToast('Lead database completely cleared. Re-syncing view...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error('Purge failure:', error);
      showToast(`Purge failed: ${error.message}`, 'error');
    } finally {
      setIsClearing(false);
    }
  };

   const handleDeleteLead = async () => {
    if (!leadToDelete) return;
    try {
      await deleteLead(leadToDelete);
      showToast('Lead deleted successfully', 'success');
    } catch (err: any) {
      showToast('Delete failed: ' + err.message, 'error');
    } finally {
      setLeadToDelete(null);
    }
  };

  const handleExport = () => {
    const exportData = filteredLeads.map(lead => {
      // Rebranding DJ/H&H to PM UPLANDS in export
      let finalProject = lead.project;
      if (finalProject && (finalProject.includes('DJ') || finalProject.includes('H&H') || finalProject.includes('UPLANDS') || finalProject.includes('PM PLOT') || finalProject.includes('VILLA'))) {
        finalProject = 'PM UPLANDS';
      }

      const formattedRemarks = lead.remarks.map(r => {
        const d = new Date(r.createdAt);
        const dateStr = format(d, 'yyyy-MM-dd');
        const timeStr = format(d, 'HH:mm:ss');
        return `[${dateStr} ${timeStr}] ${r.createdBy}: ${r.text}`;
      }).join(' | ');

      const formattedSiteVisits = (lead.siteVisits || []).map((sv, i) => {
        const d = new Date(sv.date);
        const dateStr = format(d, 'yyyy-MM-dd');
        return `Visit ${i + 1}: ${dateStr}${sv.comment ? ' (' + sv.comment + ')' : ''}`;
      }).join(' | ');

      const assignedUser = users.find(u => u.id === lead.assignedTo);
      const createdByUser = users.find(u => u.id === lead.createdBy);
      const booking = lead.bookingDetails;

      return {
        'Lead ID': lead.leadId || '',
        'Internal ID': lead.id,
        'Month': lead.month || '',
        'Date': lead.date || '',
        'Customer Name': lead.name,
        'Email Address': lead.email,
        'Phone Number': lead.phone,
        'Target Project': finalProject,
        'Lifecycle Stage': lead.lifecycleStage,
        'Origination Source': lead.source,
        'Walk-in Source': lead.walkinSource || '',
        'Employment Type': lead.employmentType || '',
        'Occupation': lead.occupation || '',
        'Property Type': lead.propertyType || '',
        'Investment Budget': lead.budget || '',
        'Preferred Site Visit': lead.preferredSiteVisit || '',
        'All Site Visits': formattedSiteVisits,
        'Plot Size': lead.plotSize || '',
        'Campaign Name': lead.campaignName || '',
        'Assigned To': assignedUser ? assignedUser.name : (lead.assignedTo || 'Unassigned'),
        'Created By': createdByUser ? createdByUser.name : (lead.createdBy || 'System'),
        'Last Follow Up': lead.lastFollowUp ? format(new Date(lead.lastFollowUp), 'yyyy-MM-dd HH:mm:ss') : '',
        'Activity Journal (All Remarks)': formattedRemarks,
        'Total Remarks': lead.remarks.length,
        'Created At': lead.createdAt,
        'Updated At': lead.updatedAt || '',
        
        // Flattened Booking Details
        'Booking: Applicant Name': booking?.applicant?.fullName || '',
        'Booking: Father/Spouse': booking?.applicant?.fatherSpouseName || '',
        'Booking: DOB': booking?.applicant?.dob || '',
        'Booking: PAN': booking?.applicant?.pan || '',
        'Booking: Adhaar': booking?.applicant?.adhaar || '',
        'Booking: Current Address': booking?.address?.currentAddress || '',
        'Booking: City': booking?.address?.city || '',
        'Booking: State': booking?.address?.state || '',
        'Booking: Pin Code': booking?.address?.pinCode || '',
        'Booking: Project': booking?.property?.projectName || '',
        'Booking: Property Type': booking?.property?.propertyType || '',
        'Booking: Unit Number': booking?.property?.unitNumber || '',
        'Booking: Size (SqFt)': booking?.property?.sizeSqFt || '',
        'Booking: Rate (per SqFt)': booking?.property?.ratePerSqFt || '',
        'Booking: Total Cost': booking?.property?.totalCost || '',
        'Booking: Amount Paid': booking?.payment?.bookingAmount || '',
        'Booking: Payment Mode': booking?.payment?.paymentMode || '',
        'Booking: Payment Status': booking?.payment?.paymentStatus || '',
        'Booking: Trans No': booking?.payment?.transactionNo || '',
        'Booking: Bank Name': booking?.payment?.bankName || '',
        'Booking: Payment Date': booking?.payment?.paymentDate || '',
        'Booking: Sales Executive': booking?.sales?.executiveName || '',
        'Booking: Channel Partner': booking?.sales?.channelPartner || '',
        'Booking: Signed At': booking?.declaration?.signedAt || '',
      };
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `PM_GROUP_LEADS_FULL_EXPORT_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map(l => l.id));
    }
  };

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleUpdatePaymentStatus = async (lead: Lead, status: 'Pending' | 'Paid') => {
    if (!lead.bookingDetails) {
      showToast('No booking details found for this lead. Please create a booking first.', 'info');
      setEditingLead(lead);
      setIsBookingFormOpen(true);
      return;
    }

    const updatedBookingDetails = {
      ...lead.bookingDetails,
      payment: {
        ...lead.bookingDetails.payment,
        paymentStatus: status
      }
    };

    try {
      await updateLead(lead.id, { bookingDetails: updatedBookingDetails });
      
      // Update inventory as well
      const { projectName, unitNumber } = lead.bookingDetails.property;
      if (projectName && unitNumber) {
        const unit = inventory.find(u => u.project === projectName && u.unitNumber === unitNumber);
        if (unit) {
          const newInventoryStatus = status === 'Paid' ? 'Sold' : 'Reserved';
          await updateInventoryUnit(unit.id, { 
            status: newInventoryStatus,
            soldToId: lead.id,
            soldAt: new Date().toISOString()
          });
          showToast(`Lead marked as ${status} & Unit marked as ${newInventoryStatus}`, 'success');
        }
      }
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignTo) {
      showToast('Please select a member to assign to.', 'error');
      return;
    }
    await bulkUpdateLeads(selectedLeadIds, { assignedTo: bulkAssignTo });
    setSelectedLeadIds([]);
    setIsBulkAssignModalOpen(false);
  };
  
  const handleBulkStatusUpdate = async () => {
    await bulkUpdateLeads(selectedLeadIds, { lifecycleStage: bulkStatusTo });
    setSelectedLeadIds([]);
    setIsBulkStatusModalOpen(false);
  };

  const handleBulkDelete = async () => {
    await bulkDeleteLeads(selectedLeadIds);
    setSelectedLeadIds([]);
    setIsBulkDeleteModalOpen(false);
  };

  const handleDownloadTemplate = () => {
    const templateData = [{
      'Lead ID': 'LID-' + Math.floor(100000 + Math.random() * 900000),
      'Date': format(new Date(), 'yyyy-MM-dd'),
      'Month': format(new Date(), 'MMMM'),
      'Customer Name': 'Rahul Sharma',
      'Email Address': 'rahul.s@example.com',
      'Phone Number': '9876543210',
      'Target Project': 'PM ELITE',
      'Property Type': 'Plot',
      'Investment Budget': '1.2 Cr',
      'Preferred Site Visit': '2026-05-25',
      'Plot Size': '1200 sqft',
      'Walk-in Source': '', // Only if walk-in
      'Employment Type': 'Salaried',
      'Occupation': 'Software Engineer',
      'Lifecycle Stage': 'Cold', // This maps to CRM Lifecycle Stage
      'Activity Journal': 'Interested in plot, requested brochure via PM Plot Leads.', // This maps to Activity Journal
      'Origination Source': 'PM Plot Leads'
    }];
    const csv = Papa.unparse(templateData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `leads_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const [isCommittingSync, setIsCommittingSync] = useState(false);
  const [syncPreviewResults, setSyncPreviewResults] = useState<{ leads: any[], updates: any[], skipped: any[], syncedSheets?: string[] } | null>(null);
  const [showSyncReview, setShowSyncReview] = useState(false);
  const [selectedPreviewLeads, setSelectedPreviewLeads] = useState<Set<number>>(new Set());
  const [selectedPreviewUpdates, setSelectedPreviewUpdates] = useState<Set<number>>(new Set());
  const [syncDetails, setSyncDetails] = useState<any[] | null>(null);
  const [showSyncDetails, setShowSyncDetails] = useState(false);

  const handleCloudSync = async () => {
    const activeConfigs = sheetConfigs.filter(c => c.isActive);
    
    if (activeConfigs.length === 0) {
      showToast('No active sync configurations found. Please go to Settings to add them.', 'info');
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync-sheets?preview=true', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
 
      const data = await response.json();
      if (data.success) {
        if (data.skipped) {
          showToast(`Sync throttled: ${data.reason || 'Already in progress'}`, 'info');
          return;
        }

        setSyncPreviewResults({ 
          leads: data.leads || [], 
          updates: data.updates || [],
          skipped: data.skipped || [],
          syncedSheets: data.syncedSheets || []
        });
        setSelectedPreviewLeads(new Set((data.leads || []).map((_: any, i: number) => i)));
        setSelectedPreviewUpdates(new Set((data.updates || []).map((_: any, i: number) => i)));
        setShowSyncReview(true);
      } else {
        throw new Error(data.error || 'Sync preview failed');
      }
    } catch (error: any) {
      console.error('Cloud Sync Preview Error:', error);
      showToast(error.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmSyncReview = async () => {
    if (!syncPreviewResults) return;

    const selectedLeads = syncPreviewResults.leads.filter((_, i) => selectedPreviewLeads.has(i));
    const selectedUpdates = syncPreviewResults.updates.filter((_, i) => selectedPreviewUpdates.has(i));

    if (selectedLeads.length === 0 && selectedUpdates.length === 0) {
      showToast('No items selected for sync.', 'info');
      return;
    }

    setIsCommittingSync(true);
    try {
      const response = await fetch('/api/leads/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          leads: selectedLeads, 
          updates: selectedUpdates,
          skipped: syncPreviewResults.skipped
        })
      });

      const data = await response.json();
      if (data.success) {
        showToast(`Successfully imported ${data.imported} and updated ${data.updated} leads.`, 'success');
        setShowSyncReview(false);
        setSyncPreviewResults(null);
      } else {
        throw new Error(data.error || 'Sync commitment failed');
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setIsCommittingSync(false);
    }
  };

  const [isImporting, setIsImporting] = useState(false);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsImporting(true);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            // Flexible header mapping including PM Plot Leads specific questions
            const mappedRows = results.data.flatMap((row: any) => {
              const findKey = (candidates: string[]) => {
                const rowKeys = Object.keys(row);
                const clean = (s: string) => s.replace(/[\u0000-\u001F\u007F-\u009F\uFEFF]/g, '').trim().toLowerCase();
                
                for (const c of candidates) {
                  const target = clean(c);
                  const found = rowKeys.find(rk => clean(rk) === target);
                  if (found) return found;
                }
                for (const c of candidates) {
                  const target = clean(c);
                  const found = rowKeys.find(rk => clean(rk).includes(target));
                  if (found) return found;
                }
                return null;
              };

              // Map headers - matching user requested headers precisely (contact, name, email)
              const nameKey = findKey(['name', 'Name', 'fullName', 'Full Name', 'CLIENT NAME', 'Customer Name', 'customer', 'client']);
              const emailKey = findKey(['email', 'Email Address', 'Email', 'mail', 'email id']);
              const phoneKey = findKey(['contact', 'Phone', 'Ph no', 'mobile', 'WhatsApp', 'phone_no', 'Phone No.', 'CONTACT NUMBER', 'Phone Number', 'Mobile No.', 'Mobile Number', 'Contact Number', 'Contact No.', 'TEL', 'Number']);
              const projectKey = findKey(['Target Project(s)', 'Project', 'Target Project', 'campaign', 'Product', 'LOCATION', 'Interested Project']);
              const pageUrlKey = findKey(['Page URL', 'URL', 'Source URL', 'Source Page', 'link', 'page_url', 'Source_URL']);
              
              const rawName = nameKey ? row[nameKey].toString().trim() : '';
              const name = rawName.split(' ').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
              const phone = normalizePhone(phoneKey ? row[phoneKey] : '');
              const email = emailKey ? row[emailKey].toString().trim().toLowerCase() : '';
              
              const pageUrl = pageUrlKey ? row[pageUrlKey].toString().toLowerCase() : '';
              let rawProjectStr = (projectKey ? row[projectKey] || '' : '').toString().toUpperCase().trim();

              // Infer project from URL if missing
              if (!rawProjectStr && pageUrl) {
                if (pageUrl.includes('upland')) rawProjectStr = 'PM UPLANDS';
                else if (pageUrl.includes('elite')) rawProjectStr = 'PM ELITE';
                else if (pageUrl.includes('rise')) rawProjectStr = 'THE RISE';
                else if (pageUrl.includes('broker') || pageUrl.includes('partner')) rawProjectStr = 'PM GROUP';
              }
              if (!rawProjectStr) rawProjectStr = 'PM UPLANDS';

              const sourceKey = findKey(['Origination Source', 'Source', 'platform', 'Lead Source', 'Origination']);
              const monthKey = findKey(['Month', 'month', 'Month of Entry']);
              const leadIdKey = findKey(['Lead id', 'Lead ID', 'lead_id', 'sr_no']);
              const siteVisitKey = findKey(['When would you like to schedule a site visit?', 'preferredSiteVisit', 'siteVisit', 'visit_date']);
              const walkinSourceKey = findKey(['Source of Walkin (If Walk-in)', 'walkin_source', 'Walk-in Source']);
              const employmentTypeKey = findKey(['Employment Type', 'employment_type']);
              const occupationKey = findKey(['Occupation', 'profession', 'job_title']);

              // Mappings based on user request:
              // Status (Sheet) = Lifecycle Stage (CRM)
              // Activity Journal (Sheet) = Activity Journal (CRM Remarks/History)
              const statusKeyFromSheet = findKey(['Lifecycle Stage', 'Status', 'Remark', 'stage']);
              const activityKeyFromSheet = findKey(['message', 'Activity Journal', 'Status', 'activity', 'notes', 'remarks']);

              const propertyTypeKey = findKey(['Interested Property Type(s)', 'propertyType', 'property_type', 'unit_type']);
              const budgetKey = findKey(['What is your preffered investment budget?', 'investment_budget', 'price_range', 'Budget Range']);
              const plotSizeKey = findKey(['Which plot size are you interested in?', 'plotSize', 'dimension', 'size', 'Plot Area']);
              const dateKey = findKey(['Submission Date', 'Date', 'Entry Date', 'Creation Date', 'createdAt']);

              const rawStatus = statusKeyFromSheet ? row[statusKeyFromSheet].toString().trim() : 'Cold';
              
              // Special detection for CP/Broker leads
              const rowValues = Object.values(row).map(v => (v || '').toString().toLowerCase());
              const isBroker = rowValues.some(v => v.includes('broker') || v.includes('cp registration') || v.includes('channel partner') || v.includes('partner registration')) ||
                               pageUrl.includes('broker') || pageUrl.includes('partner');

              let finalStatusStr = isBroker ? 'CP' : rawStatus;
              if (finalStatusStr.toUpperCase() === 'JUNK') finalStatusStr = 'Closed';

              const validStatuses: LifecycleStage[] = ['Cold', 'Warm', 'Intent', 'Site Visit', 'Converted', 'CP', 'Closed', 'Duplicate'];
              const status = validStatuses.find(s => s.toLowerCase() === finalStatusStr.toLowerCase()) || 'Cold';

              const dateVal = dateKey ? row[dateKey] : null;
              let displayDate = '';
              
              if (dateVal) {
                const strVal = dateVal.toString().trim();
                if (strVal.match(/^\d{4}-\d{2}-\d{2}T/)) {
                  displayDate = strVal.split('T')[0];
                } else if (strVal.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  displayDate = strVal;
                } else if (strVal.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/)) {
                  const parts = strVal.split(/[/\-]/);
                  displayDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                } else {
                  let parsedDate = new Date(strVal);
                  if (!isNaN(parsedDate.getTime())) {
                    if (parsedDate.getFullYear() === 2001) {
                      parsedDate = new Date(2026, 2, parsedDate.getDate());
                    }
                    displayDate = parsedDate.toISOString().split('T')[0];
                  }
                }
              }

              if (!displayDate) {
                displayDate = new Date().toISOString().split('T')[0];
              }

              const createdAt = displayDate.includes('T') ? displayDate : `${displayDate}T00:00:00.000Z`;

              const rawActivity = activityKeyFromSheet ? row[activityKeyFromSheet] : '';
              const rowRemarks = rawActivity ? [{
                id: Math.random().toString(36).substr(2, 9),
                text: rawActivity.toString(),
                createdAt: createdAt,
                createdBy: 'System Import'
              }] : [];

              const projectParts = rawProjectStr.split(/[,/&\n]| AND /).map((s: string) => s.trim()).filter(Boolean);
              const targetProjects: Project[] = [];

              projectParts.forEach((u: string) => {
                if (u === 'PM UPLANDS' || u === 'UPLAND' || u === 'UPLANDS' || u === 'PM UPLANDS VILLA' || u === 'PM UPLANDS VILLAS' || u === 'PM VILLA' || u === 'PM VILLAS' || u.includes('VILLA') || u.includes('UPLAND')) {
                  targetProjects.push('PM UPLANDS');
                }
                else if (u === 'PM ELITE' || u === 'ELITE' || u.includes('ELITE')) targetProjects.push('PM ELITE');
                else if (u === 'THE RISE' || u === 'RISE' || u.includes('RISE')) targetProjects.push('THE RISE');
              });

              if (targetProjects.length === 0) {
                if (rawProjectStr.includes('VILLA') || rawProjectStr.includes('UPLAND')) targetProjects.push('PM UPLANDS');
                else if (rawProjectStr.includes('ELITE')) targetProjects.push('PM ELITE');
                else if (rawProjectStr.includes('RISE')) targetProjects.push('THE RISE');
                else targetProjects.push('PM ELITE');
              }

              const uniqueProjects = Array.from(new Set(targetProjects));

              return uniqueProjects.map(projectName => {
                let rawPropertyType = propertyTypeKey ? row[propertyTypeKey].toString().trim() : '';
                if (rawPropertyType.toLowerCase().includes('residential')) rawPropertyType = 'Residential';
                if (rawPropertyType.toLowerCase().includes('villa')) rawPropertyType = 'Villa';
                if (rawPropertyType.toLowerCase().includes('plot')) rawPropertyType = 'Plot';
                
                const finalPropertyType = rawPropertyType || (projectName.includes('VILLA') ? 'Villa' : 'Plot');

                const leadIdVal = leadIdKey ? row[leadIdKey] : '';
                const finalLeadId = leadIdVal || `LID-${Math.floor(100000 + Math.random() * 900000)}`;
                
                const monthVal = monthKey ? row[monthKey] : '';
                const finalMonth = monthVal || (isValid(parseISO(displayDate)) ? format(parseISO(displayDate), 'MMMM') : '');

                return {
                  leadId: finalLeadId,
                  month: finalMonth,
                  date: displayDate,
                  name: name,
                  email: email,
                  phone: phone,
                  project: projectName,
                  lifecycleStage: status,
                  source: (sourceKey ? row[sourceKey] : '') || 'Manual Import',
                  propertyType: finalPropertyType as any,
                  budget: budgetKey ? row[budgetKey] : '',
                  preferredSiteVisit: siteVisitKey ? row[siteVisitKey] : '',
                  plotSize: plotSizeKey ? row[plotSizeKey] : '',
                  walkinSource: walkinSourceKey ? row[walkinSourceKey] : '',
                  employmentType: employmentTypeKey ? row[employmentTypeKey] : '',
                  occupation: occupationKey ? row[occupationKey] : '',
                  remarks: rowRemarks,
                  createdAt: createdAt
                };
              });
            });

            const validRows = mappedRows.filter((row: any) => row.name && row.name.toString().trim() !== '');
            
            if (validRows.length === 0) {
              showToast('Zero valid matches identified. Ensure your CSV contains a "name" or "full name" column.', 'error');
              setIsImporting(false);
              return;
            }

            const existingLeadsMap = new Map(); // phone_project -> id
            const existingEmailsMap = new Map(); // email_project -> id

            leads.forEach(l => {
              const normPhone = normalizePhone(l.phone);
              const normEmail = (l.email || '').toLowerCase().trim();
              const proj = (l.project || '').toUpperCase().trim();
              if (normPhone && proj) existingLeadsMap.set(`${normPhone}_${proj}`, l.id);
              if (normEmail && proj) existingEmailsMap.set(`${normEmail}_${proj}`, l.id);
            });

            let duplicateCount = 0;
            const skippedLeads: any[] = [];
            const importedLeads = validRows
              .filter((row: any) => {
                const normPhone = normalizePhone(row.phone);
                const normEmail = (row.email || '').toLowerCase().trim();
                const proj = (row.project || 'PM UPLANDS').toUpperCase().trim();
                
                const phoneKey = `${normPhone}_${proj}`;
                const emailKey = `${normEmail}_${proj}`;

                if ((normPhone && existingLeadsMap.has(phoneKey)) || (normEmail && existingEmailsMap.has(emailKey))) {
                  duplicateCount++;
                  skippedLeads.push({
                    name: row.name || 'Unnamed',
                    reason: 'Already in CRM',
                    info: `${row.name || 'Unnamed'} - ${row.phone || 'No Contact'} (Duplicate during Manual Import)`,
                    source: row.source || 'Manual Import',
                    timestamp: new Date().toISOString()
                  });
                  return false;
                }
                return true;
              })
              .map((row: any) => ({
                ...row,
                project: (row.project as Project) || 'PM UPLANDS',
                lifecycleStage: (row.lifecycleStage as LifecycleStage) || 'Cold',
                source: row.source || 'Import'
              }));

            if (importedLeads.length === 0 && duplicateCount > 0) {
              // Even if all are duplicates, we should still track them as skipped
              await importLeads([], skippedLeads);
              showToast(`Import completed: All ${duplicateCount} contacts already exist in the portfolio. Audit trail updated.`, 'info');
              setIsImporting(false);
              return;
            }

            await importLeads(importedLeads as Partial<Lead>[], skippedLeads);
            let successMessage = `Succesfully integrated ${importedLeads.length} leads into the portfolio.`;
            if (duplicateCount > 0) {
              successMessage += ` Blocked: ${duplicateCount} duplicates.`;
            }
            showToast(successMessage, 'success');
          } catch (err: any) {
            console.error('Import failure:', err);
            showToast(`Critical failure during data migration: ${err.message || 'Unknown Error'}`, 'error');
          } finally {
            setIsImporting(false);
            e.target.value = '';
          }
        },
        error: (err) => {
          console.error('Parse error:', err);
          showToast('Failed to parse CSV file. Please check the file format.', 'error');
          setIsImporting(false);
        }
      });
    }
  };

  // Load persisted sync details on mount
  React.useEffect(() => {
    const saved = sessionStorage.getItem('pm_last_sync_details');
    if (saved) {
      try {
        setSyncDetails(JSON.parse(saved));
      } catch (e) {
        sessionStorage.removeItem('pm_last_sync_details');
      }
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* ... previous modals ... */}

      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-[var(--color-text-dim)] text-[10px] uppercase tracking-widest font-black">
                Client Assets
              </h3>
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 rounded-full border border-green-500/20">
                <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[8px] font-black uppercase text-green-500 tracking-tighter">Live System</span>
              </span>
            </div>

            <div className="h-3 w-[1px] bg-[var(--color-border-main)]/50 mx-1" />

            <div className="flex items-center gap-2">
              <span className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all shadow-sm",
                filteredLeads.length !== leads.length 
                  ? "bg-accent/10 border-accent/30 text-accent ring-4 ring-accent/5" 
                  : "bg-[var(--color-bg-main)] border-[var(--color-border-main)] text-[var(--color-text-dim)]"
              )}>
                <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                  Showing {filteredLeads.length} {filteredLeads.length === 1 ? 'Lead' : 'Leads'} 
                  {filteredLeads.length !== leads.length && <span className="opacity-60 ml-1">of {leads.length} Total</span>}
                </span>
                {filteredLeads.length !== leads.length && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-3 w-3 p-0 hover:bg-transparent"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('All');
                      setProjectFilter('All');
                      setSourceFilter('All');
                      setPropertyTypeFilter('All');
                      setAssignedToFilter('All');
                    }}
                  >
                    <Search className="w-2 h-2" />
                  </Button>
                )}
              </span>
            </div>
          </div>
          <h1 className="serif text-4xl md:text-5xl lg:text-6xl italic text-[var(--color-text-main)] mt-2">
            Lead Portfolio
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {hasPermission('purge_leads') && (
            <Button variant="outline" size="sm" className="gap-2 text-[10px] text-rose-500 border-rose-900/30 hover:bg-rose-900/10 h-10 px-4" onClick={handleClearAll} disabled={isClearing}>
              <TrendingUp className="w-3 h-3 rotate-180" /> {isClearing ? 'Purging...' : 'Clear All Data'}
            </Button>
          )}
          
          <Button variant="outline" size="sm" className="gap-2 text-[10px] h-10 px-4" onClick={handleDownloadTemplate}>
            <Download className="w-3 h-3" /> dummy sheet
          </Button>
          
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept=".csv" 
            onChange={handleImport} 
            disabled={isImporting} 
          />
          
          {hasPermission('import_leads') && (
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 text-[10px] h-10 px-4" 
              disabled={isImporting}
              onClick={() => fileInputRef.current?.click()}
            >
              {isImporting ? (
                <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              {isImporting ? 'Processing...' : 'Import Data'}
            </Button>
          )}

          {hasPermission('export_leads') && (
            <Button variant="outline" size="sm" className="gap-2 text-[10px] h-10 px-4" onClick={handleExport}>
              <Download className="w-3 h-3" /> Export CSV
            </Button>
          )}

          {hasPermission('sync_sheets') && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-[10px] bg-blue-900/10 text-blue-400 border-blue-900/30 h-10 px-4 hover:bg-blue-900/20" 
                onClick={handleCloudSync} 
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                {isSyncing ? 'Syncing All Sheets...' : 'Sync All Google Sheets'}
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-[10px] bg-red-900/10 text-red-400 border-red-900/30 h-10 px-4" 
                onClick={() => setActiveTab('skipped')}
              >
                <XOctagon className="w-3 h-3" />
                Skipped Leads
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-[10px] bg-amber-900/10 text-amber-400 border-amber-900/30 h-10 px-4" 
                onClick={() => {
                  if (!syncDetails && skippedLeads.length > 0) {
                    // If no current session sync, but we have global skipped leads, use the most recent ones
                    const mostRecent = [...skippedLeads]
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .slice(0, 50);
                    setSyncDetails(mostRecent);
                    setShowSyncDetails(true);
                  } else if (!syncDetails) {
                    showToast('No sync data available. Perform a sync first.', 'info');
                  } else {
                    setShowSyncDetails(true);
                  }
                }}
              >
                <TrendingUp className="w-3 h-3" />
                Sync Report
              </Button>
            </div>
          )}

          {hasPermission('add_lead') && (
            <Button size="sm" className="gap-2 text-[10px] bg-accent text-white hover:bg-amber-600 h-10 px-6" onClick={() => { setEditingLead(null); setIsModalOpen(true); }}>
              <Plus className="w-3 h-3" /> provision lead
            </Button>
          )}
        </div>
      </header>

      <Card className="p-0 border-none bg-transparent shadow-none">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-main)] rounded-2xl p-4 md:p-8 space-y-6 md:space-y-8 mb-8 shadow-sm">
          {/* Top Search Bar */}
          <div className="relative w-full">
            <Search className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-dim)]" />
            <input 
              placeholder="Search by name, email, phone or campaign..." 
              className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-2xl px-12 md:px-16 py-3 md:py-4 text-sm text-[var(--color-text-main)] outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all placeholder:text-[var(--color-text-dim)]/50"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Grid Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)] ml-1">Lifecycle Stage</p>
              <select 
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full h-12 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-xl text-[11px] font-bold uppercase tracking-widest outline-none px-4 focus:border-accent text-[var(--color-text-dim)] appearance-none cursor-pointer"
              >
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)] ml-1">Project Portfolio</p>
              <select 
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
                className="w-full h-12 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-xl text-[11px] font-bold uppercase tracking-widest outline-none px-4 focus:border-accent text-[var(--color-text-dim)] appearance-none cursor-pointer"
              >
                {projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)] ml-1">Origination Source</p>
              <select 
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                className="w-full h-12 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-xl text-[11px] font-bold uppercase tracking-widest outline-none px-4 focus:border-accent text-[var(--color-text-dim)] appearance-none cursor-pointer"
              >
                {dynamicSources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)] ml-1">Property Type</p>
              <select 
                value={propertyTypeFilter}
                onChange={e => setPropertyTypeFilter(e.target.value)}
                className="w-full h-12 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-xl text-[11px] font-bold uppercase tracking-widest outline-none px-4 focus:border-accent text-[var(--color-text-dim)] appearance-none cursor-pointer"
              >
                {dynamicPropertyTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)] ml-1">Walk-in Source</p>
              <select 
                value={walkinSourceFilter}
                onChange={e => setWalkinSourceFilter(e.target.value)}
                className="w-full h-12 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-xl text-[11px] font-bold uppercase tracking-widest outline-none px-4 focus:border-accent text-[var(--color-text-dim)] appearance-none cursor-pointer"
              >
                {dynamicWalkinSources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)] ml-1">Employment Type</p>
              <select 
                value={employmentTypeFilter}
                onChange={e => setEmploymentTypeFilter(e.target.value)}
                className="w-full h-12 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-xl text-[11px] font-bold uppercase tracking-widest outline-none px-4 focus:border-accent text-[var(--color-text-dim)] appearance-none cursor-pointer"
              >
                {employmentTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)] ml-1">Start Date</p>
              <Input 
                type="date"
                value={startDateFilter}
                onChange={e => setStartDateFilter(e.target.value)}
                className="h-12 bg-[var(--color-bg-main)] border-[var(--color-border-main)] rounded-xl text-[11px] font-bold uppercase tracking-widest outline-none px-4 focus:border-accent"
              />
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)] ml-1">End Date</p>
              <Input 
                type="date"
                value={endDateFilter}
                onChange={e => setEndDateFilter(e.target.value)}
                className="h-12 bg-[var(--color-bg-main)] border-[var(--color-border-main)] rounded-xl text-[11px] font-bold uppercase tracking-widest outline-none px-4 focus:border-accent"
              />
            </div>

            {hasPermission('assign_lead') && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)] ml-1">Assigned Member</p>
                <select 
                  value={assignedToFilter}
                  onChange={e => setAssignedToFilter(e.target.value)}
                  className="w-full h-12 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-xl text-[11px] font-bold uppercase tracking-widest outline-none px-4 focus:border-accent text-[var(--color-text-dim)] appearance-none cursor-pointer"
                >
                  <option value="All">All Members</option>
                  <option value="Unassigned">Unassigned Leads</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
            )}

            <div className="flex items-end">
              <Button 
                variant="outline" 
                className="w-full h-12 border-dashed border-[var(--color-border-main)] text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-dim)] hover:bg-accent/5 hover:border-accent/30 hover:text-accent gap-2"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('All');
                  setProjectFilter('All');
                  setSourceFilter('All');
                  setPropertyTypeFilter('All');
                  setAssignedToFilter('All');
                  setWalkinSourceFilter('All');
                  setEmploymentTypeFilter('All');
                  setStartDateFilter('');
                  setEndDateFilter('');
                }}
              >
                <RefreshCw className="w-3 h-3" /> Clear All Filters
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-main)] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-accent relative">
            <div className="lg:hidden absolute top-0 right-0 p-2 pointer-events-none opacity-40">
              <ChevronRight className="w-4 h-4 animate-bounce-x" />
            </div>
            <table className="w-full text-left min-w-[1000px]">
              <thead>
                <tr className="text-[10px] uppercase text-[var(--color-text-dim)] bg-[var(--color-bg-main)] border-b border-[var(--color-border-main)] shadow-sm">
                  {hasPermission('bulk_assign_lead') && (
                    <th className="px-8 py-5 w-10">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 accent-accent rounded bg-black"
                        checked={selectedLeadIds.length > 0 && selectedLeadIds.length === filteredLeads.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th className="px-8 py-5 font-bold tracking-widest">SR NO.</th>
                  <th className="px-8 py-5 font-bold tracking-widest">Property Type</th>
                  <th className="px-8 py-5 font-bold tracking-widest text-center">Lead Date</th>
                  <th className="px-8 py-5 font-bold tracking-widest border-l border-[var(--color-border-main)]/30">Customer Identity</th>
                  <th className="px-8 py-5 font-bold tracking-widest">Project Focus</th>
                  <th className="px-8 py-5 font-bold tracking-widest">Lifecycle Stage</th>
                  <th className="px-8 py-5 font-bold tracking-widest">Active Reminders</th>
                  <th className="px-8 py-5 font-bold tracking-widest text-right">Recent Activity</th>
                  <th className="px-8 py-5 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className={cn(
                    "border-b border-[var(--color-border-main)]/50 hover:bg-[var(--color-text-main)]/[0.02] transition-colors group",
                    selectedLeadIds.includes(lead.id) && "bg-accent/[0.03]"
                  )}>
                    {hasPermission('bulk_assign_lead') && (
                      <td className="px-8 py-5">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 accent-accent rounded bg-black"
                          checked={selectedLeadIds.includes(lead.id)}
                          onChange={() => toggleSelectLead(lead.id)}
                        />
                      </td>
                    )}
                    <td className="px-8 py-5">
                      <span className="text-[10px] font-mono font-bold text-accent">{lead.leadId || 'N/A'}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md",
                        lead.propertyType?.toLowerCase() === 'plot' 
                          ? "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400 border border-cyan-500/20 dark:border-cyan-900/30" 
                          : "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-900/30"
                      )}>
                        {lead.propertyType || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <p className="text-[10px] font-mono text-[var(--color-text-main)] font-bold">{lead.date || (lead.createdAt ? lead.createdAt.split('T')[0] : 'N/A')}</p>
                      <p className="text-[8px] text-[var(--color-text-dim)] font-mono uppercase tracking-tighter mt-1">YYYY-MM-DD</p>
                    </td>
                    <td className="px-8 py-5 border-l border-[var(--color-border-main)]/30">
                      <p className="text-sm font-bold text-[var(--color-text-main)] leading-none mb-1">{lead.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-[var(--color-text-dim)] font-medium uppercase tracking-tighter">{lead.phone}</p>
                        {lead.assignedTo ? (
                          <span className="text-[10px] text-accent font-black uppercase tracking-widest leading-none">
                            • {users.find(u => u.id === lead.assignedTo)?.name || lead.assignedTo}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--color-text-dim)] font-bold uppercase tracking-widest leading-none opacity-50">
                            • Unassigned
                          </span>
                        )}
                      </div>
                      {(lead.occupation || lead.employmentType) && (
                        <div className="mt-1 flex items-center gap-1.5 opacity-80">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                            {lead.employmentType}{lead.occupation ? ` · ${lead.occupation}` : ''}
                          </span>
                        </div>
                      )}
                      {lead.createdBy && lead.createdBy !== 'system_import' && (
                        <div className="mt-2 flex items-center gap-1.5 opacity-60">
                          <span className="text-[7px] font-black uppercase tracking-[0.2em] text-[var(--color-text-dim)]">First Owner:</span>
                          <span className="text-[8px] font-bold text-[var(--color-text-main)] uppercase">{users.find(u => u.id === lead.createdBy)?.name || 'Unknown'}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-5 font-serif italic text-[var(--color-text-dim)] text-sm whitespace-nowrap">
                      <div>{lead.project}</div>
                      {lead.walkinSource && (
                         <div className="text-[9px] font-sans not-italic font-black text-accent uppercase tracking-widest mt-1">
                           Walk-in: {lead.walkinSource}
                         </div>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <StatusBadge status={lead.lifecycleStage} />
                    </td>
                    <td className="px-8 py-5">
                      {lead.reminders?.filter(r => !r.triggered).length > 0 ? (
                        <div className="flex items-center gap-1.5 text-accent animate-pulse">
                          <Activity className="w-3 h-3" />
                          <span className="text-[10px] font-black">{lead.reminders.filter(r => !r.triggered).length} Pending</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-700 opacity-30 italic">No triggers</span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-nowrap">
                      <p className="text-[10px] text-[var(--color-text-dim)] font-mono italic truncate max-w-[150px]">
                        {lead.remarks.length > 0 ? `"${lead.remarks[lead.remarks.length-1].text}"` : "No activity recorded"}
                      </p>
                    </td>
                    <td className="px-8 py-5 text-right flex items-center justify-end gap-2 text-nowrap">
                       {/* Booking Quick Action */}
                       <div className="flex flex-col gap-1 items-end mr-2">
                         <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleUpdatePaymentStatus(lead, 'Pending')}
                              className={cn(
                                "px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded border transition-all",
                                lead.bookingDetails?.payment?.paymentStatus === 'Pending' 
                                  ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20" 
                                  : "bg-orange-500/5 text-orange-600 border-orange-500/20 hover:bg-orange-500/10"
                              )}
                              title="Mark as Pending (Reserved)"
                            >
                              Pending
                            </button>
                            <button 
                              onClick={() => handleUpdatePaymentStatus(lead, 'Paid')}
                              className={cn(
                                "px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded border transition-all",
                                lead.bookingDetails?.payment?.paymentStatus === 'Paid' 
                                  ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20" 
                                  : "bg-emerald-500/5 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10"
                              )}
                              title="Mark as Paid (Sold)"
                            >
                              Paid
                            </button>
                         </div>
                         {lead.bookingDetails?.property?.unitNumber && (
                           <span className="text-[7px] font-mono font-bold text-[var(--color-text-dim)] uppercase bg-slate-100 dark:bg-slate-800 px-1 rounded">
                             Unit: {lead.bookingDetails.property.unitNumber}
                           </span>
                         )}
                       </div>

                       <button 
                         onClick={() => { 
                           setEditingLead(lead); 
                           setIsBookingFormOpen(true);
                         }}
                         className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-500/10 rounded-lg transition-colors border border-emerald-500/20"
                         title="New Booking / Form"
                       >
                         <FileCheck className="w-4 h-4" />
                       </button>

                       {/* Call Button */}
                       <a 
                        href={`tel:${lead.phone}`}
                        className="p-2 text-green-500 hover:text-green-700 hover:bg-green-500/10 rounded-lg transition-colors"
                        title="Call Lead"
                        onClick={(e) => {
                          // Log a remark that a call was initiated
                          const newRemark = {
                            id: Math.random().toString(36).substr(2, 9),
                            text: "Outbound call initiated via system.",
                            createdAt: new Date().toISOString(),
                            createdBy: user?.name || 'System'
                          };
                          updateLead(lead.id, { remarks: [...(lead.remarks || []), newRemark] });
                        }}
                       >
                         <PhoneCall className="w-4 h-4" />
                       </a>

                       {/* Task Button */}
                       <button 
                        onClick={() => { setTaskLead(lead); setIsTaskModalOpen(true); }}
                        className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-500/10 rounded-lg transition-colors"
                        title="Create Task"
                       >
                         <CheckSquare className="w-4 h-4" />
                       </button>

                       <Button 
                         size="sm" 
                         variant="ghost" 
                         className="text-accent hover:text-white hover:bg-accent border border-accent/20 h-7 text-[9px] px-3 font-bold uppercase tracking-wider flex items-center gap-1"
                         onClick={() => { setRemarkLead(lead); setIsRemarkModalOpen(true); }}
                       >
                         <History className="w-3 h-3" />
                         Journal
                       </Button>

                       {hasPermission('delete_lead') && (
                         <button 
                          onClick={() => setLeadToDelete(lead.id)}
                          className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Delete Lead"
                        >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       )}
                       {hasPermission('edit_lead') && (
                         <button 
                          onClick={() => { setEditingLead(lead); setIsModalOpen(true); }}
                          className="p-2 text-[var(--color-text-dim)] hover:text-accent transition-colors"
                          title="Edit Lead"
                        >
                           <ChevronRight className="w-4 h-4" />
                         </button>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredLeads.length === 0 && (
            <div className="py-20 text-center">
              <p className="serif text-xl text-slate-600 italic">Zero matches identified in asset portfolio</p>
            </div>
          )}
          <div className="p-4 bg-[var(--color-text-main)]/[0.03] border-t border-[var(--color-border-main)] flex justify-between items-center text-[10px] text-[var(--color-text-dim)] font-bold uppercase tracking-widest">
            <span>Aggregated results: {filteredLeads.length} items</span>
          </div>
        </div>
      </Card>

      {isModalOpen && (
        <LeadModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          lead={editingLead}
          onSave={async (data: any) => {
            const { projects, ...leadData } = data;
            const targetProjects = projects && projects.length > 0 ? projects : [leadData.project];

            if (editingLead) {
              // Update the current lead with the first selected project
              await updateLead(editingLead.id, { ...leadData, project: targetProjects[0] });
              
              // Create new entries for any additional projects
              if (targetProjects.length > 1) {
                for (let i = 1; i < targetProjects.length; i++) {
                  await addLead({ ...leadData, project: targetProjects[i], remarks: editingLead.remarks || [] });
                }
              }
            } else {
              // Create separate lead for each project
              for (const proj of targetProjects) {
                await addLead({ ...leadData, project: proj, remarks: [] });
              }
            }
            setIsModalOpen(false);
          }}
          onOpenBooking={() => setIsBookingFormOpen(true)}
        />
      )}

      {isBookingFormOpen && editingLead && (
        <BookingForm 
          lead={editingLead} 
          onClose={() => setIsBookingFormOpen(false)} 
        />
      )}

      {isRemarkModalOpen && (
        <RemarkModal 
          isOpen={isRemarkModalOpen}
          onClose={() => setIsRemarkModalOpen(false)}
          lead={remarkLead}
          onUpdate={async (text: string, reminder?: { dateTime: string, comment: string }, status?: LifecycleStage) => {
            if (remarkLead) {
              const updates: any = {};
              
              if (status) {
                updates.lifecycleStage = status;
              }

              if (text.trim()) {
                const newRemark = {
                  id: Math.random().toString(36).substr(2, 9),
                  text,
                  createdAt: new Date().toISOString(),
                  createdBy: user?.name || 'Unknown'
                };
                updates.remarks = [...(remarkLead.remarks || []), newRemark];
              }

              if (reminder) {
                const newReminder = {
                  id: Math.random().toString(36).substr(2, 9),
                  dateTime: reminder.dateTime,
                  comment: reminder.comment,
                  triggered: false
                };
                updates.reminders = [...(remarkLead.reminders || []), newReminder];
              }

              await updateLead(remarkLead.id, updates);
            }
            setIsRemarkModalOpen(false);
          }}
        />
      )}
      {isTaskModalOpen && (
        <TaskModal 
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          lead={taskLead}
          onSave={async (taskData) => {
            await addTask(taskData);
            setIsTaskModalOpen(false);
            showToast('Task created and linked successfully', 'success');
          }}
        />
      )}

      {showSyncDetails && syncDetails && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
          <div className="bg-[var(--color-bg-sidebar)] max-w-4xl w-full border border-[var(--color-border-main)] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-[var(--color-border-main)] flex items-center justify-between bg-gradient-to-r from-amber-500/5 to-transparent">
              <div>
                <h2 className="serif text-3xl italic font-light text-[var(--color-text-main)]">Sync Integrity Report</h2>
                <p className="text-[10px] text-amber-500 uppercase tracking-widest font-black mt-1">Audit Log: {syncDetails.length} Entries Filtered</p>
              </div>
              <Button variant="ghost" onClick={() => setShowSyncDetails(false)} className="hover:bg-amber-500/10 text-amber-500">
                <ChevronRight className="w-5 h-5 rotate-90" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="grid gap-4">
                {syncDetails.map((detail, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-[var(--color-bg-card)] border border-[var(--color-border-main)] rounded-2xl hover:border-amber-500/30 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-xs font-black",
                        detail.reason === 'Already in CRM' ? "bg-blue-500/10 text-blue-500" : "bg-rose-500/10 text-rose-500"
                      )}>
                        {detail.reason === 'Already in CRM' ? <ShieldCheck className="w-5 h-5" /> : <XOctagon className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[var(--color-text-main)] group-hover:text-amber-400 transition-colors">{detail.name || 'Anonymous Lead'}</h4>
                        <p className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-tighter font-mono">{detail.info}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded text-[9px] font-black uppercase tracking-widest text-[var(--color-text-dim)] whitespace-nowrap">
                        {detail.source}
                      </span>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                        detail.reason === 'Already in CRM' ? "bg-blue-500/20 text-blue-400" : "bg-rose-500/20 text-rose-400"
                      )}>
                        {detail.reason}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-8 border-t border-[var(--color-border-main)] bg-amber-500/5">
              <p className="text-[11px] text-slate-400 italic">
                * Note: Duplicates are automatically merged or skipped to preserve data integrity and prevent double-calling. 
                If you believe a lead was incorrectly flagged, check if the phone number or email was reused.
              </p>
              <Button 
                className="mt-6 w-full h-12 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-widest text-[10px]"
                onClick={() => setShowSyncDetails(false)}
              >
                ACKNOWLEDGEMENT COMPLETE
              </Button>
            </div>
          </div>
        </div>
      )}

      {showConfirmPurge && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[var(--color-bg-card)] max-w-md w-full border border-rose-500/30 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-rose-500/10 bg-rose-500/5">
              <div className="flex items-center gap-3 text-rose-500 mb-2">
                <Trash2 className="w-6 h-6" />
                <h2 className="serif text-2xl italic font-light">Critical Action</h2>
              </div>
              <p className="text-[10px] text-rose-400 uppercase tracking-widest font-black">Portfolio Eradication Protocol</p>
            </div>
            
            <div className="p-8 space-y-6">
              <p className="text-sm text-[var(--color-text-dim)] leading-relaxed italic">
                You are about to permanently erase all leads from the CRM database. This action is irreversible and will remove all remarks, history, and client records.
              </p>
              
              <div className="flex flex-col gap-3 mt-6">
                <Button 
                   className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-900/20 border-none"
                  onClick={executeTerminalPurge}
                >
                  CONFIRM PERMANENT PURGE
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full text-[var(--color-text-dim)] hover:text-accent"
                  onClick={() => setShowConfirmPurge(false)}
                >
                  ABORT SEQUENCE
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {leadToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[var(--color-bg-card)] max-w-md w-full border border-[var(--color-border-main)] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-[var(--color-border-main)]">
              <h2 className="serif text-2xl italic font-light text-[var(--color-text-main)]">Delete Asset?</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mt-1">Resource: {leads.find(l => l.id === leadToDelete)?.name}</p>
            </div>
            
            <div className="p-8 space-y-6">
              <p className="text-sm text-slate-400 leading-relaxed">
                Remove this lead from the portfolio? This action cannot be undone.
              </p>
              
              <div className="flex gap-4 mt-6">
                <Button 
                  variant="ghost" 
                  className="flex-1 text-slate-500"
                  onClick={() => setLeadToDelete(null)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
                  onClick={handleDeleteLead}
                >
                  Delete Permanently
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedLeadIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-8 duration-300">
          <div className="bg-[var(--color-bg-card)] border border-accent/40 rounded-full px-8 py-4 shadow-2xl flex items-center gap-8 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-[10px] font-black">
                {selectedLeadIds.length}
              </div>
              <span className="text-[10px] uppercase font-black tracking-widest text-[var(--color-text-main)]">Leads Identified</span>
            </div>
            <div className="h-4 w-[1px] bg-[var(--color-border-main)]" />
            <div className="flex gap-4">
              <Button 
                size="sm" 
                className="bg-accent text-white hover:bg-amber-600 text-[10px] h-9 px-6 rounded-full uppercase font-bold"
                onClick={() => setIsBulkAssignModalOpen(true)}
              >
                Bulk Assign Member
              </Button>
              <Button 
                size="sm" 
                className="bg-accent text-white hover:bg-amber-600 text-[10px] h-9 px-6 rounded-full uppercase font-bold"
                onClick={() => setIsBulkStatusModalOpen(true)}
              >
                Update Lifecycle
              </Button>
              {hasPermission('purge_leads') && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500 hover:text-white text-[10px] h-9 px-6 rounded-full uppercase font-bold transition-all shadow-lg shadow-rose-900/10"
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Discard Cluster
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[var(--color-text-dim)] hover:text-accent text-[10px] h-9 px-6 uppercase font-bold"
                onClick={() => setSelectedLeadIds([])}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      )}

      {isBulkStatusModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-[var(--color-bg-card)] max-w-md w-full border border-[var(--color-border-main)] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-[var(--color-border-main)] text-center">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Tag className="w-8 h-8 text-accent" />
              </div>
              <h2 className="serif text-2xl italic font-light text-[var(--color-text-main)]">Change Lifecycle Stage</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mt-1">Batch Update: {selectedLeadIds.length} Leads</p>
            </div>
            <div className="p-10 space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)]">Select Stage</label>
                <select 
                  value={bulkStatusTo} 
                  onChange={e => setBulkStatusTo(e.target.value as LifecycleStage)}
                  className="w-full h-14 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-2xl px-6 text-sm text-[var(--color-text-main)] outline-none focus:border-accent appearance-none cursor-pointer"
                >
                  {['Cold', 'Warm', 'Intent', 'Site Visit', 'Converted', 'CP', 'Closed', 'Duplicate'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-4">
                <Button variant="ghost" className="flex-1 rounded-2xl h-14 text-sm" onClick={() => setIsBulkStatusModalOpen(false)}>
                  Go Back
                </Button>
                <Button className="flex-1 bg-accent text-white hover:bg-amber-600 rounded-2xl h-14 text-sm font-black uppercase tracking-widest" onClick={handleBulkStatusUpdate}>
                  Apply Change
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Review Modal */}
      {showSyncReview && syncPreviewResults && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <Card className="w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-[var(--color-bg-main)] border-[var(--color-border-main)] shadow-2xl">
            <div className="p-6 border-b border-[var(--color-border-main)] flex items-center justify-between bg-gradient-to-r from-blue-900/10 to-transparent">
              <div>
                <h2 className="serif text-3xl italic text-blue-400">Sync Review</h2>
                <p className="text-xs text-[var(--color-text-dim)] mt-1 uppercase tracking-widest font-black">
                  Reviewing {syncPreviewResults.leads.length + syncPreviewResults.updates.length} pending changes
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowSyncReview(false)}
                className="hover:bg-red-500/10 hover:text-red-500"
              >
                <XOctagon className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* New Leads Section */}
              {syncPreviewResults.leads.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <Plus className="w-5 h-5 text-green-500" />
                      </div>
                      <h3 className="font-bold text-lg text-green-400">New Leads ({syncPreviewResults.leads.length})</h3>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        if (selectedPreviewLeads.size === syncPreviewResults.leads.length) {
                          setSelectedPreviewLeads(new Set());
                        } else {
                          setSelectedPreviewLeads(new Set(syncPreviewResults.leads.map((_, i) => i)));
                        }
                      }}
                      className="text-[10px] uppercase font-black tracking-widest text-blue-400"
                    >
                      {selectedPreviewLeads.size === syncPreviewResults.leads.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {syncPreviewResults.leads.map((lead, idx) => (
                      <div 
                        key={`new-${idx}`}
                        onClick={() => {
                          const next = new Set(selectedPreviewLeads);
                          if (next.has(idx)) next.delete(idx);
                          else next.add(idx);
                          setSelectedPreviewLeads(next);
                        }}
                        className={cn(
                          "p-4 rounded-xl border transition-all cursor-pointer group",
                          selectedPreviewLeads.has(idx) 
                            ? "bg-green-500/5 border-green-500/30 ring-1 ring-green-500/20" 
                            : "bg-[var(--color-bg-dim)] border-[var(--color-border-main)] opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-[var(--color-text-main)] group-hover:text-green-400 transition-colors">{lead.name}</p>
                              <span className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded">New</span>
                            </div>
                            <p className="text-xs text-[var(--color-text-dim)] flex items-center gap-1.5">
                              <Phone className="w-3 h-3 opacity-50" /> {lead.phone}
                            </p>
                            <p className="text-[10px] text-blue-400/70">{lead.project} • {lead.lifecycleStage}</p>
                          </div>
                          <div className={cn(
                            "w-5 h-5 rounded border flex items-center justify-center transition-all",
                            selectedPreviewLeads.has(idx) ? "bg-green-500 border-green-500 text-black" : "border-[var(--color-border-main)] bg-[var(--color-bg-main)]"
                          )}>
                            {selectedPreviewLeads.has(idx) && <CheckSquare className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Updates Section */}
              {syncPreviewResults.updates.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <RefreshCw className="w-5 h-5 text-blue-400" />
                      </div>
                      <h3 className="font-bold text-lg text-blue-400">Field Updates ({syncPreviewResults.updates.length})</h3>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        if (selectedPreviewUpdates.size === syncPreviewResults.updates.length) {
                          setSelectedPreviewUpdates(new Set());
                        } else {
                          setSelectedPreviewUpdates(new Set(syncPreviewResults.updates.map((_, i) => i)));
                        }
                      }}
                      className="text-[10px] uppercase font-black tracking-widest text-blue-400"
                    >
                      {selectedPreviewUpdates.size === syncPreviewResults.updates.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {syncPreviewResults.updates.map((update, idx) => (
                      <div 
                        key={`update-${idx}`}
                        onClick={() => {
                          const next = new Set(selectedPreviewUpdates);
                          if (next.has(idx)) next.delete(idx);
                          else next.add(idx);
                          setSelectedPreviewUpdates(next);
                        }}
                        className={cn(
                          "p-4 rounded-xl border transition-all cursor-pointer group",
                          selectedPreviewUpdates.has(idx) 
                            ? "bg-blue-500/5 border-blue-500/30 ring-1 ring-blue-500/20" 
                            : "bg-[var(--color-bg-dim)] border-[var(--color-border-main)] opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-[var(--color-text-main)] group-hover:text-blue-400 transition-colors uppercase tracking-tight">{update.existingData.name}</p>
                              <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-blue-500 text-black rounded leading-none">Update</span>
                            </div>
                            
                            <div className="space-y-1.5">
                              {update.changes.lifecycleStage && (
                                <div className="flex items-center gap-2 bg-[var(--color-text-main)]/5 p-1.5 rounded-lg border border-[var(--color-border-main)]">
                                  <span className="text-[8px] font-black uppercase tracking-tighter text-[var(--color-text-dim)]">Status:</span>
                                  <div className="flex items-center gap-1.5 text-[10px]">
                                    <span className="line-through opacity-50">{update.changes.lifecycleStage.from}</span>
                                    <ChevronRight className="w-2 h-2 text-blue-400" />
                                    <span className="font-black text-blue-400">{update.changes.lifecycleStage.to}</span>
                                  </div>
                                </div>
                              )}
                              {update.changes.other && (
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(update.updates || {}).map(([key, val]) => (
                                    key !== 'lifecycleStage' && (
                                      <div key={key} className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[8px] flex items-center gap-1">
                                        <span className="text-blue-400 font-black uppercase text-[7px]">{key}:</span>
                                        <span className="text-[var(--color-text-main)] truncate max-w-[80px]">{String(val)}</span>
                                      </div>
                                    )
                                  ))}
                                </div>
                              )}
                              {update.remark && (
                                <div className="bg-[var(--color-text-main)]/5 p-1.5 rounded-lg border border-[var(--color-border-main)]">
                                  <span className="text-[8px] font-black uppercase tracking-tighter text-[var(--color-text-dim)] block mb-1">New Remark:</span>
                                  <p className="text-[10px] line-clamp-1 italic text-[var(--color-text-dim)] font-medium">"{update.remark}"</p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className={cn(
                            "w-5 h-5 rounded border flex items-center justify-center transition-all",
                            selectedPreviewUpdates.has(idx) ? "bg-blue-500 border-blue-500 text-black" : "border-[var(--color-border-main)] bg-[var(--color-bg-main)]"
                          )}>
                            {selectedPreviewUpdates.has(idx) && <CheckSquare className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="p-6 border-t border-[var(--color-border-main)] flex items-center justify-between bg-[var(--color-bg-dim)]">
              <div className="text-xs text-[var(--color-text-dim)] uppercase tracking-widest font-black">
                {selectedPreviewLeads.size + selectedPreviewUpdates.size} Items Selected 
                <span className="mx-2 opacity-50">|</span> 
                {syncPreviewResults.syncedSheets?.length} Sheets Synced
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" className="text-xs uppercase tracking-widest font-black h-12 px-6" onClick={() => setShowSyncReview(false)}>
                  Cancel
                </Button>
                <Button 
                  className="bg-blue-600 hover:bg-blue-500 text-white min-w-[200px] h-12 text-xs uppercase tracking-widest font-black shadow-lg shadow-blue-900/20" 
                  onClick={handleConfirmSyncReview}
                  disabled={isCommittingSync || (selectedPreviewLeads.size === 0 && selectedPreviewUpdates.size === 0)}
                >
                  {isCommittingSync ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Committing...
                    </div>
                  ) : (
                    `Sync Selected (${selectedPreviewLeads.size + selectedPreviewUpdates.size})`
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {isBulkAssignModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          {/* ... Modal Content ... */}
          <div className="bg-[var(--color-bg-card)] max-w-md w-full border border-[var(--color-border-main)] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-[var(--color-border-main)]">
              <h2 className="serif text-2xl italic font-light text-[var(--color-text-main)]">Bulk Asset Assignment</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mt-1">Target Cluster: {selectedLeadIds.length} Leads</p>
            </div>
            <div className="p-10 space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)]">Select Target Member</label>
                <select 
                  value={bulkAssignTo} 
                  onChange={e => setBulkAssignTo(e.target.value)}
                  className="w-full h-14 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-2xl px-6 text-sm text-[var(--color-text-main)] outline-none focus:border-accent"
                >
                  <option value="">Select Member...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4 pt-6">
                <Button variant="ghost" className="flex-1 text-[var(--color-text-dim)]" onClick={() => setIsBulkAssignModalOpen(false)}>Abort</Button>
                <Button 
                  className="flex-1 bg-accent text-white hover:bg-amber-600" 
                  disabled={!bulkAssignTo}
                  onClick={handleBulkAssign}
                >
                  Commit Assignment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[var(--color-bg-card)] max-w-md w-full border border-rose-500/30 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-rose-500/10 bg-rose-500/5">
              <div className="flex items-center gap-3 text-rose-500 mb-2">
                <Trash2 className="w-6 h-6" />
                <h2 className="serif text-2xl italic font-light">Purge Cluster?</h2>
              </div>
              <p className="text-[10px] text-rose-400 uppercase tracking-widest font-black">Targeting: {selectedLeadIds.length} Records</p>
            </div>
            
            <div className="p-8 space-y-6">
              <p className="text-sm text-[var(--color-text-dim)] leading-relaxed italic">
                You are about to eliminate {selectedLeadIds.length} leads. This action is terminal and will erase all associated history and journals for these assets.
              </p>
              
              <div className="flex flex-col gap-3 mt-6">
                <Button 
                   className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest text-[10px] border-none shadow-lg shadow-rose-900/20"
                  onClick={handleBulkDelete}
                >
                  EXECUTE CLUSTER PURGE
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full text-[var(--color-text-dim)] hover:text-accent"
                  onClick={() => setIsBulkDeleteModalOpen(false)}
                >
                  ABORT SEQUENCE
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskModal({ isOpen, onClose, lead, onSave }: any) {
  const { users, user } = useApp();
  const [taskData, setTaskData] = useState({
    title: lead ? `Follow up with ${lead.name || 'Client'}` : '',
    description: lead ? `Project: ${lead.project || 'N/A'}. Phone: ${lead.phone || 'N/A'}` : '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    assignedTo: user?.id || '',
    type: 'follow_up' as const,
    leadId: lead?.id || ''
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-[var(--color-bg-card)] max-w-lg w-full border border-[var(--color-border-main)] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8 border-b border-[var(--color-border-main)] flex justify-between items-center bg-[var(--color-bg-sidebar)]/50">
          <div>
            <h2 className="serif text-3xl font-light italic text-[var(--color-text-main)]">Provision Task</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mt-1">Linked to: {lead?.name || 'General'}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-accent transition-colors">✕</button>
        </div>
        
        <form className="p-10 space-y-6" onSubmit={(e) => { e.preventDefault(); onSave(taskData); }}>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Task Title</label>
            <Input 
              required
              value={taskData.title}
              onChange={e => setTaskData({...taskData, title: e.target.value})}
              placeholder="e.g., Follow up call"
              className="h-12 bg-[var(--color-bg-main)] border-[var(--color-border-main)] focus:border-accent"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Description</label>
            <textarea 
              value={taskData.description}
              onChange={e => setTaskData({...taskData, description: e.target.value})}
              className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-xl p-4 text-sm text-[var(--color-text-main)] outline-none focus:border-accent min-h-[100px]"
              placeholder="Detailed instructions..."
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Due Date</label>
              <Input 
                type="date"
                required
                value={taskData.dueDate}
                onChange={e => setTaskData({...taskData, dueDate: e.target.value})}
                className="h-12 bg-[var(--color-bg-main)] border-[var(--color-border-main)] focus:border-accent"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Type</label>
              <select 
                value={taskData.type}
                onChange={e => setTaskData({...taskData, type: e.target.value as any})}
                className="w-full h-12 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-xl px-4 text-sm text-[var(--color-text-main)] outline-none focus:border-accent"
              >
                <option value="follow_up">Follow Up</option>
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="site_visit">Site Visit</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Assign To</label>
            <select 
              required
              value={taskData.assignedTo}
              onChange={e => setTaskData({...taskData, assignedTo: e.target.value})}
              className="w-full h-12 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-xl px-4 text-sm text-[var(--color-text-main)] outline-none focus:border-accent"
            >
              <option value="">Select Associate...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <Button type="submit" className="w-full h-14 bg-accent hover:bg-amber-600 text-white font-black uppercase tracking-[0.2em] shadow-xl text-xs mt-4">
            Command: Task Provision
          </Button>
        </form>
      </div>
    </div>
  );
}

function RemarkModal({ isOpen, onClose, lead, onUpdate }: any) {
  const [remarkText, setRemarkText] = useState('');
  const [newStatus, setNewStatus] = useState<LifecycleStage>(lead?.lifecycleStage || 'Cold');
  const [setReminder, setSetReminder] = useState(false);
  const [reminderData, setReminderData] = useState({
    dateTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    comment: ''
  });

  React.useEffect(() => {
    if (lead) setNewStatus(lead.lifecycleStage);
  }, [lead]);

  if (!isOpen) return null;

  const statuses: LifecycleStage[] = ['Cold', 'Warm', 'Intent', 'Site Visit', 'Converted', 'CP', 'Closed', 'Duplicate'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-[var(--color-bg-card)] max-w-lg w-full border border-[var(--color-border-main)] rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-[var(--color-border-main)] flex justify-between items-center bg-[var(--color-bg-sidebar)]/50">
          <h2 className="serif text-3xl font-light italic text-[var(--color-text-main)]">CRM Journal & Reminder</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-accent transition-colors">✕</button>
        </div>
        
        <div className="p-10 space-y-8 max-h-[85vh] overflow-y-auto scrollbar-thin scrollbar-thumb-accent">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)] flex items-center gap-2">
                <History className="w-3 h-3" />
                Lead Activity Log
              </h4>
              <span className="text-[10px] font-bold text-[var(--color-text-dim)] uppercase tracking-tighter">
                {lead?.remarks?.length || 0} Entries
              </span>
            </div>
            <div className="max-h-[250px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-accent bg-[var(--color-bg-main)]/30 rounded-2xl p-4 border border-[var(--color-border-main)]/50">
              {lead?.remarks?.length > 0 || lead?.reminders?.length > 0 ? (
                <>
                  {lead?.reminders?.filter((r: any) => !r.triggered).map((r: any) => (
                    <div key={r.id} className="p-4 bg-accent/5 border border-accent/20 rounded-xl shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-accent animate-pulse" />
                      <div className="flex justify-between items-center mb-2 font-sans text-[9px] text-accent">
                        <div className="flex items-center gap-2">
                          <Activity className="w-3 h-3" />
                          <span className="font-black uppercase tracking-widest">Scheduled Reminder</span>
                        </div>
                        <span className="font-black font-mono bg-accent/10 px-2 py-0.5 rounded">{format(new Date(r.dateTime), 'dd MMM yyyy, HH:mm')}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-[var(--color-text-main)] font-medium">
                        {r.comment}
                      </p>
                    </div>
                  ))}
                  {[...lead.remarks].reverse().map((r: any) => (
                  <div key={r.id} className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border-main)] rounded-xl shadow-sm">
                    <div className="flex justify-between items-center mb-2 font-sans text-[9px] text-slate-500">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[8px] font-black">
                          {r.createdBy.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-[var(--color-text-main)]">{r.createdBy}</span>
                      </div>
                      <span className="font-medium font-mono">{format(new Date(r.createdAt), 'dd MMM yyyy, HH:mm')}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-400 italic">
                      "{r.text}"
                    </p>
                  </div>
                ))}
              </>
            ) : (
                <div className="py-12 text-center">
                  <Activity className="w-8 h-8 text-slate-700 mx-auto mb-3 opacity-20" />
                  <p className="text-[10px] italic text-slate-600">No activity recorded for this asset yet.</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Journal Entry</label>
              <textarea 
                autoFocus
                value={remarkText}
                onChange={e => setRemarkText(e.target.value)}
                placeholder="Record recent update for this asset..."
                className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-2xl p-6 text-sm italic text-[var(--color-text-main)] outline-none min-h-[120px] focus:border-accent transition-all"
              />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Update Lifecycle Stage</label>
                <select 
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value as LifecycleStage)}
                  className="w-full h-12 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-xl text-[11px] font-bold uppercase tracking-widest outline-none px-4 focus:border-accent text-[var(--color-text-dim)] appearance-none cursor-pointer"
                >
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <p className="text-[9px] text-slate-500 italic px-2">Selecting a new stage will update the lead's current status upon saving this journal.</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--color-border-main)] space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)]">System Follow-up</h4>
              <button 
                onClick={() => setSetReminder(!setReminder)}
                className={cn(
                  "px-3 py-1 rounded-full text-[8px] uppercase font-bold tracking-widest transition-all",
                  setReminder ? "bg-accent text-white" : "bg-[var(--color-bg-main)] text-[var(--color-text-dim)] border border-[var(--color-border-main)]"
                )}
              >
                {setReminder ? 'Reminder Active' : 'Set Reminder'}
              </button>
            </div>

            {setReminder && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Temporal Target</label>
                  <Input 
                    type="datetime-local" 
                    value={reminderData.dateTime} 
                    onChange={e => setReminderData({...reminderData, dateTime: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Follow-up Intent</label>
                  <Input 
                    placeholder="e.g., Call back at 3 in noon..." 
                    value={reminderData.comment}
                    onChange={e => setReminderData({...reminderData, comment: e.target.value})}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-[var(--color-border-main)]">
            <Button variant="ghost" onClick={onClose}>Discard</Button>
            <Button 
              className="bg-accent text-white hover:bg-amber-600 px-8"
              disabled={!remarkText.trim() && (!setReminder || !reminderData.comment.trim()) && newStatus === lead?.lifecycleStage}
              onClick={() => {
                onUpdate(remarkText, setReminder ? reminderData : undefined, newStatus);
                setRemarkText('');
              }}
            >
              Update Journal
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: LifecycleStage }) {
  const styles: Record<LifecycleStage, string> = {
    'Cold': 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    'Warm': 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    'Intent': 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    'Site Visit': 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    'Converted': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    'CP': 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    'Closed': 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
    'Duplicate': 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  };

  // Robust matching: Try direct, then fallback to normalized (Title Case)
  let normalizedStatus = status;
  if (!styles[status]) {
    const s = (status || '').toString().toLowerCase();
    if (s.includes('site visit')) normalizedStatus = 'Site Visit';
    else if (s.includes('converted')) normalizedStatus = 'Converted';
    else if (s.includes('intent')) normalizedStatus = 'Intent';
    else if (s.includes('warm')) normalizedStatus = 'Warm';
    else if (s.includes('cold')) normalizedStatus = 'Cold';
    else if (s.includes('cp')) normalizedStatus = 'CP';
    else if (s.includes('closed')) normalizedStatus = 'Closed';
    else if (s.includes('duplicate')) normalizedStatus = 'Duplicate';
    else normalizedStatus = (status?.charAt(0).toUpperCase() + status?.slice(1).toLowerCase()) as LifecycleStage;
  }

  return (
    <span className={cn(
      "px-2 py-0.5 border rounded text-[9px] font-bold uppercase tracking-tight shadow-sm",
      styles[normalizedStatus] || styles['Cold']
    )}>
      {status}
    </span>
  );
}

function LeadModal({ isOpen, onClose, lead, onSave, onOpenBooking }: any) {
  const { user, theme, users, hasPermission, showToast } = useApp();
  const [selectedProjects, setSelectedProjects] = useState<Project[]>(
    lead ? [lead.project] : ['PM ELITE']
  );
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>(() => {
    if (!lead?.propertyType) return ['Plot'];
    // Handle both comma-separated and single values
    const types = lead.propertyType.split(', ').map((t: string) => t.trim());
    const standardOptions = ['Plot', 'Villa', 'Apartment', 'Commercial'];
    const filteredStandard = types.filter((t: string) => standardOptions.includes(t));
    if (types.some((t: string) => !standardOptions.includes(t))) {
      filteredStandard.push('Other');
    }
    return filteredStandard.length > 0 ? filteredStandard : ['Plot'];
  });
  const [customPropertyType, setCustomPropertyType] = useState(() => {
    if (!lead?.propertyType) return '';
    const standardOptions = ['Plot', 'Villa', 'Apartment', 'Commercial'];
    const types = lead.propertyType.split(', ').map((t: string) => t.trim());
    const other = types.find((t: string) => !standardOptions.includes(t));
    return other || '';
  });

  const [formData, setFormData] = useState<Partial<Lead>>({
    name: '',
    email: '',
    phone: '',
    project: 'PM ELITE',
    lifecycleStage: 'Cold',
    source: 'Manual Entry',
    remarks: [],
    siteVisits: [],
    propertyType: 'Plot',
    budget: '',
    preferredSiteVisit: '',
    plotSize: '',
    walkinSource: '',
    employmentType: '',
    occupation: '',
    assignedTo: '',
    month: format(new Date(), 'MMMM'),
    date: format(new Date(), 'yyyy-MM-dd'),
    leadId: `LID-${Math.floor(100000 + Math.random() * 900000)}`
  });

  React.useEffect(() => {
    if (lead) {
      setFormData({
        ...lead,
        name: lead.name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        source: lead.source || lead.originationSource || 'Manual Entry',
        originationSource: lead.originationSource || lead.source || 'Manual Entry',
        lifecycleStage: lead.lifecycleStage || 'Cold',
        assignedTo: lead.assignedTo || '',
        budget: lead.budget || '',
        preferredSiteVisit: lead.preferredSiteVisit || '',
        plotSize: lead.plotSize || '',
        walkinSource: lead.walkinSource || '',
        employmentType: lead.employmentType || '',
        occupation: lead.occupation || '',
        siteVisits: lead.siteVisits || [],
        leadId: lead.leadId || `LID-${Math.floor(100000 + Math.random() * 900000)}`,
        month: lead.month || format(new Date(), 'MMMM'),
        date: lead.date || format(new Date(), 'yyyy-MM-dd')
      });
      setSelectedProjects([lead.project]);
      
      const types = (lead.propertyType || 'Plot').split(', ').map((t: string) => t.trim());
      const standardOptions = ['Plot', 'Villa', 'Apartment', 'Commercial'];
      const filteredStandard = types.filter((t: string) => standardOptions.includes(t));
      if (types.some((t: string) => !standardOptions.includes(t))) {
        filteredStandard.push('Other');
        const other = types.find((t: string) => !standardOptions.includes(t));
        setCustomPropertyType(other || '');
      } else {
        setCustomPropertyType('');
      }
      setSelectedPropertyTypes(filteredStandard.length > 0 ? filteredStandard : ['Plot']);
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        project: 'PM ELITE',
        lifecycleStage: 'Cold',
        source: 'Manual Entry',
        remarks: [],
        siteVisits: [],
        propertyType: 'Plot',
        budget: '',
        preferredSiteVisit: '',
        plotSize: '',
        walkinSource: '',
        employmentType: '',
        occupation: '',
        assignedTo: '',
        month: format(new Date(), 'MMMM'),
        date: format(new Date(), 'yyyy-MM-dd'),
        leadId: `LID-${Math.floor(100000 + Math.random() * 900000)}`
      });
      setSelectedProjects(['PM ELITE']);
      setSelectedPropertyTypes(['Plot']);
      setCustomPropertyType('');
    }
  }, [lead]);

  const [newRemark, setNewRemark] = useState('');
  const [newSiteVisitDate, setNewSiteVisitDate] = useState('');
  const [newSiteVisitComment, setNewSiteVisitComment] = useState('');

  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [isWhatsAppDrafting, setIsWhatsAppDrafting] = useState(false);

  const BROCHURES = {
    'PM ELITE': 'https://pmgroup.biz/wp-content/uploads/2025/09/PM_ELITE_BROCHURE.pdf',
    'PM UPLANDS': 'https://pmgroup.biz/wp-content/uploads/2026/03/PM-E-BROCHURE-Uplan.pdf',
    'THE RISE': 'https://pmgroup.biz/wp-content/uploads/2026/03/Digital-Brochure-1-1.pdf'
  };

  const defaultWATemplate = `Hello ${formData.name},\n\nThank you for choosing PM Group. It was a pleasure discussing ${formData.project} with you. We are committed to providing you with the best real estate solutions.\n\nShould you have any further queries, feel free to reach out.\n\nBest Regards,\n${user?.name}\nPM Group CRM`;

  const handleLaunchWhatsApp = () => {
    if (!formData.phone) {
      showToast('Lead has no phone number', 'error');
      return;
    }
    
    // Clean and validate phone number
    let cleanPhone = formData.phone.replace(/\D/g, '');
    
    // Auto-detect 10-digit Indian numbers and prefix country code
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    
    if (cleanPhone.length < 10) {
      showToast('Phone number seems too short', 'error');
      return;
    }

    const encodedMsg = encodeURIComponent(whatsappMessage);
    // Remove the trailing slash before query param as some OS handlers are picky
    const url = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
    
    // Use a temporary anchor to trigger navigation which is often more reliable than window.open
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setIsWhatsAppDrafting(false);
    
    // Add an audit remark
    const remark = {
      id: Math.random().toString(36).substr(2, 9),
      text: `Sent WhatsApp message: "${whatsappMessage.substring(0, 30)}..."`,
      createdAt: new Date().toISOString(),
      createdBy: user?.name || 'System'
    };
    setFormData({
      ...formData,
      remarks: [...(formData.remarks || []), remark]
    });
  };

  const toggleProject = (p: Project) => {
    setSelectedProjects(prev => 
      prev.includes(p) 
        ? (prev.length > 1 ? prev.filter(item => item !== p) : prev) 
        : [...prev, p]
    );
  };

  const togglePropertyType = (type: string) => {
    setSelectedPropertyTypes(prev => 
      prev.includes(type)
        ? (prev.length > 1 ? prev.filter(t => t !== type) : prev)
        : [...prev, type]
    );
  };

  const projectOptions: Project[] = ['PM UPLANDS', 'PM ELITE', 'THE RISE'];
  const propertyOptions = ['Plot', 'Villa', 'Apartment', 'Commercial'];

  return (
    <React.Fragment>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
        <div className="bg-[var(--color-bg-card)] max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[var(--color-border-main)] rounded-3xl shadow-2xl transition-colors">
          <div className="p-8 border-b border-[var(--color-border-main)] flex justify-between items-center bg-[var(--color-bg-sidebar)]">
            <h2 className="serif text-3xl font-light italic text-white">{lead ? 'Modify Client Asset' : 'Register New Lead'}</h2>
            <div className="flex items-center gap-4">
              {lead && (
                <Button 
                  variant="outline" 
                  onClick={onOpenBooking}
                  className="h-10 px-6 rounded-xl border-accent text-accent hover:bg-accent hover:text-white transition-all text-xs font-black uppercase tracking-widest gap-2 shadow-lg shadow-accent/10 bg-white/5"
                >
                  <FileCheck className="w-4 h-4" /> Booking Form
                </Button>
              )}
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 text-xl">✕</button>
            </div>
          </div>
          
          <div className="p-12 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Month</label>
              <Input value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})} placeholder="April" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Date</label>
              <Input 
                type="date"
                value={formData.date} 
                onChange={e => {
                  const newDate = e.target.value;
                  const parsedDate = parseISO(newDate);
                  let monthUpdate = formData.month;
                  
                  if (isValid(parsedDate)) {
                    monthUpdate = format(parsedDate, 'MMMM');
                  }
                  
                  setFormData({
                    ...formData, 
                    date: newDate,
                    month: monthUpdate
                  });
                }} 
                placeholder="2024-04-22" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">SR NO.</label>
              <Input value={formData.leadId} onChange={e => setFormData({...formData, leadId: e.target.value})} placeholder="LID-123456" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Full Name</label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="Mr. John Doe"
                readOnly={user?.role === 'SalesAssociate' && !!lead}
                className={cn(user?.role === 'SalesAssociate' && !!lead && "opacity-60 bg-slate-100/10 cursor-not-allowed")}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Phone No.</label>
              <Input 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
                placeholder="+91 98765 43210"
                readOnly={user?.role === 'SalesAssociate' && !!lead}
                className={cn(user?.role === 'SalesAssociate' && !!lead && "opacity-60 bg-slate-100/10 cursor-not-allowed")}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Email</label>
              <Input 
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
                placeholder="john@example.com"
                readOnly={user?.role === 'SalesAssociate' && !!lead}
                className={cn(user?.role === 'SalesAssociate' && !!lead && "opacity-60 bg-slate-100/10 cursor-not-allowed")}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Origination Source</label>
              <Input value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} placeholder="PM Plot Leads" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-3 md:col-span-2">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Target Project(s)</label>
              <div className="flex flex-wrap gap-2">
                {projectOptions.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleProject(p)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                      selectedProjects.includes(p)
                        ? "bg-accent text-white border-accent"
                        : "bg-[var(--color-bg-main)] text-[var(--color-text-dim)] border-[var(--color-border-main)] hover:border-accent/50"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-slate-500 italic">Select one or more projects. If multiple projects are selected, separate lead entries will be created for each.</p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Lifecycle Stage</label>
              <select 
                value={formData.lifecycleStage} 
                onChange={e => setFormData({...formData, lifecycleStage: e.target.value as LifecycleStage})}
                className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-main)] h-11 rounded-lg outline-none focus:border-accent text-sm px-4 text-[var(--color-text-main)]"
              >
                {['Cold', 'Warm', 'Intent', 'Site Visit', 'Converted', 'CP', 'Closed', 'Duplicate'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Asset Assignment</label>
              <select 
                disabled={!hasPermission('assign_lead')}
                value={formData.assignedTo} 
                onChange={e => setFormData({...formData, assignedTo: e.target.value})}
                className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-main)] h-11 rounded-lg outline-none focus:border-accent text-sm px-4 text-[var(--color-text-main)]"
              >
                <option value="">Unassigned</option>
                {formData.assignedTo && !users.find(u => u.id === formData.assignedTo) && (
                  <option value={formData.assignedTo}>{formData.assignedTo} (Legacy/External)</option>
                )}
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-8 pt-4 border-t border-[var(--color-border-main)]">
            <h4 className="serif text-xl italic text-slate-400">Project Requirements</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3 md:col-span-2">
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Interested Property Type(s)</label>
                <div className="flex flex-wrap gap-2">
                  {propertyOptions.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => togglePropertyType(type)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                        selectedPropertyTypes.includes(type)
                          ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
                          : "bg-[var(--color-bg-main)] text-[var(--color-text-dim)] border-[var(--color-border-main)] hover:border-accent/50"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => togglePropertyType('Other')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                      selectedPropertyTypes.includes('Other')
                        ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800"
                        : "bg-[var(--color-bg-main)] text-[var(--color-text-dim)] border-[var(--color-border-main)] hover:border-accent/50"
                    )}
                  >
                    Other
                  </button>
                </div>
                {selectedPropertyTypes.includes('Other') && (
                  <div className="mt-3">
                    <Input 
                      placeholder="Specify other property type..."
                      value={customPropertyType}
                      onChange={e => setCustomPropertyType(e.target.value)}
                      className="border-rose-200 focus:border-rose-500"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">What is your preffered investment budget?</label>
                <Input 
                  value={formData.budget} 
                  onChange={e => setFormData({...formData, budget: e.target.value})} 
                  placeholder="e.g., ₹1.5Cr - ₹2Cr" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">When would you like to schedule a site visit?</label>
                <Input 
                  value={formData.preferredSiteVisit} 
                  onChange={e => setFormData({...formData, preferredSiteVisit: e.target.value})} 
                  placeholder="2024-05-20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Which plot size are you interested in?</label>
                <Input 
                  value={formData.plotSize} 
                  onChange={e => setFormData({...formData, plotSize: e.target.value})} 
                  placeholder="e.g., 1500 sq.ft." 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Source of Walkin (If Walk-in)</label>
                <Input 
                  value={formData.walkinSource} 
                  onChange={e => setFormData({...formData, walkinSource: e.target.value})} 
                  placeholder="e.g., News Paper, Reference" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Employment Type</label>
                <select 
                  value={formData.employmentType} 
                  onChange={e => setFormData({...formData, employmentType: e.target.value})}
                  className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-main)] h-11 rounded-lg outline-none focus:border-accent text-sm px-4 text-[var(--color-text-main)]"
                >
                  <option value="">Select...</option>
                  <option value="Business">Business</option>
                  <option value="Salaried">Salaried</option>
                  <option value="Others">Others</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Occupation</label>
                <Input 
                  value={formData.occupation} 
                  onChange={e => setFormData({...formData, occupation: e.target.value})} 
                  placeholder="e.g., Doctor, Senior Manager at ABC Corp" 
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[var(--color-border-main)]">
            <div className="flex items-center justify-between mb-2">
              <h4 className="serif text-xl italic text-slate-400">WhatsApp Dispatch</h4>
              {!isWhatsAppDrafting && formData.phone && (
                <Button 
                  size="sm"
                  variant="outline"
                  className="h-8 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5 gap-2"
                  onClick={() => {
                    setWhatsappMessage(defaultWATemplate);
                    setIsWhatsAppDrafting(true);
                  }}
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Launch WhatsApp
                </Button>
              )}
            </div>

            {isWhatsAppDrafting ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-950/20 border border-emerald-500/30 p-6 rounded-2xl space-y-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-3 h-3 text-emerald-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500/70">Draft Official Message</span>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-[8px] uppercase tracking-widest font-bold text-slate-500">Message to {formData.name}</label>
                    <textarea 
                      className="w-full min-h-[120px] bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-xl p-4 text-[11px] font-sans focus:outline-none focus:border-accent/50 resize-none"
                      value={whatsappMessage}
                      onChange={e => setWhatsappMessage(e.target.value)}
                    />
                  </div>

                  <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500/70">Quick Attach Brochure</span>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(BROCHURES).map(([proj, url]) => (
                          <Button 
                            key={proj}
                            size="sm" 
                            variant="ghost" 
                            className="h-6 px-2 text-[8px] uppercase tracking-widest text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10"
                            onClick={() => {
                              if (!whatsappMessage.includes(url)) {
                                setWhatsappMessage(prev => prev + `\n\n${proj} Brochure: ${url}`);
                              }
                            }}
                          >
                            + {proj.replace('PM ', '')}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-400 font-sans leading-relaxed">
                      Attachments are sent as links in the message. You can also paste your own links above.
                    </p>
                  </div>

                  <p className="text-[9px] text-slate-500 flex items-center gap-1">
                    <Share className="w-2.5 h-2.5" /> Media files can be added manually using the "paperclip" icon in the WhatsApp chat.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold uppercase tracking-widest text-[9px] h-10"
                    onClick={handleLaunchWhatsApp}
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> Start Conversation
                  </Button>
                  <Button 
                    variant="ghost"
                    className="px-4 text-[9px] uppercase tracking-widest font-bold text-slate-400"
                    onClick={() => setIsWhatsAppDrafting(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            ) : (
              <p className="text-[10px] text-slate-500 italic">
                {formData.phone ? 'Direct WhatsApp communication available for this lead.' : 'WhatsApp requires a valid phone number.'}
              </p>
            )}
          </div>

          <div className="space-y-4 pt-4 border-t border-[var(--color-border-main)]">
            <h4 className="serif text-xl italic text-slate-400">Site Visit Log</h4>
            <div className="space-y-3">
              {formData.siteVisits?.map((sv: any, i) => (
                <div key={sv.id || i} className="p-4 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-xl relative group">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-accent" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Visit No. {i + 1}
                      </span>
                    </div>
                    <span className="text-[8px] uppercase tracking-widest text-slate-500">
                      {format(new Date(sv.date), 'dd MMM yyyy')}
                    </span>
                  </div>
                  {sv.comment && (
                    <p className="text-[11px] text-slate-400 italic mt-1 font-sans">
                      "{sv.comment}"
                    </p>
                  )}
                  <button 
                    onClick={() => {
                      const updated = formData.siteVisits?.filter((_, idx) => idx !== i);
                      setFormData({...formData, siteVisits: updated});
                    }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-rose-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              
              <div className="bg-[var(--color-bg-sidebar)]/50 p-6 rounded-2xl border border-dashed border-[var(--color-border-main)] space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-3 h-3 text-accent" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Record Re-Site Visit</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[8px] uppercase tracking-widest font-bold text-slate-500">Visit Date</label>
                    <Input 
                      type="date"
                      value={newSiteVisitDate}
                      onChange={e => setNewSiteVisitDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] uppercase tracking-widest font-bold text-slate-500">Visit notes (Optional)</label>
                    <Input 
                      placeholder="Feedback from client..."
                      value={newSiteVisitComment}
                      onChange={e => setNewSiteVisitComment(e.target.value)}
                    />
                  </div>
                </div>
                <Button 
                  size="sm"
                  variant="outline"
                  className="w-full h-10 border-accent/20 text-accent hover:bg-accent/5 gap-2"
                  onClick={() => {
                    if (!newSiteVisitDate) {
                      showToast('Please select a visit date', 'error');
                      return;
                    }
                    const newVisit = {
                      id: Math.random().toString(36).substr(2, 9),
                      date: newSiteVisitDate,
                      comment: newSiteVisitComment,
                      createdAt: new Date().toISOString()
                    };
                    setFormData({
                      ...formData, 
                      siteVisits: [...(formData.siteVisits || []), newVisit],
                      // Also auto-update Lifecycle Stage to Site Visit if not already there or further
                      lifecycleStage: formData.lifecycleStage === 'Cold' || formData.lifecycleStage === 'Warm' || formData.lifecycleStage === 'Intent' 
                        ? 'Site Visit' 
                        : formData.lifecycleStage
                    });
                    setNewSiteVisitDate('');
                    setNewSiteVisitComment('');
                    showToast('Re-site visit recorded', 'success');
                  }}
                >
                  <Plus className="w-3 h-3" /> Record Client Visit
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[var(--color-border-main)]">
            <h4 className="serif text-xl italic text-slate-400">Activity Journal</h4>
            <div className="space-y-3">
              {formData.remarks?.map((r: any, i) => (
                <div key={r.id || i} className="p-4 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] text-[11px] text-slate-400 italic rounded-xl">
                  <div className="flex justify-between items-center mb-1 not-italic font-sans text-[8px] uppercase tracking-widest text-slate-600">
                    <span className="font-bold">{r.createdBy}</span>
                    <span>{format(new Date(r.createdAt), 'dd MMM yyyy, HH:mm')}</span>
                  </div>
                  "{r.text}"
                </div>
              ))}
              <div className="flex gap-3 mt-4">
                <Input 
                  placeholder="Record recent updates..." 
                  value={newRemark} 
                  onChange={e => setNewRemark(e.target.value)} 
                />
                <Button 
                  size="sm" 
                  className="bg-accent text-white hover:bg-amber-600"
                  onClick={() => {
                    if (newRemark) {
                      const remarkObject = {
                        id: Math.random().toString(36).substr(2, 9),
                        text: newRemark,
                        createdAt: new Date().toISOString(),
                        createdBy: user?.name || 'Unknown'
                      };
                      setFormData({...formData, remarks: [...(formData.remarks || []), remarkObject as any]});
                      setNewRemark('');
                    }
                  }}
                >
                  Append
                </Button>
              </div>
            </div>
          </div>
          </div>

          <div className="flex justify-end gap-4 pt-10 border-t border-[var(--color-border-main)]">
            <Button variant="ghost" onClick={onClose}>Discard</Button>
            <Button 
              className="bg-accent text-white hover:bg-amber-600 px-8" 
              onClick={() => {
                const finalPropertyTypes = selectedPropertyTypes
                    .filter(t => t !== 'Other')
                    .concat(selectedPropertyTypes.includes('Other') && customPropertyType ? [customPropertyType] : []);
                
                onSave({
                  ...formData, 
                  originationSource: formData.source, 
                  projects: selectedProjects,
                  propertyType: finalPropertyTypes.join(', ')
                });
              }}
            >
              Commit Changes
            </Button>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

function SyncDetailsModal({ details, onClose }: { details: any[], onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-[var(--color-bg-card)] border-[var(--color-border-main)] shadow-2xl">
        <div className="p-8 border-b border-[var(--color-border-main)] flex justify-between items-center bg-[var(--color-bg-sidebar)]">
          <div>
            <h2 className="text-2xl font-serif text-[var(--color-text-main)] italic">Last Sync Exception Report</h2>
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mt-1">Detailed breakdown of skipped spreadsheet rows</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-text-main)]/5 rounded-full transition-colors text-slate-400 hover:text-[var(--color-text-main)]">
            <Filter className="w-5 h-5 rotate-45" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8">
          <div className="space-y-3">
            {details.length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-serif italic text-xl underline underline-offset-8">No exceptions found. Data integrity 100%.</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[var(--color-border-main)]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--color-bg-sidebar)] border-b border-[var(--color-border-main)]">
                      <th className="p-5 font-black uppercase text-slate-400 text-[9px] tracking-widest">Source Sheet</th>
                      <th className="p-5 font-black uppercase text-slate-400 text-[9px] tracking-widest">Row Index</th>
                      <th className="p-5 font-black uppercase text-slate-400 text-[9px] tracking-widest">Rejection Reason</th>
                      <th className="p-5 font-black uppercase text-slate-400 text-[9px] tracking-widest">Identifier Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((d, i) => (
                      <tr key={i} className="border-b border-[var(--color-border-main)] hover:bg-[var(--color-text-main)]/5 transition-colors">
                        <td className="p-5 font-bold text-accent italic">{d.source}</td>
                        <td className="p-5 text-slate-400 font-mono">Row {d.row}</td>
                        <td className="p-5">
                          <span className={cn(
                            "px-3 py-1 rounded-full font-black text-[8px] uppercase tracking-tighter",
                            d.reason === 'Duplicate in Sync Run' ? "bg-amber-900/20 text-amber-500 border border-amber-900/50" : "bg-rose-900/20 text-rose-500 border border-rose-900/50"
                          )}>
                            {d.reason}
                          </span>
                        </td>
                        <td className="p-5 text-[var(--color-text-main)] truncate max-w-[250px] font-medium">{d.info}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-[var(--color-border-main)] bg-[var(--color-bg-sidebar)] text-center text-[10px] text-slate-400 uppercase font-black tracking-widest">
          * Lead synchronization prioritizes cloud record integrity. Duplicate identities are merged into existing entries.
        </div>
      </Card>
    </div>
  );
}
