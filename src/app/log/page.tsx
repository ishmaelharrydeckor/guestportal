'use strict';
'use client';

import React, { useState, useEffect } from 'react';
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

export default function LogPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter States
  const [ticketType, setTicketType] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    
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
      'x-staff-user': session,
      'x-staff-role': role,
    };
  };

  const fetchGuests = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        ticketType,
        status,
        sortBy,
        sortOrder,
      });
      const res = await fetch(`/api/guests/list?${queryParams.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch attendance log');
      const data = await res.json();
      setGuests(data.guests || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Error loading guest log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests();
  }, [ticketType, status, sortBy, sortOrder]);

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return 'unfold_more';
    return sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward';
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <NavigationLayout>
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-10 py-6 flex flex-col gap-6">
        {/* Page Header */}
        <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 pb-4 border-b-2 border-[#c6c6cd]">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight m-0">Attendance Log</h1>
            <p className="text-sm text-[#45464d] mt-1">
              Synchronized log of all guest arrivals and ticket details.
            </p>
          </div>
          <a
            href={
              typeof window !== 'undefined'
                ? `/api/guests/export?role=${localStorage.getItem('guest_portal_role') || ''}&session=${localStorage.getItem('guest_portal_session') || ''}`
                : '/api/guests/export'
            }
            download="attendance_report.csv"
            className="h-12 px-6 bg-[#0051d5] text-white font-bold rounded flex items-center justify-center gap-2 hover:bg-[#003ea8] transition-opacity whitespace-nowrap border border-[#0051d5] shadow-sm text-center w-full md:w-auto"
          >
            <span className="material-symbols-outlined">download</span>
            Export Attendance (.CSV)
          </a>
        </header>

        {error && (
          <div className="p-4 bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a] rounded text-sm">
            {error}
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-wrap gap-4 items-center justify-between bg-[#f6f3f5] p-4 border border-[#c6c6cd] rounded">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Ticket Type Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-[#45464d]" htmlFor="ticket-filter">
                Ticket Type
              </label>
              <select
                id="ticket-filter"
                className="h-10 px-3 bg-white border border-[#c6c6cd] rounded text-sm font-semibold outline-none focus:border-[#0051d5]"
                value={ticketType}
                onChange={(e) => setTicketType(e.target.value)}
              >
                <option value="">All Tickets</option>
                <option value="VIP">VIP</option>
                <option value="Regular">Regular</option>
                <option value="Speaker">Speaker</option>
                <option value="Sponsor">Sponsor</option>
              </select>
            </div>

            {/* Check-In Status Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-[#45464d]" htmlFor="status-filter">
                Check-In Status
              </label>
              <select
                id="status-filter"
                className="h-10 px-3 bg-white border border-[#c6c6cd] rounded text-sm font-semibold outline-none focus:border-[#0051d5]"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All Guests</option>
                <option value="checked_in">Checked In</option>
                <option value="not_checked_in">Not Checked In</option>
              </select>
            </div>
          </div>

          <div className="text-xs font-mono text-[#45464d] font-bold">
            Total Results: {guests.length}
          </div>
        </div>

        {/* Attendance Log Table */}
        <div className="bg-white border border-[#c6c6cd] rounded overflow-hidden flex flex-col mb-12">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#f6f3f5] border-b border-[#c6c6cd]">
                  <th className="p-4 text-xs font-bold uppercase text-[#45464d] w-24 text-center">Status</th>
                  <th
                    className="p-4 text-xs font-bold uppercase text-[#45464d] cursor-pointer hover:bg-[#e4e2e4] transition-colors select-none"
                    onClick={() => toggleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Guest Name
                      <span className="material-symbols-outlined text-sm">{getSortIcon('name')}</span>
                    </div>
                  </th>
                  <th className="p-4 text-xs font-bold uppercase text-[#45464d]">Email</th>
                  <th className="p-4 text-xs font-bold uppercase text-[#45464d] w-36">Ticket Type</th>
                  <th className="p-4 text-xs font-bold uppercase text-[#45464d] w-32">Payment</th>
                  <th
                    className="p-4 text-xs font-bold uppercase text-[#45464d] cursor-pointer hover:bg-[#e4e2e4] transition-colors select-none"
                    onClick={() => toggleSort('checkin_time')}
                  >
                    <div className="flex items-center gap-1">
                      Time Checked In
                      <span className="material-symbols-outlined text-sm">{getSortIcon('checkin_time')}</span>
                    </div>
                  </th>
                  <th className="p-4 text-xs font-bold uppercase text-[#45464d] w-36">Checked In By</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-[#45464d] font-semibold bg-white">
                      Loading guest log...
                    </td>
                  </tr>
                ) : guests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-[#45464d] font-semibold bg-white">
                      No guests match the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  guests.map((g, index) => {
                    const isCheckedIn = g.checked_in;
                    const paymentStatus = g.payment_status.toLowerCase();
                    return (
                      <tr
                        key={g.id}
                        className={`border-b border-[#e4e2e4] hover:bg-[#f6f3f5] transition-colors h-14 ${
                          index % 2 === 1 ? 'bg-[#fcf8fa]' : 'bg-white'
                        }`}
                      >
                        <td className="p-4 text-center">
                          <span
                            className={`material-symbols-outlined ${
                              isCheckedIn ? 'text-[#15803d]' : 'text-[#76777d]'
                            }`}
                          >
                            {isCheckedIn ? 'check_circle' : 'pending'}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-black">{g.full_name}</td>
                        <td className="p-4 text-[#45464d] font-mono text-xs">{g.email || 'N/A'}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2 py-0.5 bg-[#f6f3f5] text-black border border-[#c6c6cd] text-xs font-bold uppercase rounded-sm">
                            {g.ticket_type}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`text-xs font-bold uppercase ${
                              paymentStatus === 'paid'
                                ? 'text-[#15803d]'
                                : paymentStatus === 'pending'
                                ? 'text-[#B45309]'
                                : 'text-[#ba1a1a]'
                            }`}
                          >
                            {g.payment_status}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-xs text-[#45464d]">
                          {formatTime(g.checked_in_at)}
                        </td>
                        <td className="p-4 font-mono text-xs text-[#45464d]">
                          {g.checked_in_by || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </NavigationLayout>
  );
}
