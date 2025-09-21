export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Existing HOL colors
        'hol-wallpaper-start': '#dae5ff',
        'hol-wallpaper-mid': '#eef2ff',
        'hol-wallpaper-end': '#f9fbff',
        'hol-panel': '#ffffff',
        'hol-panel-translucent': 'rgba(255,255,255,0.82)',
        'hol-border-light': '#ffffff',
        'hol-border': '#dbe4ff',
        'hol-border-strong': '#9fb4e0',
        'hol-text-primary': '#1a2140',
        'hol-text-secondary': '#4a5776',
        'hol-text-muted': '#6a799a',
        'hol-text-inverse': '#ffffff',
        'hol-primary': '#2972ff',
        'hol-primary-light': '#79a8ff',
        'hol-secondary': '#3ed1bd',
        'hol-highlight': '#ffc857',
        'hol-glass': 'rgba(255,255,255,0.65)',
        'hol-glass-strong': 'rgba(255,255,255,0.9)',
        'hol-surface-light': '#f4f6ff',
        'hol-surface-dark': '#060b1d',
        'hol-glass-dark': 'rgba(13, 20, 40, 0.72)',
        'hol-gold': '#ffd770',
        'hol-magenta': '#ff6f91',
        'brand-blue': '#5599fe',
        'brand-purple': '#b56cff',
        'brand-green': '#48df7b',
        'brand-ink': '#0d1326',
        // Shadcn design tokens for moonscape compatibility
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      boxShadow: {
        'desktop-window': '0 28px 60px rgba(26, 33, 64, 0.18)',
        'desktop-icon': '0 16px 30px rgba(41, 114, 255, 0.18)',
        'desktop-dock': '0 18px 45px rgba(20, 32, 68, 0.18)',
        // Classic 90s raised/sunken effects using HOL colors
        'raised': 'inset 1px 1px 0 rgba(255, 255, 255, 0.8), inset -1px -1px 0 rgba(155, 180, 224, 0.6)',
        'sunken': 'inset -1px -1px 0 rgba(255, 255, 255, 0.8), inset 1px 1px 0 rgba(155, 180, 224, 0.6)',
        'classic-button': '1px 1px 0 rgba(255, 255, 255, 0.8), -1px -1px 0 rgba(155, 180, 224, 0.6)',
        'classic-pressed': 'inset 1px 1px 2px rgba(155, 180, 224, 0.4)',
      },
      backdropBlur: {
        desktop: '20px',
      },
      borderRadius: {
        'desktop-xl': '26px',
        'desktop-lg': '18px',
      },
      fontSize: {
        'desktop-subheading': ['15px', { lineHeight: '22px', letterSpacing: '0.26em' }],
      },
    },
  },
};
