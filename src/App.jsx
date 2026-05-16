import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, Database } from 'lucide-react';
import FFPPage from './pages/FFPPage';
import DataEntryPage from './pages/DataEntryPage';
import BackupPage from './pages/BackupPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>FFP System</h2>
            <p>v3.0 (With Excel Upload)</p>
          </div>
          <nav className="sidebar-nav">
            <NavLink to="/ffp" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={20} />
              <span>FFP Live Check</span>
            </NavLink>
            <NavLink to="/master-data" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Database size={20} />
              <span>Master Data Pages</span>
            </NavLink>
            <NavLink to="/backup" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Database size={20} />
              <span>Backup Data</span>
            </NavLink>
          </nav>
        </aside>
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/ffp" replace />} />
            <Route path="/ffp" element={<FFPPage />} />
            <Route path="/master-data" element={<DataEntryPage />} />
            <Route path="/backup" element={<BackupPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
