import React from 'react';
import { LatticeFrame } from './LatticeFrame';

const stack = {
  Frontend: ['React + Vite', 'Component-first architecture', 'Motion-enhanced UX'],
  Backend: ['Node.js + Express', 'REST + realtime gateways', 'Role-aware collaboration APIs'],
  Database: ['MongoDB', 'Link graph modeling', 'Decay and archive lifecycle states'],
  'Real-Time': ['Socket.io synchronization', 'Presence indicators', 'Live comments and updates'],
  'AI + Search': ['OpenAI summaries/tagging/chat', 'Cohere semantic search', 'Microlink metadata pipeline'],
  Communication: ['WebRTC rooms', 'Agora or Twilio for voice/video/screen sharing'],
  Notifications: ['Firebase push and in-app alerts'],
};

export const LatticeStackPage = () => {
  return (
    <LatticeFrame
      title="System Architecture and Stack"
      subtitle="A modular intelligence stack that powers personal lattices and collaborative lattices at the same time."
    >
      <section className="lattice-grid two">
        {Object.entries(stack).map(([area, bullets]) => (
          <article key={area} className="lattice-panel">
            <h2>{area}</h2>
            <ul className="lattice-bullets">
              {bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="lattice-panel">
        <h2>Simplified Flow</h2>
        <div className="lattice-flow">
          <span>User</span>
          <span>Frontend</span>
          <span>Backend API</span>
          <span>Metadata + AI</span>
          <span>MongoDB</span>
          <span>Real-time Sync</span>
        </div>
      </section>
    </LatticeFrame>
  );
};
