import React from 'react';
import { LatticeFrame } from './LatticeFrame';

const features = [
  ['Smart Link Ingestion Engine', 'Paste any URL and auto-fetch title, metadata, and preview with AI summary and tags.'],
  ['AI Knowledge Layer', 'Explain links simply, extract key insights, and chat with saved knowledge.'],
  ['Spotlight Search Across Lattices', 'Fuzzy and semantic retrieval over titles, summaries, tags, and contexts.'],
  ['Tagging and Filtering', 'Auto and manual tags filtered by topic, vibe, activity, and lattice type.'],
  ['Collaborative Comments', 'Discuss links and whole lattices with text and GIF-based context.'],
  ['Bookmark Import', 'Bulk import browser bookmark HTML and enrich everything with AI.'],
  ['Learning Log Layer', 'Track engagement, weekly learning summaries, and behavior-driven insight loops.'],
  ['Biological Decay System', '14-day fade and 30-day archive policy to enforce relevance over hoarding.'],
  ['Smart Notifications', 'Invites, decay warnings, and collaboration updates with intent-aware prioritization.'],
  ['Collaborative Workspace', 'Real-time synchronized shared lattices for teams and projects.'],
];

export const LatticeFeaturesPage = () => {
  return (
    <LatticeFrame
      title="Feature Grid"
      subtitle="LATTICE converts passive bookmarking into a living system through AI, collaboration, and decay mechanics."
    >
      <section className="lattice-feature-grid">
        {features.map(([title, desc]) => (
          <article key={title} className="lattice-panel feature">
            <h2>{title}</h2>
            <p>{desc}</p>
          </article>
        ))}
      </section>
    </LatticeFrame>
  );
};
