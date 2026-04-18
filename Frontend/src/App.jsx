import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Hero } from './components/Hero';
import { LandingBody } from './components/LandingBody';
import { AuthPage } from './components/AuthPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { LatticeHomePage } from './Pages/LatticeHomePage';
import { LatticeProjectPage } from './Pages/LatticeProjectPage';
import { LatticeFeaturesPage } from './Pages/LatticeFeaturesPage';
import { LatticeStackPage } from './Pages/LatticeStackPage';
import { LatticeDemoPage } from './Pages/LatticeDemoPage';
import { LatticeGraphPage } from './Pages/LatticeGraphPage';
import './App.css';

const LandingPage = () => (
  <>
    <Hero />
    <LandingBody />
  </>
);

function App() {
  return (
    <div className="app-container">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<PublicOnlyRoute />}>
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/auth" element={<Navigate to="/signup" replace />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/lattice" element={<LatticeHomePage />} />
          <Route path="/lattice/project/:projectId" element={<LatticeProjectPage />} />
          <Route path="/lattice/project/:projectId/graph" element={<LatticeGraphPage />} />
          <Route path="/lattice/graph" element={<Navigate to="/lattice" replace />} />
        </Route>
        <Route path="/lattice/features" element={<LatticeFeaturesPage />} />
        <Route path="/lattice/stack" element={<LatticeStackPage />} />
        <Route path="/lattice/demo" element={<LatticeDemoPage />} />
      </Routes>
    </div>
  );
}

export default App;
