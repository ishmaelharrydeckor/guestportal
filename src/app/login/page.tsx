'use strict';
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (data.success) {
        try {
          localStorage.setItem('guest_portal_session', username || 'Staff');
          localStorage.setItem('guest_portal_role', data.role);
        } catch (e) {
          console.warn('LocalStorage is disabled or restricted:', e);
        }
        window.location.href = data.role === 'Admin' ? '/dashboard' : '/';
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#fcf8fa] text-[#1b1b1d] min-h-screen flex items-center justify-center p-4 antialiased">
      <main className="w-full max-w-md bg-white border-2 border-[#76777d] rounded p-8 md:p-12 shadow-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#000000] text-white rounded-full mb-4">
            <span className="material-symbols-outlined text-4xl">qr_code_scanner</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-black">EventReg Ops</h1>
          <p className="text-sm text-[#45464d] mt-2">Authorized Staff Portal</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a] rounded text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1b1b1d]" htmlFor="username">
              Staff Username
            </label>
            <input
              id="username"
              type="text"
              className="block w-full px-3 py-3 border border-[#c6c6cd] rounded bg-[#f6f3f5] text-[#1b1b1d] font-mono text-sm placeholder:text-[#76777d] focus:ring-2 focus:ring-[#0051d5] focus:border-[#0051d5] focus:bg-white outline-none transition-colors"
              placeholder="e.g. John.Doe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1b1b1d]" htmlFor="password">
              Terminal Password
            </label>
            <input
              id="password"
              type="password"
              className="block w-full px-3 py-3 border border-[#c6c6cd] rounded bg-[#f6f3f5] text-[#1b1b1d] font-mono text-sm placeholder:text-[#76777d] focus:ring-2 focus:ring-[#0051d5] focus:border-[#0051d5] focus:bg-white outline-none transition-colors"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#000000] text-white font-semibold rounded hover:bg-[#303032] focus:ring-2 focus:ring-offset-2 focus:ring-black outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{loading ? 'Signing In...' : 'Sign In'}</span>
              <span className="material-symbols-outlined text-xl">login</span>
            </button>
          </div>

          <div className="text-center pt-6 mt-6 border-t border-[#e4e2e4]">
            <p className="text-xs text-[#45464d] flex items-center justify-center gap-1 font-medium">
              <span className="material-symbols-outlined text-sm">shield</span>
              Secured connection. Internal use only.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
