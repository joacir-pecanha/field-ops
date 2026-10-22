export const tokens = {
  colors: {
    // Brand
    primary: '#0056b3', // Azul escuro
    primaryActive: '#004494',
    secondary: '#6c757d',
    secondaryActive: '#5a6268',
    
    // Status
    success: '#28a745',
    warning: '#ffc107',
    danger: '#dc3545',
    dangerActive: '#c82333',
    info: '#17a2b8',

    // Connection states
    online: '#28a745',
    offline: '#6c757d',
    syncing: '#ffc107',
    error: '#dc3545',

    // Backgrounds & Surfaces
    background: '#f8f9fa',
    surface: '#ffffff',
    
    // Text
    text: '#212529',
    textMuted: '#6c757d',
    textInverse: '#ffffff',

    // Borders
    border: '#dee2e6',
  },
  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    fontSizes: {
      small: 12,
      regular: 16,
      large: 20,
      title: 24,
    },
    fontWeights: {
      regular: '400' as const,
      medium: '500' as const,
      bold: '700' as const,
    },
  },
  borderRadius: {
    small: 4,
    medium: 8,
    large: 12,
    round: 9999,
  },
};
