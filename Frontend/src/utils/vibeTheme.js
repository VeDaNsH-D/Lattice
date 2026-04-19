const VIBE_THEMES = {
  chaotic: {
    start: '#8fbf57',
    mid: '#84b94f',
    end: '#9dbf74',
    glow: '#bdd99a',
    tint: '#6ea542',
    cardTint: '#f2f4ee',
    badgeBg: 'rgba(234, 240, 255, 0.9)',
    badgeBorder: 'rgba(111, 145, 216, 0.42)',
    badgeText: '#2a4f97',
  },
  educational: {
    start: '#4bb88a',
    mid: '#43ae83',
    end: '#6cc09d',
    glow: '#9edcc3',
    tint: '#2e9870',
    cardTint: '#edf3ef',
    badgeBg: 'rgba(232, 248, 237, 0.92)',
    badgeBorder: 'rgba(97, 171, 130, 0.44)',
    badgeText: '#2b6c45',
  },
  cursed: {
    start: '#e08233',
    mid: '#b47aac',
    end: '#6988de',
    glow: '#d3b5c6',
    tint: '#cb7135',
    cardTint: '#f3eeec',
    badgeBg: 'rgba(253, 235, 231, 0.92)',
    badgeBorder: 'rgba(223, 126, 102, 0.46)',
    badgeText: '#9d4029',
  },
  high_signal: {
    start: '#8896e3',
    mid: '#6572d1',
    end: '#7f8ee0',
    glow: '#b1bcf5',
    tint: '#4f5dc4',
    cardTint: '#eff0f6',
    badgeBg: 'rgba(239, 233, 251, 0.92)',
    badgeBorder: 'rgba(154, 127, 198, 0.46)',
    badgeText: '#5f428d',
  },
  neutral: {
    start: '#d8d8d8',
    mid: '#cecece',
    end: '#b8b8b8',
    glow: '#d8d8d8',
    tint: '#949494',
    cardTint: '#f2f2f2',
    badgeBg: 'rgba(246, 240, 232, 0.94)',
    badgeBorder: 'rgba(179, 156, 134, 0.45)',
    badgeText: '#725b46',
  },
};

export function normalizeVibeLabel(rawVibe) {
  const value = String(rawVibe || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  if (!value) {
    return 'neutral';
  }

  return Object.prototype.hasOwnProperty.call(VIBE_THEMES, value) ? value : 'neutral';
}

export function getVibeTheme(rawVibe) {
  const vibe = normalizeVibeLabel(rawVibe);
  return {
    vibe,
    ...VIBE_THEMES[vibe],
  };
}

export function formatVibeLabel(rawVibe) {
  const vibe = normalizeVibeLabel(rawVibe);
  return vibe
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}
