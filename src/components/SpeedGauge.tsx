const SPEED_LEVELS = ['', 'Silent', 'Standard', 'Sport', 'Ludicrous'] as const;

const POPUP_ID = 'speed-gauge-popup';

export default function SpeedGauge({
  level,
  onSet,
  icon,
}: {
  level: number;
  onSet: (lvl: number) => void;
  icon: React.ReactNode;
}) {
  const safe = Math.min(4, Math.max(1, level || 2));

  return (
    <button
      className='flex flex-col items-center justify-center gap-4 group'
      popovertarget={POPUP_ID}
      style={{ anchorName: '--speed-gauge-btn' }}>
      <div className='text-zinc-500 group-hover:text-white transition-colors'>
        {icon}
      </div>

      <span className='text-white text-sm font-bold'>{SPEED_LEVELS[safe]}</span>

      <div
        id={POPUP_ID}
        popover='auto'
        style={{
          positionAnchor: '--speed-gauge-btn',
          top: 'anchor(bottom)',
          left: 'anchor(right)',
          transform: 'translate(-100%,0%)',
          inset: 'unset',
        }}
        className='bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl p-5 w-100'>
        <div className='flex items-center justify-between mb-4'>
          <span className='text-zinc-400 text-sm'>Speed Mode</span>
          <span className='text-white text-base font-semibold'>
            {SPEED_LEVELS[safe]}
          </span>
        </div>
        <input
          type='range'
          min={1}
          max={4}
          step={1}
          value={safe}
          onChange={(e) => onSet(Number(e.target.value))}
          className='w-full accent-teal-500 h-2'
        />
        <div className='flex justify-between text-zinc-500 text-xs mt-2'>
          {SPEED_LEVELS.slice(1).map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>
    </button>
  );
}
