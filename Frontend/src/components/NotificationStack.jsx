import React from 'react';
import { CheckCircle2, MessageSquare, Briefcase } from 'lucide-react';
import './Hero.css';

export const NotificationStack = () => {
  return (
    <div className="notification-stack">
      {/* Top Card */}
      <div className="notification-card card-1">
        <div className="card-avatar">
          <img src="https://i.pravatar.cc/100?img=11" alt="Wei Chen" />
          <div className="card-avatar-badge badge-blue">
             <MessageSquare size={8} color="white" strokeWidth={3} />
          </div>
        </div>
        <div className="card-content">
          <div className="card-name">Wei Chen <span style={{fontWeight: 400, color: '#555'}}>joined to</span> Final Presentation</div>
          <div className="card-meta">
            <span>8 min ago</span>
            <span>•</span>
            <span>Orixcreative Dribbble</span>
          </div>
        </div>
      </div>

      {/* Middle Card */}
      <div className="notification-card card-2">
        <div className="card-avatar">
          <img src="https://i.pravatar.cc/100?img=33" alt="Matthew Johnson" />
          <div className="card-avatar-badge badge-green">
            <CheckCircle2 size={8} color="white" strokeWidth={3} />
          </div>
        </div>
        <div className="card-content">
          <div className="card-name">Matthew Johnson</div>
          <div className="card-meta">
            <span>Content Writer</span>
            <span>•</span>
            <span>@orixcreative</span>
          </div>
        </div>
        {/* Right three dots pseudo icon */}
        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', padding: '0.2rem' }}>
          <div style={{width: 3, height: 3, borderRadius: '50%', background: '#aaa'}}></div>
          <div style={{width: 3, height: 3, borderRadius: '50%', background: '#aaa'}}></div>
          <div style={{width: 3, height: 3, borderRadius: '50%', background: '#aaa'}}></div>
        </div>
      </div>

      {/* Bottom Card */}
      <div className="notification-card card-3">
        <div className="card-avatar">
          <img src="https://i.pravatar.cc/100?img=60" alt="Terry Lipshutz" />
        </div>
        <div className="card-content">
          <div className="card-name">Terry Lipshutz</div>
          <div className="card-meta" style={{ marginTop: '0.1rem', fontSize: '0.7rem' }}>
            <span>Approved the design of the iOS app...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
