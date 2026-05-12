import React, { useState, useRef } from 'react';
import { useApp } from '@/src/AppContext';
import { Lead, BookingDetails } from '@/src/types';
import { Card, Button } from '@/src/components/ui';
import { 
  X, 
  Download, 
  Upload, 
  FileCheck, 
  User, 
  MapPin, 
  Home, 
  CreditCard, 
  Briefcase, 
  CheckCircle2,
  Printer
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface BookingFormProps {
  lead: Lead;
  onClose: () => void;
}

export default function BookingForm({ lead, onClose }: BookingFormProps) {
  const { saveBookingDetails, inventory, updateInventoryUnit, logoUrl, showToast } = useApp();
  const [activeStep, setActiveStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const letterheadRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<BookingDetails>(lead.bookingDetails || {
    applicant: {
      fullName: lead.name || '',
      fatherSpouseName: '',
      dob: '',
      mobile: lead.phone || '',
      email: lead.email || '',
      pan: '',
      adhaar: ''
    },
    address: {
      currentAddress: '',
      city: '',
      state: '',
      pinCode: ''
    },
    property: {
      projectName: lead.project || '',
      propertyType: 'Plot',
      unitNumber: '',
      sizeSqFt: lead.plotSize || '',
      ratePerSqFt: '',
      totalCost: lead.budget || ''
    },
    payment: {
      bookingAmount: '',
      paymentMode: 'Online',
      transactionNo: '',
      bankName: '',
      paymentStatus: 'Pending',
      paymentDate: new Date().toISOString().split('T')[0]
    },
    sales: {
      executiveName: '',
      channelPartner: lead.lifecycleStage === 'CP' ? lead.source : ''
    },
    declaration: {
      confirmed: false,
      signedAt: ''
    }
  });

  const handleChange = (section: keyof BookingDetails, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as any),
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveBookingDetails(lead.id, formData);
      
      // Update inventory status if unit is selected
      if (formData.property.projectName && formData.property.unitNumber) {
        const unit = inventory.find(u => 
          u.project === formData.property.projectName && 
          u.unitNumber === formData.property.unitNumber
        );
        
        if (unit) {
          const newStatus = formData.payment.paymentStatus === 'Paid' ? 'Sold' : 'Reserved';
          await updateInventoryUnit(unit.id, { 
            status: newStatus,
            soldToId: lead.id,
            soldAt: new Date().toISOString()
          });
          showToast(`Unit ${unit.unitNumber} marked as ${newStatus}`, 'success');
        }
      }
      
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!letterheadRef.current) return;
    
    showToast('Generating high-quality booking form...', 'info');
    
    try {
      const element = letterheadRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Booking_Form_${lead.name || 'Leads'}_${new Date().getTime()}.pdf`);
      showToast('Booking form downloaded successfully', 'success');
    } catch (e) {
      console.error('PDF generation failed:', e);
      showToast('Failed to generate PDF', 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('File size must be less than 5MB', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        setFormData(prev => ({
          ...prev,
          signedDocUrl: base64String,
          declaration: {
            ...prev.declaration,
            signedAt: new Date().toISOString()
          }
        }));
        showToast('Signed document uploaded successfully', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const getReraNumber = (projectName: string) => {
    switch(projectName) {
      case 'PM UPLANDS':
        return 'P-IND-23-3974 (Ph1), P-IND-23-3933 (Ph2)';
      case 'PM ELITE':
        return 'P-IND-25-5373';
      case 'THE RISE':
        return 'P-OTH-25-6127';
      default:
        return 'N/A';
    }
  };

  const renderStep = () => {
    switch(activeStep) {
      case 1:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
              <User className="w-5 h-5" /> 1. Applicant Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-[var(--color-text-dim)] tracking-widest">Full Name</label>
                <input 
                  type="text" 
                  value={formData.applicant.fullName}
                  onChange={(e) => handleChange('applicant', 'fullName', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 h-11 px-4 rounded-xl focus:ring-2 focus:ring-accent/20 transition-all outline-none text-slate-900 dark:text-white font-medium"
                  placeholder="As per PAN card"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-[var(--color-text-dim)] tracking-widest">Father's / Spouse Name</label>
                <input 
                  type="text" 
                  value={formData.applicant.fatherSpouseName}
                  onChange={(e) => handleChange('applicant', 'fatherSpouseName', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 h-11 px-4 rounded-xl focus:ring-2 focus:ring-accent/20 transition-all outline-none text-slate-900 dark:text-white font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-[var(--color-text-dim)] tracking-widest">Date of Birth</label>
                <input 
                  type="date" 
                  value={formData.applicant.dob}
                  onChange={(e) => handleChange('applicant', 'dob', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 h-11 px-4 rounded-xl focus:ring-2 focus:ring-accent/20 transition-all outline-none text-slate-900 dark:text-white font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-[var(--color-text-dim)] tracking-widest">Mobile Number</label>
                <input 
                  type="tel" 
                  value={formData.applicant.mobile}
                  onChange={(e) => handleChange('applicant', 'mobile', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 h-11 px-4 rounded-xl focus:ring-2 focus:ring-accent/20 transition-all outline-none text-slate-900 dark:text-white font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-[var(--color-text-dim)] tracking-widest">Email ID</label>
                <input 
                  type="email" 
                  value={formData.applicant.email}
                  onChange={(e) => handleChange('applicant', 'email', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 h-11 px-4 rounded-xl focus:ring-2 focus:ring-accent/20 transition-all outline-none text-slate-900 dark:text-white font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-[var(--color-text-dim)] tracking-widest">PAN Number</label>
                <input 
                  type="text" 
                  value={formData.applicant.pan}
                  onChange={(e) => handleChange('applicant', 'pan', e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 h-11 px-4 rounded-xl focus:ring-2 focus:ring-accent/20 transition-all outline-none text-slate-900 dark:text-white font-medium"
                  maxLength={10}
                />
              </div>
              <div className="space-y-2 col-span-full">
                <label className="text-[10px] font-black uppercase text-[var(--color-text-dim)] tracking-widest">Aadhaar Number</label>
                <input 
                  type="text" 
                  value={formData.applicant.adhaar}
                  onChange={(e) => handleChange('applicant', 'adhaar', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 h-11 px-4 rounded-xl focus:ring-2 focus:ring-accent/20 transition-all outline-none text-slate-900 dark:text-white font-medium"
                  maxLength={12}
                />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
              <MapPin className="w-5 h-5" /> 2. Address Details
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-muted-foreground">Current Address</label>
                <textarea 
                  value={formData.address.currentAddress}
                  onChange={(e) => handleChange('address', 'currentAddress', e.target.value)}
                  className="w-full bg-background border border-border min-h-[100px] p-3 rounded-lg focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-muted-foreground">City</label>
                  <input 
                    type="text" 
                    value={formData.address.city}
                    onChange={(e) => handleChange('address', 'city', e.target.value)}
                    className="w-full bg-background border border-border h-10 px-3 rounded-lg focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-muted-foreground">State</label>
                  <input 
                    type="text" 
                    value={formData.address.state}
                    onChange={(e) => handleChange('address', 'state', e.target.value)}
                    className="w-full bg-background border border-border h-10 px-3 rounded-lg focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-muted-foreground">Pin Code</label>
                  <input 
                    type="text" 
                    value={formData.address.pinCode}
                    onChange={(e) => handleChange('address', 'pinCode', e.target.value)}
                    className="w-full bg-background border border-border h-10 px-3 rounded-lg focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    maxLength={6}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
              <Home className="w-5 h-5" /> 3. Property Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-muted-foreground">Project Name</label>
                <select 
                  value={formData.property.projectName}
                  onChange={(e) => {
                    handleChange('property', 'projectName', e.target.value);
                    handleChange('property', 'unitNumber', ''); // Reset unit
                  }}
                  className="w-full bg-background border border-border h-10 px-3 rounded-lg focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                >
                  <option value="">Select Project</option>
                  <option value="PM UPLANDS">PM UPLANDS</option>
                  <option value="PM ELITE">PM ELITE</option>
                  <option value="THE RISE">THE RISE</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-muted-foreground">Property Type</label>
                <select 
                  value={formData.property.propertyType}
                  onChange={(e) => handleChange('property', 'propertyType', e.target.value)}
                  className="w-full bg-background border border-border h-10 px-3 rounded-lg focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                >
                  <option value="Plot">Plot</option>
                  <option value="Villa">Villa</option>
                  <option value="Flat">Flat</option>
                </select>
              </div>
              <div className="space-y-2 col-span-full">
                <label className="text-xs font-black uppercase text-muted-foreground">Select Plot / Unit Number</label>
                <select 
                  value={formData.property.unitNumber}
                  onChange={(e) => {
                    const unitNum = e.target.value;
                    const unit = inventory.find(u => u.unitNumber === unitNum && u.project === formData.property.projectName);
                    if (unit) {
                      handleChange('property', 'unitNumber', unit.unitNumber);
                      handleChange('property', 'sizeSqFt', (unit.sizeSqFt || unit.sizeSqMt || '').toString());
                    } else {
                      handleChange('property', 'unitNumber', unitNum);
                    }
                  }}
                  className="w-full bg-primary/5 border-2 border-primary/20 h-12 px-4 rounded-xl focus:ring-2 focus:ring-accent/20 transition-all outline-none font-bold text-accent"
                >
                  <option value="">-- Click to select unit from inventory --</option>
                  {inventory
                    .filter(u => u.project === formData.property.projectName)
                    .sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0))
                    .map(u => (
                      <option 
                        key={u.id} 
                        value={u.unitNumber}
                        disabled={u.status === 'Sold' && u.unitNumber !== formData.property.unitNumber}
                        className={cn(u.status === 'Sold' ? "text-red-500 opacity-50" : u.status === 'Reserved' ? "text-orange-500" : "text-green-600")}
                      >
                        {u.unitNumber} - {u.status} {u.sizeSqFt ? `(${u.sizeSqFt} SqFt)` : u.sizeSqMt ? `(${u.sizeSqMt} SqMt)` : ''}
                      </option>
                    ))
                  }
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-muted-foreground">Size (Sq. Ft.)</label>
                <input 
                  type="text" 
                  value={formData.property.sizeSqFt}
                  onChange={(e) => handleChange('property', 'sizeSqFt', e.target.value)}
                  className="w-full bg-background border border-border h-10 px-3 rounded-lg focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-muted-foreground">Rate per Sq. Ft.</label>
                <input 
                  type="text" 
                  value={formData.property.ratePerSqFt}
                  onChange={(e) => handleChange('property', 'ratePerSqFt', e.target.value)}
                  className="w-full bg-background border border-border h-10 px-3 rounded-lg focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
              <div className="space-y-2 col-span-full">
                <label className="text-xs font-black uppercase text-muted-foreground">Total Cost</label>
                <input 
                  type="text" 
                  value={formData.property.totalCost}
                  onChange={(e) => handleChange('property', 'totalCost', e.target.value)}
                  className="w-full bg-background border border-border h-12 px-4 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none text-lg font-black text-primary"
                />
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
              <CreditCard className="w-5 h-5" /> 4. Payment Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-muted-foreground">Booking Amount Paid</label>
                <input 
                  type="text" 
                  value={formData.payment.bookingAmount}
                  onChange={(e) => handleChange('payment', 'bookingAmount', e.target.value)}
                  className="w-full bg-background border border-border h-10 px-3 rounded-lg focus:ring-2 focus:ring-primary/20 transition-all outline-none font-bold text-accent"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-muted-foreground">Payment Mode</label>
                <select 
                  value={formData.payment.paymentMode}
                  onChange={(e) => handleChange('payment', 'paymentMode', e.target.value)}
                  className="w-full bg-background border border-border h-10 px-3 rounded-lg focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Online">Online</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-muted-foreground">Payment Status</label>
                <select 
                  value={formData.payment.paymentStatus}
                  onChange={(e) => handleChange('payment', 'paymentStatus', e.target.value as 'Pending' | 'Paid')}
                  className="w-full bg-primary/5 border border-primary/30 h-10 px-3 rounded-lg focus:ring-2 focus:ring-primary/20 transition-all outline-none font-bold text-primary"
                >
                  <option value="Pending">Pending (Marks Unit as Reserved)</option>
                  <option value="Paid">Paid (Marks Unit as Sold)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-muted-foreground">Chq / Trans No.</label>
                <input 
                  type="text" 
                  value={formData.payment.transactionNo}
                  onChange={(e) => handleChange('payment', 'transactionNo', e.target.value)}
                  className="w-full bg-background border border-border h-10 px-3 rounded-lg focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-muted-foreground">Bank Name</label>
                <input 
                  type="text" 
                  value={formData.payment.bankName}
                  onChange={(e) => handleChange('payment', 'bankName', e.target.value)}
                  className="w-full bg-background border border-border h-10 px-3 rounded-lg focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-muted-foreground">Payment Date</label>
                <input 
                  type="date" 
                  value={formData.payment.paymentDate}
                  onChange={(e) => handleChange('payment', 'paymentDate', e.target.value)}
                  className="w-full bg-background border border-border h-10 px-3 rounded-lg focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
                <Briefcase className="w-5 h-5" /> 5. Sales & Confirmation
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-muted-foreground">Sales Executive</label>
                  <input 
                    type="text" 
                    value={formData.sales.executiveName}
                    onChange={(e) => handleChange('sales', 'executiveName', e.target.value)}
                    className="w-full bg-background border border-border h-10 px-3 rounded-lg focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-muted-foreground">Channel Partner</label>
                  <input 
                    type="text" 
                    value={formData.sales.channelPartner}
                    onChange={(e) => handleChange('sales', 'channelPartner', e.target.value)}
                    className="w-full bg-background border border-border h-10 px-3 rounded-lg focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6 p-4 bg-muted/50 rounded-xl border border-border">
              <h3 className="text-sm font-black uppercase tracking-widest text-primary">6. Final Declaration</h3>
              <div className="flex items-start gap-3">
                <div 
                  className={cn(
                    "mt-1 w-5 h-5 rounded border cursor-pointer flex items-center justify-center transition-all",
                    formData.declaration.confirmed ? "bg-accent border-accent text-white" : "border-muted-foreground/30 bg-background"
                  )}
                  onClick={() => handleChange('declaration', 'confirmed', !formData.declaration.confirmed)}
                >
                  {formData.declaration.confirmed && <CheckCircle2 className="w-4 h-4" />}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  I hereby confirm that the above information provided by me is true and correct. I agree to the terms and conditions of the company for property booking at <strong>{formData.property.projectName}</strong>.
                </p>
              </div>
            </div>

            <Card className="p-6 border-dashed border-2 border-primary/20 bg-primary/5">
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold">Upload Signed Booking Copy</p>
                  <p className="text-xs text-muted-foreground">Scan or photo of the physical form (Max 5MB)</p>
                </div>
                
                {formData.signedDocUrl ? (
                  <div className="flex items-center gap-2 p-2 bg-green-500/10 text-green-500 rounded-lg border border-green-500/20 px-4">
                    <FileCheck className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Document Secured</span>
                    <button 
                      onClick={() => setFormData(prev => ({ ...prev, signedDocUrl: undefined }))}
                      className="ml-2 p-1 hover:bg-green-500/10 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" className="relative h-10 px-6 rounded-full border-primary/50 text-primary hover:bg-primary/10">
                    Select File
                    <input 
                      type="file" 
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                  </Button>
                )}
              </div>
            </Card>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-main)] shadow-2xl rounded-3xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        <header className="px-8 py-6 border-b border-[var(--color-border-main)]/30 flex justify-between items-center bg-[var(--color-bg-sidebar)]/20">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center shadow-inner">
              <FileCheck className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-black text-base uppercase tracking-tight leading-none mb-1 text-[var(--color-text-main)]">Property Booking Management</h2>
              <p className="text-[10px] text-[var(--color-text-dim)] uppercase font-black tracking-widest leading-none">Ref: {lead.leadId || lead.id}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-[var(--color-text-main)]/10 rounded-full transition-colors text-[var(--color-text-dim)]"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-10">
          {/* Progress Tracker */}
          <div className="flex items-center justify-between mb-12 max-w-2xl mx-auto px-4">
            {[1, 2, 3, 4, 5].map((step) => (
              <React.Fragment key={step}>
                <div 
                  className={cn(
                    "flex flex-col items-center gap-2 transition-all cursor-pointer",
                    activeStep === step ? "opacity-100" : "opacity-30 hover:opacity-100"
                  )}
                  onClick={() => setActiveStep(step)}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all",
                    activeStep >= step ? "bg-accent text-white shadow-lg shadow-accent/20" : "bg-[var(--color-bg-main)] border border-[var(--color-border-main)]/30 text-[var(--color-text-dim)]"
                  )}>
                    {step}
                  </div>
                  <span className={cn(
                    "text-[8px] font-black uppercase tracking-tighter",
                    activeStep >= step ? "text-accent" : "text-[var(--color-text-dim)]"
                  )}>
                    {step === 1 ? 'Profile' : step === 2 ? 'Address' : step === 3 ? 'Property' : step === 4 ? 'Payment' : 'Final'}
                  </span>
                </div>
                {step < 5 && (
                  <div className="flex-1 px-2 mb-4">
                    <div className={cn("h-[2px] w-full", activeStep > step ? "bg-accent" : "bg-[var(--color-border-main)]/30")} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="min-h-[400px]">
            {renderStep()}
          </div>
        </div>

        <footer className="px-8 py-6 border-t border-[var(--color-border-main)]/30 flex justify-between items-center bg-[var(--color-bg-sidebar)]/20">
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleDownloadPDF}
              className="h-11 px-6 rounded-xl border-accent/40 text-accent hover:bg-accent hover:text-white transition-all font-black text-[10px] uppercase tracking-widest"
            >
              <Download className="w-4 h-4 mr-2" /> Download Form
            </Button>
            {formData.signedDocUrl && (
              <a 
                href={formData.signedDocUrl} 
                download={`Signed_Booking_${lead.name}.pdf`}
                className="flex items-center px-5 h-11 bg-[var(--color-bg-sidebar)]/50 hover:bg-[var(--color-bg-sidebar)]/80 text-[var(--color-text-main)] rounded-xl transition-all text-xs font-black uppercase tracking-widest border border-[var(--color-border-main)]/30"
              >
                <Printer className="w-4 h-4 mr-2" /> Signed Doc
              </a>
            )}
          </div>
          
          <div className="flex gap-3">
            <Button 
              variant="ghost" 
              onClick={() => activeStep > 1 && setActiveStep(prev => prev - 1)}
              disabled={activeStep === 1}
              className="h-11 px-8 rounded-xl text-[var(--color-text-dim)] hover:text-[var(--color-text-main)]"
            >
              Back
            </Button>
            {activeStep < 5 ? (
              <Button 
                onClick={() => setActiveStep(prev => prev + 1)}
                className="h-11 px-10 rounded-xl bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20"
              >
                Next Step
              </Button>
            ) : (
              <Button 
                onClick={handleSave}
                disabled={isSaving || !formData.declaration.confirmed}
                className="h-11 px-10 rounded-xl bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20"
              >
                {isSaving ? 'Processing...' : 'Complete Booking'}
              </Button>
            )}
          </div>
        </footer>
      </div>

      {/* HIDDEN LETTERHEAD FOR PDF GENERATION */}
      <div className="fixed left-[-9999px] top-0 pointer-events-none">
        <div 
          ref={letterheadRef}
          style={{ 
            width: '210mm', 
            minHeight: '297mm', 
            padding: '25mm 20mm', 
            backgroundColor: 'white', 
            color: 'black', 
            fontFamily: 'serif' 
          }}
        >
          {/* PM Group Letterhead Header */}
          <div style={{ borderBottom: '2px solid #C1884A', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              {logoUrl ? (
                <img src={logoUrl} alt="PM Group Logo" style={{ height: '60px', marginBottom: '10px' }} />
              ) : (
                <h1 style={{ color: '#122835', margin: 0, fontSize: '32px', fontStyle: 'italic' }}>PM Group</h1>
              )}
            </div>
            <div style={{ textAlign: 'right', fontSize: '10px', color: '#666' }}>
              <p style={{ margin: 0 }}>201, A-1 wing, UNO Business Park,</p>
              <p style={{ margin: 0 }}>Bicholi Mardana Road, Indore by-pass,</p>
              <p style={{ margin: 0 }}>Opposite Sahara City, Indore (M.P.)</p>
              <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>www.pmgroup.biz</p>
            </div>
          </div>

          <h2 style={{ textAlign: 'center', textTransform: 'uppercase', fontSize: '20px', letterSpacing: '2px', marginBottom: '30px', color: '#122835' }}>Booking Confirmation Form</h2>

          <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
            {/* Applicant Section */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ borderBottom: '1px solid #eee', color: '#C1884A' }}>1. APPLICANT DETAILS</h3>
              <table style={{ width: '100%' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '150px', fontWeight: 'bold' }}>Full Name:</td>
                    <td>{formData.applicant.fullName}</td>
                    <td style={{ width: '150px', fontWeight: 'bold' }}>Mobile:</td>
                    <td>{formData.applicant.mobile}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold' }}>Father's Name:</td>
                    <td>{formData.applicant.fatherSpouseName}</td>
                    <td style={{ fontWeight: 'bold' }}>DOB:</td>
                    <td>{formData.applicant.dob}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold' }}>Email ID:</td>
                    <td colSpan={3}>{formData.applicant.email}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold' }}>PAN Number:</td>
                    <td>{formData.applicant.pan}</td>
                    <td style={{ fontWeight: 'bold' }}>Aadhaar:</td>
                    <td>{formData.applicant.adhaar}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Address Section */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ borderBottom: '1px solid #eee', color: '#C1884A' }}>2. ADDRESS DETAILS</h3>
              <p><strong>Current Address:</strong> {formData.address.currentAddress}</p>
              <p><strong>City:</strong> {formData.address.city} | <strong>State:</strong> {formData.address.state} | <strong>PIN:</strong> {formData.address.pinCode}</p>
            </div>

            {/* Property Section */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ borderBottom: '1px solid #eee', color: '#C1884A' }}>3. PROPERTY DETAILS</h3>
              <table style={{ width: '100%', border: '1px solid #eee', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px', border: '1px solid #eee' }}><strong>Project:</strong> {formData.property.projectName}</td>
                    <td style={{ padding: '8px', border: '1px solid #eee' }}><strong>RERA No:</strong> {getReraNumber(formData.property.projectName)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', border: '1px solid #eee' }}><strong>Property Type:</strong> {formData.property.propertyType}</td>
                    <td style={{ padding: '8px', border: '1px solid #eee' }}><strong>Unit No:</strong> {formData.property.unitNumber}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', border: '1px solid #eee' }}><strong>Dimensions:</strong> {formData.property.sizeSqFt} Sq. Ft.</td>
                    <td style={{ padding: '8px', border: '1px solid #eee' }}><strong>Rate:</strong> ₹{formData.property.ratePerSqFt}/-</td>
                  </tr>
                  <tr style={{ background: '#f9f9f9' }}>
                    <td colSpan={2} style={{ padding: '12px', border: '1px solid #eee', textAlign: 'right', fontSize: '14px' }}>
                      <strong>TOTAL CONSIDERATION COST: ₹{formData.property.totalCost}/-</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payment Section */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ borderBottom: '1px solid #eee', color: '#C1884A' }}>4. PAYMENT DETAILS</h3>
              <p><strong>Booking Amount:</strong> ₹{formData.payment.bookingAmount}/- ({formData.payment.paymentMode})</p>
              <p><strong>Ref No / Chq No:</strong> {formData.payment.transactionNo} | <strong>Bank:</strong> {formData.payment.bankName}</p>
              <p><strong>Date:</strong> {formData.payment.paymentDate}</p>
            </div>

            {/* Sales Section */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ borderBottom: '1px solid #eee', color: '#C1884A' }}>5. SALES DETAILS</h3>
              <p><strong>Sales Executive:</strong> {formData.sales.executiveName} | <strong>Channel Partner:</strong> {formData.sales.channelPartner || 'Direct'}</p>
            </div>

            {/* Declaration */}
            <div style={{ marginTop: '40px', padding: '20px', border: '1px solid #C1884A', borderRadius: '8px', position: 'relative' }}>
              <h4 style={{ margin: 0, marginBottom: '10px' }}>DECLARATION</h4>
              <p style={{ margin: 0, fontSize: '11px', lineHeight: '1.4' }}>
                I hereby confirm that the above information provided by me is true and correct to the best of my knowledge. I agree to abide by the terms and conditions set forth by the company for the booking of the said property. I understand that this booking is subject to the final approval of the management and realization of the booking amount.
              </p>
              
              <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '150px', borderBottom: '1px solid black', marginBottom: '5px' }}></div>
                  <span style={{ fontSize: '10px' }}>Applicant Signature</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '150px', borderBottom: '1px solid black', marginBottom: '5px' }}></div>
                  <span style={{ fontSize: '10px' }}>Date: {new Date().toLocaleDateString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Footer */}
          <div style={{ position: 'absolute', bottom: '20mm', left: '20mm', right: '20mm', paddingTop: '10px', borderTop: '1px solid #eee', textAlign: 'center', fontSize: '9px', color: '#999' }}>
            <p style={{ margin: 0 }}>This is a computer-generated document and needs to be physically signed for validation.</p>
            <p style={{ margin: 0 }}>PM Group - Excellence in Execution</p>
          </div>
        </div>
      </div>
    </div>
  );
}
