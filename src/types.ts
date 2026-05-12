export type Role = 'SuperAdmin' | 'SubAdmin' | 'SalesTeamLead' | 'SalesAssociate';

export type Permission = 
  | 'view_dashboard'
  | 'view_leads'
  | 'view_skipped'
  | 'view_audit'
  | 'add_lead'
  | 'edit_lead'
  | 'delete_lead'
  | 'assign_lead'
  | 'bulk_assign_lead'
  | 'import_leads'
  | 'export_leads'
  | 'purge_leads'
  | 'sync_sheets'
  | 'view_users'
  | 'add_user'
  | 'edit_user'
  | 'delete_user'
  | 'view_tasks'
  | 'add_task'
  | 'view_chat'
  | 'manage_settings'
  | 'all';

export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  entityId?: string;
  entityName?: string;
  details: string;
  timestamp: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  permissions: Permission[];
}

export type LifecycleStage = 'Cold' | 'Warm' | 'Intent' | 'Site Visit' | 'Converted' | 'CP' | 'Closed' | 'Duplicate';
export type Project = 'PM UPLANDS' | 'PM ELITE' | 'THE RISE';
export type PropertyType = 'Plot' | 'Villa' | 'Apartment' | string;

export interface Remark {
  id: string;
  text: string;
  createdAt: string;
  createdBy: string; // User Name
}

export interface Reminder {
  id: string;
  dateTime: string;
  comment: string;
  triggered: boolean;
}

export interface SiteVisit {
  id: string;
  date: string;
  comment?: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  project: Project;
  lifecycleStage: LifecycleStage;
  source: string;
  remarks: Remark[];
  reminders: Reminder[];
  siteVisits?: SiteVisit[];
  assignedTo: string; // User ID
  createdBy?: string; // User ID of creator
  createdAt: string;
  updatedAt?: string;
  lastFollowUp?: string;
  // Specific requirements
  propertyType?: PropertyType;
  budget?: string;
  preferredSiteVisit?: string;
  plotSize?: string;
  month?: string;
  date?: string;
  leadId?: string;
  campaignName?: string;
  originationSource?: string;
  walkinSource?: string;
  employmentType?: 'Business' | 'Salaried' | string;
  occupation?: string;
  manuallyEditedFields?: string[]; // Field names that should not be overwritten by sync
  bookingDetails?: BookingDetails;
}

export interface BookingDetails {
  applicant: {
    fullName: string;
    fatherSpouseName: string;
    dob: string;
    mobile: string;
    email: string;
    pan: string;
    adhaar: string;
  };
  address: {
    currentAddress: string;
    city: string;
    state: string;
    pinCode: string;
  };
  property: {
    projectName: string;
    propertyType: 'Plot' | 'Villa' | 'Flat';
    unitNumber: string;
    sizeSqFt: string;
    ratePerSqFt: string;
    totalCost: string;
  };
  payment: {
    bookingAmount: string;
    paymentMode: 'Cash' | 'Cheque' | 'Online';
    paymentStatus?: 'Pending' | 'Paid';
    transactionNo: string;
    bankName: string;
    paymentDate: string;
  };
  sales: {
    executiveName: string;
    channelPartner: string;
  };
  declaration: {
    confirmed: boolean;
    signatureUrl?: string; // Base64 or identifier for uploaded signed doc
    signedAt: string;
  };
  signedDocUrl?: string; // The URL/path to the uploaded signed document
}

export interface SheetConfig {
  id: string;
  name: string;
  url: string;
  sheetIndex: number; // 1-indexed
  isActive: boolean;
  mappings?: Record<string, string>; // CRM field -> Sheet Column Name
  lastSynced?: string;
  createdAt: string;
}

export type TaskStatus = 'Pending' | 'In Progress' | 'Ongoing' | 'Complete';

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  assignedTo: string; // User ID
  assignedBy: string; // User ID
  leadId?: string;
  status: TaskStatus;
  type: 'follow_up' | 'meeting' | 'call' | 'site_visit' | 'general';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string; // User ID or 'system' or 'broadcast'
  text: string;
  taskId?: string; // Link to a task if this message is a task notification
  read: boolean;
  timestamp: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface SkippedLead {
  id: string;
  source: string;
  row: number;
  reason: string;
  info: string;
  timestamp: string;
}

export type InventoryStatus = 'Available' | 'Sold' | 'Reserved' | 'Blocked';

export interface InventoryUnit {
  id: string;
  project: Project;
  unitNumber: string; // Plot No / CR No etc
  status: InventoryStatus;
  sizeSqFt: number;
  sizeSqMt?: number;
  dimension?: string;
  unitType?: 'PLOT' | 'VILLA' | 'APARTMENT' | string;
  plcPercentage?: string;
  plcDescription?: string;
  soldToId?: string; // Linked Lead ID
  soldAt?: string;
  price?: number;
  createdAt: string;
  updatedAt: string;
  serialNumber?: number; // SR.NO from images
}

export interface SyncLog {
  id: string;
  timestamp: string;
  imported?: number;
  updated?: number;
  identical?: number;
  skipped?: number;
  duration?: number;
  status: 'Success' | 'Failed';
  error?: string;
}
