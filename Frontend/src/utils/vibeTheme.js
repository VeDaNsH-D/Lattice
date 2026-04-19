const VIBE_THEMES = {
  'high-signal': {
    start: '#2f80ed',
    mid: '#1f6fe0',
    end: '#7bb7ff',
    glow: '#b9dcff',
    tint: '#2563eb',
    cardTint: '#eef6ff',
    badgeBg: 'rgba(231, 243, 255, 0.96)',
    badgeBorder: 'rgba(79, 145, 237, 0.42)',
    badgeText: '#1d4ed8',
  },
  educational: {
    start: '#22c55e',
    mid: '#16a34a',
    end: '#86efac',
    glow: '#c4f1d2',
    tint: '#15803d',
    cardTint: '#effaf2',
    badgeBg: 'rgba(233, 251, 239, 0.96)',
    badgeBorder: 'rgba(67, 169, 107, 0.42)',
    badgeText: '#166534',
  },
  motivational: {
    start: '#fb7185',
    mid: '#f97316',
    end: '#fbbf24',
    glow: '#ffd7ab',
    tint: '#ea580c',
    cardTint: '#fff5ee',
    badgeBg: 'rgba(255, 238, 231, 0.96)',
    badgeBorder: 'rgba(248, 138, 93, 0.46)',
    badgeText: '#c2410c',
  },
  chaotic: {
    start: '#a855f7',
    mid: '#ec4899',
    end: '#f97316',
    glow: '#f1b3e8',
    tint: '#c026d3',
    cardTint: '#f8f1ff',
    badgeBg: 'rgba(246, 232, 255, 0.96)',
    badgeBorder: 'rgba(182, 121, 237, 0.45)',
    badgeText: '#7e22ce',
  },
  cursed: {
    start: '#5b4b8a',
    mid: '#7262a6',
    end: '#ad9be8',
    glow: '#d7cff7',
    tint: '#4c3f75',
    cardTint: '#f3effb',
    badgeBg: 'rgba(237, 233, 251, 0.96)',
    badgeBorder: 'rgba(144, 127, 196, 0.46)',
    badgeText: '#4f46e5',
  },
  general: {
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
  const value = String(rawVibe || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!value) {
    return 'general';
  }

  if (Object.prototype.hasOwnProperty.call(VIBE_THEMES, value)) {
    return value;
  }

  const aliases = {
    research: 'high-signal',
    reference: 'high-signal',
    tooling: 'high-signal',
    tutorial: 'educational',
    inspiration: 'motivational',
    news: 'chaotic',
    discussion: 'chaotic',
    highsignal: 'high-signal',
    educational: 'educational',
    motivational: 'motivational',
    chaotic: 'chaotic',
    cursed: 'cursed',
    general: 'general',
  };

  return aliases[value] || 'general';
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
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('-');
}
