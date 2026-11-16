import React from 'react';

export function WebView({ source, style, ...props }) {
  return React.createElement('div', {
    'data-react-native-webview': 'true',
    'data-html-length': source?.html ? String(source.html.length) : '0',
    ...props,
  });
}

export default WebView;
