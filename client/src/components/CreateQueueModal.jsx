import React, { useState, useEffect } from 'react';
import { X, Layers, Loader2 } from 'lucide-react';

const CreateQueueModal = ({ isOpen, onClose, onSubmit, editingQueue = null }) => {
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingQueue) {
      setName(editingQueue.name || '');
      setPrefix(editingQueue.prefix || '');
    } else {
      setName('');
      setPrefix('');
    }
    setError('');
  }, [editingQueue, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a queue name.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await onSubmit({
        name: name.trim(),
        prefix: prefix.trim().toUpperCase() || undefined,
      });
      setName('');
      setPrefix('');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save queue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {editingQueue ? 'Rename Queue' : 'Create New Queue'}
              </h3>
              <p className="text-xs text-slate-400">
                {editingQueue ? 'Update the display name of this queue' : 'Configure a new queue line'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Queue Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. General Consultation or Cash Counter"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm text-slate-900"
            />
          </div>

          {!editingQueue && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Token Prefix <span className="text-slate-400 text-[10px] font-normal">(Optional, e.g. DOC, Q)</span>
              </label>
              <input
                type="text"
                maxLength={4}
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                placeholder="e.g. Q or DOC"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm text-slate-900 font-mono uppercase"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Generated tokens will be formatted as {prefix || 'Q'}001, {prefix || 'Q'}002...
              </p>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-xs flex items-center space-x-2 transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{editingQueue ? 'Save Changes' : 'Create Queue'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateQueueModal;

