import { useState, useEffect, useRef } from 'react';

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { load } from '@tauri-apps/plugin-store';
import type { AmsTray, AmsUnit, PrinterStatus } from './vite-env';

// ── Helpers ───────────────────────────────────────────────────────────────────

function gcodeLabel(state: string): { text: string; dot: string } {
  switch (state) {
    case 'RUNNING':
      return { text: 'Printing', dot: 'bg-teal-400' };
    case 'PAUSE':
      return { text: 'Paused', dot: 'bg-amber-400' };
    case 'FINISH':
      return { text: 'Complete', dot: 'bg-green-400' };
    case 'FAILED':
      return { text: 'Failed', dot: 'bg-red-500' };
    default:
      return { text: 'Ready', dot: 'bg-zinc-500' };
  }
}

function fmtRemaining(mins: number): string {
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
}

function humidityGrade(level: number): {
  letter: string;
  color: string;
  label: string;
} {
  switch (level) {
    case 5:
      return { letter: 'A', color: 'text-green-400', label: 'Dry' };
    case 4:
      return { letter: 'B', color: 'text-green-400', label: 'Good' };
    case 3:
      return { letter: 'C', color: 'text-yellow-400', label: 'Fair' };
    case 2:
      return { letter: 'D', color: 'text-orange-400', label: 'Humid' };
    case 1:
      return { letter: 'E', color: 'text-red-400', label: 'Wet' };
    default:
      return { letter: '?', color: 'text-zinc-500', label: 'Unknown' };
  }
}

// ── Section (collapsible card) ────────────────────────────────────────────────

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className='rounded-xl overflow-hidden'>
      <button
        onClick={() => setOpen((o) => !o)}
        className='w-full flex items-center justify-between px-4 py-3 bg-zinc-800 text-left'>
        <span className='text-white font-semibold text-sm'>{title}</span>
        <svg
          className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
          strokeWidth={2}>
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M19 9l-7 7-7-7'
          />
        </svg>
      </button>
      {open && (
        <div className='bg-zinc-900 px-4 py-4 flex flex-col gap-4'>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className='w-full bg-zinc-700 rounded-full h-2'>
      <div
        className='bg-teal-500 h-2 rounded-full transition-all duration-500'
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

// ── Print status card (status + progress + controls) ──────────────────────────

function PrintStatusCard({
  status,
  onCommand,
}: {
  status: PrinterStatus;
  onCommand: (cmd: string) => void;
}) {
  const { text, dot } = gcodeLabel(status.gcode_state);
  const isPrinting = status.gcode_state === 'RUNNING';
  const isPaused = status.gcode_state === 'PAUSE';
  const isActive = isPrinting || isPaused;

  return (
    <div className='bg-zinc-800 rounded-xl p-4 flex flex-col gap-3'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <span
            className={`w-2 h-2 rounded-full ${dot} ${isPrinting ? 'animate-pulse' : ''}`}
          />
          <span className='text-white font-semibold'>{text}</span>
        </div>
        {isActive && status.stage && (
          <span className='text-zinc-400 text-xs bg-zinc-700 rounded-full px-2 py-0.5'>
            {status.stage}
          </span>
        )}
      </div>

      {isActive && (
        <>
          <ProgressBar percent={status.progress} />
          <div className='flex justify-between text-sm'>
            <span className='text-teal-400 font-semibold'>
              {status.progress}%
            </span>
            <span className='text-zinc-400'>
              {fmtRemaining(status.remaining_mins)}
            </span>
          </div>
          {status.total_layer_num > 0 && (
            <p className='text-zinc-500 text-xs'>
              Layer{' '}
              <span className='text-zinc-300 font-medium'>
                {status.layer_num}
              </span>{' '}
              / {status.total_layer_num}
            </p>
          )}
        </>
      )}

      {isActive && (
        <div className='flex gap-2 pt-1 border-t border-zinc-700'>
          {isPrinting && (
            <button
              onClick={() => onCommand('pause')}
              className='flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors'>
              Pause
            </button>
          )}
          {isPaused && (
            <button
              onClick={() => onCommand('resume')}
              className='flex-1 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors'>
              Resume
            </button>
          )}
          <button
            onClick={() => onCommand('stop')}
            className='flex-1 bg-red-900 hover:bg-red-800 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors'>
            Stop
          </button>
        </div>
      )}
    </div>
  );
}

// ── Temperature gauge cell ────────────────────────────────────────────────────

function TempGauge({
  label,
  actual,
  target,
}: {
  label: string;
  actual: number;
  target?: number;
}) {
  return (
    <div className='bg-zinc-800 rounded-xl p-4 flex flex-col gap-1'>
      <span className='text-zinc-400 text-xs uppercase tracking-wider'>
        {label}
      </span>
      <span className='text-white text-2xl font-bold tabular-nums'>
        {actual.toFixed(1)}°
      </span>
      {target != null && target > 0 && (
        <span className='text-zinc-500 text-xs'>
          target {target.toFixed(0)}°
        </span>
      )}
    </div>
  );
}

// ── Chamber light button (matches TempGauge cell style) ───────────────────────

function LampButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`bg-zinc-800 rounded-xl p-4 flex flex-col gap-1 items-start w-full transition-colors ${
        on ? 'ring-1 ring-yellow-500/60' : ''
      }`}>
      <span className='text-zinc-400 text-xs uppercase tracking-wider'>
        Light
      </span>
      <span className='text-2xl leading-none mt-1'>{on ? '💡' : '🔦'}</span>
      <span
        className={`text-xs font-semibold mt-1 ${on ? 'text-yellow-400' : 'text-zinc-500'}`}>
        {on ? 'On' : 'Off'}
      </span>
    </button>
  );
}

// ── AMS filament view (no outer card — lives inside Section) ──────────────────

function AmsView({ ams }: { ams: AmsUnit[] }) {
  if (!ams.length) return null;
  return (
    <div className='flex flex-col gap-4'>
      {ams.map((unit) => {
        const grade = humidityGrade(unit.humidity);
        return (
          <div key={unit.id}>
            <p className='text-zinc-500 text-xs mb-2 flex items-center gap-2'>
              <span>Unit {unit.id + 1}</span>
              <span>·</span>
              <span>
                Humidity{' '}
                <span className={`font-bold ${grade.color}`}>
                  {grade.letter}
                </span>
                <span className='text-zinc-600 ml-1'>({grade.label})</span>
              </span>
            </p>
            <div className='flex gap-3'>
              {unit.trays.map((tray: AmsTray) => (
                <div
                  key={tray.id}
                  className='flex flex-col items-center gap-1 flex-1'>
                  <div
                    className='w-full aspect-square rounded-lg border-2 border-zinc-700 max-w-12'
                    style={{
                      backgroundColor:
                        tray.color ? `#${tray.color}` : '#3f3f46',
                    }}
                  />
                  <span className='text-zinc-400 text-[10px] font-medium'>
                    {tray.tray_type || '—'}
                  </span>
                  {tray.name && (
                    <span className='text-zinc-500 text-[9px] truncate w-full text-center'>
                      {tray.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── External spool (no outer card — lives inside Section) ─────────────────────

function ExternalSpool({ tray, divided }: { tray: AmsTray; divided: boolean }) {
  return (
    <div
      className={`flex items-center gap-4 ${divided ? 'pt-4 border-t border-zinc-700/60' : ''}`}>
      <div
        className='w-10 h-10 rounded-lg border-2 border-zinc-700 shrink-0'
        style={{ backgroundColor: tray.color ? `#${tray.color}` : '#3f3f46' }}
      />
      <div className='flex flex-col gap-0.5 min-w-0'>
        <span className='text-zinc-400 text-xs'>External Spool</span>
        <span className='text-white font-semibold text-sm'>
          {tray.tray_type}
        </span>
        {tray.name && (
          <span className='text-zinc-400 text-xs truncate'>{tray.name}</span>
        )}
      </div>
    </div>
  );
}

// ── Speed slider (no outer card — lives inside Section) ───────────────────────

const SPEED_LEVELS = ['', 'Silent', 'Standard', 'Sport', 'Ludicrous'] as const;

function SpeedSlider({
  level,
  onSet,
}: {
  level: number;
  onSet: (lvl: number) => void;
}) {
  const safe = Math.min(4, Math.max(1, level || 2));
  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between'>
        <span className='text-zinc-400 text-xs'>Speed Mode</span>
        <span className='text-white text-sm font-semibold'>
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
        className='w-full accent-teal-500'
      />
      <div className='flex justify-between text-zinc-600 text-[10px]'>
        {SPEED_LEVELS.slice(1).map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

// ── Manual jog controls ───────────────────────────────────────────────────────

// Polar-to-Cartesian helper (SVG Y-axis points down, angles still work correctly
// because we define all angles such that sweep-flag=1 always traces the short arc)
function p2c(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

// Annular wedge path from startDeg→endDeg between r1 (inner) and r2 (outer).
// All four quadrants use sweep=1 (clockwise outer arc, counterclockwise inner arc).
function wedgePath(s: number, e: number, r1: number, r2: number): string {
  const [ax, ay] = p2c(s, r2);
  const [bx, by] = p2c(e, r2);
  const [cx, cy] = p2c(e, r1);
  const [dx, dy] = p2c(s, r1);
  const f = (n: number) => n.toFixed(4);
  return `M${f(ax)},${f(ay)} A${r2},${r2},0,0,1,${f(bx)},${f(by)} L${f(cx)},${f(cy)} A${r1},${r1},0,0,0,${f(dx)},${f(dy)}Z`;
}

// Each quadrant: centre angle, axis, and sign of movement
const WD = [
  { key: 'yp', axis: 'Y' as const, sign: 1, label: 'Y', mid: -90 },
  { key: 'xp', axis: 'X' as const, sign: 1, label: 'X', mid: 0 },
  { key: 'yn', axis: 'Y' as const, sign: -1, label: '-Y', mid: 90 },
  { key: 'xn', axis: 'X' as const, sign: -1, label: '-X', mid: 180 },
] as const;

const GAP = 5; // degrees clipped from each wedge edge for visual separator
const IR = 0.27; // inner radius (centre button boundary)
const SR = 0.56; // split radius (±1 / ±10 zone boundary)
const OR = 0.94; // outer wheel edge

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
      {/* Dark backing circle */}
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
            {/* Inner zone — moves ±1 mm */}
            <path
              d={wedgePath(s, e, IR, SR)}
              fill={flash === smKey ? '#0f766e' : '#3f3f46'}
              stroke='#1c1c1f'
              strokeWidth={0.022}
              onClick={() => tap(smKey, () => onMove(axis, sign * 1))}
              style={{ cursor: 'pointer' }}
            />
            {/* Outer zone — moves ±10 mm */}
            <path
              d={wedgePath(s, e, SR, OR)}
              fill={flash === lgKey ? '#0f766e' : '#3f3f46'}
              stroke='#1c1c1f'
              strokeWidth={0.022}
              onClick={() => tap(lgKey, () => onMove(axis, sign * 10))}
              style={{ cursor: 'pointer' }}
            />
            {/* Axis label (outer zone) */}
            <text
              x={lx}
              y={ly}
              textAnchor='middle'
              dominantBaseline='middle'
              fontSize={0.17}
              fontWeight='600'
              fill='#d4d4d8'
              style={{ pointerEvents: 'none' }}>
              {label}
            </text>
            {/* Step label (inner zone) */}
            <text
              x={sx}
              y={sy}
              textAnchor='middle'
              dominantBaseline='middle'
              fontSize={0.11}
              fill='#71717a'
              style={{ pointerEvents: 'none' }}>
              {sign > 0 ? '+1' : '−1'}
            </text>
          </g>
        );
      })}

      {/* Centre home button */}
      <circle
        cx={0}
        cy={0}
        r={IR - 0.01}
        fill={flash === 'home' ? '#0f766e' : '#27272a'}
        stroke='#52525b'
        strokeWidth={0.025}
        onClick={() => tap('home', onHome)}
        style={{ cursor: 'pointer' }}
      />
      <text
        x={0}
        y={0.02}
        textAnchor='middle'
        dominantBaseline='middle'
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
        <svg
          className='w-4 h-4'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={2.5}
          strokeLinecap='round'>
          <path d='M5 11l7-7 7 7M5 19l7-7 7 7' />
        </svg>
      </button>
      <button className={btn} onClick={() => onMove(1)}>
        <svg
          className='w-4 h-4'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={2.5}
          strokeLinecap='round'>
          <path d='M5 15l7-7 7 7' />
        </svg>
      </button>

      {/* Simplified extruder graphic */}
      <div className='flex flex-col items-center py-1 gap-0 my-auto'>
        <div className='w-2 h-5 bg-gradient-to-b from-zinc-300 to-zinc-500 rounded-t' />
        <div className='w-9 h-6 bg-zinc-600 rounded border border-zinc-500 flex items-center justify-center'>
          <div className='w-4 h-4 rounded-full border-2 border-zinc-400' />
        </div>
        <div className='w-2 h-2 bg-zinc-500 rounded-b' />
      </div>

      <button className={btn} onClick={() => onMove(-1)}>
        <svg
          className='w-4 h-4'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={2.5}
          strokeLinecap='round'>
          <path d='M19 9l-7 7-7-7' />
        </svg>
      </button>
      <button className={btn} onClick={() => onMove(-10)}>
        <svg
          className='w-4 h-4'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={2.5}
          strokeLinecap='round'>
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
        <svg
          className='w-4 h-4'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={2.5}
          strokeLinecap='round'>
          <path d='M5 11l7-7 7 7M5 19l7-7 7 7' />
        </svg>
      </button>
      <button className={btn} onClick={() => onMove(1)}>
        <svg
          className='w-4 h-4'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={2.5}
          strokeLinecap='round'>
          <path d='M5 15l7-7 7 7' />
        </svg>
      </button>
      <span className='text-zinc-400 text-xs font-medium text-center shrink-0 px-1 my-auto'>
        Bed
      </span>
      <button className={btn} onClick={() => onMove(-1)}>
        <svg
          className='w-4 h-4'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={2.5}
          strokeLinecap='round'>
          <path d='M19 9l-7 7-7-7' />
        </svg>
      </button>
      <button className={btn} onClick={() => onMove(-10)}>
        <svg
          className='w-4 h-4'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={2.5}
          strokeLinecap='round'>
          <path d='M19 5l-7 7-7-7M19 13l-7 7-7-7' />
        </svg>
      </button>
    </div>
  );
}

function JogControls({ onGcode }: { onGcode: (g: string) => void }) {
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
      <p className='text-zinc-600 text-[10px]'>
        ⌂ homes all axes — do this before moving
      </p>
    </div>
  );
}

// ── Connecting screen ─────────────────────────────────────────────────────────

function ConnectingScreen({ ip }: { ip: string }) {
  return (
    <div
      className='min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4'
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className='w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin' />
      <p className='text-zinc-400 text-sm'>Connecting to {ip}…</p>
    </div>
  );
}

// ── Settings panel ────────────────────────────────────────────────────────────

function SettingsPanel({
  ip,
  setIp,
  accessCode,
  setAccessCode,
  serial,
  setSerial,
  onConnect,
  error,
  onBack,
}: {
  ip: string;
  setIp: (v: string) => void;
  accessCode: string;
  setAccessCode: (v: string) => void;
  serial: string;
  setSerial: (v: string) => void;
  onConnect: () => void;
  error: string;
  onBack?: () => void;
}) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConnect();
  }

  return (
    <div className='min-h-screen bg-zinc-950 text-white flex flex-col'>
      <div
        className='flex items-center px-4 pb-3 bg-zinc-900 border-b border-zinc-800 gap-3'
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
        {onBack && (
          <button
            onClick={onBack}
            className='text-zinc-400 hover:text-white transition-colors text-lg leading-none'>
            ←
          </button>
        )}
        <h1 className='font-semibold text-lg'>Printer Settings</h1>
      </div>

      <div className='flex-1 p-6 flex flex-col gap-4'>
        {error && (
          <div className='bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3'>
            <p className='text-red-400 text-sm font-medium'>
              Connection failed
            </p>
            <p className='text-red-500/80 text-xs mt-1'>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          <label className='flex flex-col gap-1'>
            <span className='text-zinc-400 text-xs uppercase tracking-wider'>
              Printer IP
            </span>
            <input
              className='bg-zinc-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500'
              placeholder='192.168.1.100'
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              required
            />
          </label>

          <label className='flex flex-col gap-1'>
            <span className='text-zinc-400 text-xs uppercase tracking-wider'>
              Access Code
            </span>
            <input
              className='bg-zinc-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500 font-mono tracking-widest'
              placeholder='12345678'
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              required
            />
          </label>

          <label className='flex flex-col gap-1'>
            <span className='text-zinc-400 text-xs uppercase tracking-wider'>
              Serial Number
            </span>
            <input
              className='bg-zinc-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500 font-mono'
              placeholder='01P09C400101231'
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              required
            />
          </label>

          <button
            type='submit'
            className='bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg py-3 transition-colors mt-2'>
            Connect
          </button>
        </form>

        <p className='text-zinc-600 text-xs text-center'>
          Find your access code on the printer touchscreen → Settings → WLAN
        </p>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({ onSettings }: { onSettings: () => void }) {
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [frameData, setFrameData] = useState<string | null>(null);
  const [lightOn, setLightOn] = useState(false);
  const [speedLevel, setSpeedLevel] = useState(2);
  // Block MQTT sync for 5 s after a user command so optimistic state isn't
  // immediately overridden by stale printer reports.
  const lightPendingUntil = useRef(0);
  const speedPendingUntil = useRef(0);

  useEffect(() => {
    invoke<PrinterStatus>('get_status')
      .then(setStatus)
      .catch(() => {});

    const unlistenStatus = listen<PrinterStatus>('printer-status', (e) => {
      setStatus(e.payload);
      const now = Date.now();
      if (now > lightPendingUntil.current) setLightOn(e.payload.chamber_light);
      if (now > speedPendingUntil.current)
        setSpeedLevel(e.payload.spd_lvl || 2);
    });

    const unlistenCamera = listen<string>('camera-frame', (e) =>
      setFrameData(`data:image/jpeg;base64,${e.payload}`),
    );

    return () => {
      unlistenStatus.then((f) => f());
      unlistenCamera.then((f) => f());
    };
  }, []);

  async function sendCommand(cmd: string) {
    await invoke('printer_command', { command: cmd }).catch(console.error);
  }

  async function sendGcode(gcode: string) {
    await invoke('send_gcode', { gcode }).catch(console.error);
  }

  async function toggleLight() {
    const next = !lightOn;
    setLightOn(next);
    lightPendingUntil.current = Date.now() + 5000;
    try {
      await invoke('set_chamber_light', { on: next });
    } catch {
      setLightOn(!next);
      lightPendingUntil.current = 0;
    }
  }

  async function setSpeed(level: number) {
    setSpeedLevel(level);
    speedPendingUntil.current = Date.now() + 5000;
    await invoke('set_print_speed', { level }).catch(console.error);
  }

  const hasFilament =
    status && (status.ams.length > 0 || status.vt_tray != null);

  return (
    <div className='min-h-screen bg-zinc-950 text-white flex flex-col'>
      {/* Header — pushed below status bar with safe-area inset */}
      <div
        className='flex items-center justify-between px-4 pb-3 bg-zinc-900 border-b border-zinc-800 shrink-0'
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
        <h1 className='font-semibold text-lg'>BambuMobile</h1>
        <button
          onClick={onSettings}
          className='text-zinc-400 hover:text-white transition-colors text-xl leading-none'
          aria-label='Settings'>
          ⚙
        </button>
      </div>

      {/* Scrollable content */}
      <div className='flex flex-col gap-3 p-4 overflow-y-auto pb-8'>
        {/* Camera feed */}
        <div className='rounded-xl overflow-hidden bg-zinc-900 aspect-video flex items-center justify-center shrink-0'>
          {frameData ?
            <img
              src={frameData}
              className='w-full h-full object-cover'
              alt='Live camera'
            />
          : <div className='flex flex-col items-center gap-2 text-center px-6'>
              <span className='text-3xl'>📷</span>
              <p className='text-zinc-400 text-sm font-medium'>
                Connecting to camera…
              </p>
              <p className='text-zinc-600 text-xs'>
                Waiting for stream on port 6000
              </p>
            </div>
          }
        </div>

        {/* Print status + controls (not collapsible — primary info) */}
        {status && <PrintStatusCard status={status} onCommand={sendCommand} />}

        {/* ── Collapsible sections ── */}

        {status && (
          <Section title='Temperatures'>
            <div className='grid grid-cols-3 gap-3'>
              <TempGauge
                label='Nozzle'
                actual={status.nozzle_temp}
                target={status.nozzle_target}
              />
              <TempGauge
                label='Bed'
                actual={status.bed_temp}
                target={status.bed_target}
              />
              <LampButton on={lightOn} onToggle={toggleLight} />
            </div>
          </Section>
        )}

        {hasFilament && (
          <Section title='Filament'>
            <AmsView ams={status!.ams} />
            {status!.vt_tray && (
              <ExternalSpool
                tray={status!.vt_tray}
                divided={status!.ams.length > 0}
              />
            )}
          </Section>
        )}

        {status && (
          <Section title='Print Speed'>
            <SpeedSlider level={speedLevel} onSet={setSpeed} />
          </Section>
        )}

        {status && (
          <Section title='Manual Move' defaultOpen={false}>
            <JogControls onGcode={sendGcode} />
          </Section>
        )}

        {!status && (
          <p className='text-zinc-500 text-center py-8'>
            Waiting for printer data…
          </p>
        )}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

type Phase = 'connecting' | 'connected' | 'error' | 'settings';

const STORE_FILE = 'bambu-settings.json';

export default function App() {
  const [ip, setIp] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [serial, setSerial] = useState('');
  const [phase, setPhase] = useState<Phase>('connecting');
  const [error, setError] = useState('');

  async function connect(
    targetIp = ip,
    targetCode = accessCode,
    targetSerial = serial,
  ) {
    setPhase('connecting');
    setError('');
    try {
      await invoke('disconnect_printer').catch(() => {});
      await invoke('connect_printer', {
        ip: targetIp,
        accessCode: targetCode,
        serial: targetSerial,
      });
      const store = await load(STORE_FILE, { autoSave: false, defaults: {} });
      await store.set('bambu_ip', targetIp);
      await store.set('bambu_code', targetCode);
      await store.set('bambu_serial', targetSerial);
      await store.save();
      setPhase('connected');
    } catch (err) {
      if (String(err) === 'Already connected') {
        setPhase('connected');
        return;
      }
      setError(String(err));
      setPhase('error');
    }
  }

  // Load persisted credentials from app-data store, then auto-connect.
  useEffect(() => {
    (async () => {
      try {
        const store = await load(STORE_FILE, { autoSave: false, defaults: {} });
        const savedIp = await store.get<string>('bambu_ip');
        const savedCode = await store.get<string>('bambu_code');
        const savedSerial = await store.get<string>('bambu_serial');
        if (savedIp) setIp(savedIp);
        if (savedCode) setAccessCode(savedCode);
        if (savedSerial) setSerial(savedSerial);
        if (savedCode && savedSerial) {
          await connect(savedIp ?? ip, savedCode, savedSerial);
        } else {
          setPhase('error');
          setError('Enter your printer credentials to connect.');
        }
      } catch {
        setPhase('error');
        setError('Could not load saved settings.');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'connecting') return <ConnectingScreen ip={ip} />;

  if (phase === 'error' || phase === 'settings') {
    return (
      <SettingsPanel
        ip={ip}
        setIp={setIp}
        accessCode={accessCode}
        setAccessCode={setAccessCode}
        serial={serial}
        setSerial={setSerial}
        onConnect={() => connect(ip, accessCode, serial)}
        error={error}
        onBack={phase === 'settings' ? () => setPhase('connected') : undefined}
      />
    );
  }

  return <Dashboard onSettings={() => setPhase('settings')} />;
}
