import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { PrinterStatus } from '../vite-env';

import Section from './Section';
import PrintStatusCard from './PrintStatusCard';
import TempGauge from './TempGauge';
import LampButton from './LampButton';
import AmsView from './AmsView';
import ExternalSpool from './ExternalSpool';
import SpeedSlider from './SpeedSlider';
import JogControls from './JogControls';

export default function Dashboard({ onSettings }: { onSettings: () => void }) {
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [frameData, setFrameData] = useState<string | null>(null);
  const [lightOn, setLightOn] = useState(false);
  const [speedLevel, setSpeedLevel] = useState(2);
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
      if (now > speedPendingUntil.current) setSpeedLevel(e.payload.spd_lvl || 2);
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

  const hasFilament = status && (status.ams.length > 0 || status.vt_tray != null);

  return (
    <div className='min-h-screen bg-zinc-950 text-white flex flex-col'>
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

      <div className='flex flex-col gap-3 p-4 overflow-y-auto pb-8'>
        <div className='rounded-xl overflow-hidden bg-zinc-900 aspect-video flex items-center justify-center shrink-0'>
          {frameData ?
            <img src={frameData} className='w-full h-full object-cover' alt='Live camera' />
          : <div className='flex flex-col items-center gap-2 text-center px-6'>
              <span className='text-3xl'>📷</span>
              <p className='text-zinc-400 text-sm font-medium'>Connecting to camera…</p>
              <p className='text-zinc-600 text-xs'>Waiting for stream on port 6000</p>
            </div>
          }
        </div>

        {status && <PrintStatusCard status={status} onCommand={sendCommand} />}

        {status && (
          <Section title='Temperatures'>
            <div className='grid grid-cols-3 gap-3'>
              <TempGauge label='Nozzle' actual={status.nozzle_temp} target={status.nozzle_target} />
              <TempGauge label='Bed' actual={status.bed_temp} target={status.bed_target} />
              <LampButton on={lightOn} onToggle={toggleLight} />
            </div>
          </Section>
        )}

        {hasFilament && (
          <Section title='Filament'>
            <AmsView ams={status!.ams} />
            {status!.vt_tray && (
              <ExternalSpool tray={status!.vt_tray} divided={status!.ams.length > 0} />
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
          <p className='text-zinc-500 text-center py-8'>Waiting for printer data…</p>
        )}
      </div>
    </div>
  );
}
