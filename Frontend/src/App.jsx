import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Hero } from './components/Hero';
import { LandingBody } from './components/LandingBody';
import { AuthPage } from './components/AuthPage';
import { LatticeHomePage } from './Pages/LatticeHomePage';
import { LatticeFeaturesPage } from './Pages/LatticeFeaturesPage';
import { LatticeStackPage } from './Pages/LatticeStackPage';
import { LatticeDemoPage } from './Pages/LatticeDemoPage';
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
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/lattice" element={<LatticeHomePage />} />
        <Route path="/lattice/features" element={<LatticeFeaturesPage />} />
        <Route path="/lattice/stack" element={<LatticeStackPage />} />
        <Route path="/lattice/demo" element={<LatticeDemoPage />} />
      </Routes>
    </div>
  );
}

export default App;
