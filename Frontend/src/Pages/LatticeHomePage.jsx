import React from 'react';
import { LatticeFrame } from './LatticeFrame';
import { BookOpen, PenTool, Code2, Share2, ArrowUpRight, Atom, Blocks } from 'lucide-react';
import './LatticePages.css';

const personalLattices = [
  { id: '01', title: 'DESIGN', author: 'Mina Gallagher', lessons: '32 Lesson', icon: <BookOpen color="#7a9b3e" size={26}/> },
  { id: '02', title: 'WRITING', author: 'Mina Gallagher', lessons: '16 Lesson', icon: <PenTool color="#7a9b3e" size={26}/> },
  { id: '03', title: 'DEVELOPMENT', author: 'Mina Gallagher', lessons: '42 Lesson', icon: <Code2 color="#7a9b3e" size={26}/> },
  { id: '04', title: 'SOCIAL MEDIA', author: 'Mina Gallagher', lessons: '8 Lesson', icon: <Share2 color="#7a9b3e" size={26}/> },
];

const collaborativeLattices = [
  { id: '05', title: 'WEB3 ARCHITECTURE', author: 'Louis Nguyen', lessons: '12 Lesson', icon: <Blocks color="#7a9b3e" size={26}/> },
  { id: '06', title: 'GROWTH METRICS', author: 'Alfred Gabriel', lessons: '8 Lesson', icon: <ArrowUpRight color="#7a9b3e" size={26}/> },
  { id: '07', title: 'PRODUCT SCIENCE', author: 'Julia Robinson', lessons: '45 Lesson', icon: <Atom color="#7a9b3e" size={26}/> },
  { id: '08', title: 'BRAND STRATEGY', author: 'Mina Gallagher', lessons: '22 Lesson', icon: <PenTool color="#7a9b3e" size={26}/> },
];

export const LatticeHomePage = () => {
  return (
    <LatticeFrame>
      <div className="directory-container">
        
        <header className="directory-header">
          <h2>Personal Hub</h2>
        </header>

        <section className="directory-grid">
          {personalLattices.map(item => (
            <div className="dir-card" key={item.id}>
              <div className="dir-hover-bg"></div>
              
              <div className="dir-index">{`{ ${item.id} }`}</div>
              
              <div className="dir-icon-wrapper">
                <div className="dir-icon-blob"></div>
                <div className="dir-icon">{item.icon}</div>
              </div>

              <div className="dir-bottom">
                <h3 className="dir-title">{item.title}</h3>
                <div className="dir-meta">
                  <span>{item.author}</span>
                  <span className="dir-line"></span>
                  <span>{item.lessons}</span>
                </div>
              </div>
              
              <div className="dir-action-circle">
                <ArrowUpRight size={18} strokeWidth={2.5} color="#5e8027" />
              </div>
            </div>
          ))}
        </section>

        <header className="directory-header" style={{marginTop: '60px'}}>
          <h2>Collaborative Hub</h2>
        </header>

        <section className="directory-grid">
          {collaborativeLattices.map(item => (
            <div className="dir-card" key={item.id}>
              <div className="dir-hover-bg"></div>
              
              <div className="dir-index">{`{ ${item.id} }`}</div>
              
              <div className="dir-icon-wrapper">
                <div className="dir-icon-blob"></div>
                <div className="dir-icon">{item.icon}</div>
              </div>

              <div className="dir-bottom">
                <h3 className="dir-title">{item.title}</h3>
                <div className="dir-meta">
                  <span>{item.author}</span>
                  <span className="dir-line"></span>
                  <span>{item.lessons}</span>
                </div>
              </div>

              <div className="dir-action-circle">
                <ArrowUpRight size={18} strokeWidth={2.5} color="#5e8027" />
              </div>
            </div>
          ))}
        </section>

      </div>
    </LatticeFrame>
  );
};
