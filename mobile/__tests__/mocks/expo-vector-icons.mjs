import React from 'react';

function createMockIcon(setName) {
  return function MockIcon({ name, size, color, ...props }) {
    return React.createElement('span', {
      'data-icon-set': setName,
      'data-icon': name,
      'data-size': size,
      'data-color': color,
      ...props,
    });
  };
}

export const MaterialIcons = createMockIcon('MaterialIcons');
export const Ionicons = createMockIcon('Ionicons');
export const Feather = createMockIcon('Feather');

export default {
  MaterialIcons,
  Ionicons,
  Feather,
};
