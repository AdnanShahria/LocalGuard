import plugin from 'tailwindcss/plugin.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./popup.html",
    "./options.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        focus: {
          bg: '#0c0e14',
          card: '#141824',
          cardSubtle: '#1a2030',
          border: 'rgba(255, 255, 255, 0.08)',
          borderHover: 'rgba(255, 255, 255, 0.16)',
          accent: '#3b82f6',
          accentGlow: 'rgba(59, 130, 246, 0.25)',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          textMuted: '#94a3b8',
          textSecondary: '#cbd5e1',
          textPrimary: '#f8fafc',
        },
        // Apple Sapphire to Electric Cobalt Brand Hierarchy
        sapphire: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc5fb',
          400: '#38a5f8',
          500: '#3b82f6', // Electric Cobalt light apex
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e3a8a', // Royal Cobalt / Deep Sapphire midtone
          900: '#0f172a',
          950: '#0a192f', // Midnight Sapphire core
        },
      },
      fontFamily: {
        // Apple SF Pro typography hierarchy strictly aligned with Apple HIG
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"SF Pro"',
          'system-ui',
          '-apple-system-subheadline',
          'Inter',
          '"Helvetica Neue"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        display: [
          '"SF Pro Display"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro"',
          'system-ui',
          'sans-serif',
        ],
        text: [
          '"SF Pro Text"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro"',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          'SFMono-Regular',
          'ui-monospace',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          'monospace',
        ],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'liquid-glass-sm': '0 4px 16px 0 rgba(10, 25, 47, 0.08), inset 0 1px 0 0 rgba(255, 255, 255, 0.65)',
        'liquid-glass-md': '0 8px 32px 0 rgba(10, 25, 47, 0.12), inset 0 1px 0 0 rgba(255, 255, 255, 0.8)',
        'liquid-glass-lg': '0 16px 48px 0 rgba(10, 25, 47, 0.16), inset 0 1px 0 0 rgba(255, 255, 255, 0.9)',
        'liquid-glass-dark': '0 8px 32px 0 rgba(2, 6, 23, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.14)',
        'liquid-glass-cobalt': '0 12px 36px 0 rgba(59, 130, 246, 0.25), inset 0 1px 0 0 rgba(255, 255, 255, 0.4)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.35)',
        'glow-teal': '0 0 20px rgba(20, 184, 166, 0.35)',
        'glow-amber': '0 0 20px rgba(245, 158, 11, 0.35)',
        'glow-orange': '0 0 20px rgba(249, 115, 22, 0.35)',
        'glow-red': '0 0 25px rgba(239, 68, 68, 0.45)',
        'glow-cobalt': '0 0 24px rgba(59, 130, 246, 0.45)',
      },
      backdropBlur: {
        'xs': '2px',
        'apple': '20px',
        'apple-heavy': '32px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-subtle': 'pulseSubtle 2s infinite ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
      },
    },
  },
  plugins: [
    plugin(function({ addUtilities }) {
      addUtilities({
        // Tabular Numerals for precision timers and analytics figures
        '.tabular-nums': {
          'font-variant-numeric': 'tabular-nums',
          'font-feature-settings': '"tnum" 1, "cv01" 1',
        },
        '.proportional-nums': {
          'font-variant-numeric': 'proportional-nums',
          'font-feature-settings': '"tnum" 0',
        },
        '.apple-timer-nums': {
          'font-variant-numeric': 'tabular-nums',
          'font-feature-settings': '"tnum" 1, "zero" 1',
          'letter-spacing': '-0.02em',
        },

        // Apple Liquid Glass Materials (HIG macOS / visionOS Translucency)
        '.liquid-glass': {
          'background': 'rgba(255, 255, 255, 0.72)',
          'backdrop-filter': 'blur(20px) saturate(180%)',
          '-webkit-backdrop-filter': 'blur(20px) saturate(180%)',
          'border': '1px solid rgba(255, 255, 255, 0.45)',
          'box-shadow': '0 8px 32px 0 rgba(10, 25, 47, 0.08), inset 0 1px 0 0 rgba(255, 255, 255, 0.75)',
        },
        '.liquid-glass-dark': {
          'background': 'rgba(15, 23, 42, 0.75)',
          'backdrop-filter': 'blur(24px) saturate(190%)',
          '-webkit-backdrop-filter': 'blur(24px) saturate(190%)',
          'border': '1px solid rgba(255, 255, 255, 0.12)',
          'box-shadow': '0 8px 32px 0 rgba(2, 6, 23, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.14)',
        },
        '.liquid-glass-subtle': {
          'background': 'rgba(255, 255, 255, 0.45)',
          'backdrop-filter': 'blur(14px) saturate(160%)',
          '-webkit-backdrop-filter': 'blur(14px) saturate(160%)',
          'border': '1px solid rgba(255, 255, 255, 0.25)',
        },
        '.liquid-glass-subtle-dark': {
          'background': 'rgba(15, 23, 42, 0.45)',
          'backdrop-filter': 'blur(16px) saturate(170%)',
          '-webkit-backdrop-filter': 'blur(16px) saturate(170%)',
          'border': '1px solid rgba(255, 255, 255, 0.08)',
        },
        '.liquid-glass-card': {
          'background': 'rgba(255, 255, 255, 0.82)',
          'backdrop-filter': 'blur(24px) saturate(180%)',
          '-webkit-backdrop-filter': 'blur(24px) saturate(180%)',
          'border': '1px solid rgba(226, 232, 240, 0.85)',
          'border-radius': '1.25rem',
          'box-shadow': '0 10px 30px -10px rgba(10, 25, 47, 0.08), 0 1px 3px 0 rgba(0, 0, 0, 0.02), inset 0 1px 0 0 rgba(255, 255, 255, 0.9)',
        },
        '.liquid-glass-cobalt': {
          'background': 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(30, 58, 138, 0.08) 100%)',
          'backdrop-filter': 'blur(20px) saturate(180%)',
          '-webkit-backdrop-filter': 'blur(20px) saturate(180%)',
          'border': '1px solid rgba(96, 165, 250, 0.35)',
          'box-shadow': '0 8px 32px 0 rgba(30, 58, 138, 0.15), inset 0 1px 0 0 rgba(255, 255, 255, 0.4)',
        },
        '.liquid-glass-interactive': {
          'transition': 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          '&:hover': {
            'transform': 'translateY(-1px)',
            'border-color': 'rgba(96, 165, 250, 0.5)',
            'box-shadow': '0 12px 36px 0 rgba(59, 130, 246, 0.16), inset 0 1px 0 0 rgba(255, 255, 255, 0.9)',
          },
          '&:active': {
            'transform': 'scale(0.985)',
          },
        },
        // Continuous Squircle utility
        '.squircle': {
          'border-radius': '28%',
        },
        '.squircle-shield': {
          'border-radius': '28%',
          'background': 'linear-gradient(135deg, #3b82f6 0%, #1e3a8a 44%, #0a192f 100%)',
        },
      });
    }),
  ],
}
