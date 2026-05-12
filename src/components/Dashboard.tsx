import React, { useState, useMemo } from 'react';
import { useApp } from '@/src/AppContext';
import { Lead, Project, LifecycleStage } from '@/src/types';
import { Card, Button } from '@/src/components/ui';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfDay,
  endOfDay,
  eachWeekOfInterval, 
  isWithinInterval, 
  parseISO, 
  eachDayOfInterval,
  subDays,
  subWeeks,
  isSameDay
} from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
  LabelList
} from 'recharts';
import { Users, Target, Activity, TrendingUp, PieChart as PieIcon, Map as MapIcon, Calendar, Briefcase, ChevronRight, ShieldCheck, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const { user, leads: allLeads, skippedLeads, theme, setActiveTab, users, inventory, sendEODReport } = useApp();
  const [selectedProject, setSelectedProject] = useState<string>('All');
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string>('All');
  const [selectedAssociate, setSelectedAssociate] = useState<string>('All');
 
  // Slot View States
  const [slot1View, setSlot1View] = useState('campaign'); // Source Performance
  const [slot2View, setSlot2View] = useState('lifecycle'); // Classification
  const [slot3View, setSlot3View] = useState('daily'); // Volume/Trends
  const [slot4View, setSlot4View] = useState('property'); // Interest
  const [slot5View, setSlot5View] = useState('quality'); // Quality/Engagement
  const [slot6View, setSlot6View] = useState('aging'); // Lead Aging
  const [slot7View, setSlot7View] = useState('inventory'); // Inventory Health
  const [slot8View, setSlot8View] = useState('funnel'); // Transition Funnel
  const [slot9View, setSlot9View] = useState('efficiency'); // Assoc Efficiency

  const teamMembers = useMemo(() => {
    return users; // Show all users in the filter
  }, [users]);

  const formatSourceName = (name: string) => {
    const n = name.toUpperCase().trim();
    if (n === 'MASTER SYNC') return 'MASTER SYNC';
    if (n.includes('WALK')) return 'WALK-INS';
    if (n.includes('MANUAL')) return 'MANUAL ENTRY';
    if (n.includes('FB ') || n.includes('FACEBOOK') || n.includes('INSTA') || n.includes('META')) return 'META ADS';
    if (n.includes('GOOGLE')) return 'GOOGLE ADS';
    // If it mentions "SHEET" but has other words, it might be a specific sheet name the user wants to see
    if (n === 'SHEET SYNC' || n === 'SHEET IMPORT') return 'SHEET IMPORT';
    return n || 'OTHER';
  };

  const sources = useMemo(() => {
    const sSet = new Set(allLeads.map(l => formatSourceName(l.source || l.originationSource || 'Other')));
    return ['All', ...Array.from(sSet)].sort();
  }, [allLeads]);

  const targetProjects = useMemo(() => {
    const pSet = new Set(allLeads.map(l => l.project).filter(Boolean));
    // Also include common "Targets" if not in data yet based on the screenshot
    return ['All', ...Array.from(pSet)].sort();
  }, [allLeads]);

  const leads = useMemo(() => {
    let filtered = allLeads;
    
    if (selectedProject !== 'All') {
      filtered = filtered.filter(l => l.project === selectedProject);
    }

    if (selectedSource !== 'All') {
      filtered = filtered.filter(l => formatSourceName(l.source || l.originationSource || 'Other') === selectedSource);
    }
    
    // We used to filter by l.name && (l.phone || l.email) here, 
    // but the user wants the dashboard to reflect all leads they see in the system.
    
    if (selectedAssociate !== 'All' && (user?.role !== 'SalesAssociate')) {
      filtered = filtered.filter(l => l.assignedTo === selectedAssociate);
    }
    return filtered;
  }, [allLeads, selectedSource, selectedAssociate, user]);

  // For metrics and trends, the user wants "accurate" data matching their list.
  // We keep all leads (including duplicates) for volume/count trends if the user expects to see everything.
  // However, we'll keep a filtered version for stage breakdown if that makes more sense.
  const metricsLeads = useMemo(() => leads, [leads]);
  const portfolioLeads = useMemo(() => {
    return leads.filter(l => l.lifecycleStage !== 'Duplicate');
  }, [leads]);

  // Use portfolioLeads (cleaned) for status distribution mostly
  // But volume trends should likely show EVERYTHING hitting the system.

  const STATUS_COLORS: Record<string, string> = {
    'Cold': '#C1884A',
    'Warm': '#122835',
    'Intent': '#D19F61',
    'Site Visit': '#262626',
    'Converted': '#3b82f6',
    'CP': '#10b981',
    'Closed': '#ef4444',
    'Duplicate': '#8B5CF6'
  };

  const COLORS = Object.values(STATUS_COLORS);
  const chartTextColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  const gridColor = theme === 'dark' ? '#1e293b' : '#e2e8f0';
  const tooltipBg = theme === 'dark' ? '#122835' : '#ffffff';

  // Helper for safe date parsing - Made significantly more robust
  const safeParseISO = (dateStr: any) => {
    if (!dateStr) return null;
    
    // 0. Handle Date object or Firestore Timestamp
    if (dateStr instanceof Date) return dateStr;
    if (typeof dateStr === 'object' && dateStr.seconds !== undefined) {
      return new Date(dateStr.seconds * 1000);
    }
    
    if (typeof dateStr === 'number') return new Date(dateStr);
    if (typeof dateStr !== 'string') return null;

    // 1. Try standard ISO/parseISO
    const d = parseISO(dateStr);
    if (!isNaN(d.getTime()) && dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
      return d;
    }
    
    // 2. Try native Date constructor (often handles local format better than parseISO for MM/DD/YYYY)
    const nativeDate = new Date(dateStr);
    if (!isNaN(nativeDate.getTime())) return nativeDate;

    // 3. Manual Fallback for common formats like DD-MM-YYYY or MM-DD-YYYY
    const parts = dateStr.split(/[-/.]/).map((p: string) => p.trim());
    if (parts.length >= 3) {
      const p1 = parseInt(parts[0]);
      const p2 = parseInt(parts[1]);
      const p3Str = parts[2].split(' ')[0];
      const p3 = parseInt(p3Str);

      if (p3 > 1000) { 
        // YYYY is at the end: Could be DD-MM-YYYY or MM-DD-YYYY
        // If p1 > 12, must be DD-MM-YYYY
        if (p1 > 12) return new Date(p3, p2 - 1, p1);
        // If p2 > 12, must be MM-DD-YYYY
        if (p2 > 12) return new Date(p3, p1 - 1, p2);
        
        // Ambiguous: Assume MM-DD-YYYY if current month matches p1, else DD-MM-YYYY? 
        // Actually, let's stick to MM-DD-YYYY as it matches Google Sheets standard often
        // but we'll try to be safe.
        const d1 = new Date(p3, p1 - 1, p2); 
        if (!isNaN(d1.getTime())) return d1;
      } else if (p1 > 1000) { 
        // YYYY is at the start: YYYY-MM-DD
        const d2 = new Date(p1, p2 - 1, p3);
        if (!isNaN(d2.getTime())) return d2;
      } else if (p3 > 0 && p3 < 100) {
        // 2-digit year at the end
        const year = p3 + (p3 > 50 ? 1900 : 2000);
        if (p1 > 12) return new Date(year, p2 - 1, p1);
        if (p2 > 12) return new Date(year, p1 - 1, p2);
        const d3 = new Date(year, p1 - 1, p2);
        if (!isNaN(d3.getTime())) return d3;
      }
    }
    
    return null;
  };

  // 1. Leads by Campaign (Origination Source) - OHLC / Performance Style
  const sourcePerformanceData = useMemo(() => {
    // Group leads by their formatted origination source
    const baseLeads = metricsLeads;

    const grouped = new Map<string, any[]>();
    baseLeads.forEach(l => {
      const srcName = formatSourceName(l.source || l.originationSource || 'Other');
      if (!grouped.has(srcName)) grouped.set(srcName, []);
      grouped.get(srcName)?.push(l);
    });
    
    return Array.from(grouped.entries()).map(([srcName, srcLeads]) => {
      const daysCount: Record<string, number> = {};
      srcLeads.forEach(l => {
        const parsed = safeParseISO(l.date || l.createdAt);
        if (parsed) {
          const d = format(parsed, 'yyyy-MM-dd');
          daysCount[d] = (daysCount[d] || 0) + 1;
        }
      });
      
      const counts = Object.values(daysCount);
      const total = srcLeads.length;
      const avg = counts.length > 0 ? total / counts.length : 0;
      const low = counts.length > 0 ? Math.min(...counts) : 0;
      const high = counts.length > 0 ? Math.max(...counts) : 0;

      return {
        name: srcName,
        displayName: srcName,
        total,
        low,
        high,
        avg: parseFloat(avg.toFixed(1))
      };
    }).sort((a, b) => b.total - a.total);
  }, [allLeads, selectedAssociate]);

  // 2. Property Interest (Property Type)
  const propertyInterestData = useMemo(() => {
    const counts: Record<string, number> = {};
    portfolioLeads.forEach(l => {
      let type = (l.propertyType || 'Not Specified').trim();
      const lower = type.toLowerCase();
      if (lower.includes('villa')) type = 'Villa';
      else if (lower.includes('plot')) type = 'Plot';
      else if (lower.includes('commercial')) type = 'Commercial';
      else if (lower.includes('residential')) type = 'Residential';
      else if (lower === 'not specified' || !lower) type = 'N/A';
      
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [portfolioLeads]);

  // 3. Leads by Classification (Lifecycle Stage)
  const statusData = useMemo(() => {
    // Show status breakdown for ALL leads currently being viewed (respect filters)
    const statuses: LifecycleStage[] = ['Cold', 'Warm', 'Intent', 'Site Visit', 'Converted', 'CP', 'Closed', 'Duplicate'];
    
    // Create a normalized mapping to handle case-sensitivity from imports
    const normalize = (s: string) => {
      const lower = (s || '').toLowerCase().trim();
      if (lower === 'cold') return 'Cold';
      if (lower === 'warm') return 'Warm';
      if (lower === 'intent') return 'Intent';
      if (lower === 'site visit' || lower === 'sitevisit' || lower === 'sv') return 'Site Visit';
      if (lower === 'converted') return 'Converted';
      if (lower === 'cp' || lower === 'channel partner') return 'CP';
      if (lower === 'closed' || lower === 'dead' || lower === 'junk') return 'Closed';
      if (lower === 'duplicate') return 'Duplicate';
      return s; // Fallback
    };

    return statuses.map(s => ({
      name: s,
      value: leads.filter(l => normalize(l.lifecycleStage) === s).length
    }));
  }, [leads]);

  const pieStatusData = useMemo(() => {
    return statusData.filter(d => d.value > 0);
  }, [statusData]);

  // Budget Distribution
  const budgetData = useMemo(() => {
    const counts: Record<string, number> = {};
    portfolioLeads.forEach(l => {
      let bVal = (l.budget || 'N/A').toString().trim();
      if (!bVal || bVal === 'null' || bVal === 'undefined') bVal = 'N/A';
      counts[bVal] = (counts[bVal] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); 
  }, [portfolioLeads]);

  // 4. Daily Lead Volume (Last 30 Days)
  const dailyVolumeData = useMemo(() => {
    if (metricsLeads.length === 0) return [];
    
    // Group leads by normalized date string
    const dateCounts = new Map<string, number>();
    metricsLeads.forEach(l => {
      const d = safeParseISO(l.date || l.createdAt);
      if (d) {
        // Normalize to beginning of day for stable mapping
        const key = format(d, 'yyyy-MM-dd');
        dateCounts.set(key, (dateCounts.get(key) || 0) + 1);
      }
    });

    // Generate interval that definitely covers today
    const end = endOfDay(new Date());
    const start = startOfDay(subDays(end, 29));
    const days = eachDayOfInterval({ start, end });

    return days.map(day => {
      const key = format(day, 'yyyy-MM-dd');
      const count = dateCounts.get(key) || 0;
      return {
        date: format(day, 'MMM dd'),
        fullDate: key,
        leads: count
      };
    });
  }, [metricsLeads]);

  // Weekly Lead Volume (Last 12 Weeks)
  const weeklyVolumeData = useMemo(() => {
    if (metricsLeads.length === 0) return [];
    
    const end = endOfDay(new Date());
    const start = startOfDay(subDays(end, 83)); // ~12 weeks
    const weeks = eachWeekOfInterval({ start, end });

    // Group leads into weeks for efficiency
    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart);
      const count = metricsLeads.filter(l => {
        const d = safeParseISO(l.date || l.createdAt);
        return d && isWithinInterval(d, { start: weekStart, end: weekEnd });
      }).length;
      return {
        week: format(weekStart, 'MMM dd'),
        leads: count
      };
    });
  }, [metricsLeads]);

  // 5. Quality Ratio by Week (%)
  const qualityRatioData = useMemo(() => {
    if (portfolioLeads.length === 0) return [];
    
    // Map leads to their parsed dates and sources once
    const processedLeads = portfolioLeads.map(l => ({
      date: safeParseISO(l.date || l.createdAt),
      stage: l.lifecycleStage,
      source: formatSourceName(l.source || l.originationSource || 'Other')
    })).filter(l => l.date !== null);

    const minDate = subDays(new Date(), 60); 
    const maxDate = new Date();
    const weeks = eachWeekOfInterval({ start: minDate, end: maxDate });
    const localSources = Array.from(new Set(processedLeads.map(l => l.source))) as string[];

    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart);
      const interval = { start: weekStart, end: weekEnd };
      
      const weekLeads = processedLeads.filter(l => isWithinInterval(l.date!, interval));
      
      const entry: any = { week: format(weekStart, 'MMM dd') };
      const isQuality = (stage: string) => ['Warm', 'Intent', 'Site Visit', 'Converted', 'CP'].includes(stage);
      
      const qualityLeads = weekLeads.filter(l => isQuality(l.stage));
      entry.ratio = weekLeads.length > 0 ? parseFloat(((qualityLeads.length / weekLeads.length) * 100).toFixed(1)) : 0;
      entry.totalLeads = weekLeads.length;
      entry.qualityLeads = qualityLeads.length;

      localSources.forEach(src => {
        const srcLeads = weekLeads.filter(l => l.source === src);
        const qSrcLeads = srcLeads.filter(l => isQuality(l.stage));
        entry[src] = srcLeads.length > 0 ? parseFloat(((qSrcLeads.length / srcLeads.length) * 100).toFixed(1)) : 0;
        entry[`${src}_quality`] = qSrcLeads.length;
        entry[`${src}_total`] = srcLeads.length;
      });

      return entry;
    });
  }, [portfolioLeads]);

  // 6. Lead Status for Source Matrix
  const sourceStatusData = useMemo(() => {
    // Use all leads (including duplicates) to show full source distribution
    const localSources = Array.from(new Set(leads.map(l => formatSourceName(l.source || l.originationSource || 'Other')))) as string[];
    const statuses: LifecycleStage[] = ['Cold', 'Warm', 'Intent', 'Site Visit', 'Converted', 'CP', 'Closed', 'Duplicate'];
    
    // Create a normalized mapping to handle case-sensitivity from imports
    const normalize = (s: string) => {
      const lower = (s || '').toLowerCase().trim();
      if (lower === 'cold') return 'Cold';
      if (lower === 'warm') return 'Warm';
      if (lower === 'intent') return 'Intent';
      if (lower === 'site visit' || lower === 'sitevisit' || lower === 'sv') return 'Site Visit';
      if (lower === 'converted') return 'Converted';
      if (lower === 'cp' || lower === 'channel partner') return 'CP';
      if (lower === 'closed' || lower === 'dead' || lower === 'junk') return 'Closed';
      if (lower === 'duplicate') return 'Duplicate';
      return s; // Fallback
    };

    return localSources.map(src => {
      const entry: any = { name: src };
      statuses.forEach(status => {
        entry[status] = leads.filter(l => 
          formatSourceName(l.source || l.originationSource || 'Other') === src && 
          normalize(l.lifecycleStage) === status
        ).length;
      });
      return entry;
    });
  }, [leads]);

  // Monthly Lead Inflow
  const monthlyInflowData = useMemo(() => {
    const counts: Record<string, number> = {};
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Initialize all months with 0
    months.forEach(m => counts[m] = 0);

    metricsLeads.forEach(l => {
      let monthLabel = null;
      
      // Try to derive month from date field first if possible for accuracy
      const parsed = safeParseISO(l.date || l.createdAt);
      if (parsed) {
        monthLabel = format(parsed, 'MMMM');
      } else if (l.month) {
        // Fallback to stored month string, ensuring capitalization
        const m = l.month.charAt(0).toUpperCase() + l.month.slice(1).toLowerCase();
        if (months.includes(m)) monthLabel = m;
      }

      if (monthLabel && counts[monthLabel] !== undefined) {
        counts[monthLabel]++;
      }
    });

    return months.map(name => ({ name, leads: counts[name] }))
      .filter(d => d.leads > 0 || (new Date().getMonth() >= months.indexOf(d.name) && months.indexOf(d.name) >= (new Date().getMonth() - 5)));
  }, [metricsLeads]);

  // Associate Performance
  const associatePerformanceData = useMemo(() => {
    return teamMembers.map(u => {
      const uLeads = metricsLeads.filter(l => l.assignedTo === u.id);
      const converted = uLeads.filter(l => l.lifecycleStage === 'Converted').length;
      return {
        name: u.name,
        total: uLeads.length,
        converted,
        ratio: uLeads.length > 0 ? parseFloat(((converted / uLeads.length) * 100).toFixed(1)) : 0
      };
    }).sort((a, b) => b.total - a.total);
  }, [metricsLeads, teamMembers]);

  // 10. Lead Aging Analysis (Average days in current status)
  const agingData = useMemo(() => {
    const stages: LifecycleStage[] = ['Cold', 'Warm', 'Intent', 'Site Visit', 'Converted', 'CP', 'Closed'];
    const now = new Date();
    
    return stages.map(stage => {
      const stageLeads = portfolioLeads.filter(l => l.lifecycleStage === stage);
      if (stageLeads.length === 0) return { name: stage, days: 0 };

      const totalDays = stageLeads.reduce((acc, lead) => {
        const created = safeParseISO(lead.createdAt);
        if (!created) return acc;
        return acc + Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);

      return {
        name: stage,
        days: parseFloat((totalDays / stageLeads.length).toFixed(1)),
        count: stageLeads.length
      };
    });
  }, [portfolioLeads]);

  // 11. Inventory Health Analysis
  const inventoryHealthData = useMemo(() => {
    const projects: Project[] = ['PM UPLANDS', 'PM ELITE', 'THE RISE'];
    return projects.map(p => {
      const projectUnits = inventory.filter(u => u.project === p);
      const sold = projectUnits.filter(u => u.status === 'Sold').length;
      const reserved = projectUnits.filter(u => u.status === 'Reserved').length;
      const total = projectUnits.length;
      return {
        name: p,
        sold,
        reserved,
        available: total - (sold + reserved),
        total,
        ratio: total > 0 ? parseFloat(((sold / total) * 100).toFixed(1)) : 0
      };
    });
  }, [inventory]);

  // 12. Source Conversion Efficiency
  const sourceEfficiencyData = useMemo(() => {
    const localSources = Array.from(new Set(leads.map(l => formatSourceName(l.source || l.originationSource || 'Other')))) as string[];
    return localSources.map(src => {
      const srcLeads = leads.filter(l => formatSourceName(l.source || l.originationSource || 'Other') === src);
      const converted = srcLeads.filter(l => l.lifecycleStage === 'Converted').length;
      return {
        name: src,
        total: srcLeads.length,
        converted,
        rate: srcLeads.length > 0 ? parseFloat(((converted / srcLeads.length) * 100).toFixed(1)) : 0
      };
    }).sort((a, b) => b.rate - a.rate).slice(0, 8);
  }, [leads]);

  // 13. Lead State Funnel
  const funnelData = useMemo(() => {
    const funnelStages: LifecycleStage[] = ['Cold', 'Warm', 'Intent', 'Site Visit', 'Converted'];
    let cumulative = 0;
    return funnelStages.map((stage, i) => {
      const count = portfolioLeads.filter(l => l.lifecycleStage === stage).length;
      // In a real CRM, we'd check if they EVER hit this stage. For now, we use current.
      return {
        name: stage,
        value: count,
        fill: STATUS_COLORS[stage] || COLORS[i % COLORS.length]
      };
    }).sort((a, b) => b.value - a.value);
  }, [portfolioLeads]);

  // 14. Weekly Project Interest
  const weeklyProjectInterest = useMemo(() => {
    const last4Weeks = Array.from({ length: 4 }, (_, i) => {
      const d = subWeeks(new Date(), i);
      return {
        start: startOfWeek(d),
        end: endOfWeek(d),
        label: `Week ${format(d, 'ww')}`
      };
    }).reverse();

    return last4Weeks.map(w => {
      const weekLeads = portfolioLeads.filter(l => {
        const d = safeParseISO(l.createdAt);
        return d && d >= w.start && d <= w.end;
      });
      const entry: any = { name: w.label };
      ['PM UPLANDS', 'PM ELITE', 'THE RISE'].forEach(p => {
        entry[p] = weekLeads.filter(l => l.project === p).length;
      });
      return entry;
    });
  }, [portfolioLeads]);

  // STATS OVERVIEW
  const stats = useMemo(() => {
    const warm = portfolioLeads.filter(l => l.lifecycleStage === 'Warm').length;
    const intentOnly = portfolioLeads.filter(l => l.lifecycleStage === 'Intent').length;
    const cp = portfolioLeads.filter(l => l.lifecycleStage === 'CP').length;
    
    return {
      totalEntries: leads.length,
      uniqueLeads: portfolioLeads.length,
      // Active Intent now includes Warm, Intent, and CP
      intent: warm + intentOnly + cp,
      warmCount: warm,
      intentOnlyCount: intentOnly,
      cpCount: cp,
      siteVisit: portfolioLeads.filter(l => l.lifecycleStage === 'Site Visit').length,
      converted: portfolioLeads.filter(l => l.lifecycleStage === 'Converted').length,
      duplicatesCount: leads.filter(l => l.lifecycleStage === 'Duplicate').length,
      todayCount: dailyVolumeData[dailyVolumeData.length - 1]?.leads || 0
    };
  }, [portfolioLeads, leads, skippedLeads, dailyVolumeData]);

  const handleSendEODReport = async () => {
    setIsSendingReport(true);
    try {
      const stageCounts = {
        cold: leads.filter(l => l.lifecycleStage === 'Cold').length,
        warm: leads.filter(l => l.lifecycleStage === 'Warm').length,
        intent: leads.filter(l => l.lifecycleStage === 'Intent').length,
        siteVisit: leads.filter(l => l.lifecycleStage === 'Site Visit').length,
        converted: leads.filter(l => l.lifecycleStage === 'Converted').length,
        cp: leads.filter(l => l.lifecycleStage === 'CP').length,
        closed: leads.filter(l => l.lifecycleStage === 'Closed').length,
        duplicate: leads.filter(l => l.lifecycleStage === 'Duplicate').length,
      };

      const scheduledVisits = leads
        .filter(l => (l.siteVisits && l.siteVisits.length > 0) || l.lifecycleStage === 'Site Visit')
        .map(l => ({
          name: l.name,
          phone: l.phone,
          project: l.project,
          date: l.siteVisits?.[l.siteVisits.length - 1]?.date || l.preferredSiteVisit || 'TBD',
          comment: l.siteVisits?.[l.siteVisits.length - 1]?.comment || ''
        }))
        .slice(0, 10); // Limit to top 10 recent/relevant ones

      const reportData = {
        totalLeads: stats.totalEntries,
        siteVisits: stats.siteVisit,
        conversions: stats.converted,
        intentLeads: stats.intent,
        stages: stageCounts,
        performance: {
          hotRatio: ((stats.intent / (stats.totalEntries || 1)) * 100).toFixed(1),
          conversionRate: ((stats.converted / (stats.totalEntries || 1)) * 100).toFixed(1),
          activeFollowups: allLeads.filter(l => l.assignedTo === user?.id && l.lifecycleStage !== 'Closed' && l.lifecycleStage !== 'Converted').length
        },
        siteVisitLog: scheduledVisits
      };
      await sendEODReport(reportData);
    } finally {
      setIsSendingReport(false);
    }
  };

  // Custom label renderer to avoid React warnings about internal props
  const renderBarLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    if (!value || value <= 0) return null;
    // Determine contrast color based on background (roughly)
    const isLight = props.fill === '#cbd5e1';
    return (
      <text 
        x={x + width / 2} 
        y={y + height / 2} 
        fill={isLight ? '#475569' : '#fff'} 
        textAnchor="middle" 
        dominantBaseline="middle"
        fontSize={8}
        fontWeight="bold"
      >
        {value}
      </text>
    );
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-accent text-[10px] uppercase tracking-[0.3em] font-black">Performance Intelligence</h3>
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 rounded-full border border-green-500/20">
              <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[8px] font-black uppercase text-green-500 tracking-tighter">Real-time Stream</span>
            </span>
          </div>
          <h1 className="serif text-4xl md:text-5xl lg:text-6xl italic text-[var(--color-text-main)] mt-2">Dashboard</h1>
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center flex-1 max-w-full">
          {user?.role !== 'SalesAssociate' && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <label className="text-[10px] uppercase tracking-widest font-black text-[var(--color-text-dim)]">Member</label>
              <select 
                value={selectedAssociate}
                onChange={e => setSelectedAssociate(e.target.value)}
                className="h-10 bg-[var(--color-bg-main)] border border-[var(--color-border-main)] rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none px-4 focus:border-accent text-[var(--color-text-dim)] appearance-none cursor-pointer"
              >
                <option value="All">All Members</option>
                {teamMembers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          
          <div className="relative flex-1 w-full max-w-full group">
            <div className="flex bg-[var(--color-bg-card)] p-1 rounded-full border border-[var(--color-border-main)]/80 shadow-md overflow-x-auto no-scrollbar scroll-smooth items-center h-[52px]">
              {targetProjects.map((p) => {
                const count = p === 'All' 
                  ? allLeads.filter(l => l.lifecycleStage !== 'Duplicate').length
                  : allLeads.filter(l => l.project === p && l.lifecycleStage !== 'Duplicate').length;

                const isActive = selectedProject === p;

                return (
                  <button
                    key={p}
                    onClick={() => setSelectedProject(p)}
                    className={cn(
                      "group flex items-center gap-2.5 px-5 h-full rounded-full transition-all duration-300 whitespace-nowrap text-[10px] font-black uppercase tracking-widest",
                      isActive 
                        ? "bg-[#C1884A] text-white shadow-xl shadow-[#C1884A]/30 translate-y-[-1px]" 
                        : "text-slate-500 hover:text-accent hover:bg-accent/5"
                    )}
                  >
                    {p}
                    <span className={cn(
                      "flex items-center justify-center min-w-[24px] h-[18px] px-1.5 rounded-full text-[9px] font-black transition-all",
                      isActive 
                        ? "bg-white/20 text-white" 
                        : "bg-[var(--color-bg-main)] text-[var(--color-text-dim)] group-hover:bg-accent/20 group-hover:text-accent"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Custom Horizontal Scroll Indicator */}
            <div className="absolute -bottom-2 left-10 right-10 h-1 bg-slate-200/30 rounded-full overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="h-full bg-accent/40 w-1/3 rounded-full" />
            </div>
          </div>

          <button 
            onClick={() => {
              setSelectedProject('All');
              setSelectedSource('All');
              setSelectedAssociate('All');
            }}
            className="flex-shrink-0 flex items-center gap-2 text-[10px] uppercase font-black text-[var(--color-text-dim)] hover:text-accent transition-colors px-2"
          >
            <RefreshCw className="w-3 h-3" /> Reset
          </button>

          {(user?.role === 'SalesTeamLead' || user?.role === 'SalesAssociate') && (
            <Button
              size="sm"
              onClick={handleSendEODReport}
              disabled={isSendingReport}
              className="group relative overflow-hidden bg-accent text-white hover:bg-amber-600 h-10 px-6 rounded-full uppercase tracking-widest font-black text-[10px] shadow-lg shadow-amber-900/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Activity className={cn("w-3.5 h-3.5 mr-2", isSendingReport && "animate-spin")} />
              {isSendingReport ? 'Sending...' : 'Send EOD Report'}
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
            </Button>
          )}
        </div>
      </header>

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatSummaryCard 
          title={user?.role === 'Associate' ? "Your Leads" : "Total Leads"} 
          value={stats.totalEntries.toString()} 
          icon={Users} 
          sub={`Today: ${stats.todayCount} | All sheet entries`} 
          color="accent" 
        />
        <StatSummaryCard title="Unique Portfolio" value={stats.uniqueLeads.toString()} icon={Target} sub={`${stats.converted} Converted | ${stats.duplicatesCount} Duplicates`} color="blue" />
        <StatSummaryCard 
          title="Active Intent" 
          value={stats.intent.toString()} 
          icon={Activity} 
          sub={`Warm: ${stats.warmCount} | Intent: ${stats.intentOnlyCount} | CP: ${stats.cpCount}`} 
          color="gold" 
        />
        <StatSummaryCard 
          title="Site Visits" 
          value={stats.siteVisit.toString()} 
          icon={MapIcon} 
          sub="confirmed site visits" 
          color="tan" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* SLOT 1: CAMPAIGN & SOURCE PERFORMANCE */}
        <div className="lg:col-span-2">
          <ChartCard 
            title={slot1View === 'campaign' ? "Campaign Performance (Daily Range)" : slot1View === 'matrix' ? "Contact Origination Matrix" : "Member Engagement Matrix"} 
            icon={slot1View === 'campaign' ? Briefcase : slot1View === 'matrix' ? MapIcon : Users}
            currentView={slot1View}
            onViewChange={setSlot1View}
            options={[
              { label: 'Campaign Stats', value: 'campaign' },
              { label: 'Source Matrix', value: 'matrix' },
              { label: 'Team Engagement', value: 'members' }
            ]}
          >
            {slot1View === 'campaign' && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sourcePerformanceData} margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={gridColor} />
                  <XAxis dataKey="displayName" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: any, name: string) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
                  />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 10, paddingBottom: 20 }} />
                  <Bar dataKey="low" name="Min Daily" fill="#94a3b8" barSize={4} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="total" name="Total Leads" fill="#C1884A" barSize={24} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="high" name="Max Daily" fill="#ef4444" barSize={4} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {slot1View === 'matrix' && (
              <div className="space-y-4 mt-4 overflow-y-auto max-h-[280px] pr-2 scrollbar-hide">
                {sourcePerformanceData.length === 0 ? (
                  <div className="text-center py-10 text-[var(--color-text-dim)] italic text-xs">No lead sources mapped yet.</div>
                ) : (
                  sourcePerformanceData.map((src) => (
                    <button 
                      key={src.name} 
                      onClick={() => setSelectedSource(src.name)}
                      className={cn(
                        "w-full flex items-center justify-between p-4 bg-[var(--color-bg-main)] rounded-[1.5rem] border transition-all active:scale-[0.98]",
                        selectedSource === src.name 
                          ? "border-accent shadow-lg shadow-accent/5" 
                          : "border-[var(--color-border-main)] hover:border-accent/40"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center bg-[#F7F2EB] dark:bg-accent/10 rounded-xl">
                          <MapIcon className="w-4 h-4 text-accent" />
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] uppercase font-black text-[var(--color-text-main)] tracking-widest">{src.displayName}</p>
                          <p className="text-[9px] text-[var(--color-text-dim)] font-bold opacity-70">Avg {src.avg} leads/day</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-serif text-accent">{src.total}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {slot1View === 'members' && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={associatePerformanceData} margin={{ right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: chartTextColor }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                   <Tooltip 
                    contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: any, name: string) => [value, name === 'ratio' ? 'Conversion %' : name.charAt(0).toUpperCase() + name.slice(1)]}
                  />
                  <Bar dataKey="total" name="Assigned Leads" fill="#122835" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="converted" name="Success Rate" fill="#C1884A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* SLOT 2: CLASSIFICATION & STATUS */}
        <ChartCard 
          title={slot2View === 'lifecycle' ? "Lifecycle Breakdown" : "Status Distribution"} 
          icon={slot2View === 'lifecycle' ? PieIcon : Activity}
          currentView={slot2View}
          onViewChange={setSlot2View}
          options={[
            { label: 'Lifecycle Matrix', value: 'lifecycle' },
            { label: 'Stage Bar Chart', value: 'bar' }
          ]}
        >
          {slot2View === 'lifecycle' ? (
            <div className="flex h-full items-center relative">
              <div className="flex-1 h-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={pieStatusData} 
                      innerRadius={65} 
                      outerRadius={90} 
                      paddingAngle={5} 
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={1500}
                    >
                      {pieStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <p className="text-2xl font-serif text-accent">{leads.length}</p>
                  <p className="text-[7px] uppercase font-black tracking-widest text-[var(--color-text-dim)]">Total</p>
                </div>
              </div>
              <div className="w-[80px] space-y-1 pr-2">
                {statusData.filter(d => ['Cold', 'Warm', 'Intent', 'Site Visit', 'Converted', 'CP', 'Closed'].includes(d.name)).map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between group cursor-default">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.name] || COLORS[i % COLORS.length] }} />
                      <span className="text-[8px] uppercase font-bold text-[var(--color-text-dim)] truncate max-w-[40px]">{d.name}</span>
                    </div>
                    <span className={cn("text-[9px] font-black", d.value > 0 ? "text-accent" : "text-gray-300 dark:text-gray-700")}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: 'transparent' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                  ))}
                  <LabelList dataKey="value" position="top" style={{ fill: chartTextColor, fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SLOT 3: VOLUME & TRENDS */}
        <ChartCard 
          title={slot3View === 'daily' ? "Daily Lead Volume" : slot3View === 'weekly' ? "Weekly Lead Volume" : "Monthly Lead Inflow"} 
          icon={slot3View === 'daily' ? Calendar : TrendingUp}
          currentView={slot3View}
          onViewChange={setSlot3View}
          options={[
            { label: 'Daily Volume', value: 'daily' },
            { label: 'Weekly Volume', value: 'weekly' },
            { label: 'Monthly Inflow', value: 'monthly' }
          ]}
        >
          {slot3View === 'daily' && (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyVolumeData}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C1884A" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#C1884A" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="leads" stroke="#C1884A" fillOpacity={1} fill="url(#colorLeads)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {slot3View === 'weekly' && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyVolumeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: chartTextColor }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="leads" fill="#122835" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {slot3View === 'monthly' && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyInflowData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="leads" fill="#C1884A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* SLOT 4: INTEREST & BUDGET */}
        <ChartCard 
          title={slot4View === 'property' ? "Property Interest Breakdown" : "Investment Budget Range"} 
          icon={slot4View === 'property' ? Target : TrendingUp}
          currentView={slot4View}
          onViewChange={setSlot4View}
          options={[
            { label: 'Property Types', value: 'property' },
            { label: 'Budget Ranges', value: 'budget' }
          ]}
        >
          {slot4View === 'property' ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={propertyInterestData} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={gridColor} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} width={70} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="#C1884A" barSize={20} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={budgetData} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={gridColor} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} width={70} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="#D19F61" barSize={20} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
        {/* SLOT 5: QUALITY & SOURCE MATRIX */}
        <ChartCard 
          title={slot5View === 'quality' ? "Quality Ratio Trend (%)" : "Lifecycle Matrix by Source"} 
          icon={slot5View === 'quality' ? Activity : TrendingUp}
          currentView={slot5View}
          onViewChange={setSlot5View}
          options={[
            { label: 'Quality Trends', value: 'quality' },
            { label: 'Source Stacks', value: 'stacks' }
          ]}
        >
          {slot5View === 'quality' ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={qualityRatioData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} unit="%" />
                <Tooltip 
                  contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: any, name: string, props: any) => {
                    const entry = props.payload;
                    if (name === "Overall Quality") {
                      return [`${value}% (${entry.qualityLeads}/${entry.totalLeads})`, name];
                    }
                    const quality = entry[`${name}_quality`];
                    const total = entry[`${name}_total`];
                    return [`${value}% ${quality !== undefined ? `(${quality}/${total})` : ''}`, name];
                  }}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 10, paddingBottom: 20 }} />
                <Line type="monotone" name="Overall Quality" dataKey="ratio" stroke="#C1884A" strokeWidth={3} dot={{ r: 4, fill: '#C1884A' }} />
                {(Array.from(new Set(leads.map(l => formatSourceName(l.source || l.originationSource || 'Other')))).filter(s => s !== 'OTHER') as string[]).map((src, i) => (
                  <Line 
                    key={src} 
                    type="monotone" 
                    dataKey={src} 
                    stroke={COLORS[(i + 1) % COLORS.length]} 
                    strokeWidth={2} 
                    strokeDasharray="5 5" 
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sourceStatusData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: 'transparent' }}
                  formatter={(value: any, name: string) => [value, name]}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 10, paddingBottom: 20 }} />
                <Bar dataKey="Cold" stackId="a" fill={STATUS_COLORS['Cold']}>
                  <LabelList dataKey="Cold" content={renderBarLabel} />
                </Bar>
                <Bar dataKey="Warm" stackId="a" fill={STATUS_COLORS['Warm']}>
                  <LabelList dataKey="Warm" content={renderBarLabel} />
                </Bar>
                <Bar dataKey="Intent" stackId="a" fill={STATUS_COLORS['Intent']}>
                  <LabelList dataKey="Intent" content={renderBarLabel} />
                </Bar>
                <Bar dataKey="Site Visit" stackId="a" fill={STATUS_COLORS['Site Visit']}>
                  <LabelList dataKey="Site Visit" content={renderBarLabel} />
                </Bar>
                <Bar dataKey="CP" stackId="a" fill={STATUS_COLORS['CP']}>
                  <LabelList dataKey="CP" content={renderBarLabel} />
                </Bar>
                <Bar dataKey="Converted" stackId="a" fill={STATUS_COLORS['Converted']}>
                  <LabelList dataKey="Converted" content={renderBarLabel} />
                </Bar>
                <Bar dataKey="Closed" stackId="a" fill={STATUS_COLORS['Closed']}>
                  <LabelList dataKey="Closed" content={renderBarLabel} />
                </Bar>
                <Bar dataKey="Duplicate" stackId="a" fill={STATUS_COLORS['Duplicate']} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="Duplicate" content={renderBarLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SLOT 6: AGING & VELOCITY */}
        <ChartCard 
          title={slot6View === 'aging' ? "Lead Aging (Avg Days in Stage)" : "Source Conversion Efficiency (%)"} 
          icon={slot6View === 'aging' ? Activity : TrendingUp}
          currentView={slot6View}
          onViewChange={setSlot6View}
          options={[
            { label: 'Lead Aging', value: 'aging' },
            { label: 'Source Efficiency', value: 'efficiency' }
          ]}
        >
          {slot6View === 'aging' ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agingData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} label={{ value: 'Days', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: chartTextColor } }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: any, name: string) => [value + " Days", "Avg Aging"]}
                />
                <Bar dataKey="days" radius={[4, 4, 0, 0]} barSize={40} fill="#122835">
                  <LabelList dataKey="days" position="top" style={{ fill: chartTextColor, fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sourceEfficiencyData} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={gridColor} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} unit="%" />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: chartTextColor }} width={70} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="rate" fill="#C1884A" barSize={20} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="rate" position="right" style={{ fill: chartTextColor, fontSize: 9, fontWeight: 'bold' }} formatter={(v: number) => v + '%'} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* SLOT 7: INVENTORY HEALTH */}
        <ChartCard 
          title="Inventory Sales Health" 
          icon={PieIcon}
          currentView={slot7View}
          onViewChange={setSlot7View}
          options={[
            { label: 'Sales Progress', value: 'inventory' },
            { label: 'Stock Breakdown', value: 'stock' }
          ]}
        >
          {slot7View === 'inventory' ? (
            <div className="space-y-6 mt-4">
              {inventoryHealthData.map((proj) => (
                <div key={proj.name} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-main)]">{proj.name}</h4>
                      <p className="text-[9px] font-bold text-[var(--color-text-dim)]">{proj.sold} Sold / {proj.total} Total</p>
                    </div>
                    <span className="text-sm font-serif text-accent">{proj.ratio}%</span>
                  </div>
                  <div className="h-2 bg-[var(--color-bg-main)] rounded-full overflow-hidden border border-[var(--color-border-main)]">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${proj.ratio}%` }}
                      className="h-full bg-accent shadow-[0_0_10px_rgba(193,136,74,0.3)]"
                    />
                  </div>
                </div>
              ))}
              <p className="text-[9px] text-[var(--color-text-dim)] pt-4 border-t border-[var(--color-border-main)]/50 italic">
                * Based on current listings in the Inventory Ledger.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={inventoryHealthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: chartTextColor }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12 }} />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 9, paddingBottom: 10 }} />
                <Bar dataKey="sold" name="Sold" stackId="a" fill="#122835" />
                <Bar dataKey="reserved" name="Reserved" stackId="a" fill="#C1884A" />
                <Bar dataKey="available" name="Available" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SLOT 8: FUNNEL & PROJECT GROWTH */}
        <ChartCard 
          title={slot8View === 'funnel' ? "Stage Conversion Funnel" : "Weekly Project Interest"} 
          icon={TrendingUp}
          currentView={slot8View}
          onViewChange={setSlot8View}
          options={[
            { label: 'Conversion Funnel', value: 'funnel' },
            { label: 'Project Growth', value: 'growth' }
          ]}
        >
          {slot8View === 'funnel' ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnelData} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={gridColor} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} width={70} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" barSize={30}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                  <LabelList dataKey="value" position="right" style={{ fill: chartTextColor, fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyProjectInterest}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: chartTextColor }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12 }} />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 8, paddingBottom: 10 }} />
                <Bar dataKey="PM UPLANDS" stackId="a" fill="#122835" />
                <Bar dataKey="PM ELITE" stackId="a" fill="#C1884A" />
                <Bar dataKey="THE RISE" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* SLOT 9: ASSOCIATE EFFICIENCY */}
        <ChartCard 
          title="Associate Efficiency Analysis" 
          icon={Activity}
          currentView={slot9View}
          onViewChange={setSlot9View}
          options={[
            { label: 'Success Rate (%)', value: 'efficiency' },
            { label: 'Lead Volume', value: 'volume' }
          ]}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={associatePerformanceData} layout="vertical" margin={{ left: 80, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={gridColor} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTextColor }} width={70} />
              <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: 8, fontSize: 12 }} />
              <Bar 
                dataKey={slot9View === 'efficiency' ? "ratio" : "total"} 
                fill={slot9View === 'efficiency' ? "#C1884A" : "#122835"} 
                barSize={20} 
                radius={[0, 4, 4, 0]}
              >
                <LabelList 
                  dataKey={slot9View === 'efficiency' ? "ratio" : "total"} 
                  position="right" 
                  style={{ fill: chartTextColor, fontSize: 9, fontWeight: 'bold' }} 
                  formatter={(v: number) => slot9View === 'efficiency' ? `${v}%` : v} 
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function StatSummaryCard({ title, value, sub, icon: Icon, color, onClick, className }: any) {
  const colors: Record<string, string> = {
    accent: "text-[var(--color-accent)] border-t-[var(--color-accent)]",
    blue: "text-[#3b82f6] border-t-[#3b82f6]",
    gold: "text-[#C1884A] border-t-[#C1884A]",
    tan: "text-[#D19F61] border-t-[#D19F61]"
  };

  return (
    <Card 
      onClick={onClick}
      className={cn(
        "p-6 bg-[var(--color-bg-card)] border-[var(--color-border-main)] border-t-[3px] rounded-2xl shadow-xl flex flex-col justify-between hover:translate-y-[-2px] transition-all", 
        colors[color],
        className
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-[10px] uppercase font-black tracking-widest text-[var(--color-text-dim)]">{title}</h3>
        <Icon className="w-4 h-4 opacity-30" />
      </div>
      <div>
        <div className="text-4xl font-serif text-[var(--color-text-main)] mb-1">{value}</div>
        <div className="text-[10px] text-[var(--color-text-dim)] font-bold uppercase tracking-tight">{sub}</div>
      </div>
    </Card>
  );
}

function ChartCard({ title, icon: Icon, children, options, currentView, onViewChange }: any) {
  return (
    <Card className="p-4 md:p-8 bg-[var(--color-bg-card)] border-[var(--color-border-main)] rounded-2xl shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-[10px] uppercase font-black tracking-[0.2em] text-[var(--color-text-dim)] flex items-center gap-3">
          <Icon className="w-3 h-3 text-accent" />
          {title}
        </h3>
        {options && (
          <select 
            value={currentView}
            onChange={(e) => onViewChange(e.target.value)}
            className="bg-transparent text-[10px] font-black uppercase text-accent border-none outline-none cursor-pointer focus:ring-0 appearance-none text-right"
          >
            {options.map((opt: any) => (
              <option key={opt.value} value={opt.value} className="bg-[var(--color-bg-card)] text-[var(--color-text-main)]">
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {!options && <ChevronRight className="w-3 h-3 text-[var(--color-text-dim)]" />}
      </div>
      <div className="flex-1 min-h-[300px]">
        {children}
      </div>
    </Card>
  );
}
