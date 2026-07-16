'use strict';
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import NavigationLayout from '@/components/NavigationLayout';

interface Guest {
  id: string;
  full_name: string;
  email: string | null;
  ticket_type: string;
  payment_status: string;
  amount_paid: number | null;
  order_id: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  checked_in_by: string | null;
}

export default function CheckInPage() {
  const [query, setQuery] = useState('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicateModal, setDuplicateModal] = useState<{
    show: boolean;
    guest: Guest | null;
    time: string | null;
    by: string | null;
  }>({ show: false, guest: null, time: null, by: null });
  
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

  // Fetch guests based on search query
  const fetchGuests = useCallback(async (searchQuery: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/guests/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setGuests(data.guests || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch guest list');
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger search on mount and when query changes
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchGuests(query);
    }, 150); // Debounce searches to avoid spamming SQLite

    return () => clearTimeout(delayDebounceFn);
  }, [query, fetchGuests]);

  // Execute checkin action
  const handleCheckIn = async (guestId: string, force = false) => {
    try {
      const res = await fetch('/api/guests/checkin', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ guestId, action: 'checkin', force }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Check-in failed');
        return;
      }

      if (data.success === false && data.code === 'ALREADY_CHECKED_IN') {
        // Trigger the duplicate modal
        const targetGuest = guests.find((g) => g.id === guestId) || null;
        setDuplicateModal({
          show: true,
          guest: targetGuest,
          time: data.checked_in_at,
          by: data.checked_in_by,
        });
        return;
      }

      // Success: Close modal if open, refresh search list
      setDuplicateModal({ show: false, guest: null, time: null, by: null });
      fetchGuests(query);
    } catch (err) {
      alert('An error occurred during check-in.');
    }
  };

  // Execute undo action
  const handleUndo = async (guestId: string) => {
    if (!confirm('Are you sure you want to undo check-in for this guest?')) return;
    try {
      const res = await fetch('/api/guests/checkin', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ guestId, action: 'undo' }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Undo action failed');
        return;
      }

      fetchGuests(query);
    } catch (err) {
      alert('An error occurred during undo.');
    }
  };

  // Helper for rendering badges
  const renderTicketBadge = (type: string) => {
    const cleanType = (type || 'Regular').toUpperCase();
    let classes = 'bg-[#e4e2e4] text-[#1b1b1d] border-[#c6c6cd]'; // default Regular
    if (cleanType === 'VIP') {
      classes = 'bg-[#FDE68A] text-black border-[#76777d]';
    } else if (cleanType === 'SPEAKER') {
      classes = 'bg-[#581C87] text-white border-[#76777d]';
    } else if (cleanType === 'SPONSOR') {
      classes = 'bg-[#0051d5] text-white border-[#c6c6cd]';
    }

    return (
      <span className={`font-mono text-xs font-bold px-2 py-0.5 uppercase rounded-sm border ${classes}`}>
        {type || 'Regular'}
      </span>
    );
  };

  // Helper for rendering payment status
  const renderPaymentStatus = (status: string) => {
    const cleanStatus = (status || 'Issue').toLowerCase();
    if (cleanStatus === 'paid') {
      return (
        <span className="bg-[#f0edef] text-[#15803d] font-mono text-xs font-bold px-2 py-0.5 uppercase rounded-sm border border-[#c6c6cd]">
          Paid
        </span>
      );
    } else if (cleanStatus === 'pending') {
      return (
        <span className="bg-[#f0edef] text-[#B45309] font-mono text-xs font-bold px-2 py-0.5 uppercase rounded-sm border border-[#c6c6cd]">
          Pending
        </span>
      );
    } else {
      return (
        <span className="bg-[#ffdad6] text-[#93000a] font-mono text-xs font-bold px-2 py-0.5 uppercase rounded-sm border border-[#ba1a1a] flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">warning</span>
          See Finance
        </span>
      );
    }
  };

  // Formatter for timestamp
  const formatTime = (isoString: string | null) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <NavigationLayout>
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-10 flex flex-col gap-6 pt-4">
        {/* Search Header */}
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-[#1b1b1d] tracking-tight">Guest Check-In</h1>
          <p className="text-[#45464d] text-sm">Scan QR code or search by name to process arrivals.</p>
          
          <div className="relative mt-4 w-full">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#76777d] text-2xl">
              search
            </span>
            <input
              aria-label="Search guest name"
              autoFocus
              className="w-full h-16 pl-14 pr-12 bg-white border-2 border-[#c6c6cd] rounded font-medium text-lg text-black focus:border-[#0051d5] focus:ring-0 outline-none transition-colors shadow-sm"
              placeholder="Search guest name or email..."
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#76777d] hover:text-black p-2 flex items-center justify-center"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="p-4 bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a] rounded text-sm">
            {error}
          </div>
        )}

        {/* Results Area */}
        <section className="flex flex-col gap-4 w-full mt-2 pb-16">
          {loading && guests.length === 0 ? (
            <div className="text-center py-8 text-[#45464d] font-semibold">Searching guest records...</div>
          ) : guests.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-[#c6c6cd] rounded bg-[#f6f3f5]">
              <span className="material-symbols-outlined text-6xl text-[#76777d] mb-4">search_off</span>
              <h3 className="text-lg font-bold text-black mb-2">No guests found</h3>
              <p className="text-sm text-[#45464d] max-w-md">
                Try searching with a different name, email, or import a guest list from the upload page.
              </p>
            </div>
          ) : (
            guests.map((g) => {
              const isCheckedIn = g.checked_in;
              const hasIssue = g.payment_status.toLowerCase() === 'issue';

              if (isCheckedIn) {
                return (
                  <article
                    key={g.id}
                    className="bg-white border-2 border-[#c6c6cd] p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden rounded"
                  >
                    {/* Faint green background overlay indicating success */}
                    <div className="absolute inset-0 bg-green-500/5 z-0" />
                    
                    <div className="flex flex-col gap-1 w-full relative z-10">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h2 className="text-lg font-bold text-[#45464d] line-through decoration-[#c6c6cd]">
                          {g.full_name}
                        </h2>
                        {renderTicketBadge(g.ticket_type)}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="font-mono text-[#45464d]">
                          ID: {g.order_id || 'N/A'}
                        </span>
                        <span className="text-[#c6c6cd]">•</span>
                        <div className="flex items-center gap-1 text-[#15803d] font-bold">
                          <span className="material-symbols-outlined text-base">check_circle</span>
                          <span>
                            Checked In at {formatTime(g.checked_in_at)} by {g.checked_in_by || 'Staff'}
                          </span>
                        </div>
                        <span className="text-[#c6c6cd]">•</span>
                        <button
                          onClick={() => handleUndo(g.id)}
                          className="text-[#0051d5] hover:underline font-mono font-bold"
                        >
                          Undo Check-in
                        </button>
                      </div>
                    </div>
                  </article>
                );
              }

              return (
                <article
                  key={g.id}
                  className="bg-white border border-[#c6c6cd] p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-[#76777d] transition-colors rounded"
                >
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-lg font-bold text-black">{g.full_name}</h2>
                      {renderTicketBadge(g.ticket_type)}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="font-mono text-[#45464d]">
                        ID: {g.order_id || 'N/A'}
                      </span>
                      <span className="text-[#c6c6cd]">•</span>
                      {renderPaymentStatus(g.payment_status)}
                    </div>
                  </div>

                  <button
                    disabled={hasIssue}
                    onClick={() => handleCheckIn(g.id)}
                    className={`w-full sm:w-auto h-12 px-6 font-bold rounded flex items-center justify-center gap-2 flex-shrink-0 transition-opacity active:opacity-80 ${
                      hasIssue
                        ? 'bg-[#e4e2e4] text-[#76777d] cursor-not-allowed border border-[#c6c6cd]'
                        : 'bg-[#0051d5] text-white hover:bg-[#003ea8]'
                    }`}
                  >
                    Check In
                  </button>
                </article>
              );
            })
          )}
        </section>
      </div>

      {/* Duplicate Scan Warning Modal */}
      {duplicateModal.show && duplicateModal.guest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border-2 border-[#ba1a1a] rounded max-w-md w-full p-6 shadow-lg">
            <div className="flex items-center gap-3 text-[#ba1a1a] mb-4">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="text-xl font-bold">Duplicate Scan Detected</h3>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-black">
                <strong>{duplicateModal.guest.full_name}</strong> is already checked in.
              </p>
              <div className="p-3 bg-[#ffdad6] border border-[#ba1a1a] rounded text-xs text-[#93000a] space-y-1">
                <div><strong>Check-in Time:</strong> {duplicateModal.time ? new Date(duplicateModal.time).toLocaleString() : 'N/A'}</div>
                <div><strong>Checked-in By:</strong> {duplicateModal.by || 'Unknown'}</div>
              </div>
              <p className="text-xs text-[#45464d]">
                Duplicate check-ins can indicate sharing of tickets. Would you like to check this guest in again anyway?
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDuplicateModal({ show: false, guest: null, time: null, by: null })}
                className="px-4 py-2 border border-[#c6c6cd] text-black font-semibold rounded hover:bg-[#f0edef] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCheckIn(duplicateModal.guest!.id, true)}
                className="px-4 py-2 bg-[#ba1a1a] text-white font-semibold rounded hover:bg-[#93000a] transition-colors"
              >
                Yes, Check In Again
              </button>
            </div>
          </div>
        </div>
      )}
    </NavigationLayout>
  );
}
