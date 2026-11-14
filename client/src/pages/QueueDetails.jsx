import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  UserPlus, 
  Play, 
  CheckCircle2, 
  Clock, 
  Users, 
  AlertCircle, 
  RefreshCw, 
  Phone, 
  User, 
  Ticket, 
  Timer,
  ChevronRight,
  History
} from 'lucide-react';
import api from '../services/api';
import TokenTable from '../components/TokenTable';
import AddTokenModal from '../components/AddTokenModal';
import ConfirmModal from '../components/ConfirmModal';

const QueueDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [queue, setQueue] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [waitingTokens, setWaitingTokens] = useState([]);
  const [servingToken, setServingToken] = useState(null);
  const [completedTokens, setCompletedTokens] = useState([]);
  const [cancelledTokens, setCancelledTokens] = useState([]);
  const [avgServiceMinutes, setAvgServiceMinutes] = useState(5);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [cancellingToken, setCancellingToken] = useState(null);
  const [activeTab, setActiveTab] = useState('waiting'); // 'waiting', 'completed', 'cancelled'
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    fetchQueueDetails();
  }, [id]);

  // Timer for active serving elapsed duration
  useEffect(() => {
    let interval = null;
    if (servingToken?.service_started_at) {
      const start = new Date(servingToken.service_started_at).getTime();
      const updateElapsed = () => {
        const now = Date.now();
        setElapsedSeconds(Math.max(0, Math.floor((now - start) / 1000)));
      };
      updateElapsed();
      interval = setInterval(updateElapsed, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [servingToken]);

  const fetchQueueDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/queues/${id}/tokens`);
      if (res.data?.success) {
        setQueue(res.data.queue);
        setTokens(res.data.tokens || []);
        setWaitingTokens(res.data.waitingTokens || []);
        setServingToken(res.data.servingToken || null);
        setCompletedTokens(res.data.completedTokens || []);
        setCancelledTokens(res.data.cancelledTokens || []);
        setAvgServiceMinutes(res.data.avgServiceMinutes || 5);
      }
    } catch (err) {
      console.error('Failed to load queue details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add person to queue
  const handleAddToken = async (data) => {
    await api.post(`/queues/${id}/tokens`, data);
    await fetchQueueDetails();
  };

  // Move token up
  const handleMoveUp = async (tokenId) => {
    try {
      setActionLoading(true);
      await api.put(`/tokens/${tokenId}/move-up`);
      await fetchQueueDetails();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to move token up');
    } finally {
      setActionLoading(false);
    }
  };

  // Move token down
  const handleMoveDown = async (tokenId) => {
    try {
      setActionLoading(true);
      await api.put(`/tokens/${tokenId}/move-down`);
      await fetchQueueDetails();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to move token down');
    } finally {
      setActionLoading(false);
    }
  };

  // Call next waiting token
  const handleCallNext = async () => {
    if (servingToken) {
      alert(`Cannot call next: Token ${servingToken.token_number} is already being served. Please complete current service first.`);
      return;
    }
    if (waitingTokens.length === 0) {
      alert('No waiting tokens available in this queue.');
      return;
    }

    try {
      setActionLoading(true);
      await api.put(`/queues/${id}/call-next`);
      await fetchQueueDetails();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to call next token');
    } finally {
      setActionLoading(false);
    }
  };

  // Complete current service
  const handleCompleteService = async () => {
    if (!servingToken) return;
    try {
      setActionLoading(true);
      await api.put(`/tokens/${servingToken.id}/complete`);
      await fetchQueueDetails();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete service');
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel token confirmation
  const handleCancelConfirm = async () => {
    if (!cancellingToken) return;
    try {
      setActionLoading(true);
      await api.put(`/tokens/${cancellingToken.id}/cancel`);
      setCancellingToken(null);
      await fetchQueueDetails();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel token');
    } finally {
      setActionLoading(false);
    }
  };

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (loading && !queue) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading queue management console...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/queues"
          className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Queues</span>
        </Link>

        <button
          onClick={fetchQueueDetails}
          disabled={loading || actionLoading}
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          title="Refresh Queue"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
        </button>
      </div>

      {/* Queue Header Hero Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-md bg-brand-50 text-brand-700 text-xs font-bold uppercase tracking-wider border border-brand-200">
              Prefix: {queue?.prefix || 'Q'}
            </span>
            <span className="text-xs text-slate-400">
              Queue ID #{queue?.id}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {queue?.name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Avg service duration: ~{avgServiceMinutes} mins • Managed in real-time
          </p>
        </div>

        {/* Action Button: Add Person */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-md shadow-brand-600/20 active:scale-95 transition-all flex items-center space-x-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Person to Queue</span>
          </button>
        </div>
      </div>

      {/* CURRENT SERVING HERO PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className="flex h-3 w-3 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${servingToken ? 'bg-emerald-400' : 'bg-slate-500'} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${servingToken ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {servingToken ? 'Now Serving' : 'Service Counter Idle'}
                </span>
              </div>

              {servingToken && (
                <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-mono font-medium text-indigo-200 border border-white/10">
                  <Timer className="w-3.5 h-3.5" />
                  <span>Elapsed: {formatTimer(elapsedSeconds)}</span>
                </div>
              )}
            </div>

            {servingToken ? (
              <div className="my-4">
                <div className="flex items-baseline space-x-3">
                  <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white">
                    {servingToken.token_number}
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-indigo-200 truncate">
                    {servingToken.person_name}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-300">
                  {servingToken.phone_number && (
                    <div className="flex items-center space-x-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{servingToken.phone_number}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Started at {new Date(servingToken.service_started_at || servingToken.called_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="my-6">
                <h3 className="text-2xl font-bold text-slate-200">No token currently serving</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Click "Call Next Token" below to automatically summon the first waiting person in queue.
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons for Service Counter */}
          <div className="relative z-10 pt-4 border-t border-white/10 flex flex-wrap items-center gap-3">
            {servingToken ? (
              <>
                <button
                  onClick={handleCompleteService}
                  disabled={actionLoading}
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/30 flex items-center space-x-2 transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>COMPLETE SERVICE</span>
                </button>
                <button
                  onClick={() => setCancellingToken(servingToken)}
                  disabled={actionLoading}
                  className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-rose-300 font-semibold text-xs border border-white/10 transition-colors"
                >
                  Cancel Service
                </button>
              </>
            ) : (
              <button
                onClick={handleCallNext}
                disabled={waitingTokens.length === 0 || actionLoading}
                className={`px-6 py-3.5 rounded-xl text-white font-bold text-sm flex items-center space-x-2 transition-all shadow-lg ${
                  waitingTokens.length > 0
                    ? 'bg-brand-600 hover:bg-brand-500 shadow-brand-600/40 active:scale-95'
                    : 'bg-slate-700/60 opacity-60 cursor-not-allowed shadow-none'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>CALL NEXT TOKEN</span>
              </button>
            )}

            {waitingTokens.length === 0 && !servingToken && (
              <span className="text-xs text-slate-400 italic">
                Waiting queue is currently empty.
              </span>
            )}
          </div>
        </div>

        {/* Right Metric Summary Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              Queue Status Summary
            </h3>

            <div className="space-y-3.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/70 border border-amber-100">
                <div className="flex items-center space-x-2.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold text-slate-700">Currently Waiting</span>
                </div>
                <span className="text-lg font-black text-amber-600">{waitingTokens.length}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/70 border border-blue-100">
                <div className="flex items-center space-x-2.5">
                  <Play className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-700">Currently Serving</span>
                </div>
                <span className="text-lg font-black text-blue-600">{servingToken ? 1 : 0}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-700">Completed Services</span>
                </div>
                <span className="text-lg font-black text-emerald-600">{completedTokens.length}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50/70 border border-rose-100">
                <div className="flex items-center space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span className="text-xs font-semibold text-slate-700">Cancelled Tokens</span>
                </div>
                <span className="text-lg font-black text-rose-600">{cancelledTokens.length}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-center">
            <span className="text-xs font-semibold text-slate-500">
              Total Tokens Generated: <strong className="text-slate-900">{tokens.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Tabs for Waiting Queue vs History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200">
          <div className="flex space-x-6">
            <button
              onClick={() => setActiveTab('waiting')}
              className={`pb-3 text-sm font-bold flex items-center space-x-2 border-b-2 transition-colors ${
                activeTab === 'waiting'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Waiting Queue</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                {waitingTokens.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('completed')}
              className={`pb-3 text-sm font-bold flex items-center space-x-2 border-b-2 transition-colors ${
                activeTab === 'completed'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Completed</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                {completedTokens.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('cancelled')}
              className={`pb-3 text-sm font-bold flex items-center space-x-2 border-b-2 transition-colors ${
                activeTab === 'cancelled'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Cancelled</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                {cancelledTokens.length}
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-400 hidden sm:block">
            {activeTab === 'waiting' && 'Use Move Up / Move Down to rearrange priority order'}
          </div>
        </div>

        {/* Tab Contents */}
        {activeTab === 'waiting' && (
          <TokenTable
            tokens={waitingTokens}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onCancel={(t) => setCancellingToken(t)}
            isLoading={actionLoading}
          />
        )}

        {activeTab === 'completed' && (
          <TokenTable
            tokens={completedTokens}
            isLoading={actionLoading}
          />
        )}

        {activeTab === 'cancelled' && (
          <TokenTable
            tokens={cancelledTokens}
            isLoading={actionLoading}
          />
        )}
      </div>

      {/* Add Token Modal */}
      <AddTokenModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddToken}
        queueName={queue?.name}
      />

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={!!cancellingToken}
        onClose={() => setCancellingToken(null)}
        onConfirm={handleCancelConfirm}
        title="Cancel Token"
        message={`Are you sure you want to cancel Token ${cancellingToken?.token_number} (${cancellingToken?.person_name})? This cannot be undone.`}
        confirmText="Confirm Cancellation"
        isDestructive={true}
        isLoading={actionLoading}
      />
    </div>
  );
};

export default QueueDetails;

