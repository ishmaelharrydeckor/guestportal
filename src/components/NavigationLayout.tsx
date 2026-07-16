'use strict';
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface NavigationLayoutProps {
  children: React.ReactNode;
}

export default function NavigationLayout({ children }: NavigationLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = React.useState<string>('Staff');
  const [mounted, setMounted] = React.useState(false);

  const handleLogout = () => {
    // Fire-and-forget server-side cookie deletion
    fetch('/api/auth/logout', { method: 'POST' }).catch((err) => {
      console.error('Logout API failed:', err);
    });

    // Clean up local state and redirect instantly
    try {
      localStorage.removeItem('guest_portal_session');
      localStorage.removeItem('guest_portal_role');
    } catch (e) {
      console.warn('Failed to clear LocalStorage:', e);
    }
    window.location.href = '/login';
  };

  React.useEffect(() => {
    setMounted(true);
    let session: string | null = null;
    let currentRole = 'Staff';

    try {
      session = localStorage.getItem('guest_portal_session');
      currentRole = localStorage.getItem('guest_portal_role') || 'Staff';
    } catch (e) {
      console.warn('LocalStorage access failed:', e);
    }

    // Fallback to cookie if localStorage is not set/supported
    if (!session) {
      const getCookie = (name: string) => {
        if (typeof window === 'undefined') return '';
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
        return '';
      };
      session = getCookie('guest_portal_user');
      currentRole = getCookie('guest_portal_role') || 'Staff';
    }

    if (!session) {
      window.location.href = '/login';
      return;
    }

    setRole(currentRole);

    if (currentRole === 'Staff') {
      const isRestricted =
        pathname === '/dashboard' ||
        pathname === '/log' ||
        pathname === '/upload';
      if (isRestricted) {
        window.location.href = '/';
      }
    }
  }, [pathname]);

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/', label: 'Check-In', icon: 'how_to_reg' },
    { href: '/log', label: 'Attendance Log', icon: 'assignment' },
    { href: '/upload', label: 'Upload', icon: 'upload_file' },
  ].filter((link) => {
    if (!mounted) return false;
    if (role === 'Staff') {
      return link.href === '/';
    }
    return true;
  });

  return (
    <div className="bg-[#fcf8fa] text-[#1b1b1d] font-sans min-h-screen flex flex-col antialiased">
      {/* Top NavBar (Desktop/Tablet) */}
      <nav className="bg-white text-black text-sm border-b-2 border-[#c6c6cd] hidden md:flex justify-between items-center w-full px-4 h-16 fixed top-0 z-50">
        <div className="flex items-center gap-6 max-w-7xl mx-auto w-full justify-between">
          <div className="flex items-center gap-6">
            <span className="text-xl font-black text-black">EventReg Ops</span>
            <div className="flex gap-2">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`py-2 px-3 transition-colors rounded ${
                      isActive
                        ? 'text-[#0051d5] font-bold border-b-2 border-[#0051d5] rounded-none opacity-100'
                        : 'text-[#45464d] hover:text-black hover:bg-[#f0edef]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full border border-[#c6c6cd] overflow-hidden bg-[#f0edef] flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">person</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-[#45464d] hover:text-black text-xs font-bold uppercase transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Top NavBar (Mobile) */}
      <nav className="md:hidden flex justify-between items-center w-full px-4 h-16 bg-white border-b-2 border-[#c6c6cd] fixed top-0 z-50">
        <div className="font-bold text-lg text-black">EventReg Ops</div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleLogout}
            className="text-[#45464d] hover:text-black text-xs font-bold uppercase flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      </nav>

      {/* Page Content Canvas */}
      <main className="flex-1 w-full pt-20 pb-20 md:pb-8 flex flex-col">
        {children}
      </main>

      {/* BottomNavBar (Mobile fallback navigation) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-[#c6c6cd] flex justify-around items-center h-16 z-50 pb-safe">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                isActive ? 'text-[#0051d5] font-bold bg-[#316bf3]/10' : 'text-[#45464d]'
              }`}
            >
              <span className={`material-symbols-outlined text-2xl ${isActive ? 'filled' : ''}`}>
                {link.icon}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
