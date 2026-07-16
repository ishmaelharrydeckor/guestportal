'use strict';
'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import NavigationLayout from '@/components/NavigationLayout';
import * as XLSX from 'xlsx';

interface ParsedGuest {
  full_name: string;
  email: string | null;
  ticket_type: string;
  payment_status: string;
  amount_paid: number | null;
  order_id: string | null;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedGuests, setParsedGuests] = useState<ParsedGuest[]>([]);
  const [headersMap, setHeadersMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [uploadMode, setUploadMode] = useState<'merge' | 'replace'>('merge');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Helper function to map headers intelligently
  const mapHeaders = (rawHeaders: string[]) => {
    const cleanHeaders = rawHeaders.map((h) => String(h).trim().toLowerCase());
    const mapping: Record<string, number> = {};

    const nameIdx = cleanHeaders.findIndex((h) => h.includes('name') || h.includes('guest') || h.includes('attendee') || h.includes('customer'));
    const emailIdx = cleanHeaders.findIndex((h) => h.includes('email') || h.includes('e-mail') || h.includes('mail'));
    const ticketIdx = cleanHeaders.findIndex((h) => h.includes('ticket') || h.includes('type') || h.includes('package') || h.includes('tier') || h.includes('admission'));
    const amountIdx = cleanHeaders.findIndex((h) => h.includes('amount') || h.includes('price') || h.includes('cost') || h.includes('paid_amount') || h.includes('paid amount'));
    const paymentIdx = cleanHeaders.findIndex((h, idx) => {
      if (idx === amountIdx) return false;
      return h.includes('status') || h.includes('payment') || h.includes('paid') || h.includes('paid_status');
    });
    const orderIdx = cleanHeaders.findIndex((h) => {
      const words = h.split(/[\s_\-\/]+/);
      return words.includes('id') || h.includes('order') || h.includes('ref') || h.includes('booking');
    });

    const displayMapping: Record<string, string> = {};

    if (nameIdx !== -1) {
      mapping['full_name'] = nameIdx;
      displayMapping['Name'] = rawHeaders[nameIdx];
    }
    if (emailIdx !== -1) {
      mapping['email'] = emailIdx;
      displayMapping['Email'] = rawHeaders[emailIdx];
    }
    if (ticketIdx !== -1) {
      mapping['ticket_type'] = ticketIdx;
      displayMapping['Ticket Type'] = rawHeaders[ticketIdx];
    }
    if (paymentIdx !== -1) {
      mapping['payment_status'] = paymentIdx;
      displayMapping['Payment Status'] = rawHeaders[paymentIdx];
    }
    if (amountIdx !== -1) {
      mapping['amount_paid'] = amountIdx;
      displayMapping['Amount Paid'] = rawHeaders[amountIdx];
    }
    if (orderIdx !== -1) {
      mapping['order_id'] = orderIdx;
      displayMapping['Order ID'] = rawHeaders[orderIdx];
    }

    setHeadersMap(displayMapping);
    return mapping;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setError('');
    setSuccess('');
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Parse sheet as raw 2D array
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (rows.length < 2) {
          throw new Error('Spreadsheet must contain a header row and at least one data row.');
        }

        const rawHeaders = rows[0].map((cell) => String(cell || '').trim());
        const mapping = mapHeaders(rawHeaders);

        // We require at least a Name column to match
        if (mapping['full_name'] === undefined) {
          throw new Error('Could not identify a "Name" column in your spreadsheet. Please make sure the sheet has a column header named "Name", "Full Name", or "Guest Name".');
        }

        const guestsList: ParsedGuest[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const nameVal = mapping['full_name'] !== undefined ? String(row[mapping['full_name']] || '').trim() : '';
          
          // Reject rows with no name
          if (!nameVal) continue;

          const emailVal = mapping['email'] !== undefined ? String(row[mapping['email']] || '').trim() : '';
          const ticketVal = mapping['ticket_type'] !== undefined ? String(row[mapping['ticket_type']] || '').trim() : 'Regular';
          const paymentVal = mapping['payment_status'] !== undefined ? String(row[mapping['payment_status']] || '').trim() : 'Paid';
          const amountVal = mapping['amount_paid'] !== undefined ? parseFloat(String(row[mapping['amount_paid']])) : null;
          const orderVal = mapping['order_id'] !== undefined ? String(row[mapping['order_id']] || '').trim() : '';

          // Standardize payment status
          let paymentStatus = 'Unknown';
          const payLower = paymentVal.toLowerCase();
          if (payLower.includes('paid') || payLower.includes('yes') || payLower.includes('complete') || payLower.includes('success')) {
            paymentStatus = 'Paid';
          } else if (payLower.includes('pending') || payLower.includes('wait')) {
            paymentStatus = 'Pending';
          } else if (payLower.includes('issue') || payLower.includes('error') || payLower.includes('unpaid') || payLower.includes('refund')) {
            paymentStatus = 'Issue';
          } else if (paymentVal) {
            paymentStatus = paymentVal; // Keep status if custom, or default to Paid
          }

          guestsList.push({
            full_name: nameVal,
            email: emailVal || null,
            ticket_type: ticketVal || 'Regular',
            payment_status: paymentStatus,
            amount_paid: isNaN(amountVal as number) ? null : amountVal,
            order_id: orderVal || null,
          });
        }

        if (guestsList.length === 0) {
          throw new Error('No valid guest records found in the spreadsheet.');
        }

        setParsedGuests(guestsList);
      } catch (err: any) {
        setError(err.message || 'Error parsing the Excel file. Please verify it is a valid .xlsx or .csv file.');
        setFile(null);
        setParsedGuests([]);
        setHeadersMap({});
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError('File read error.');
      setLoading(false);
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const getAuthHeaders = (customHeaders: Record<string, string> = {}): Record<string, string> => {
    if (typeof window === 'undefined') return customHeaders;
    
    let session = '';
    let role = '';
    try {
      session = localStorage.getItem('guest_portal_session') || '';
      role = localStorage.getItem('guest_portal_role') || '';
    } catch (e) {}

    if (!session) {
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
        return '';
      };
      session = getCookie('guest_portal_user');
      role = getCookie('guest_portal_role');
    }

    return {
      ...customHeaders,
      'x-staff-user': session,
      'x-staff-role': role,
    };
  };

  const triggerUpload = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    setShowConfirmModal(false);

    try {
      const res = await fetch('/api/guests/upload', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ guests: parsedGuests, mode: uploadMode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setSuccess(`Successfully imported ${parsedGuests.length} guests in ${uploadMode === 'merge' ? 'Merge' : 'Replace'} mode!`);
      setFile(null);
      setParsedGuests([]);
      setHeadersMap({});
    } catch (err: any) {
      setError(err.message || 'Failed to import guests to SQLite database');
    } finally {
      setLoading(false);
    }
  };

  return (
    <NavigationLayout>
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-10 py-6 flex flex-col gap-6">
        <header className="pb-4 border-b-2 border-[#c6c6cd] flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight m-0">Upload Guest List</h1>
            <p className="text-sm text-[#45464d] mt-1">Import your attendee data from .xlsx or .csv files.</p>
          </div>
          {parsedGuests.length > 0 && (
            <div className="flex gap-3 w-full md:w-auto">
              <button
                onClick={() => {
                  setUploadMode('merge');
                  setShowConfirmModal(true);
                }}
                className="flex-1 md:flex-initial h-12 px-6 bg-[#0051d5] text-white font-bold rounded hover:bg-[#003ea8] transition-colors"
              >
                Import List
              </button>
              <button
                onClick={() => {
                  setFile(null);
                  setParsedGuests([]);
                  setHeadersMap({});
                  setSuccess('');
                  setError('');
                }}
                className="h-12 px-4 border border-[#c6c6cd] text-black font-semibold rounded hover:bg-[#f6f3f5] transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </header>

        {error && (
          <div className="p-4 bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a] rounded text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-100 text-[#15803d] border border-green-500 rounded text-sm font-semibold">
            {success}
          </div>
        )}

        {/* Drag & Drop Zone */}
        {parsedGuests.length === 0 && (
          <section
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="bg-white border-2 border-dashed border-[#76777d] hover:border-[#0051d5] transition-colors p-12 flex flex-col items-center justify-center text-center min-h-[250px] cursor-pointer group rounded"
          >
            <div className="w-16 h-16 bg-[#f0edef] rounded-full flex items-center justify-center mb-4 group-hover:bg-[#dae2fd] transition-colors">
              <span className="material-symbols-outlined text-4xl text-[#76777d] group-hover:text-[#0051d5]">
                cloud_upload
              </span>
            </div>
            <h2 className="text-xl font-bold text-black mb-2">
              {loading ? 'Reading spreadsheet data...' : 'Drag and drop your spreadsheet here'}
            </h2>
            <p className="text-sm text-[#45464d] mb-4">
              or click to browse Excel (.xlsx) or CSV (.csv) files
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
          </section>
        )}

        {/* Column Mapping & Preview Table */}
        {parsedGuests.length > 0 && (
          <div className="space-y-6">
            <div className="bg-[#f0edef] border border-[#c6c6cd] p-4 rounded text-sm">
              <h3 className="font-bold text-black mb-2">Column Mapping Identified:</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs font-mono">
                {Object.entries(headersMap).map(([key, raw]) => (
                  <div key={key} className="bg-white p-2 border border-[#c6c6cd] rounded">
                    <div className="text-[#45464d] font-sans font-bold">{key}:</div>
                    <div className="text-black font-semibold mt-1 truncate">{raw}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#c6c6cd] rounded overflow-hidden flex flex-col">
              <div className="p-4 border-b border-[#c6c6cd] bg-[#fcf8fa]">
                <h3 className="font-bold text-black">Guest List Preview (First 10 records)</h3>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f6f3f5] border-b border-[#c6c6cd]">
                      <th className="p-3 text-xs font-bold uppercase text-[#45464d]">Name</th>
                      <th className="p-3 text-xs font-bold uppercase text-[#45464d]">Email</th>
                      <th className="p-3 text-xs font-bold uppercase text-[#45464d]">Ticket Type</th>
                      <th className="p-3 text-xs font-bold uppercase text-[#45464d]">Payment Status</th>
                      <th className="p-3 text-xs font-bold uppercase text-[#45464d]">Amount Paid</th>
                      <th className="p-3 text-xs font-bold uppercase text-[#45464d]">Order ID</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {parsedGuests.slice(0, 10).map((g, index) => (
                      <tr key={index} className="border-b border-[#e4e2e4] hover:bg-[#f6f3f5]">
                        <td className="p-3 font-bold text-black">{g.full_name}</td>
                        <td className="p-3 font-mono text-xs text-[#45464d]">{g.email || '-'}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-[#f6f3f5] border border-[#c6c6cd] text-xs font-mono font-bold uppercase rounded-sm">
                            {g.ticket_type}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-xs font-bold uppercase">{g.payment_status}</span>
                        </td>
                        <td className="p-3 font-mono text-xs">
                          {g.amount_paid !== null ? `$${g.amount_paid}` : '-'}
                        </td>
                        <td className="p-3 font-mono text-xs">{g.order_id || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Upload Method Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#c6c6cd] rounded max-w-md w-full p-6 shadow-lg">
            <div className="flex items-center gap-3 text-black mb-4">
              <span className="material-symbols-outlined text-3xl">upload_file</span>
              <h3 className="text-xl font-bold">Import Configuration</h3>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-[#45464d]">
                Choose how you want to import <strong>{parsedGuests.length}</strong> guest records into the database:
              </p>
              
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 border border-[#c6c6cd] hover:border-black rounded cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="upload-mode"
                    className="mt-1"
                    checked={uploadMode === 'merge'}
                    onChange={() => setUploadMode('merge')}
                  />
                  <div>
                    <div className="font-bold text-black">Merge with existing list (Recommended)</div>
                    <div className="text-xs text-[#45464d] mt-1">
                      Upserts records. Existing check-in statuses are preserved, details are updated, and new guests are appended.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border border-[#c6c6cd] hover:border-black rounded cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="upload-mode"
                    className="mt-1"
                    checked={uploadMode === 'replace'}
                    onChange={() => setUploadMode('replace')}
                  />
                  <div>
                    <div className="font-bold text-black text-red-600">Replace list entirely</div>
                    <div className="text-xs text-[#45464d] mt-1">
                      Wipes the database and replaces the entire guest table with the contents of this upload.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-[#c6c6cd] text-black font-semibold rounded hover:bg-[#f6f3f5]"
              >
                Cancel
              </button>
              <button
                onClick={triggerUpload}
                className="px-4 py-2 bg-black text-white font-semibold rounded hover:bg-[#303032]"
              >
                Confirm Import
              </button>
            </div>
          </div>
        </div>
      )}
    </NavigationLayout>
  );
}
