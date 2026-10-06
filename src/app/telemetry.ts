import { Injectable, computed, signal } from '@angular/core';
import Papa from 'papaparse';

export interface TelemetryFrame {
  time: number;
  lat: number;
  lon: number;
  heading: number;
  pitch: number;
  roll: number;
  fov: number;
  altitude?: number;
}

export interface TelemetryImport {
  frames: TelemetryFrame[];
  warnings: string[];
}

type Row = Record<string, unknown>;
const MAX_FRAMES = 200_000;
export const wrap = (angle: number) => ((angle % 360) + 360) % 360;
const number = (value: unknown): number =>
  value === undefined || value === null || String(value).trim() === '' ? NaN : Number(value);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const angularLerp = (a: number, b: number, t: number) => a + (((b - a + 540) % 360) - 180) * t;

export function normalizeTelemetry(rows: Row[]): TelemetryImport {
  if (rows.length > MAX_FRAMES) throw new Error('Maximum 200,000 telemetry records per session.');
  const frames: TelemetryFrame[] = [];
  let invalid = 0;
  let defaultAttitude = 0;
  const kinds = new Set<string>();
  for (const raw of rows) {
    const row = Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [key.trim().toLowerCase(), value]),
    );
    const timestamp = row['timestamp'] ?? row['time'];
    const numericTime = number(timestamp);
    const time = Number.isFinite(numericTime) ? numericTime : Date.parse(String(timestamp)) / 1000;
    const lat = number(row['lat']);
    const lon = number(row['lon']);
    const heading = number(row['heading']);
    const pitch = row['pitch'] === undefined ? 0 : number(row['pitch']);
    const roll = row['roll'] === undefined ? 0 : number(row['roll']);
    const fov = row['fov'] === undefined || row['fov'] === '' ? 75 : number(row['fov']);
    const altitude =
      row['altitude'] === undefined || row['altitude'] === '' ? undefined : number(row['altitude']);
    if (
      ![time, lat, lon, heading, pitch, roll, fov].every(Number.isFinite) ||
      time < 0 ||
      Math.abs(lat) > 85.051129 ||
      Math.abs(lon) > 180 ||
      Math.abs(pitch) > 90 ||
      Math.abs(roll) > 180 ||
      fov <= 0 ||
      fov >= 180 ||
      (altitude !== undefined && !Number.isFinite(altitude))
    ) {
      invalid++;
      continue;
    }
    if (row['pitch'] === undefined || row['roll'] === undefined) defaultAttitude++;
    kinds.add(Number.isFinite(numericTime) ? 'seconds' : 'ISO');
    frames.push({
      time,
      lat,
      lon,
      heading: wrap(heading),
      pitch,
      roll,
      fov,
      ...(altitude === undefined ? {} : { altitude }),
    });
  }
  if (kinds.size > 1)
    throw new Error('Use either relative seconds or ISO timestamps throughout a file, not both.');
  if (!frames.length)
    throw new Error(
      'No valid telemetry. Required: timestamp, lat, lon, heading. Latitude must be within ±85.051129° for the map.',
    );
  frames.sort((a, b) => a.time - b.time);
  const unique = frames.filter(
    (frame, i) => i === frames.length - 1 || frame.time !== frames[i + 1].time,
  );
  const start = unique[0].time;
  const warnings: string[] = [];
  if (invalid) warnings.push(`${invalid} invalid record(s) skipped.`);
  if (unique.length !== frames.length)
    warnings.push(`${frames.length - unique.length} duplicate timestamp(s); last record kept.`);
  if (defaultAttitude)
    warnings.push(`${defaultAttitude} record(s) missing pitch or roll; assumed 0°.`);
  if (kinds.has('ISO'))
    warnings.push(
      'ISO timestamps aligned to the first sample. Adjust sync offset if video starts earlier.',
    );
  return {
    frames: unique.map((frame) => ({
      ...frame,
      time: kinds.has('ISO') ? frame.time - start : frame.time,
    })),
    warnings,
  };
}

function parseSrt(text: string): TelemetryImport {
  const rows: Row[] = [];
  let missingYaw = 0;
  let missingAttitude = 0;
  for (const block of text
    .replace(/\r/g, '')
    .trim()
    .split(/\n\s*\n/)) {
    const stamp = block.match(/(\d{2,}):(\d{2}):(\d{2})[,.](\d{3})\s*-->/);
    if (!stamp) continue;
    const body = block.slice((stamp.index ?? 0) + stamp[0].length).replace(/<[^>]+>/g, '');
    const field = (keys: string) => {
      const match = body.match(new RegExp(`(?:${keys})\\s*[:=]\\s*([-+]?\\d+(?:\\.\\d+)?)`, 'i'));
      return match ? Number(match[1]) : undefined;
    };
    const gps = body.match(/GPS\s*\(\s*([-+\d.]+)\s*,\s*([-+\d.]+)(?:\s*,\s*([-+\d.]+))?/i);
    const heading = field('gimbal_yaw|gb_yaw|camera_yaw') ?? field('heading|yaw|flight_yaw');
    const pitch = field('gimbal_pitch|gb_pitch|camera_pitch') ?? field('pitch');
    const roll = field('gimbal_roll|gb_roll|camera_roll') ?? field('roll');
    if (heading === undefined) missingYaw++;
    if (pitch === undefined || roll === undefined) missingAttitude++;
    rows.push({
      timestamp:
        Number(stamp[1]) * 3600 +
        Number(stamp[2]) * 60 +
        Number(stamp[3]) +
        Number(stamp[4]) / 1000,
      lat: field('latitude|lat') ?? (gps ? Number(gps[2]) : undefined),
      lon: field('longitude|lon|lng') ?? (gps ? Number(gps[1]) : undefined),
      heading: heading ?? 0,
      pitch: pitch ?? 0,
      roll: roll ?? 0,
      fov: field('fov') ?? 75,
      altitude:
        field('rel_alt|relative_altitude|altitude|alt') ?? (gps?.[3] ? Number(gps[3]) : undefined),
    });
  }
  const result = normalizeTelemetry(rows);
  if (missingYaw) result.warnings.push(`${missingYaw} SRT cue(s) lack yaw; assumed north (0°).`);
  if (missingAttitude)
    result.warnings.push(
      `${missingAttitude} SRT cue(s) lack attitude fields; assumed 0° for missing values.`,
    );
  return result;
}

export function parseTelemetry(text: string, filename: string): TelemetryImport {
  if (/\.srt$/i.test(filename)) return parseSrt(text);
  if (/\.json$/i.test(filename)) {
    const value: unknown = JSON.parse(text);
    const rows = Array.isArray(value) ? value : (value as { frames?: unknown })?.frames;
    if (
      !Array.isArray(rows) ||
      rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))
    ) {
      throw new Error('JSON must contain an array of telemetry objects or { "frames": [...] }.');
    }
    return normalizeTelemetry(rows);
  }
  const result = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (key) => key.trim().toLowerCase(),
  });
  if (result.errors.length) throw new Error(`CSV: ${result.errors[0].message}`);
  return normalizeTelemetry(result.data);
}

export async function readTelemetry(file: File): Promise<TelemetryImport> {
  if (file.size > 32 * 1024 * 1024)
    throw new Error('Telemetry file exceeds the 32 MB import limit.');
  if (!/\.(csv|json|srt)$/i.test(file.name))
    throw new Error('Choose a CSV, JSON, or SRT telemetry file.');
  if (!/\.csv$/i.test(file.name)) return parseTelemetry(await file.text(), file.name);
  // Worker parsing keeps CSV tokenization off the playback thread; 200k records is the in-memory ceiling.
  return new Promise((resolve, reject) => {
    const rows: Row[] = [];
    Papa.parse<Row>(file, {
      header: true,
      worker: true,
      skipEmptyLines: 'greedy',
      chunk: (result, parser) => {
        if (result.errors.length || rows.length + result.data.length > MAX_FRAMES) {
          reject(
            new Error(
              result.errors[0]?.message ?? 'Maximum 200,000 telemetry records per session.',
            ),
          );
          parser.abort();
          return;
        }
        for (const row of result.data) rows.push(row);
      },
      complete: () => {
        try {
          resolve(normalizeTelemetry(rows));
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error),
    });
  });
}

export function interpolateFrame(
  frames: readonly TelemetryFrame[],
  time: number,
): TelemetryFrame | null {
  if (!frames.length || !Number.isFinite(time)) return null;
  if (time <= frames[0].time) return { ...frames[0] };
  if (time >= frames[frames.length - 1].time) return { ...frames[frames.length - 1] };
  let low = 0;
  let high = frames.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >>> 1;
    if (frames[mid].time <= time) low = mid;
    else high = mid;
  }
  const a = frames[low];
  const b = frames[high];
  const t = (time - a.time) / (b.time - a.time);
  const altitude =
    a.altitude !== undefined && b.altitude !== undefined
      ? lerp(a.altitude, b.altitude, t)
      : undefined;
  return {
    time,
    lat: lerp(a.lat, b.lat, t),
    lon: ((angularLerp(a.lon, b.lon, t) + 540) % 360) - 180,
    heading: wrap(angularLerp(a.heading, b.heading, t)),
    pitch: lerp(a.pitch, b.pitch, t),
    roll: ((angularLerp(a.roll, b.roll, t) + 540) % 360) - 180,
    fov: lerp(a.fov, b.fov, t),
    ...(altitude === undefined ? {} : { altitude }),
  };
}

export function sampleTelemetry(): TelemetryFrame[] {
  return Array.from({ length: 61 }, (_, i) => ({
    time: i / 2,
    lat: 37.805 + i * 0.000045,
    lon: -122.465 + Math.sin(i / 22) * 0.0024,
    heading: wrap(15 + Math.sin(i / 16) * 32),
    pitch: -8 + Math.sin(i / 8) * 7,
    roll: Math.sin(i / 10) * 12,
    fov: 75,
    altitude: 84 + Math.sin(i / 14) * 8,
  }));
}

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  readonly frames = signal<readonly TelemetryFrame[]>(sampleTelemetry());
  readonly time = signal(0);
  readonly offset = signal(0);
  readonly frame = computed(() => this.getInterpolatedFrame(this.time() + this.offset()));
  readonly duration = computed(() => this.frames().at(-1)?.time ?? 0);
  readonly coverage = computed(() => {
    const frames = this.frames();
    const time = this.time() + this.offset();
    return frames.length
      ? time < frames[0].time
        ? 'Before telemetry'
        : time > this.duration()
          ? 'After telemetry'
          : 'Synchronized'
      : 'No telemetry';
  });
  getInterpolatedFrame(time: number): TelemetryFrame | null {
    return interpolateFrame(this.frames(), time);
  }
  load(frames: TelemetryFrame[]): void {
    this.frames.set(frames);
    this.offset.set(0);
  }
}
