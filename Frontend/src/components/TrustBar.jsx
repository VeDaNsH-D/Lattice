import React from 'react';
import './Hero.css';

const trustLogos = [
  { id: 'google', src: 'https://api.iconify.design/logos:google.svg' },
  { id: 'airbnb', src: 'https://api.iconify.design/logos:airbnb.svg' },
  { id: 'coinbase', src: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/coinbase.svg' },
  { id: 'notion', src: 'https://api.iconify.design/logos:notion-icon.svg' },
  { id: 'gumroad', src: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/gumroad.svg' },
  { id: 'paypal', src: 'https://api.iconify.design/logos:paypal.svg' },
  { id: 'upwork', src: 'https://api.iconify.design/logos:upwork.svg' },
  { id: 'shopify', src: 'https://api.iconify.design/logos:shopify.svg' },
  { id: 'stripe', src: 'https://api.iconify.design/logos:stripe.svg' },
  { id: 'zoom', src: 'https://api.iconify.design/logos:zoom-icon.svg' }
];

export const TrustBar = () => {
  return (
    <div className="trust-bar">
      <div className="trust-title">Trusted by 200,000+ users worldwide</div>
      <div className="trust-logos">
        {trustLogos.map((logo) => (
          <img 
            key={logo.id} 
            src={logo.src} 
            alt={`${logo.id} logo`} 
            className="trust-logo" 
          />
        ))}
      </div>
    </div>
  );
};
