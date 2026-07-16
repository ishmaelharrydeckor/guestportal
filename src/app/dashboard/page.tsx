'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import NavigationLayout from '@/components/NavigationLayout';

interface RecentActivity {
  id: string;
  full_name: string;
  ticket_type: string;
  payment_status: string;
  checked_in_at: string;
  checked_in_by: string;
}

interface StatsData {
  total: number;
  checkedIn: number;
  notArrived: number;
  pendingIssues: number;
  issueCount: number;
  recentActivity: RecentActivity[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData>({
    total: 0,
    checkedIn: 0,
    notArrived: 0,
    pendingIssues: 0,
    issueCount: 0,
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const fetchStats = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch('/api/guests/stats', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch statistics');
      const data = await res.json();
      setStats(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Error loading dashboard metrics');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchStats(true);

    // Setup polling every 5 seconds for live updates
    const interval = setInterval(() => {
      fetchStats();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getPercentage = () => {
    if (stats.total === 0) return 0;
    return Math.round((stats.checkedIn / stats.total) * 1000) / 10;
  };

  const formatTime = (isoString: string) => {
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
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-10 py-6 flex flex-col gap-6">
        {/* Page Header & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">Terminal Dashboard</h1>
            <p className="text-sm text-[#45464d] mt-1">Real-time metrics for entrance registration.</p>
          </div>
          <div className="flex flex-col sm:flex-row w-full md:w-auto gap-4">
            <Link
              href="/"
              className="flex items-center justify-center gap-2 px-6 h-12 bg-[#0051d5] text-white font-bold rounded hover:bg-[#003ea8] active:scale-95 transition-all shadow-sm w-full sm:w-auto text-center"
            >
              <span className="material-symbols-outlined">qr_code_scanner</span>
              Start Check-In
            </Link>
            <Link
              href="/upload"
              className="flex items-center justify-center gap-2 px-6 h-12 bg-white text-black border border-[#c6c6cd] font-bold rounded hover:bg-[#f0edef] active:scale-95 transition-all w-full sm:w-auto text-center"
            >
              <span className="material-symbols-outlined">upload_file</span>
              Upload Guest List
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a] rounded text-sm">
            {error}
          </div>
        )}

        {/* Big Stat Cards (Bento Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total */}
          <div className="bg-[#f6f3f5] border border-[#c6c6cd] rounded p-6 flex flex-col justify-between min-h-[140px] hover:border-[#76777d] transition-colors">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-[#45464d]">Total Guests</span>
              <span className="material-symbols-outlined text-[#76777d]">groups</span>
            </div>
            <div className="text-3xl font-black text-black mt-4">{loading ? '...' : stats.total}</div>
          </div>

          {/* Checked In */}
          <div className="bg-[#f6f3f5] border border-[#c6c6cd] rounded p-6 flex flex-col justify-between min-h-[140px] relative overflow-hidden group">
            <div className="relative z-10 flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-[#45464d]">Checked In</span>
              <span className="material-symbols-outlined text-[#0051d5]">check_circle</span>
            </div>
            <div className="relative z-10 flex items-baseline gap-2 mt-4">
              <span className="text-3xl font-black text-black">{loading ? '...' : stats.checkedIn}</span>
              <span className="font-mono text-sm text-[#0051d5] font-bold">{getPercentage()}%</span>
            </div>
            <div className="w-full bg-[#e4e2e4] h-1.5 mt-2 rounded-full overflow-hidden relative z-10">
              <div className="bg-[#0051d5] h-full transition-all duration-500" style={{ width: `${getPercentage()}%` }}></div>
            </div>
          </div>

          {/* Not Arrived */}
          <div className="bg-[#f6f3f5] border border-[#c6c6cd] rounded p-6 flex flex-col justify-between min-h-[140px]">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-[#45464d]">Not Arrived</span>
              <span className="material-symbols-outlined text-[#76777d]">pending</span>
            </div>
            <div className="text-3xl font-black text-black mt-4">{loading ? '...' : stats.notArrived}</div>
          </div>

          {/* Payment Issues */}
          <div className={`border-2 rounded p-6 flex flex-col justify-between min-h-[140px] ${
            stats.issueCount > 0 ? 'bg-[#ffdad6] border-[#ba1a1a]' : 'bg-[#f6f3f5] border-[#c6c6cd]'
          }`}>
            <div className="flex justify-between items-start">
              <span className={`text-xs font-bold uppercase tracking-wider ${stats.issueCount > 0 ? 'text-[#ba1a1a]' : 'text-[#45464d]'}`}>
                Payment Issues
              </span>
              <span className={`material-symbols-outlined ${stats.issueCount > 0 ? 'text-[#ba1a1a]' : 'text-[#76777d]'}`}>error</span>
            </div>
            <div className={`text-3xl font-black mt-4 ${stats.issueCount > 0 ? 'text-[#ba1a1a]' : 'text-black'}`}>
              {loading ? '...' : stats.issueCount}
            </div>
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="bg-white border border-[#c6c6cd] rounded overflow-hidden mt-4 flex flex-col">
          <div className="p-4 border-b-2 border-[#c6c6cd] bg-[#fcf8fa] flex justify-between items-center">
            <h2 className="text-lg font-bold text-black">Recent Live Activity (Checked In)</h2>
            <Link href="/log" className="text-[#0051d5] font-bold text-sm hover:underline flex items-center gap-1">
              View Attendance Log <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
          
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-[#f6f3f5] border-b border-[#c6c6cd]">
                  <th className="p-4 text-xs font-bold uppercase text-[#45464d] w-16 text-center">Status</th>
                  <th className="p-4 text-xs font-bold uppercase text-[#45464d]">Guest Name</th>
                  <th className="p-4 text-xs font-bold uppercase text-[#45464d]">Ticket Type</th>
                  <th className="p-4 text-xs font-bold uppercase text-[#45464d]">Payment Status</th>
                  <th className="p-4 text-xs font-bold uppercase text-[#45464d]">Time Checked In</th>
                  <th className="p-4 text-xs font-bold uppercase text-[#45464d]">Checked In By</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {stats.recentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#45464d] font-semibold bg-white">
                      No recent check-ins recorded yet.
                    </td>
                  </tr>
                ) : (
                  stats.recentActivity.map((r, index) => (
                    <tr
                      key={r.id}
                      className={`border-b border-[#e4e2e4] hover:bg-[#f6f3f5] transition-colors h-14 ${
                        index % 2 === 1 ? 'bg-[#fcf8fa]' : 'bg-white'
                      }`}
                    >
                      <td className="p-4 text-center">
                        <span className="material-symbols-outlined text-[#15803d]">check_circle</span>
                      </td>
                      <td className="p-4 font-bold text-black">{r.full_name}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2 py-0.5 bg-[#f6f3f5] text-black border border-[#c6c6cd] text-xs font-bold uppercase rounded-sm">
                          {r.ticket_type}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-[#15803d] font-bold text-xs uppercase">{r.payment_status}</span>
                      </td>
                      <td className="p-4 font-mono text-[#45464d]">{formatTime(r.checked_in_at)}</td>
                      <td className="p-4 font-mono text-[#45464d]">{r.checked_in_by || 'Staff'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </NavigationLayout>
  );
}
