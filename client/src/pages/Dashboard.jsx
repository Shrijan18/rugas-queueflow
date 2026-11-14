import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Ticket, 
  Clock, 
  PlayCircle, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  ArrowRight, 
  Activity, 
  RefreshCw,
  Sparkles,
  Inbox
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatCard from '../components/StatCard';
import QueueCard from '../components/QueueCard';
import CreateQueueModal from '../components/CreateQueueModal';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [queues, setQueues] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const [statsRes, activityRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/recent-activity'),
      ]);

      if (statsRes.data?.success) {
        setStats(statsRes.data.stats);
        setQueues(statsRes.data.queues || []);
      }
      if (activityRes.data?.success) {
        setActivities(activityRes.data.activities || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateQueue = async (data) => {
    const res = await api.post('/queues', data);
    if (res.data?.success) {
      await fetchDashboardData();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-brand-600 text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Operational Overview</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, {user?.full_name || 'Manager'}!
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time queue monitoring, token dispatching, and service metrics.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center space-x-2 transition-all active:scale-95 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-brand-600' : ''}`} />
            <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs flex items-center space-x-2 shadow-xs shadow-brand-600/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Queue</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid (6 KPI cards from Section 5) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Total Queues"
          value={stats?.total_queues}
          icon={Layers}
          color="indigo"
          subtitle="Active counters"
        />
        <StatCard
          title="Tokens Generated"
          value={stats?.total_tokens}
          icon={Ticket}
          color="blue"
          subtitle="All-time tokens"
        />
        <StatCard
          title="Currently Waiting"
          value={stats?.total_waiting}
          icon={Clock}
          color="amber"
          subtitle="Waiting in line"
        />
        <StatCard
          title="Currently Serving"
          value={stats?.total_serving}
          icon={PlayCircle}
          color="indigo"
          subtitle="Under service"
        />
        <StatCard
          title="Completed"
          value={stats?.total_completed}
          icon={CheckCircle2}
          color="emerald"
          subtitle="Finished services"
        />
        <StatCard
          title="Cancelled"
          value={stats?.total_cancelled}
          icon={XCircle}
          color="rose"
          subtitle="Withdrawn tokens"
        />
      </div>

      {/* Main Content Split: Queues Overview & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 spans): My Queues Overview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">My Queues</h2>
              <p className="text-xs text-slate-500">Live queues supervised by you</p>
            </div>
            <Link
              to="/queues"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {queues.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
                <Inbox className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Queues Created Yet</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                Get started by creating your first queue line (e.g. "Customer Support" or "Billing Desk").
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-5 inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-xs shadow-xs hover:bg-brand-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Queue</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {queues.slice(0, 4).map((queue) => (
                <QueueCard key={queue.id} queue={queue} />
              ))}
            </div>
          )}
        </div>

        {/* Right Column (1 span): Recent Activity Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Recent Activity</h2>
              <p className="text-xs text-slate-500">Real-time audit log of operations</p>
            </div>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
            {activities.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No token activity recorded yet.
              </div>
            ) : (
              <div className="space-y-4">
                {activities.slice(0, 7).map((act) => {
                  let badgeColor = 'bg-slate-100 text-slate-600';
                  if (act.activity_type.includes('CREATED')) badgeColor = 'bg-indigo-50 text-indigo-700';
                  if (act.activity_type.includes('CALLED')) badgeColor = 'bg-blue-50 text-blue-700';
                  if (act.activity_type.includes('COMPLETED')) badgeColor = 'bg-emerald-50 text-emerald-700';
                  if (act.activity_type.includes('CANCELLED')) badgeColor = 'bg-rose-50 text-rose-700';
                  if (act.activity_type.includes('MOVED')) badgeColor = 'bg-amber-50 text-amber-700';

                  return (
                    <div key={act.id} className="flex items-start space-x-3 text-xs">
                      <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${badgeColor}`}>
                        {act.activity_type.replace('_', ' ')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 leading-snug break-words">
                          {act.details || `Activity in ${act.queue_name}`}
                        </p>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {act.queue_name}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Queue Modal */}
      <CreateQueueModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateQueue}
      />
    </div>
  );
};

export default Dashboard;

