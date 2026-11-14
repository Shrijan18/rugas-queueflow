import React from 'react';
import { Link } from 'react-router-dom';
import { Users, PlayCircle, CheckCircle2, ArrowRight, MoreVertical, Edit2, Trash2 } from 'lucide-react';

const QueueCard = ({ queue, onEdit, onDelete }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-brand-300 card-hover flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-xs font-semibold uppercase tracking-wider border border-brand-100">
                {queue.prefix || 'Q'}
              </span>
              <h3 className="text-base font-bold text-slate-900 truncate max-w-[200px]" title={queue.name}>
                {queue.name}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Created {new Date(queue.created_at).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center space-x-1">
            {onEdit && (
              <button
                onClick={() => onEdit(queue)}
                title="Rename Queue"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(queue)}
                title="Delete Queue"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Currently Serving Banner */}
        <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Currently Serving
          </span>
          {queue.current_serving ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-bold text-xs">
                  {queue.current_serving.token_number}
                </span>
                <span className="text-xs font-semibold text-slate-800 truncate max-w-[140px]">
                  {queue.current_serving.person_name}
                </span>
              </div>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No token currently serving</p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 py-2 border-t border-slate-100 mb-4 text-center">
          <div>
            <span className="block text-lg font-bold text-amber-600">
              {queue.waiting_count || 0}
            </span>
            <span className="text-[11px] font-medium text-slate-400">Waiting</span>
          </div>
          <div>
            <span className="block text-lg font-bold text-emerald-600">
              {queue.completed_count || 0}
            </span>
            <span className="text-[11px] font-medium text-slate-400">Done</span>
          </div>
          <div>
            <span className="block text-lg font-bold text-slate-700">
              {queue.total_tokens || 0}
            </span>
            <span className="text-[11px] font-medium text-slate-400">Total</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <Link
        to={`/queues/${queue.id}`}
        className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-50 hover:bg-brand-100/80 text-brand-700 font-semibold text-xs transition-colors"
      >
        <span>Manage Queue</span>
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
};

export default QueueCard;

