import type { AmsTray, AmsUnit } from '../vite-env';
import { humidityGrade } from '../utils/printer';

export default function AmsView({ ams }: { ams: AmsUnit[] }) {
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
                <span className={`font-bold ${grade.color}`}>{grade.letter}</span>
                <span className='text-zinc-600 ml-1'>({grade.label})</span>
              </span>
            </p>
            <div className='flex gap-3'>
              {unit.trays.map((tray: AmsTray) => (
                <div key={tray.id} className='flex flex-col items-center gap-1 flex-1'>
                  <div
                    className='w-full aspect-square rounded-lg border-2 border-zinc-700 max-w-12'
                    style={{ backgroundColor: tray.color ? `#${tray.color}` : '#3f3f46' }}
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
