import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { 
  Ticket, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Users, 
  TrendingUp, 
  Timer, 
  Award, 
  Calendar,
  RefreshCw 
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import StatCard from '../components/StatCard';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Analytics = () => {
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState(null);
  const [waitingTimes, setWaitingTimes] = useState(null);
  const [distribution, setDistribution] = useState(null);
  const [dailyTokens, setDailyTokens] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [ovRes, trRes, wtRes, distRes, dtRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/analytics/queue-trends'),
        api.get('/analytics/waiting-times'),
        api.get('/analytics/token-distribution'),
        api.get('/analytics/daily-tokens'),
      ]);

      if (ovRes.data?.success) setOverview(ovRes.data);
      if (trRes.data?.success) setTrends(trRes.data.trend);
      if (wtRes.data?.success) setWaitingTimes(wtRes.data.chart);
      if (distRes.data?.success) setDistribution(distRes.data.distribution);
      if (dtRes.data?.success) setDailyTokens(dtRes.data.chart);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const kpis = overview?.kpis || {};
  const insights = overview?.insights || {};

  // 1. Line Chart Data: Queue Length Trend
  const hasTrendData = trends?.labels && trends.labels.length > 0;
  const trendChartData = {
    labels: hasTrendData ? trends.labels : [],
    datasets: [
      {
        label: 'Waiting Tokens',
        data: hasTrendData ? trends.data : [],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#4f46e5',
        pointRadius: 4,
      },
    ],
  };

  // 2. Doughnut Chart Data: Token Status Distribution
  const hasDistributionData = (kpis.totalTokens || 0) > 0;
  const doughnutData = {
    labels: distribution?.labels || ['Waiting', 'Serving', 'Completed', 'Cancelled'],
    datasets: [
      {
        data: distribution?.data || [0, 0, 0, 0],
        backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'],
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  // 3. Bar Chart Data: Average Waiting Time by Queue
  const hasWaitingData = waitingTimes?.labels && waitingTimes.labels.length > 0;
  const waitingBarData = {
    labels: hasWaitingData ? waitingTimes.labels : [],
    datasets: [
      {
        label: 'Avg Wait (mins)',
        data: hasWaitingData ? waitingTimes.data : [],
        backgroundColor: '#f59e0b',
        borderRadius: 8,
      },
    ],
  };

  // 4. Bar Chart Data: Daily Token Generation
  const hasDailyData = dailyTokens?.labels && dailyTokens.labels.length > 0;
  const dailyBarData = {
    labels: hasDailyData ? dailyTokens.labels : [],
    datasets: [
      {
        label: 'Tokens Issued',
        data: hasDailyData ? dailyTokens.data : [],
        backgroundColor: '#4f46e5',
        borderRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { size: 12 },
        bodyFont: { size: 12 },
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: '#64748b' },
      },
      y: {
        grid: { color: '#f1f5f9' },
        ticks: { font: { size: 11 }, color: '#64748b', precision: 0 },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics & Operational Insights</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time PostgreSQL telemetry of service durations, wait times, and throughput.
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center space-x-2 transition-all shadow-2xs self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Cards Grid (from Section 8) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Tokens Generated"
          value={kpis.totalTokens}
          icon={Ticket}
          color="indigo"
          subtitle="All queues combined"
        />
        <StatCard
          title="Avg Waiting Time"
          value={kpis.avgWaitingMinutes}
          unit="min"
          icon={Clock}
          color="amber"
          subtitle="Before service begins"
        />
        <StatCard
          title="Avg Service Duration"
          value={kpis.avgServiceMinutes}
          unit="min"
          icon={Timer}
          color="blue"
          subtitle="Active consultation"
        />
        <StatCard
          title="Current Queue Length"
          value={kpis.currentWaiting}
          icon={Users}
          color="purple"
          subtitle="Waiting in line now"
        />
        <StatCard
          title="Total Completed"
          value={kpis.totalCompleted}
          icon={CheckCircle2}
          color="emerald"
          subtitle="Successfully served"
        />
        <StatCard
          title="Total Cancelled"
          value={kpis.totalCancelled}
          icon={XCircle}
          color="rose"
          subtitle="Withdrawn tokens"
        />
      </div>

      {/* Additional Key Insights Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center space-x-3 text-brand-600 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Busiest Queue</span>
          </div>
          <p className="text-lg font-bold text-slate-900 truncate">
            {insights.busiestQueue?.name || 'None'}
          </p>
          <span className="text-xs text-slate-400">
            {insights.busiestQueue ? `${insights.busiestQueue.waiting_count} waiting` : 'No waiting tokens'}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center space-x-3 text-amber-600 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Longest Wait Now</span>
          </div>
          <p className="text-lg font-bold text-slate-900 truncate">
            {insights.longestWaitingToken ? `${insights.longestWaitingToken.waiting_minutes} mins` : '0 mins'}
          </p>
          <span className="text-xs text-slate-400 truncate block">
            {insights.longestWaitingToken ? `Token ${insights.longestWaitingToken.token_number} (${insights.longestWaitingToken.queue_name})` : 'Queue is clear'}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center space-x-3 text-emerald-600 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Completed Today</span>
          </div>
          <p className="text-lg font-bold text-slate-900">
            {insights.completedToday || 0}
          </p>
          <span className="text-xs text-slate-400">Since 00:00 today</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center space-x-3 text-indigo-600 mb-2">
            <Award className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Service Efficiency</span>
          </div>
          <p className="text-lg font-bold text-slate-900">
            {kpis.totalTokens > 0 
              ? `${Math.round(((kpis.totalCompleted || 0) / kpis.totalTokens) * 100)}%` 
              : '100%'}
          </p>
          <span className="text-xs text-slate-400">Completion rate</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart A: Queue Length Trend */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Queue Length Trend</h3>
            <p className="text-xs text-slate-400">Waiting queue volume tracked across genuine snapshots</p>
          </div>
          <div className="h-64 w-full">
            {hasTrendData ? (
              <Line data={trendChartData} options={chartOptions} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                <TrendingUp className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No Historical Snapshots Yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Snapshots are recorded automatically as people are queued, called, and served.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Chart B: Token Status Distribution */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Token Status Distribution</h3>
            <p className="text-xs text-slate-400">Breakdown of waiting, serving, completed & cancelled</p>
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            {hasDistributionData ? (
              <div className="w-56 h-56">
                <Doughnut 
                  data={doughnutData} 
                  options={{
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 11 } }
                      }
                    }
                  }} 
                />
              </div>
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                <Ticket className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No Tokens Generated Yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Issue tokens to customers to view status distribution across counters.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Chart C: Average Waiting Time by Queue */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Average Waiting Time by Queue (Minutes)</h3>
            <p className="text-xs text-slate-400">Calculated strictly from completed service records</p>
          </div>
          <div className="h-64 w-full">
            {hasWaitingData ? (
              <Bar data={waitingBarData} options={chartOptions} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                <Clock className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No Waiting History Recorded</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Average waiting times will display here once services are completed.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Chart D: Daily Token Generation */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Daily Token Generation</h3>
            <p className="text-xs text-slate-400">Volume of tokens created over recent dates</p>
          </div>
          <div className="h-64 w-full">
            {hasDailyData ? (
              <Bar data={dailyBarData} options={chartOptions} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                <Calendar className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No Daily Volume Data</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Daily token output will appear as tokens are created each day.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;

