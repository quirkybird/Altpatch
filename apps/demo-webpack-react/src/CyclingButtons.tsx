type CyclingButtonsProps = {
  color: string;
};

const buttonLabels = ['随便玩玩', '按钮1', '按钮2', '按钮3', '按钮4', '按钮5'];

export function CyclingButtons({ color }: CyclingButtonsProps) {
  const base = parseInt(color.slice(1), 16);
  const r = (base >> 16) & 255;
  const g = (base >> 8) & 255;
  const b = base & 255;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateAreas: `
          ". a ."
          "b c d"
          ". e ."
        `,
        gap: 12,
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      {buttonLabels.map((label, i) => {
        const t = i / (buttonLabels.length - 1);
        const nr = Math.round(r + t * (255 - r));
        const ng = Math.round(g + t * (255 - g));
        const nb = Math.round(b + t * (255 - b));
        const area = ['c', 'a', 'b', 'e', 'd'][i] || 'c';
        return (
          <button
            key={label}
            style={{
              gridArea: area,
              border: '1px solid #94a3b8',
              borderRadius: 10,
              padding: '10px 16px',
              background: `rgb(${nr},${ng},${nb})`,
              cursor: 'pointer'
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
