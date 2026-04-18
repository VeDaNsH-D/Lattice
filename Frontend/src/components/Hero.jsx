import React, { useRef, useState } from 'react';
import { Sparkles, Command, Puzzle } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import version2Video from '../assets/Version 02.mp4';
import './Hero.css';
import { ConcentricNetwork } from './ConcentricNetwork';
import { NotificationStack } from './NotificationStack';
import { TrustBar } from './TrustBar';

export const Hero = () => {
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);

  // Hero Parallax hooks for video
  const videoRef = useRef(null);
  const { scrollYProgress: videoScroll } = useScroll({
    target: videoRef,
    offset: ["start 95%", "start 15%"]
  });
  const scale = useTransform(videoScroll, [0, 0.4, 1], [0.85, 1, 1.2]);
  const rotateX = useTransform(videoScroll, [0, 0.4, 1], [15, 0, 0]);

  return (
    <section className="hero-section">
      {/* Top Navbar */}
      <nav className="hero-navbar">
        <div className="hero-nav-brand">
          <Command size={24} />
          LATTICE
        </div>
        <div className="hero-nav-links">
          <a href="#products">Products</a>
          <a href="#solutions" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            Solutions
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L5 5L9 1" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <a href="#services">Services <span className="new-badge">NEW</span></a>
          <a href="#pricing">Pricing</a>
          <a href="#insight">Insight</a>
          <button className="hero-nav-extension" onClick={() => setIsExtensionModalOpen(true)} type="button">
            <Puzzle size={14} />
            Add Chrome Extension
          </button>
        </div>
        <div className="hero-nav-actions">
          <Link to="/signup" state={{ fromLanding: true }} style={{ textDecoration: 'none' }}><button className="btn-signin">Sign up</button></Link>
          <Link to="/lattice" style={{ textDecoration: 'none' }}><button className="btn-contact">Open Lattice</button></Link>
        </div>
      </nav>

      {isExtensionModalOpen ? (
        <div className="hero-extension-overlay" role="dialog" aria-modal="true" aria-label="Install Chrome extension">
          <div className="hero-extension-card">
            <h3>Add Shelflife Extension</h3>
            <p>Install in developer mode to save current page links directly into your project.</p>
            <ol>
              <li>Open chrome://extensions in Chrome.</li>
              <li>Turn on Developer mode.</li>
              <li>Click Load unpacked.</li>
              <li>Select the chrome-bookmark-importer folder from this project.</li>
            </ol>
            <div className="hero-extension-actions">
              <button
                className="btn-secondary"
                onClick={() => window.open('chrome://extensions', '_blank')}
                type="button"
              >
                Open Extensions Page
              </button>
              <button className="btn-primary" onClick={() => setIsExtensionModalOpen(false)} type="button">
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main Content */}
      <div className="hero-content">
        {/* Background and Orbiting Icons perfectly anchored to the text center */}
        <ConcentricNetwork />

        {/* Rating */}
        <div className="hero-rating">
          <div className="rating-item google">
            <span style={{ fontWeight: 700, color: '#ea4335' }}>G</span>
            <span>4.6</span>
            <span style={{ color: '#aaa', fontWeight: 400 }}>Google</span>
          </div>
          <div className="rating-item trustpilot">
            <span className="rating-star">★</span>
            <span>4.9</span>
            <span style={{ color: '#aaa', fontWeight: 400 }}>Trustpilot</span>
          </div>
        </div>

        <h1 className="hero-title">
          Build living knowledge<br />with LATTICE
        </h1>
        <p className="hero-subtitle">
          LATTICE is an AI-powered knowledge network where every user has personal lattices and shared collaborative lattices.
        </p>

        <div className="hero-actions">
          <Link to="/signup" style={{ textDecoration: 'none' }}><button className="btn-primary">Get started free</button></Link>
          <button className="btn-secondary">Talk to sales team</button>
        </div>
      </div>

      {/* Stacked Cards */}
      <NotificationStack />

      {/* Parallax Video Segment directly below Hero content */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '1120px', perspective: '1000px', marginTop: '60px', marginBottom: '140px', zIndex: 10 }} ref={videoRef}>
        <div className="hero_glowContainer">
          <div className="hero_glowBlue" style={{ background: 'rgba(0, 255, 150, 0.15)' }} />
          <div className="hero_glowPurple" />
        </div>

        <motion.div
          className="hero_videoWrapper"
          style={{ scale, rotateX, transformOrigin: 'top center' }}
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="hero_videoInner">
            <video
              src={version2Video}
              autoPlay
              loop
              muted
              playsInline
              className="hero_videoObject"
            />
          </div>
        </motion.div>
      </div>

      {/* Bottom Logos */}
      <TrustBar />

    </section>
  );
};
