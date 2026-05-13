import type { PrinterStatus } from '../vite-env';
import { gcodeLabel, fmtRemaining } from '../utils/printer';

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

export default function PrintStatusCard({
  status,
  onCommand,
}: {
  status: PrinterStatus;
  onCommand: (cmd: string) => void;
}) {
  const { text, dot } = gcodeLabel(status.gcode_state);
  const isPrinting = status.gcode_state === 'RUNNING';
  const isPaused   = status.gcode_state === 'PAUSE';
  const isActive   = isPrinting || isPaused;

  return (
    <div className='bg-zinc-800 rounded-xl p-4 flex flex-col gap-3'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <span className={`w-2 h-2 rounded-full ${dot} ${isPrinting ? 'animate-pulse' : ''}`} />
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
            <span className='text-teal-400 font-semibold'>{status.progress}%</span>
            <span className='text-zinc-400'>{fmtRemaining(status.remaining_mins)}</span>
          </div>
          {status.total_layer_num > 0 && (
            <p className='text-zinc-500 text-xs'>
              Layer{' '}
              <span className='text-zinc-300 font-medium'>{status.layer_num}</span>
              {' '}/ {status.total_layer_num}
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
