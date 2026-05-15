export function gcodeLabel(state: string): { text: string; dot: string } {
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

export function fmtRemaining(mins: number): string {
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `-${h}h${m}m` : `-${m}m`;
}

export function humidityGrade(level: number): {
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
