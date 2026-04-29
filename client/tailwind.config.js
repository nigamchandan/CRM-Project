/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Stripe-inspired indigo brand palette.
        // 600 is the primary CTA color; 500 is hover; 50/100 power soft-fill
        // surfaces (focus rings, status pills, tint backgrounds).
        brand: {
          50:  '#eef0ff',
          100: '#e0e3ff',
          200: '#c5cbff',
          300: '#a3aaff',
          400: '#8b8dff',
          500: '#7a73ff',
          600: '#635bff', // primary
          700: '#5247e0',
          800: '#3f37b8',
          900: '#2e2986',
          950: '#1a1750',
        },
        // Layered surface tokens so dark mode can express depth.
        // Light: page → card → elevated; Dark: same hierarchy with deep blacks.
        surface: {
          page:        '#f6f9fc', // Stripe's signature page background
          card:        '#ffffff',
          elevated:    '#ffffff',
          'page-dark':       '#0a0a14',
          'card-dark':       '#13131e',
          'elevated-dark':   '#1a1a28',
          'border-dark':     '#252535',
        },
      },
      boxShadow: {
        // Stripe-style shadows: soft, layered, never heavy.
        card:     '0 1px 2px 0 rgba(16,24,40,0.04), 0 1px 3px 0 rgba(16,24,40,0.06)',
        'card-hover': '0 2px 6px -1px rgba(16,24,40,0.06), 0 4px 12px -2px rgba(16,24,40,0.08)',
        'card-dark':  '0 0 0 1px rgba(255,255,255,0.04), 0 1px 3px rgba(0,0,0,0.4)',
        // Indigo glow for primary CTAs — the "Stripe button look".
        glow:        '0 1px 2px 0 rgba(16,24,40,0.05), 0 4px 12px -2px rgba(99,91,255,0.35)',
        'glow-sm':   '0 1px 2px 0 rgba(16,24,40,0.05), 0 2px 6px -1px rgba(99,91,255,0.25)',
        // Inset highlight on buttons for that "lit-from-above" feel.
        'inset-top': 'inset 0 1px 0 0 rgba(255,255,255,0.15)',
      },
      backgroundImage: {
        'brand-gradient':  'linear-gradient(180deg, #7a73ff 0%, #635bff 100%)',
        'brand-gradient-r':'linear-gradient(135deg, #635bff 0%, #8b6cf5 100%)',
        'page-gradient':   'linear-gradient(180deg, #f6f9fc 0%, #ffffff 280px)',
        'page-gradient-dark': 'linear-gradient(180deg, #0a0a14 0%, #13131e 320px)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in':   { '0%': { opacity: 0 },               '100%': { opacity: 1 } },
        'slide-up':  { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'pulse-ring':{ '0%': { transform: 'scale(.8)', opacity: 0.6 }, '100%': { transform: 'scale(2.4)', opacity: 0 } },
      },
      animation: {
        'fade-in':   'fade-in .25s ease-out',
        'slide-up':  'slide-up .25s ease-out',
        'pulse-ring':'pulse-ring 1.6s cubic-bezier(0.215,0.61,0.355,1) infinite',
      },
    },
  },
  plugins: [],
};
