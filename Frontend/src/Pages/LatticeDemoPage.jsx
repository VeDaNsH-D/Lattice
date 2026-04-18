import React from 'react';
import { LatticeFrame } from './LatticeFrame';

const flow = [
  'User adds a link to a personal or collaborative lattice.',
  'AI generates summary, semantic tags, and vibe classification.',
  'Link appears instantly for all collaborators through real-time sync.',
  'Team discusses through comments, GIFs, and live presence indicators.',
  'Spotlight Search retrieves related knowledge across lattices.',
  'Decay simulation shows fade at day 14 and archive at day 30.',
  'Team starts video chat and screen sharing to resolve decisions quickly.',
];

const usp = [
  'Lattice-first information architecture',
  'Dual model: personal plus collaborative intelligence',
  'Biological decay as a knowledge hygiene engine',
  'AI-assisted understanding, not just storage',
  'Communication and learning logs embedded into the knowledge loop',
];

export const LatticeDemoPage = () => {
  return (
    <LatticeFrame
      title="Judge-Ready Demo Narrative"
      subtitle="A concise walkthrough to pitch LATTICE as a living knowledge network instead of a bookmark manager."
    >
      <section className="lattice-grid two">
        <article className="lattice-panel">
          <h2>Demo Flow</h2>
          <ol className="lattice-numbered">
            {flow.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>

        <article className="lattice-panel">
          <h2>Unique Selling Points</h2>
          <ul className="lattice-bullets">
            {usp.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="lattice-impact-box">
            Saving links -&gt; Building living knowledge networks.
          </div>
        </article>
      </section>
    </LatticeFrame>
  );
};
