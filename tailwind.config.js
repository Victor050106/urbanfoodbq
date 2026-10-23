// Genera assets/css/tailwind.css con `npm run css`. Hay que volver a correrlo cada vez que se usa
// una clase de Tailwind nueva en el HTML o en assets/js; si no, esa clase no tiene estilo.
module.exports = {
  content: ['./index.html', './reservas/**/*.html', './privacidad/**/*.html', './assets/js/**/*.js'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'deep-black': '#000000',
        'vibrant-orange': '#FF6B00',
        'fresh-teal': '#1ABC9C',
        'warm-gold': '#F39C12',
        'background': '#f9f9f9',
        'surface': '#f9f9f9',
        'surface-container': '#eeeeee',
        'surface-container-low': '#f3f3f3',
        'surface-container-lowest': '#ffffff',
        'surface-container-high': '#e8e8e8',
        'surface-container-highest': '#e2e2e2',
        'on-background': '#1a1c1c',
        'on-surface': '#1a1c1c',
        'secondary': '#5e5e5e',
        'primary': '#a04100',
        'primary-container': '#ff6b00'
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.5rem',
        full: '9999px'
      },
      spacing: {
        'container-max': '1280px',
        'margin-desktop': '64px',
        'base': '8px',
        'margin-mobile': '20px',
        'gutter-mobile': '16px',
        'gutter-desktop': '24px'
      },
      fontFamily: {
        'display': ['Bebas Neue', 'sans-serif'],
        'body': ['Inter', 'sans-serif']
      },
      fontSize: {
        'display-lg-mobile': ['48px', { lineHeight: '48px', letterSpacing: '0.02em', fontWeight: '400' }],
        'display-lg': ['80px', { lineHeight: '80px', letterSpacing: '0.02em', fontWeight: '400' }],
        'headline-lg': ['40px', { lineHeight: '40px', letterSpacing: '0.03em', fontWeight: '400' }],
        'headline-md': ['24px', { lineHeight: '32px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'label-bold': ['14px', { lineHeight: '20px', fontWeight: '700' }],
        'label-sm': ['12px', { lineHeight: '16px', fontWeight: '500' }]
      }
    }
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')]
};
