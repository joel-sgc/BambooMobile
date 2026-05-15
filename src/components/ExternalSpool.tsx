import type { AmsTray } from '../vite-env';

export default function ExternalSpool({
  tray,
  divided,
}: {
  tray: AmsTray;
  divided?: boolean;
}) {
  return (
    <div
      className={`flex items-center w-full gap-4 ${divided ? 'pt-4 border-t border-zinc-700/60' : ''}`}>
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
