import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';

import ConnectingScreen from './components/ConnectingScreen';
import SettingsPanel from './components/SettingsPanel';
import Dashboard from './components/Dashboard';
import FileManager from './components/FileManager';
import TimelapseBrowser from './components/TimelapseBrowser';
import Sidebar, { type Page } from './components/Sidebar';

type Phase = 'connecting' | 'connected' | 'error';

const STORE_FILE = 'bamboo-settings.json';

export default function App() {
  const [ip, setIp] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [serial, setSerial] = useState('');
  const [phase, setPhase] = useState<Phase>('connecting');
  const [error, setError] = useState('');
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filePath, setFilePath] = useState('/');
  const backActionRef = useRef<() => boolean>(() => false);

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
      setPage('dashboard');
    } catch (err) {
      if (String(err) === 'Already connected') {
        setPhase('connected');
        return;
      }
      setError(String(err));
      setPhase('error');
    }
  }

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

  function navigate(p: Page) {
    if (p === 'files') setFilePath('/');
    setPage(p);
    setSidebarOpen(false);
  }

  // Keep backActionRef current without re-registering the event listener
  backActionRef.current = () => {
    if (phase !== 'connected') return false;
    if (sidebarOpen) { setSidebarOpen(false); return true; }
    if (page === 'files' && filePath !== '/') {
      const trimmed = filePath.endsWith('/') ? filePath.slice(0, -1) : filePath;
      setFilePath(trimmed.substring(0, trimmed.lastIndexOf('/') + 1) || '/');
      return true;
    }
    if (page !== 'dashboard') { navigate('dashboard'); return true; }
    return false; // on dashboard — let Android exit the app
  };

  useEffect(() => {
    const arm = () => window.history.pushState(null, '', window.location.href);
    arm();
    const handle = () => { if (backActionRef.current()) arm(); };
    window.addEventListener('popstate', handle);
    return () => window.removeEventListener('popstate', handle);
  }, []);

  if (phase === 'connecting') return <ConnectingScreen ip={ip} />;

  // First-time setup / bad credentials — full screen, no back button
  if (phase === 'error') {
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
      />
    );
  }

  // Connected — page routing with sidebar overlay
  return (
    <>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        page={page}
        onNavigate={navigate}
      />

      {page === 'dashboard' && (
        <Dashboard onMenuOpen={() => setSidebarOpen(true)} />
      )}

      {page === 'files' && (
        <FileManager
          onMenuOpen={() => setSidebarOpen(true)}
          path={filePath}
          onPathChange={setFilePath}
        />
      )}

      {page === 'timelapses' && (
        <TimelapseBrowser onMenuOpen={() => setSidebarOpen(true)} />
      )}

      {page === 'printer-settings' && (
        <SettingsPanel
          ip={ip}
          setIp={setIp}
          accessCode={accessCode}
          setAccessCode={setAccessCode}
          serial={serial}
          setSerial={setSerial}
          onConnect={() => connect(ip, accessCode, serial)}
          error={error}
          onBack={() => navigate('dashboard')}
        />
      )}
    </>
  );
}
