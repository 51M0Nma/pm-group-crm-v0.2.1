
import axios from 'axios';
import Papa from 'papaparse';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

async function debugSync() {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || '(default)');

  const sheets = [
    { 
      url: 'https://docs.google.com/spreadsheets/d/1zC910K-OuSZk4xfc-HjUAQaRQ1x75qXhXIVNNNkgkIo/export?format=csv&gid=0',
      source: 'PM Plot Leads'
    },
    { 
      url: 'https://docs.google.com/spreadsheets/d/1zC910K-OuSZk4xfc-HjUAQaRQ1x75qXhXIVNNNkgkIo/export?format=csv&gid=1219704764',
      source: 'PM Villa Leads'
    }
  ];

  const existingLeadsSnapshot = await getDocs(collection(db, 'leads'));
  const existingPhones = new Set(existingLeadsSnapshot.docs.map(doc => doc.data().phone));
  console.log(`Current CRM Leads: ${existingLeadsSnapshot.docs.length}`);

  const allLeadsRaw = [];
  for (const sheet of sheets) {
    const response = await axios.get(sheet.url);
    const results = Papa.parse(response.data, { header: true, skipEmptyLines: true });
    results.data.forEach((row: any) => {
       const findKey = (keys: string[]) => {
        const rowKeys = Object.keys(row);
        return rowKeys.find(rk => keys.some(k => k.toLowerCase() === rk.trim().toLowerCase()));
      };

      const nameKey = findKey(['Full Name', 'name', 'customer', 'client', 'full_name']);
      const name = nameKey ? row[nameKey]?.toString() || '' : '';
      const phoneKey = findKey(['Phone No.', 'phone', 'mobile', 'contact', 'phone_number']);
      let phoneInput = phoneKey ? row[phoneKey]?.toString() || '' : '';

      allLeadsRaw.push({ name, phoneInput, source: sheet.source });
    });
  }

  const normalizedLeads = allLeadsRaw.map(l => {
    let phoneInput = l.phoneInput;
    if (phoneInput.includes('/')) phoneInput = phoneInput.split('/')[0].trim();
    let cleanPhone = phoneInput.replace(/\D/g, '');
    if (cleanPhone.startsWith('910')) {
      let stripped = cleanPhone.substring(3);
      cleanPhone = stripped.length === 10 ? stripped : '91' + stripped;
    } else if (cleanPhone.length >= 10) {
      cleanPhone = cleanPhone.slice(-10);
    }
    return { ...l, cleanPhone };
  });

  const testLeads = normalizedLeads.filter(l => l.name.toLowerCase().includes('test'));
  const nonTestLeads = normalizedLeads.filter(l => !l.name.toLowerCase().includes('test'));

  const seenPhones = new Map();
  const duplicatesInSheets = [];
  const uniqueLeadsInSheets = [];

  nonTestLeads.forEach(l => {
    if (seenPhones.has(l.cleanPhone)) {
      duplicatesInSheets.push({ ...l, original: seenPhones.get(l.cleanPhone) });
    } else {
      uniqueLeadsInSheets.push(l);
      seenPhones.set(l.cleanPhone, l);
    }
  });

  console.log(`\nDetailed Breakdown:`);
  console.log(`Total rows in both sheets: ${allLeadsRaw.length}`);
  console.log(`Test leads excluded: ${testLeads.length} (${testLeads.map(t => t.name).join(', ')})`);
  console.log(`Duplicates within sheets (same phone number): ${duplicatesInSheets.length}`);
  if (duplicatesInSheets.length > 0) {
    duplicatesInSheets.forEach(d => {
      console.log(`- Duplicate found: "${d.name}" and "${d.original.name}" share the phone ${d.cleanPhone}`);
    });
  }
  console.log(`Unique leads found in sheets: ${uniqueLeadsInSheets.length}`);
  console.log(`Leads currently in CRM: ${existingLeadsSnapshot.docs.length}`);

  const crmLeads = existingLeadsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as any);
  const crmDuplicates: any[] = [];
  const crmSeen = new Map();
  crmLeads.forEach((l: any) => {
    let p = l.phone?.toString().replace(/\D/g, '') || '';
    let normalized = p.length >= 10 ? p.slice(-10) : p;
    if (crmSeen.has(normalized)) {
      crmDuplicates.push({ ...l, original: crmSeen.get(normalized) });
    } else {
      crmSeen.set(normalized, l);
    }
  });

  console.log(`\nDuplicates ALREADY INSIDE CRM (Double entries): ${crmDuplicates.length}`);
  if (crmDuplicates.length > 0) {
    crmDuplicates.forEach((d: any) => {
      console.log(`- CRM Duplicate: "${d.name}" and "${d.original.name}" share the phone ${d.phone} (Stored as ${d.phone} vs ${d.original.phone})`);
    });
  }

  const sheetPhones = new Set(uniqueLeadsInSheets.map(l => l.cleanPhone));
  const inCrmButNotInSheets = crmLeads.filter((l: any) => {
    let p = l.phone?.toString().replace(/\D/g, '') || '';
    let normalized = p.length >= 10 ? p.slice(-10) : p;
    return !sheetPhones.has(normalized);
  });

  console.log(`\nLeads in CRM but NOT found in current sheets: ${inCrmButNotInSheets.length}`);
  if (inCrmButNotInSheets.length > 0) {
    inCrmButNotInSheets.forEach((l: any) => {
      console.log(`- ${l.name} (${l.phone}) [Source: ${l.source}]`);
    });
  }
}

debugSync().catch(console.error);
