import React from 'react';
import { X, Sparkles, HelpCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const GuidedWalkthroughBanner = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 border border-indigo-500/30 shadow-lg relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-400/30 text-brand-300 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
                QueueFlow Walkthrough Guide
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Ready
              </span>
            </div>
            <h4 className="text-sm font-bold text-white tracking-tight">
              Mastering Your Queue Management Workflow in 4 Simple Steps
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs text-slate-300">
              <div className="flex items-center space-x-2 bg-white/5 rounded-lg p-2 border border-white/5">
                <span className="w-5 h-5 rounded-full bg-brand-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                <span><strong>Create Queues</strong> with custom prefix codes</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/5 rounded-lg p-2 border border-white/5">
                <span className="w-5 h-5 rounded-full bg-brand-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                <span><strong>Add Persons</strong> to auto-issue sequential tokens</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/5 rounded-lg p-2 border border-white/5">
                <span className="w-5 h-5 rounded-full bg-brand-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                <span><strong>Rearrange Priority</strong> with Move Up / Move Down</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/5 rounded-lg p-2 border border-white/5">
                <span className="w-5 h-5 rounded-full bg-brand-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">4</span>
                <span><strong>Call Next & Complete</strong> with live timer</span>
              </div>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title="Dismiss Guide"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default GuidedWalkthroughBanner;
