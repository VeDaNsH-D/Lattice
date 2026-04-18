import React from 'react';
import './Hero.css';

// Using simple SVG icons or text as fallbacks for the brand logos
const icons = [
  { id: 'slack', src: 'https://api.iconify.design/logos:slack-icon.svg', size: 48, radius: 625, angle: -150 },
  { id: 'googleads', src: 'https://api.iconify.design/logos:google-ads.svg', size: 44, radius: 375, angle: 135 },
  { id: 'meta', src: 'https://api.iconify.design/logos:meta-icon.svg', size: 54, radius: 375, angle: 180 }, 
  { id: 'mailchimp', src: 'https://api.iconify.design/logos:mailchimp.svg', size: 42, radius: 625, angle: 155 },
  { id: 'zapier', src: 'https://api.iconify.design/logos:zapier-icon.svg', size: 50, radius: 500, angle: -30 },
  { id: 'figma', src: 'https://api.iconify.design/logos:figma.svg', size: 44, radius: 500, angle: 25 },
  { id: 'aws', src: 'https://api.iconify.design/logos:aws.svg', size: 56, radius: 625, angle: 0 },
  { id: 'asana', src: 'https://api.iconify.design/logos:asana-icon.svg', size: 48, radius: 375, angle: -45 }
];

export const ConcentricNetwork = () => {
  return (
    <div className="concentric-rings-container">
      {/* Glow */}
      <div className="hero-glow"></div>

      {/* Rings */}
      <div className="ring ring-2"></div>
      <div className="ring ring-3"></div>
      <div className="ring ring-4"></div>
      <div className="ring ring-5"></div>
      
      {/* Colored partial rings */}
      <div className="ring-accent ring-accent-1"></div>
      <div className="ring-accent ring-accent-2"></div>

      {/* Floating Icons */}
      {icons.map((icon, index) => {
        // Convert polar (radius, angle) to cartesian for translation
        const angleRad = (icon.angle * Math.PI) / 180;
        const x = icon.radius * Math.cos(angleRad);
        const y = icon.radius * Math.sin(angleRad);

        return (
          <div
            key={icon.id}
            className={`floating-icon-wrapper`}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginLeft: `${x}px`,
              marginTop: `${y}px`,
              width: icon.size,
              height: icon.size,
              transform: 'translate(-50%, -50%)',
              zIndex: 2
            }}
          >
            <div className={`floating-icon icon-${icon.id}`} style={{ width: '100%', height: '100%', position: 'relative', top: 'auto', left: 'auto', transform: 'none' }}>
              <img 
                src={icon.src} 
                alt={icon.id} 
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
