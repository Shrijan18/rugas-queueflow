import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const routeTitles = {
  '/dashboard': 'Dashboard Overview',
  '/queues': 'Queue Management',
  '/analytics': 'Performance Analytics',
  '/profile': 'Manager Profile',
};

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

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
        />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

