import { useState } from 'react';

// ── SVG math ──────────────────────────────────────────────────────────────────

function p2c(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

function wedgePath(s: number, e: number, r1: number, r2: number): string {
  const [ax, ay] = p2c(s, r2);
  const [bx, by] = p2c(e, r2);
  const [cx, cy] = p2c(e, r1);
  const [dx, dy] = p2c(s, r1);
  const f = (n: number) => n.toFixed(4);
  return `M${f(ax)},${f(ay)} A${r2},${r2},0,0,1,${f(bx)},${f(by)} L${f(cx)},${f(cy)} A${r1},${r1},0,0,0,${f(dx)},${f(dy)}Z`;
}

// ── Wheel config ──────────────────────────────────────────────────────────────

const WD = [
  { key: 'yp', axis: 'Y' as const, sign:  1, label:  'Y', mid: -90 },
  { key: 'xp', axis: 'X' as const, sign:  1, label:  'X', mid:   0 },
  { key: 'yn', axis: 'Y' as const, sign: -1, label: '-Y', mid:  90 },
  { key: 'xn', axis: 'X' as const, sign: -1, label: '-X', mid: 180 },
] as const;

const GAP = 5;
const IR  = 0.27;
const SR  = 0.56;
const OR  = 0.94;

// ── Sub-components (only used by JogControls) ─────────────────────────────────

function XYWheel({
  onMove,
  onHome,
}: {
  onMove: (axis: 'X' | 'Y', mm: number) => void;
  onHome: () => void;
}) {
  const [flash, setFlash] = useState<string | null>(null);

  function tap(key: string, fn: () => void) {
    setFlash(key);
    setTimeout(() => setFlash(null), 180);
    fn();
  }

  return (
    <svg
      viewBox='-1.1 -1.1 2.2 2.2'
      className='w-full h-full select-none touch-none'
      style={{ WebkitTapHighlightColor: 'transparent' }}>
      <circle cx={0} cy={0} r={1.08} fill='#1c1c1f' />

      {WD.map(({ key, axis, sign, label, mid }) => {
        const s = mid - 45 + GAP;
        const e = mid + 45 - GAP;
        const smKey = `${key}_1`;
        const lgKey = `${key}_10`;
        const [lx, ly] = p2c(mid, (SR + OR) / 2 + 0.03);
        const [sx, sy] = p2c(mid, (IR + SR) / 2);

        return (
          <g key={key}>
            <path
              d={wedgePath(s, e, IR, SR)}
              fill={flash === smKey ? '#0f766e' : '#3f3f46'}
              stroke='#1c1c1f'
              strokeWidth={0.022}
              onClick={() => tap(smKey, () => onMove(axis, sign * 1))}
              style={{ cursor: 'pointer' }}
            />
            <path
              d={wedgePath(s, e, SR, OR)}
              fill={flash === lgKey ? '#0f766e' : '#3f3f46'}
              stroke='#1c1c1f'
              strokeWidth={0.022}
              onClick={() => tap(lgKey, () => onMove(axis, sign * 10))}
              style={{ cursor: 'pointer' }}
            />
            <text
              x={lx} y={ly}
              textAnchor='middle' dominantBaseline='middle'
              fontSize={0.17} fontWeight='600' fill='#d4d4d8'
              style={{ pointerEvents: 'none' }}>
              {label}
            </text>
            <text
              x={sx} y={sy}
              textAnchor='middle' dominantBaseline='middle'
              fontSize={0.11} fill='#71717a'
              style={{ pointerEvents: 'none' }}>
              {sign > 0 ? '+1' : '−1'}
            </text>
          </g>
        );
      })}

      <circle
        cx={0} cy={0} r={IR - 0.01}
        fill={flash === 'home' ? '#0f766e' : '#27272a'}
        stroke='#52525b'
        strokeWidth={0.025}
        onClick={() => tap('home', onHome)}
        style={{ cursor: 'pointer' }}
      />
      <text
        x={0} y={0.02}
        textAnchor='middle' dominantBaseline='middle'
        fontSize={0.22}
        fill={flash === 'home' ? '#5eead4' : '#14b8a6'}
        style={{ pointerEvents: 'none' }}>
        ⌂
      </text>
    </svg>
  );
}

function ExtruderControl({ onMove }: { onMove: (mm: number) => void }) {
  const btn =
    'flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-700 hover:bg-zinc-600 active:bg-teal-800 text-zinc-200 transition-colors';

  return (
    <div className='grid grid-rows-[auto_auto_1fr_auto_auto] items-center justify-between h-full gap-2'>
      <button className={btn} onClick={() => onMove(10)}>
        <svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2.5} strokeLinecap='round'>
          <path d='M5 11l7-7 7 7M5 19l7-7 7 7' />
        </svg>
      </button>
      <button className={btn} onClick={() => onMove(1)}>
        <svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2.5} strokeLinecap='round'>
          <path d='M5 15l7-7 7 7' />
        </svg>
      </button>

      <div className='flex flex-col items-center py-1 gap-0 my-auto'>
        <div className='w-2 h-5 bg-gradient-to-b from-zinc-300 to-zinc-500 rounded-t' />
        <div className='w-9 h-6 bg-zinc-600 rounded border border-zinc-500 flex items-center justify-center'>
          <div className='w-4 h-4 rounded-full border-2 border-zinc-400' />
        </div>
        <div className='w-2 h-2 bg-zinc-500 rounded-b' />
      </div>

      <button className={btn} onClick={() => onMove(-1)}>
        <svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2.5} strokeLinecap='round'>
          <path d='M19 9l-7 7-7-7' />
        </svg>
      </button>
      <button className={btn} onClick={() => onMove(-10)}>
        <svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2.5} strokeLinecap='round'>
          <path d='M19 5l-7 7-7-7M19 13l-7 7-7-7' />
        </svg>
      </button>
    </div>
  );
}

function BedControl({ onMove }: { onMove: (mm: number) => void }) {
  const btn =
    'flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-700 hover:bg-zinc-600 active:bg-teal-800 text-zinc-200 transition-colors';

  return (
    <div className='grid grid-rows-[auto_auto_1fr_auto_auto] items-center justify-between gap-2 w-fit h-full'>
      <button className={btn} onClick={() => onMove(10)}>
        <svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2.5} strokeLinecap='round'>
          <path d='M5 11l7-7 7 7M5 19l7-7 7 7' />
        </svg>
      </button>
      <button className={btn} onClick={() => onMove(1)}>
        <svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2.5} strokeLinecap='round'>
          <path d='M5 15l7-7 7 7' />
        </svg>
      </button>
      <span className='text-zinc-400 text-xs font-medium text-center shrink-0 px-1 my-auto'>
        Bed
      </span>
      <button className={btn} onClick={() => onMove(-1)}>
        <svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2.5} strokeLinecap='round'>
          <path d='M19 9l-7 7-7-7' />
        </svg>
      </button>
      <button className={btn} onClick={() => onMove(-10)}>
        <svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2.5} strokeLinecap='round'>
          <path d='M19 5l-7 7-7-7M19 13l-7 7-7-7' />
        </svg>
      </button>
    </div>
  );
}

// ── Exported component ────────────────────────────────────────────────────────

export default function JogControls({ onGcode }: { onGcode: (g: string) => void }) {
  function move(axis: 'X' | 'Y' | 'Z' | 'E', feedrate: number, mm: number) {
    onGcode(`G91\nG1 ${axis}${mm} F${feedrate}\nG90`);
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='grid grid-cols-[1fr_auto_auto] gap-3 items-center'>
        <div className='flex-1 aspect-square'>
          <XYWheel
            onMove={(axis, mm) => move(axis, 3000, mm)}
            onHome={() => onGcode('G28')}
          />
        </div>
        <ExtruderControl onMove={(mm) => move('E', 200, mm)} />
        <BedControl onMove={(mm) => move('Z', 300, mm)} />
      </div>
      <p className='text-zinc-600 text-[10px]'>⌂ homes all axes — do this before moving</p>
    </div>
  );
}
