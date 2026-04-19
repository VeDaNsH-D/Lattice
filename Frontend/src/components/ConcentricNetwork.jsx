import React, { useEffect, useState } from 'react';
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
  const [elapsedMs, setElapsedMs] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyPreference = () => setPrefersReducedMotion(media.matches);
    applyPreference();

    if (media.addEventListener) {
      media.addEventListener('change', applyPreference);
      return () => media.removeEventListener('change', applyPreference);
    }

    media.addListener(applyPreference);
    return () => media.removeListener(applyPreference);
  }, []);

  useEffect(() => {
    let rafId;
    const start = performance.now();

    const update = (now) => {
      setElapsedMs(now - start);
      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const motionScale = prefersReducedMotion ? 2.2 : 1;

  const getAngle = (duration, reverse = false, start = 0) => {
    const totalSeconds = elapsedMs / 1000;
    const turns = totalSeconds / (duration * motionScale);
    const delta = turns * 360;
    return start + (reverse ? -delta : delta);
  };

  const ringConfigs = [
    { className: 'ring-2', duration: 44, reverse: false },
    { className: 'ring-3', duration: 58, reverse: true },
    { className: 'ring-4', duration: 74, reverse: false },
    { className: 'ring-5', duration: 92, reverse: true }
  ];

  const accentConfigs = [
    { className: 'ring-accent-1', duration: 70, start: -45, reverse: false },
    { className: 'ring-accent-2', duration: 96, start: 15, reverse: true }
  ];

  return (
    <div className="concentric-rings-container">
      {/* Glow */}
      <div className="hero-glow"></div>

      {/* Rings */}
      {ringConfigs.map((ring) => (
        <div
          key={ring.className}
          className={`ring ${ring.className}`}
          style={{
            transform: `translate(-50%, -50%) rotate(${getAngle(ring.duration, ring.reverse)}deg)`
          }}
        />
      ))}

      {/* Colored partial rings */}
      {accentConfigs.map((accent) => (
        <div
          key={accent.className}
          className={`ring-accent ${accent.className}`}
          style={{
            transform: `translate(-50%, -50%) rotate(${getAngle(accent.duration, accent.reverse, accent.start)}deg)`
          }}
        />
      ))}

      {/* Floating Icons */}
      {icons.map((icon, index) => {
        // Convert polar (radius, angle) to cartesian for translation
        const angleRad = (icon.angle * Math.PI) / 180;
        const x = icon.radius * Math.cos(angleRad);
        const y = icon.radius * Math.sin(angleRad);
        const orbitDuration = (42 + (index % 4) * 9) * motionScale;
        const orbitReverse = index % 2 !== 0;
        const orbitAngle = getAngle(orbitDuration, orbitReverse);

        return (
          <div
            key={icon.id}
            className={`floating-icon-wrapper`}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: icon.size,
              height: icon.size,
              marginLeft: `${-icon.size / 2}px`,
              marginTop: `${-icon.size / 2}px`,
              zIndex: 2,
              transform: `rotate(${orbitAngle}deg)`
            }}
          >
            <div
              style={{
                width: icon.size,
                height: icon.size,
                transform: `translate(${x}px, ${y}px)`
              }}
            >
              <div
                className={`floating-icon icon-${icon.id}`}
                style={{
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                  top: 'auto',
                  left: 'auto',
                  transform: `rotate(${-orbitAngle}deg)`
                }}
              >
                <img
                  src={icon.src}
                  alt={icon.id}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
