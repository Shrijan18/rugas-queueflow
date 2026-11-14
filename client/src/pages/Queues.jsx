import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Layers, RefreshCw, Inbox } from 'lucide-react';
import api from '../services/api';
import QueueCard from '../components/QueueCard';
import CreateQueueModal from '../components/CreateQueueModal';
import ConfirmModal from '../components/ConfirmModal';

const Queues = () => {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingQueue, setEditingQueue] = useState(null);
  const [deletingQueue, setDeletingQueue] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchQueues();
  }, []);

  const fetchQueues = async () => {
    try {
      setLoading(true);
      const res = await api.get('/queues');
      if (res.data?.success) {
        setQueues(res.data.queues || []);
      }
    } catch (err) {
      console.error('Failed to fetch queues:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQueue = async (data) => {
    if (editingQueue) {
      await api.put(`/queues/${editingQueue.id}`, data);
    } else {
      await api.post('/queues', data);
    }
    setEditingQueue(null);
    await fetchQueues();
  };

  const handleDeleteConfirm = async () => {
    if (!deletingQueue) return;
    try {
      setIsDeleting(true);
      await api.delete(`/queues/${deletingQueue.id}`);
      setDeletingQueue(null);
      await fetchQueues();
    } catch (err) {
      console.error('Failed to delete queue:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredQueues = queues.filter((q) =>
    q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (q.prefix && q.prefix.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Queues</h1>
          <p className="text-xs text-slate-500 mt-1">
            Create, rename, supervise, and dispatch tokens across multiple queue lines.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchQueues}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-2xs"
            title="Refresh Queues"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setEditingQueue(null);
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs flex items-center space-x-2 shadow-xs shadow-brand-600/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Queue</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search queues by name or prefix..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors"
          />
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Showing <span className="text-slate-900">{filteredQueues.length}</span> of {queues.length} queues
        </div>
      </div>

      {/* Queue Cards Grid */}
      {filteredQueues.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mb-4">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {searchTerm ? 'No Matching Queues Found' : 'No Queues Created Yet'}
          </h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? `No queues matched "${searchTerm}". Try a different search query.`
              : 'Create your first queue to start dispensing tokens and serving customers.'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => {
                setEditingQueue(null);
                setIsCreateModalOpen(true);
              }}
              className="mt-5 inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-xs shadow-xs hover:bg-brand-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Queue</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQueues.map((queue) => (
            <QueueCard
              key={queue.id}
              queue={queue}
              onEdit={(q) => {
                setEditingQueue(q);
                setIsCreateModalOpen(true);
              }}
              onDelete={(q) => setDeletingQueue(q)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Queue Modal */}
      <CreateQueueModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingQueue(null);
        }}
        onSubmit={handleSaveQueue}
        editingQueue={editingQueue}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingQueue}
        onClose={() => setDeletingQueue(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Queue"
        message={`Are you sure you want to permanently delete "${deletingQueue?.name}"? All associated tokens, history, and records will be deleted.`}
        confirmText="Delete Queue"
        isDestructive={true}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default Queues;

