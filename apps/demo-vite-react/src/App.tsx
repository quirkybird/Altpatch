import React from 'react';
import { CyclingButtons } from './CyclingButtons';
export function App() {
  const colors = [
    '#f8fafc',
    '#e0e0e0',
    '#d0d0d0',
    '#c0c0c0',
    '#b0b0b0',
    '#a0a0a0',
    '#8a2be2',
    '#a52a2a',
    '#ff4500',
    '#008b8b',
    '#00ced1'
  ];
  const [colorIndex, setColorIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setColorIndex((prevIndex) => (prevIndex + 1) % colors.length);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main
      style={{ fontFamily: 'system-ui', padding: 24, backgroundColor: 'black', color: 'white' }}
    >
      <h1 style={{ color: 'white' }}>欢迎来到我的 Vite 插件altpatch</h1>
      <p style={{ color: 'white' }}>
        按住 Alt 点击下面按钮，会触发 AltPatch tooltip 与 /api/read-file 调用。
      </p>
      <CyclingButtons color={colors[colorIndex]} />
    </main>
  );
}