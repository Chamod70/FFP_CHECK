import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, Database } from 'lucide-react';
import FFPPage from './pages/FFPPage';
import DataEntryPage from './pages/DataEntryPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>FFP System</h2>
            <p>v2.0 (No Excel Upload)</p>
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
          </nav>
        </aside>
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/ffp" replace />} />
            <Route path="/ffp" element={<FFPPage />} />
            <Route path="/master-data" element={<DataEntryPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
