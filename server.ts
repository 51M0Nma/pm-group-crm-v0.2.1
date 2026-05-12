import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import Papa from 'papaparse';
import { format, parseISO, isValid } from 'date-fns';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { 
  getFirestore,
  initializeFirestore, 
  memoryLocalCache,
  collection, 
  doc, 
  writeBatch, 
  getDocs, 
  query, 
  limit,
  getDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import fs from 'fs';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy load Firebase Config helper
function getFirebaseConfig() {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('firebase-applet-config.json not found. Please run the Firebase setup tool.');
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

let db: any = null;
let dbId: string = '(default)';

function initFirebase() {
  if (db) return { db, dbId };
  
  try {
    const firebaseConfig = getFirebaseConfig();
    console.log(`Initializing Firebase for Project: ${firebaseConfig.projectId}`);
    
    const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    
    // Using initializeFirestore with standard settings to avoid BloomFilter errors
    // Adding experimentalAutoDetectLongPolling for better retry logic in restricted environments
    db = initializeFirestore(firebaseApp, {
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true
    }, dbId);
    
    console.log(`Firestore initialized with Database ID: ${dbId}`);
    return { db, dbId };
  } catch (err: any) {
    console.error('Failed to initialize Firebase:', err);
    throw err;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Global Exception Handling
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err);
  });

  // API Routes
  let isSyncing = false;
  let lastSyncResult: any = null;
  const SYNC_COOLDOWN = 60000; // 1 minute cooldown
  let lastSyncEndTime = 0;

  const OperationType = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LIST: 'list',
    GET: 'get',
    WRITE: 'write',
  } as const;

  type OperationType = typeof OperationType[keyof typeof OperationType];

  function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType,
      path,
      authInfo: {
        isServer: true
      }
    };
    const jsonError = JSON.stringify(errInfo);
    console.error('Firestore Error (Server): ', jsonError);
    throw new Error(jsonError);
  }

  const normalizePhone = (input: any): string => {
    if (!input) return '';
    let clean = input.toString().replace(/\D/g, '');
    if (clean.length === 11 && clean.startsWith('0')) clean = clean.substring(1);
    if (clean.length === 12 && clean.startsWith('91')) clean = clean.substring(2);
    if (clean.length > 10) clean = clean.slice(-10);
    return clean;
  };

  const getPriority = (stage: string) => {
    const s = (stage || 'Cold').toLowerCase();
    if (s.includes('booked')) return 10;
    if (s.includes('visited') || s.includes('visit done')) return 9;
    if (s.includes('replied')) return 8;
    if (s.includes('active')) return 7;
    if (s.includes('prospect')) return 6;
    if (s.includes('nurture')) return 5;
    if (s.includes('suspect')) return 4;
    if (s.includes('cold')) return 3;
    if (s.includes('not interested') || s.includes('lost') || s.includes('dead')) return 1;
    return 2;
  };

  const normalizeDate = (d: string) => {
    if (!d) return new Date().toISOString().split('T')[0];
    const strVal = d.trim();
    if (strVal.match(/^\d{4}-\d{2}-\d{2}/)) return strVal.split('T')[0];
    const dmyMatch = strVal.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
    if (dmyMatch) {
      return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
    }
    const parsed = new Date(strVal);
    return isNaN(parsed.getTime()) ? new Date().toISOString().split('T')[0] : parsed.toISOString().split('T')[0];
  };

  const normalizeLifecycleStage = (s: string): string => {
    const normalized = (s || 'Cold').trim().toLowerCase();
    if (normalized.includes('site visit')) return 'Site Visit';
    if (normalized.includes('converted')) return 'Converted';
    if (normalized.includes('intent')) return 'Intent';
    if (normalized.includes('warm')) return 'Warm';
    if (normalized.includes('cold')) return 'Cold';
    if (normalized.includes('duplicate')) return 'Duplicate';
    if (normalized.includes('cp') || normalized.includes('broker')) return 'CP';
    if (normalized.includes('closed') || normalized.includes('junk') || normalized.includes('dead') || normalized.includes('lost')) return 'Closed';
    
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  async function performSync(requestId: string = 'manual', dryRun: boolean = false) {
    if (isSyncing && !dryRun) {
      console.log(`[Sync][${requestId}] Blocked: already in progress.`);
      return { success: true, skipped: true, reason: 'Sync already in progress' };
    }
    
    const now = Date.now();
    if (!dryRun && now - lastSyncEndTime < SYNC_COOLDOWN) {
      console.log(`[Sync][${requestId}] Blocked: cooldown active.`);
      return { success: true, skipped: true, reason: 'Cooldown active' };
    }

    if (!dryRun) isSyncing = true;
    console.log(`[Sync][${requestId}] Cycle started (dryRun: ${dryRun})...`);
    const startTime = Date.now();

    try {
      const { db } = initFirebase();

      // Fetch dynamic sheet configurations
      const sheetConfigsSn = await getDocs(collection(db, 'sheetConfigs'));
      let configs: any[] = sheetConfigsSn.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // If no configs found, fallback to the original hardcoded master sheet for safety
      if (configs.length === 0) {
        console.log(`[Sync][${requestId}] No configurations found. Using legacy master fallback.`);
        configs = [{
          id: 'legacy-fallback',
          url: 'https://docs.google.com/spreadsheets/d/1KWl7c6MHYhk1Mm2kw36SvgdjLMVk6Fhz-y349rs5grg/export?format=csv&gid=0',
          name: 'PM PLOT CAMAIGN',
          isActive: true,
          sheetIndex: 1
        }];
      }

      const activeConfigs = configs.filter((c: any) => c.isActive);
      const syncedSheetNames = activeConfigs.map((c: any) => c.name);
      console.log(`[Sync][${requestId}] Found ${activeConfigs.length} active configurations: ${syncedSheetNames.join(', ')}`);

      const aggregatedLeads = new Map<string, any>();
      const skippedToSave: any[] = [];
      let skippedNoId = 0;

      for (const config of activeConfigs as any[]) {
        try {
          let sheetUrl = config.url;
          // Transform URL if it's a standard edit link
          if (sheetUrl.includes('/edit')) {
            const idMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            const spreadsheetId = idMatch ? idMatch[1] : null;
            if (spreadsheetId) {
              const gidMatch = sheetUrl.match(/[#&]gid=([0-9]+)/);
              const gid = gidMatch ? gidMatch[1] : '0';
              sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
            }
          }

          console.log(`[Sync][${requestId}] Fetching data from: ${config.name} (${sheetUrl})`);
          const response = await axios.get(sheetUrl, { timeout: 45000 });
          const results = Papa.parse(response.data, { header: true, skipEmptyLines: true });
          console.log(`[Sync][${requestId}] [${config.name}] Parsed ${results.data.length} rows.`);

          for (let i = 0; i < results.data.length; i++) {
            const row = results.data[i] as any;
            const rowKeys = Object.keys(row);

            const findHeader = (candidates: string[]) => {
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

            const getMappedVal = (candidates: string[]) => {
              const key = findHeader(candidates);
              const val = key && row[key] != null ? row[key] : '';
              return val.toString().trim();
            };
            
            // Map headers - matching user requested headers precisely
            const rawName = getMappedVal(['name', 'Name', 'fullName', 'Full Name', 'CLIENT NAME', 'Customer Name']);
            const name = rawName.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
            const rawPhone = getMappedVal(['contact', 'Phone', 'Ph no', 'mobile', 'WhatsApp', 'phone_no', 'Phone No.', 'CONTACT NUMBER', 'Phone Number', 'Mobile No.', 'Mobile Number', 'Contact Number', 'Contact No.', 'TEL', 'Number']);
            const phone = normalizePhone(rawPhone);
            if (rawPhone && !phone) {
              console.log(`[Sync] [${config.name}] Row ${i+2}: Raw phone "${rawPhone}" normalized to empty string.`);
            }
            const email = getMappedVal(['email', 'Email', 'Email Address', 'mail', 'Email ID']).toLowerCase();
            const leadId = getMappedVal(['Lead id', 'Lead ID', 'sr_no', 'LeadID']);
            let originationSource = getMappedVal(['Origination Source', 'Source', 'Lead Source', 'Platform', 'Origination']);
            
            let targetProjects = getMappedVal(['Target Project(s)', 'Target Project', 'Project', 'Interested Project', 'LOCATION']);
            // Infer project from Page URL for Website leads if project is missing
            const pageUrl = getMappedVal(['Page URL', 'URL', 'Source URL', 'page_url', 'Source Page', 'link']);
            if (!targetProjects && pageUrl) {
              const urlLower = pageUrl.toLowerCase();
              if (urlLower.includes('upland')) targetProjects = 'PM UPLANDS';
              else if (urlLower.includes('elite')) targetProjects = 'PM ELITE';
              else if (urlLower.includes('rise')) targetProjects = 'THE RISE';
              else if (urlLower.includes('broker') || urlLower.includes('partner')) targetProjects = 'PM GROUP';
            }

            let lifecycleStage = normalizeLifecycleStage(getMappedVal(['Lifecycle Stage', 'STATUS', 'Status', 'Stage', 'Lead Status']));
            const assetAssignment = getMappedVal(['Asset Assignment', 'Assigned To', 'Owner']);
            const propertyType = getMappedVal(['Interested Property Type(s)', 'Property Type', 'Property focus', 'Configuration', 'CONFIGURATION']);
            const budget = getMappedVal(['What is your preffered investment budget?', 'Budget Range', 'INVESTMENT BUDGET', 'budget']);
            const siteVisit = getMappedVal(['When would you like to schedule a site visit?', 'Preferred Site Visit', 'Site Visit Date', 'VISIT']);
            const plotSize = getMappedVal(['Which plot size are you interested in?', 'Plot Size', 'Plot Area', 'Dimension']);
            const walkinSource = getMappedVal(['Source of Walkin (If Walk-in)', 'Walk-in Source', 'Walkin Source', 'SOURCE OF WALKIN']);
            const employmentType = getMappedVal(['Employment Type', 'BUSINESS/SALARIED', 'Business/Salaried', 'Occupation Type']);
            const occupation = getMappedVal(['Occupation', 'Profession', 'Designation']);
            const activityJournal = getMappedVal(['message', 'Activity Journal', 'REMARK', 'Remarks', 'Status Line', 'Comments', 'Remark', 'note']);
            const rowDate = normalizeDate(getMappedVal(['Submission Date', 'Date', 'DATE', 'Entry Date', 'Timestamp', 'Created At']));
            
            // Special handling for Website Source & CP leads
            const rowValues = Object.values(row).map(v => (v || '').toString().toLowerCase());
            const hasBrokerKeyword = rowValues.some(v => v.includes('broker') || v.includes('cp registration') || v.includes('channel partner') || v.includes('partner registration'));
            const isBrokerUrl = pageUrl.toLowerCase().includes('broker') || pageUrl.toLowerCase().includes('partner');

            if (hasBrokerKeyword || isBrokerUrl) {
              lifecycleStage = 'CP';
            }

            const sheetNameLower = config.name.toLowerCase();
            if (!originationSource) {
              if (sheetNameLower.includes('website') || sheetNameLower.includes('form') || sheetNameLower.includes('online')) {
                originationSource = 'Website';
              } else {
                originationSource = config.name;
              }
            }
            
            if (!phone && !email) { 
              skippedNoId++; 
              skippedToSave.push({
                row: i + 2,
                reason: 'Missing ID',
                info: `${name || 'Unnamed'} - No contact info`,
                source: config.name,
                timestamp: new Date().toISOString()
              });
              continue; 
            }

            // Keyword filter: check everywhere in the row for 'test' or 'h&h'
            const isTestLead = rowValues.some(v => v.includes('test'));
            const isHHLead = rowValues.some(v => v.includes('h&h'));

            if (isTestLead || isHHLead) {
              skippedToSave.push({
                row: i + 2,
                reason: isTestLead ? 'Test Lead Filter' : 'H&H Filter',
                info: `${name} - ${phone || email}`,
                source: config.name,
                timestamp: new Date().toISOString()
              });
              continue;
            }

            const rawProj = (targetProjects || 'PM UPLANDS').toUpperCase();
            const projectParts = rawProj.split('/').map(p => p.trim()).filter(Boolean);

            for (const p of projectParts) {
              let normalizedProj = 'PM UPLANDS';
              const up = p.toUpperCase();
              if (up.includes('VILLA') || up.includes('UPLAND')) normalizedProj = 'PM UPLANDS';
              else if (up.includes('ELITE')) normalizedProj = 'PM ELITE';
              else if (up.includes('RISE')) normalizedProj = 'THE RISE';
              else normalizedProj = p; 

              // Deduplication finalized by Phone No. (Project is secondary/informational)
              const key = phone ? phone : `${email}_${normalizedProj}`;
              const existingAgg = aggregatedLeads.get(key);
              
              if (existingAgg) {
                // Merge logic for duplicate within same sync session
                // Keep the one with better status or more info
                if (getPriority(lifecycleStage) > getPriority(existingAgg.lifecycleStage)) {
                  existingAgg.lifecycleStage = lifecycleStage;
                }
                if (activityJournal && !existingAgg.rowRemarks.includes(activityJournal)) {
                  existingAgg.rowRemarks += ` | ${activityJournal}`;
                }
                // Update other fields if missing in existingAgg
                const fieldsToMerge = ['budget', 'plotSize', 'preferredSiteVisit', 'assignedTo', 'occupation', 'employmentType'];
                fieldsToMerge.forEach(f => {
                  if (!existingAgg[f] && (aggregatedLeads.get(key) as any)[f]) {
                    existingAgg[f] = (aggregatedLeads.get(key) as any)[f];
                  }
                });
                
                skippedToSave.push({
                  row: i + 2,
                  reason: 'Duplicate in Sync Cycle (Merged)',
                  info: `${name} - ${phone || email} (Proj: ${normalizedProj})`,
                  source: config.name,
                  timestamp: new Date().toISOString()
                });
              } else {
                aggregatedLeads.set(key, { 
                  name, 
                  phone, 
                  email, 
                  project: normalizedProj, 
                  rowRemarks: activityJournal,
                  leadId: leadId,
                  source: originationSource || config.name,
                  originationSource: originationSource || config.name,
                  lifecycleStage: lifecycleStage || 'Cold',
                  assignedTo: assetAssignment,
                  propertyType: propertyType,
                  budget: budget,
                  preferredSiteVisit: siteVisit,
                  plotSize: plotSize,
                  walkinSource: walkinSource,
                  employmentType: employmentType,
                  occupation: occupation,
                  date: rowDate,
                  rowNumber: i + 2,
                  syncSource: config.name
                });
              }
            }
          }
        } catch (confError: any) {
          console.error(`[Sync][${requestId}] Error processing config "${config.name}":`, confError.message);
        }
      }

      console.log(`[Sync][${requestId}] Deduplicated to ${aggregatedLeads.size} unique entries.`);

      const existingSnapshot = await getDocs(collection(db, 'leads'));
      const crmPhoneMap = new Map();
      const crmEmailMap = new Map();

      existingSnapshot.docs.forEach(d => {
        const data = d.data();
        const p = normalizePhone(data.phone);
        const e = (data.email || '').toLowerCase().trim();
        const pr = (data.project || '').toUpperCase().trim();
        const docInfo = { id: d.id, ...data };

        // Prioritize phone for global deduplication
        if (p) {
          if (!crmPhoneMap.has(p)) crmPhoneMap.set(p, docInfo);
        } else if (e && pr) {
          crmEmailMap.set(`${e}_${pr}`, docInfo);
        }
      });

      const toImport: any[] = [];
      const toUpdate: any[] = [];

      for (const agg of aggregatedLeads.values()) {
        const pKey = agg.phone ? agg.phone : null;
        const eKey = agg.email ? `${agg.email.toLowerCase()}_${agg.project.toUpperCase()}` : null;
        
        const existing = (pKey ? crmPhoneMap.get(pKey) : null) || (eKey ? crmEmailMap.get(eKey) : null);

        if (existing) {
          // Record as skipped for information, but we might still update it
          if (!dryRun) {
            skippedToSave.push({
              row: agg.rowNumber || 'Aggregated',
              reason: 'Already in CRM (Updating Fields)',
              info: `${agg.name} - ${agg.phone || agg.email} (Proj: ${agg.project})`,
              source: 'Master Sync',
              timestamp: new Date().toISOString()
            });
          }

          // Check for field updates
          const updates: any = {};
          const fieldsToSync = [
            'phone', 'email', 'lifecycleStage', 'budget', 'propertyType', 'plotSize', 
            'preferredSiteVisit', 'walkinSource', 'employmentType', 
            'occupation', 'name', 'assignedTo', 'leadId'
          ];

          fieldsToSync.forEach(field => {
            // Check if this field is manually locked in the CRM
            const isLocked = (existing.manuallyEditedFields || []).includes(field);
            
            if (!isLocked && agg[field] && agg[field] !== existing[field]) {
              // If it's lifecycleStage, only update if it's a higher priority
              if (field === 'lifecycleStage') {
                if (getPriority(agg[field]) > getPriority(existing[field])) {
                  updates[field] = agg[field];
                }
              } else {
                updates[field] = agg[field];
              }
            }
          });

          const hasNewRemark = agg.rowRemarks && !(existing.remarks || []).some((r: any) => r.text.toLowerCase() === agg.rowRemarks.toLowerCase());

          if (Object.keys(updates).length > 0 || hasNewRemark) {
            toUpdate.push({
              id: existing.id,
              existingData: existing,
              updates: updates,
              remark: hasNewRemark ? agg.rowRemarks : null,
              newData: { ...agg, newRemark: hasNewRemark ? agg.rowRemarks : null },
              changes: {
                  lifecycleStage: updates.lifecycleStage ? { from: existing.lifecycleStage, to: updates.lifecycleStage } : null,
                  remark: hasNewRemark ? agg.rowRemarks : null,
                  other: Object.keys(updates).some(k => k !== 'lifecycleStage')
              }
            });
          }
        } else {
          toImport.push(agg);
        }
      }

      if (dryRun) {
        return {
          success: true,
          preview: true,
          leads: toImport,
          updates: toUpdate,
          skippedCount: skippedToSave.length,
          skippedNoId,
          syncedSheets: syncedSheetNames,
          timestamp: new Date().toISOString()
        };
      }

      console.log(`[Sync][${requestId}] Results: Import=${toImport.length}, Update=${toUpdate.length}, Skipped=${skippedToSave.length}`);

      const CHUNK = 400;
      
      // Save Skipped Leads to audit log
      if (skippedToSave.length > 0) {
        for (let i = 0; i < skippedToSave.length; i += CHUNK) {
          const batch = writeBatch(db);
          skippedToSave.slice(i, i + CHUNK).forEach(s => {
            const ref = doc(collection(db, 'skipped_leads'));
            batch.set(ref, { ...s, id: ref.id });
          });
          await batch.commit();
        }
      }

      for (let i = 0; i < toImport.length; i += CHUNK) {
        const batch = writeBatch(db);
          toImport.slice(i, i + CHUNK).forEach(l => {
            const ref = doc(collection(db, 'leads'));
            const { rowRemarks, ...leadData } = l;
            
            batch.set(ref, {
              ...leadData,
              id: ref.id,
              lifecycleStage: leadData.lifecycleStage || 'Cold',
              source: leadData.originationSource || 'Master Sync',
              leadId: leadData.leadId || `LID-${Math.floor(100000 + Math.random() * 900000)}`,
              remarks: rowRemarks ? [{
                id: Math.random().toString(36).substr(2, 9),
                text: rowRemarks,
                createdAt: new Date().toISOString(),
                createdBy: 'System Sync'
              }] : [],
              createdAt: leadData.date ? `${leadData.date}T00:00:00.000Z` : new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              month: leadData.date ? format(parseISO(leadData.date), 'MMMM') : format(new Date(), 'MMMM'),
              date: leadData.date || format(new Date(), 'yyyy-MM-dd')
            });
          });
        await batch.commit();
      }

      for (let i = 0; i < toUpdate.length; i += CHUNK) {
        const batch = writeBatch(db);
        toUpdate.slice(i, i + CHUNK).forEach(u => {
          const updateData: any = {
            ...u.updates,
            updatedAt: new Date().toISOString()
          };
          
          if (u.remark) {
            updateData.remarks = [
              ...(u.existingRemarks || []),
              {
                id: Math.random().toString(36).substr(2, 9),
                text: u.remark,
                createdAt: new Date().toISOString(),
                createdBy: 'System Sync (Update)'
              }
            ];
          }

          batch.update(doc(db, 'leads', u.id), updateData);
        });
        await batch.commit();
      }

      const resObj = { 
        success: true, 
        count: toImport.length + toUpdate.length, 
        new: toImport.length, 
        updated: toUpdate.length,
        skipped: skippedToSave.length,
        skippedNoId,
        syncedSheets: syncedSheetNames,
        timestamp: new Date().toISOString()
      };
      
      lastSyncResult = resObj;
      
      try {
        const logRef = doc(collection(db, 'sync_logs'));
        await setDoc(logRef, { ...resObj, status: 'Success', duration: ((Date.now() - startTime) / 1000).toFixed(1) });
      } catch (e) {}

      return resObj;
    } catch (error: any) {
      console.error(`[Sync][${requestId}] Fatal:`, error.message);
      throw error;
    } finally {
      if (!dryRun) {
        isSyncing = false;
        lastSyncEndTime = Date.now();
      }
    }
  }

  app.post('/api/sync-sheets', async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    const preview = req.query.preview === 'true';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[API] POST /api/sync-sheets | ID: ${requestId} | IP: ${ip} | Preview: ${preview}`);
    
    try {
      const result = await performSync(requestId, preview);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/sheets/preview', async (req, res) => {
    const { url, name, sheetIndex } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL required' });

    try {
      console.log(`[Preview] Fetching sheet: ${name} (${url})`);
      
      // Transform URL if needed
      let exportUrl = url;
      const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      const spreadsheetId = idMatch ? idMatch[1] : null;
      if (spreadsheetId) {
        const gidMatch = url.match(/[#&]gid=([0-9]+)/);
        const gid = gidMatch ? gidMatch[1] : '0';
        exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
      }

      const response = await axios.get(exportUrl, { timeout: 30000 });
      const results = Papa.parse(response.data, { header: true, skipEmptyLines: true });
      
      const { db } = initFirebase();
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const teamLead = usersSnapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find((u: any) => u.role === 'SalesTeamLead');

      const existingLeadsSnapshot = await getDocs(collection(db, 'leads'));
      const crmPhoneMap = new Map();
      const crmEmailMap = new Map();

      existingLeadsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const p = normalizePhone(data.phone);
        const e = (data.email || '').toLowerCase().trim();
        const pr = (data.project || '').toUpperCase().trim();
        const docInfo = { id: doc.id, ...data };

        if (p) {
          if (!crmPhoneMap.has(p)) crmPhoneMap.set(p, docInfo);
        } else if (e && pr) {
          crmEmailMap.set(`${e}_${pr}`, docInfo);
        }
      });

      const previewLeadsMap = new Map<string, any>();
      const skipped: any[] = [];
      const mappings = req.body.mappings || {};

      results.data.forEach((row: any, index: number) => {
        const findHeader = (candidates: string[]) => {
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

        const findValue = (crmField: string, candidates: string[]) => {
          const normalizedField = crmField === 'status' ? 'lifecycleStage' : crmField;
          const mappedKey = mappings[normalizedField] || mappings[crmField];
          if (mappedKey && row[mappedKey] !== undefined) return row[mappedKey];
          return findHeader(candidates) ? row[findHeader(candidates)!] : null;
        };

        const nameVal = (findValue('name', ['Full Name', 'CLIENT NAME', 'Customer Name', 'name', 'customer', 'client']) || '').toString().trim();
        const phoneVal = (findValue('phone', ['contact', 'Phone', 'Ph no', 'mobile', 'WhatsApp', 'phone_no', 'Phone No.', 'CONTACT NUMBER', 'Phone Number', 'Mobile No.', 'Mobile Number', 'Contact Number', 'Contact No.', 'TEL', 'Number']) || '').toString();
        const cleanPhone = normalizePhone(phoneVal);
        const emailVal = (findValue('email', ['Email', 'Email Address', 'mail', 'Email ID']) || '').toString().trim().toLowerCase();

        const rowValues = Object.values(row).map(v => (v || '').toString().toLowerCase());
        const isTestLead = rowValues.some(v => v.includes('test'));
        const isHHLead = rowValues.some(v => v.includes('h&h'));

        if (isTestLead || isHHLead) {
          skipped.push({ 
            row: index + 2, 
            name: nameVal || 'Unnamed', 
            reason: isTestLead ? 'Test Lead Filter' : 'H&H Filter',
            info: `${nameVal || 'Unnamed'} - ${phoneVal || 'No Contact'}`,
            source: name || 'Sheet Sync',
            timestamp: new Date().toISOString()
          });
          return;
        }

        if (!nameVal || (!cleanPhone && !emailVal)) {
          skipped.push({ 
            row: index + 2, 
            name: nameVal || 'Unnamed', 
            reason: 'Missing Identity',
            info: `${nameVal || 'Unnamed'} - ${phoneVal || 'No Contact'}`,
            source: name || 'Sheet Sync',
            timestamp: new Date().toISOString()
          });
          return;
        }

        const rawProject = (findValue('project', ['Target Project(s)', 'Target Project', 'Project focus', 'Project', 'campaign', 'Product', 'LOCATION']) || '').toString().trim();
        const initialRemark = (findValue('remarks', ['Activity Journal', 'REMARK', 'Remarks', 'Comments', 'note']) || '').toString().trim();
        const rawDate = (findValue('date', ['Date', 'DATE', 'Timestamp', 'Created At']) || '').toString().trim();
        
        const normalizeDatePreview = (d: string) => {
          if (!d) return new Date().toISOString().split('T')[0];
          const strVal = d.trim();
          if (strVal.match(/^\d{4}-\d{2}-\d{2}T/)) return strVal.split('T')[0];
          if (strVal.match(/^\d{4}-\d{2}-\d{2}$/)) return strVal;
          if (strVal.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/)) {
            const parts = strVal.split(/[/\-]/);
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
          const parsed = new Date(strVal);
          return isNaN(parsed.getTime()) ? new Date().toISOString().split('T')[0] : parsed.toISOString().split('T')[0];
        };

        const sheetLifecycleStage = normalizeLifecycleStage(findValue('lifecycleStage', ['Lifecycle Stage', 'STATUS', 'Status', 'stage', 'Lead Status']));
        
        // Project Normalization matching performSync
        const rawProj = (rawProject || 'PM UPLANDS').toUpperCase();
        const projectParts = rawProj.split('/').map(p => p.trim()).filter(Boolean);
        const finalProject = projectParts.length > 0 ? projectParts[0] : 'PM UPLANDS';
        let normalizedProj = 'PM UPLANDS';
        if (finalProject.includes('VILLA') || finalProject.includes('UPLAND')) normalizedProj = 'PM UPLANDS';
        else if (finalProject.includes('ELITE')) normalizedProj = 'PM ELITE';
        else if (finalProject.includes('RISE')) normalizedProj = 'THE RISE';
        else normalizedProj = finalProject;

        const leadData = {
          name: nameVal,
          phone: cleanPhone,
          email: emailVal,
          leadId: findValue('leadId', ['Lead id', 'Lead ID', 'sr_no']) || '',
          project: normalizedProj,
          lifecycleStage: sheetLifecycleStage,
          budget: findValue('budget', ['What is your preffered investment budget?', 'BUDGET', 'Investment Budget', 'budget']) || '',
          walkinSource: findValue('walkinSource', ['Source of Walkin (If Walk-in)', 'SOURCE OF WALKIN', 'walkin_source']) || '',
          employmentType: findValue('employmentType', ['Employment Type', 'BUSINESS/SALARIED', 'employment_type']) || '',
          occupation: findValue('occupation', ['OCCUPATION', 'profession', 'Occupation']) || '',
          propertyType: findValue('propertyType', ['Interested Property Type(s)', 'CONFIGURATION', 'Property Type']) || '',
          preferredSiteVisit: findValue('preferredSiteVisit', ['When would you like to schedule a site visit?', 'VISIT', 'Preferred Site Visit', 'visit_date']) || '',
          plotSize: findValue('plotSize', ['Which plot size are you interested in?', 'Plot Size', 'Plot Area', 'Dimension']) || '',
          source: findValue('originationSource', ['Origination Source', 'Source', 'Lead Source']) || name || 'Sheet Sync',
          originationSource: findValue('originationSource', ['Origination Source', 'Source', 'Lead Source']) || name || 'Sheet Sync',
          assignedTo: findValue('assetAssignment', ['Asset Assignment', 'Assigned To', 'Owner']) || (teamLead ? teamLead.id : ''),
          date: normalizeDatePreview(rawDate),
          initialRemark,
          rowNumber: index + 2
        };

        const dedupKey = cleanPhone ? cleanPhone : `${emailVal}_${normalizedProj.toUpperCase()}`;
        const existingAgg = previewLeadsMap.get(dedupKey);
        if (existingAgg) {
          if (getPriority(leadData.lifecycleStage) > getPriority(existingAgg.lifecycleStage)) {
            existingAgg.lifecycleStage = leadData.lifecycleStage;
          }
          if (initialRemark && !existingAgg.initialRemark.includes(initialRemark)) {
            existingAgg.initialRemark += ` | ${initialRemark}`;
          }
        } else {
          previewLeadsMap.set(dedupKey, leadData);
        }
      });

      const leads: any[] = [];
      const updates: any[] = [];

      for (const leadData of previewLeadsMap.values()) {
        const pKey = leadData.phone ? leadData.phone : null;
        const eKey = leadData.email ? `${leadData.email.toLowerCase()}_${leadData.project.toUpperCase()}` : null;
        const existing = (pKey ? crmPhoneMap.get(pKey) : null) || (eKey ? crmEmailMap.get(eKey) : null);

        if (existing) {
          const hasBetterStatus = getPriority(leadData.lifecycleStage) > getPriority(existing.lifecycleStage);
          const hasNewRemark = leadData.initialRemark && !(existing.remarks || []).some((r: any) => r.text.toLowerCase() === leadData.initialRemark.toLowerCase());
          
          // Check for other field changes like performSync
          const fieldsToSync = [
            'budget', 'propertyType', 'plotSize', 
            'preferredSiteVisit', 'walkinSource', 'employmentType', 
            'occupation', 'name', 'email', 'assignedTo', 'leadId'
          ];
          let hasOtherChanges = false;
          const updatesObj: any = {};
          fieldsToSync.forEach(field => {
            if (leadData[field] && leadData[field] !== existing[field]) {
              hasOtherChanges = true;
              updatesObj[field] = leadData[field];
            }
          });

          if (hasBetterStatus || hasNewRemark || hasOtherChanges) {
            updates.push({
              id: existing.id,
              existingData: existing,
              newData: { ...leadData, newRemark: leadData.initialRemark },
              updates: updatesObj,
              changes: {
                lifecycleStage: hasBetterStatus ? { from: existing.lifecycleStage, to: leadData.lifecycleStage } : null,
                remark: hasNewRemark ? leadData.initialRemark : null,
                other: hasOtherChanges
              }
            });
          } else {
            skipped.push({ 
              row: leadData.rowNumber || 'N/A',
              name: leadData.name, 
              reason: 'Already in CRM', 
              info: `${leadData.name} - ${leadData.phone || leadData.email} (Already in CRM)`,
              source: name || 'Sheet Sync',
              timestamp: new Date().toISOString(),
              note: 'No status upgrade or new remark' 
            });
          }
        } else {
          leads.push({
            ...leadData,
            remarks: leadData.initialRemark ? [{
              id: Math.random().toString(36).substr(2, 9),
              text: leadData.initialRemark,
              createdAt: new Date().toISOString(),
              createdBy: 'System Sync'
            }] : []
          });
        }
      }

      res.json({ success: true, leads, updates, skippedCount: skipped.length, skipped });
    } catch (error: any) {
      console.error('Preview Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/sheets/headers', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL required' });

    try {
      let exportUrl = url;
      const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      const spreadsheetId = idMatch ? idMatch[1] : null;
      if (spreadsheetId) {
        const gidMatch = url.match(/[#&]gid=([0-9]+)/);
        const gid = gidMatch ? gidMatch[1] : '0';
        exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
      }

      const response = await axios.get(exportUrl, { timeout: 15000 });
      const results = Papa.parse(response.data, { header: false, preview: 1 });
      
      if (results.data && results.data[0]) {
        res.json({ success: true, headers: results.data[0] });
      } else {
        res.status(400).json({ success: false, error: 'Could not read headers' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/leads/bulk-import', async (req, res) => {
    const { leads = [], updates = [] } = req.body;
    if (leads.length === 0 && updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No data provided' });
    }

    try {
      const { db } = initFirebase();
      
      // Combine all operations
      const allOps: { type: 'set' | 'update', ref: any, data: any }[] = [];

      leads.forEach((lead: any) => {
        const newLeadRef = doc(collection(db, 'leads'));
        const leadId = `LID-${Math.floor(100000 + Math.random() * 900000)}`;
        const createdAt = lead.date 
          ? (lead.date.includes('T') ? lead.date : `${lead.date}T00:00:00.000Z`)
          : new Date().toISOString();

        allOps.push({
          type: 'set',
          ref: newLeadRef,
          data: {
            ...lead,
            id: newLeadRef.id,
            leadId,
            createdAt: createdAt,
            updatedAt: new Date().toISOString()
          }
        });
      });

      updates.forEach((update: any) => {
        const leadRef = doc(db, 'leads', update.id);
        const newData = update.newData || update.updates || {};
        const newRemark = newData.newRemark || update.remark;
        
        const updatePayload: any = {
          updatedAt: new Date().toISOString()
        };

        const manuallyEditedFields = update.existingData?.manuallyEditedFields || [];
        const isLifecycleLocked = manuallyEditedFields.includes('lifecycleStage');

        if (newData.lifecycleStage && !isLifecycleLocked) {
          updatePayload.lifecycleStage = newData.lifecycleStage;
        }

        if (newRemark) {
          const existingRemarks = update.existingData?.remarks || update.existingRemarks || [];
          updatePayload.remarks = [
            ...existingRemarks,
            {
              id: Math.random().toString(36).substr(2, 9),
              text: newRemark,
              createdAt: new Date().toISOString(),
              createdBy: 'System Sync (Update)'
            }
          ];
        }

        Object.keys(newData).forEach(key => {
          if (key !== 'lifecycleStage' && key !== 'newRemark' && key !== 'remarks' && key !== 'updatedAt') {
            const isLocked = manuallyEditedFields.includes(key);
            if (!isLocked) {
              updatePayload[key] = newData[key];
            }
          }
        });

        allOps.push({ type: 'update', ref: leadRef, data: updatePayload });
      });

      const skipped = req.body.skipped || [];
      skipped.forEach((s: any) => {
        const ref = doc(collection(db, 'skipped_leads'));
        allOps.push({
          type: 'set',
          ref,
          data: {
            ...s,
            id: ref.id,
            timestamp: s.timestamp || new Date().toISOString()
          }
        });
      });

      // Execute in chunks of 500
      const CHUNK_SIZE = 500;
      for (let i = 0; i < allOps.length; i += CHUNK_SIZE) {
        const chunk = allOps.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(op => {
          if (op.type === 'set') batch.set(op.ref, op.data);
          else batch.update(op.ref, op.data);
        });
        await batch.commit();
      }

      res.json({ success: true, count: leads.length + updates.length, imported: leads.length, updated: updates.length, skipped: skipped.length });
    } catch (error: any) {
      console.error('Bulk Import Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/send-eod-report', async (req, res) => {
    const { userId, userName, reportData } = req.body;
    if (!userId || !userName) {
      return res.status(400).json({ success: false, error: 'User info required' });
    }

    try {
      // Configuration for SMTP
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: (process.env.SMTP_PORT || '465') === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const recipients = [
        'havi@patelmotors.com',
        'ishapatel@patelmotors.com',
        'navneet@patelmotors.com',
        'Sanjaygupta@pmgroupind.com',
        'digital@patelmotors.com'
      ];

      const today = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });

      // Build HTML Report
      const stages = reportData.stages || {};
      const perf = reportData.performance || {};
      
      const htmlContent = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="background-color: #122835; background: linear-gradient(135deg, #122835 0%, #1e3a4c 100%); color: white; padding: 40px 32px; text-align: center;">
            <p style="margin: 0; text-transform: uppercase; letter-spacing: 3px; font-size: 11px; font-weight: 800; opacity: 0.7;">Executive Summary</p>
            <h1 style="margin: 8px 0 0 0; font-size: 28px; font-weight: 300; font-style: italic; letter-spacing: -0.5px;">End of Day Report</h1>
            <div style="margin-top: 16px; display: inline-block; padding: 6px 16px; background-color: rgba(255,255,255,0.1); border-radius: 20px; font-size: 13px;">
              ${today}
            </div>
          </div>

          <div style="padding: 40px 32px;">
            <!-- Reporter Info -->
            <div style="margin-bottom: 40px; border-left: 4px solid #C1884A; padding-left: 20px;">
              <p style="margin: 0; font-size: 12px; text-transform: uppercase; font-weight: 900; color: #94a3b8; letter-spacing: 1.5px;">Reporting Associate</p>
              <h2 style="margin: 4px 0 0 0; font-size: 26px; color: #122835; font-weight: 700;">${userName}</h2>
            </div>

            <!-- Key Performance Metrics -->
            <table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 40px;">
              <tr>
                <td width="48%" style="background-color: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #f1f5f9;">
                  <p style="margin: 0; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #64748b; letter-spacing: 1px;">Engagement Velocity</p>
                  <p style="margin: 8px 0 0 0;">
                    <span style="font-size: 24px; font-weight: 700; color: #122835;">${perf.hotRatio || 0}%</span>
                    <span style="font-size: 11px; color: #94a3b8; margin-left: 5px;">High Intent</span>
                  </p>
                </td>
                <td width="4%"></td>
                <td width="48%" style="background-color: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #f1f5f9;">
                  <p style="margin: 0; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #64748b; letter-spacing: 1px;">Success Rate</p>
                  <p style="margin: 8px 0 0 0;">
                    <span style="font-size: 24px; font-weight: 700; color: #10b981;">${perf.conversionRate || 0}%</span>
                    <span style="font-size: 11px; color: #94a3b8; margin-left: 5px;">Efficiency</span>
                  </p>
                </td>
              </tr>
            </table>

            <!-- Lifecycle Stage Breakdown -->
            <div style="margin-bottom: 40px;">
              <h3 style="margin: 0 0 20px 0; font-size: 14px; text-transform: uppercase; font-weight: 900; color: #122835; letter-spacing: 1px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">Lead Lifecycle Portfolio</h3>
              
              <table width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #475569;">Cold Leads</td>
                  <td align="right" style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #122835;">${stages.cold || 0}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #475569;">Warm Leads</td>
                  <td align="right" style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #122835;">${stages.warm || 0}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #D19F61;">Active Intent</td>
                  <td align="right" style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #D19F61;">${stages.intent || 0}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #122835;">Site Visits Scheduled</td>
                  <td align="right" style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #122835;">${stages.siteVisit || 0}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #10b981;">Converted</td>
                  <td align="right" style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #10b981;">${stages.converted || 0}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #0891b2;">Channel Partner (CP)</td>
                  <td align="right" style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #0891b2;">${stages.cp || 0}</td>
                </tr>
                <tr>
                  <td style="padding: 16px 12px; background-color: #f8fafc; border-radius: 8px; font-size: 14px; font-weight: 800; color: #1e293b;">Total Active Pipeline</td>
                  <td align="right" style="padding: 16px 12px; background-color: #f8fafc; border-radius: 8px; font-weight: 900; color: #122835; font-size: 18px;">${reportData.totalLeads || 0}</td>
                </tr>
              </table>
            </div>

            <!-- Detailed Summary -->
            <div style="padding: 24px; background-color: #fefce8; border: 1px solid #fef08a; border-radius: 12px; margin-bottom: 40px;">
              <h4 style="margin: 0 0 12px 0; font-size: 12px; color: #854d0e; text-transform: uppercase; font-weight: 900; letter-spacing: 0.5px;">Strategic Summary</h4>
              <p style="margin: 0; font-size: 14px; color: #713f12; line-height: 1.6;">
                Associate <strong>${userName}</strong> is currently managing <strong>${perf.activeFollowups || 0}</strong> active follow-ups. 
                With an engagement velocity of <strong>${perf.hotRatio || 0}%</strong>, the current focus is on nurturing high-intent leads 
                towards successful site visits and final conversions. 
                Today's activity resulted in <strong>${stages.siteVisit || 0}</strong> site visits and <strong>${stages.converted || 0}</strong> successful primary conversions.
              </p>
            </div>

            <!-- Site Visit Log -->
            ${reportData.siteVisitLog && reportData.siteVisitLog.length > 0 ? `
            <div style="margin-bottom: 40px;">
              <h3 style="margin: 0 0 20px 0; font-size: 14px; text-transform: uppercase; font-weight: 900; color: #122835; letter-spacing: 1px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">Site Visit Log</h3>
              <table width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 12px;">
                <thead>
                  <tr>
                    <th align="left" style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 900; text-transform: uppercase;">Lead Name</th>
                    <th align="left" style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 900; text-transform: uppercase;">Project</th>
                    <th align="right" style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 900; text-transform: uppercase;">Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${reportData.siteVisitLog.map((log: any) => `
                    <tr>
                      <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #334155;">${log.name}</td>
                      <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; color: #475569;">${log.project}</td>
                      <td align="right" style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; color: #122835; font-weight: 500;">${log.date}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ` : ''}
          </div>

          <!-- Footer -->
          <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 32px; text-align: center;">
            <p style="margin: 0; font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 900; letter-spacing: 2px;">PM Group CRM • Automated Reporting Intelligence</p>
            <p style="margin: 12px 0 0 0; font-size: 12px; color: #cbd5e1;">Generated by PM CRM Real-time Sync Engine</p>
          </div>
        </div>
      `;

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('SMTP credentials missing. EOD Report email simulation logging content instead.');
        console.log('Report content:', reportData);
        // We still return success for demo purposes if keys aren't set, 
        // effectively simulating it for the UI.
        return res.json({ success: true, simulated: true });
      }

      await transporter.sendMail({
        from: `"PM CRM Reports" <${process.env.SMTP_USER}>`,
        to: recipients.join(', '),
        subject: `EOD Report - ${userName} - ${today}`,
        html: htmlContent,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('EOD Report Email Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    
    console.log(`[Production] Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Not Found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
