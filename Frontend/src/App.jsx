import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import './App.css';

const Hero = lazy(() => import('./components/Hero').then((module) => ({ default: module.Hero })));
const LandingBody = lazy(() => import('./components/LandingBody').then((module) => ({ default: module.LandingBody })));
const AuthPage = lazy(() => import('./components/AuthPage').then((module) => ({ default: module.AuthPage })));
const LatticeHomePage = lazy(() => import('./Pages/LatticeHomePage').then((module) => ({ default: module.LatticeHomePage })));
const LatticeMyLatticesPage = lazy(() => import('./Pages/LatticeMyLatticesPage').then((module) => ({ default: module.LatticeMyLatticesPage })));
const LatticeProjectPage = lazy(() => import('./Pages/LatticeProjectPage').then((module) => ({ default: module.LatticeProjectPage })));
const LatticeGraveyardPage = lazy(() => import('./Pages/LatticeGraveyardPage').then((module) => ({ default: module.LatticeGraveyardPage })));
const LatticeActivityPage = lazy(() => import('./Pages/LatticeActivityPage').then((module) => ({ default: module.LatticeActivityPage })));
const LatticeSettingsPage = lazy(() => import('./Pages/LatticeSettingsPage').then((module) => ({ default: module.LatticeSettingsPage })));
const LatticeProfilePage = lazy(() => import('./Pages/LatticeProfilePage').then((module) => ({ default: module.LatticeProfilePage })));
const LatticePublicPage = lazy(() => import('./Pages/LatticePublicPage').then((module) => ({ default: module.LatticePublicPage })));
const LatticeFeaturesPage = lazy(() => import('./Pages/LatticeFeaturesPage').then((module) => ({ default: module.LatticeFeaturesPage })));
const LatticeStackPage = lazy(() => import('./Pages/LatticeStackPage').then((module) => ({ default: module.LatticeStackPage })));
const LatticeDemoPage = lazy(() => import('./Pages/LatticeDemoPage').then((module) => ({ default: module.LatticeDemoPage })));
const LatticeGraphPage = lazy(() => import('./Pages/LatticeGraphPage').then((module) => ({ default: module.LatticeGraphPage })));
const InviteResponsePage = lazy(() => import('./Pages/InviteResponsePage').then((module) => ({ default: module.InviteResponsePage })));

const LandingPage = () => (
  <>
    <Hero />
    <LandingBody />
  </>
);

function App() {
  return (
    <div className="app-container">
      <Suspense fallback={<div className="app-loading">Loading...</div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<PublicOnlyRoute />}>
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/auth" element={<Navigate to="/signup" replace />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/lattice" element={<LatticeHomePage />} />
            <Route path="/lattice/personal" element={<LatticeMyLatticesPage />} />
            <Route path="/lattice/shared" element={<LatticeMyLatticesPage />} />
            <Route path="/lattice/activity" element={<LatticeActivityPage />} />
            <Route path="/lattice/settings" element={<LatticeSettingsPage />} />
            <Route path="/lattice/graveyard" element={<LatticeGraveyardPage />} />
            <Route path="/lattice/project/:projectId" element={<LatticeProjectPage />} />
            <Route path="/lattice/project/:projectId/graph" element={<LatticeGraphPage />} />
            <Route path="/lattice/graph" element={<Navigate to="/lattice" replace />} />
          </Route>
          <Route path="/profile/:userId" element={<LatticeProfilePage />} />
          <Route path="/lattice/:latticeId" element={<LatticePublicPage />} />
          <Route path="/lattice/features" element={<LatticeFeaturesPage />} />
          <Route path="/lattice/stack" element={<LatticeStackPage />} />
          <Route path="/lattice/demo" element={<LatticeDemoPage />} />
          <Route path="/invite/:inviteId" element={<InviteResponsePage />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
