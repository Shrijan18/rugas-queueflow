import React from 'react';
import { User, Mail, Shield, Calendar, LogOut, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manager Profile</h1>
        <p className="text-xs text-slate-500 mt-1">
          Review your account details, active permissions, and system security credentials.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 pb-8 border-b border-slate-100">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-brand-500/20">
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'M'}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-bold text-slate-900">{user?.full_name || 'Manager'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
            <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
                Queue Administrator
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Active Session
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center space-x-1.5 transition-colors self-center sm:self-start"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Account ID
            </span>
            <span className="font-mono text-sm font-bold text-slate-800">
              MGR-{String(user?.id || 1).padStart(4, '0')}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Registered Email
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {user?.email || 'N/A'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Member Since
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Security Protocol
            </span>
            <span className="text-sm font-semibold text-emerald-600 flex items-center">
              <Shield className="w-4 h-4 mr-1 text-emerald-500" />
              JWT + HTTP-Only Cookie
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

