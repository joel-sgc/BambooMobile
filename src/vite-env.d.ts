/// <reference types="vite/client" />

// CSS Anchor Positioning + Popover API — not yet in standard TS lib types
declare module 'react' {
  interface CSSProperties {
    anchorName?: string;
    positionAnchor?: string;
  }
  interface HTMLAttributes<T> {
    popover?: 'auto' | 'manual';
    popovertarget?: string;
    popovertargetaction?: 'toggle' | 'show' | 'hide';
  }
  interface ButtonHTMLAttributes<T> {
    popovertarget?: string;
    popovertargetaction?: 'toggle' | 'show' | 'hide';
  }
}

export interface AmsTray {
  id: number;
  tray_type: string;
  color: string;
  name: string;
}

export interface AmsUnit {
  id: number;
  humidity: number;
  trays: AmsTray[];
}

export interface PrinterStatus {
  nozzle_temp: number;
  nozzle_target: number;
  bed_temp: number;
  bed_target: number;
  progress: number;
  remaining_mins: number;
  layer_num: number;
  total_layer_num: number;
  stage: string;
  gcode_state: string;
  ams: AmsUnit[];
  vt_tray: AmsTray | null;
  chamber_light: boolean;
  spd_lvl: number;
  subtask_name: string;
  task_id: string;
}
