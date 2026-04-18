import React from 'react';
import { Command } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';
import illustrationAnimation from '../assets/illustration.json';
import './AuthPage.css';

const LottieComponent = typeof Lottie === 'function' ? Lottie : Lottie?.default;

export const AuthPage = () => {
  return (
    <div className="auth-wrapper">
      <motion.div 
        className="auth-card"
        initial={{ opacity: 0, scale: 0.98, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        
        {/* LEFT COLUMN */}
        <div className="auth-left">
          <Link to="/" className="auth-brand" style={{textDecoration: 'none'}}>
            <Command size={24} color="white" strokeWidth={2.5} />
            LATTICE
          </Link>
          
          <h1 className="auth-headline">
            Create an account and<br/>
            bring beauty to every<br/>
            moment.
          </h1>

          <div className="auth-lottie">
            {LottieComponent ? (
              <LottieComponent
                animationData={illustrationAnimation}
                loop={true}
                style={{ width: '100%', height: '100%', maxHeight: '420px', objectFit: 'contain' }}
              />
            ) : null}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="auth-right">
          <h2 className="auth-title">Create Account</h2>

          <form onSubmit={(e) => e.preventDefault()} className="auth-form">
            <div className="auth-row">
              <fieldset className="auth-fieldset">
                <legend>First Name</legend>
                <input type="text" className="auth-input" />
              </fieldset>
              <fieldset className="auth-fieldset">
                <legend>Last Name</legend>
                <input type="text" className="auth-input" />
              </fieldset>
            </div>

            <fieldset className="auth-fieldset">
              <legend>Email</legend>
              <input type="email" className="auth-input" />
            </fieldset>

            <fieldset className="auth-fieldset">
              <legend>Password</legend>
              <input type="password" className="auth-input" />
            </fieldset>

            <button type="submit" className="auth-submitBtn">
              Create Account
            </button>
            
            <div className="auth-toggleText">
              Already have an account? <Link to="/auth?mode=login" className="auth-toggleLink">Login</Link>
            </div>
          </form>

        </div>
      </motion.div>
    </div>
  );
};
