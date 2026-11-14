import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import GuidedWalkthroughBanner from './GuidedWalkthroughBanner';

const routeTitles = {
  '/dashboard': 'Dashboard Overview',
  '/queues': 'Queue Management',
  '/analytics': 'Performance Analytics',
  '/profile': 'Manager Profile',
};

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const location = useLocation();

  // Load guide preference (only auto-open once on dashboard if not dismissed)
  useEffect(() => {
    const isDismissed = localStorage.getItem('qf_walkthrough_dismissed') === 'true';
    if (!isDismissed && location.pathname === '/dashboard') {
      setGuideOpen(true);
    }
  }, [location.pathname]);

  const handleDismissGuide = () => {
    setGuideOpen(false);
    localStorage.setItem('qf_walkthrough_dismissed', 'true');
  };

  const handleToggleGuide = () => {
    setGuideOpen((prev) => !prev);
  };

  // Find matching title or default
  let currentTitle = 'Dashboard';
  if (location.pathname.startsWith('/queues/')) {
    currentTitle = 'Queue Console';
  } else if (routeTitles[location.pathname]) {
    currentTitle = routeTitles[location.pathname];
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-64">
        {/* Top Navbar */}
        <Navbar 
          title={currentTitle} 
          onMenuClick={() => setSidebarOpen(true)}
          onToggleGuide={handleToggleGuide}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <GuidedWalkthroughBanner isOpen={guideOpen} onClose={handleDismissGuide} />
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

