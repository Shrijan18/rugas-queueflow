import React from 'react';
import { Menu, HelpCircle, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Navbar = ({ onMenuClick, onToggleGuide, title = 'Dashboard' }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Side: Mobile toggle & Title */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
          </div>
        </div>

        {/* Right Side: Profile & Quick Actions */}
        <div className="flex items-center space-x-3">
          {/* Help & Walkthrough Button */}
          {onToggleGuide && (
            <button
              onClick={onToggleGuide}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-slate-200 hover:border-brand-300 bg-white hover:bg-brand-50/60 text-slate-600 hover:text-brand-700 text-xs font-semibold transition-all shadow-2xs"
              title="Toggle QueueFlow Help Guide"
            >
              <HelpCircle className="w-3.5 h-3.5 text-brand-600" />
              <span>Help Guide</span>
            </button>
          )}

          <div className="hidden md:flex items-center text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            QueueFlow Online
          </div>

          {/* User initials bubble */}
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-semibold text-xs flex items-center justify-center shadow-xs">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'M'}
            </div>
            <div className="hidden lg:block text-left">
              <span className="block text-xs font-semibold text-slate-800 leading-tight">
                {user?.full_name || 'Manager'}
              </span>
              <span className="block text-[10px] text-slate-500 font-medium">Administrator</span>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

