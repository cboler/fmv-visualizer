import { interpolateFrame, normalizeTelemetry, parseTelemetry, sampleTelemetry } from './telemetry';

const row = { timestamp: 0, lat: 37, lon: -122, heading: 350, pitch: 0, roll: 170 };

describe('Telemetry normalization', () => {
  it('sorts, deduplicates, aligns ISO timestamps and reports missing attitude', () => {
    const result = normalizeTelemetry([
      { ...row, timestamp: '2026-10-06T12:00:02Z', heading: 10 },
      { ...row, timestamp: '2026-10-06T12:00:00Z' },
      { timestamp: '2026-10-06T12:00:02Z', lat: 38, lon: -121, heading: 20 },
    ]);
    expect(result.frames.map((frame) => frame.time)).toEqual([0, 2]);
    expect(result.frames[1].heading).toBe(20);
    expect(result.frames[1].fov).toBe(75);
    expect(result.warnings.join(' ')).toContain('duplicate');
    expect(result.warnings.join(' ')).toContain('missing pitch or roll');
  });
  it('keeps relative seconds including a delayed first sample', () => {
    expect(normalizeTelemetry([{ ...row, timestamp: 5 }]).frames[0].time).toBe(5);
  });
  it('rejects empty and mixed clocks, invalid coordinates and out-of-range angles', () => {
    expect(() => normalizeTelemetry([])).toThrow('No valid telemetry');
    expect(() => normalizeTelemetry([{ ...row, timestamp: '' }])).toThrow();
    expect(() => normalizeTelemetry([row, { ...row, timestamp: '2026-10-06T12:00:00Z' }])).toThrow(
      'not both',
    );
    for (const bad of [
      { lat: 90 },
      { lon: 181 },
      { pitch: 91 },
      { roll: -181 },
      { fov: 180 },
      { altitude: 'bad' },
    ]) {
      expect(() => normalizeTelemetry([{ ...row, ...bad }])).toThrow();
    }
  });
  it('skips invalid records with a visible warning and wraps negative heading', () => {
    const result = normalizeTelemetry([
      { ...row, heading: -1 },
      { ...row, timestamp: 1, lat: '' },
    ]);
    expect(result.frames[0].heading).toBe(359);
    expect(result.warnings[0]).toContain('1 invalid');
  });
  it('parses quoted CSV, BOM headers and both JSON envelope formats', () => {
    expect(
      parseTelemetry(
        '\ufefftimestamp,lat,lon,heading,pitch,roll\n0,"37",-122,350,0,0',
        'flight.csv',
      ).frames[0].lat,
    ).toBe(37);
    expect(parseTelemetry(JSON.stringify([row]), 'flight.json').frames).toHaveLength(1);
    expect(parseTelemetry(JSON.stringify({ frames: [row] }), 'flight.json').frames).toHaveLength(1);
    expect(() => parseTelemetry('{"hello":true}', 'flight.json')).toThrow('JSON must');
    expect(() =>
      parseTelemetry('timestamp,lat,lon,heading\n0,37,-122,0,extra', 'flight.csv'),
    ).toThrow('CSV');
  });
  it('parses DJI bracket fields and prefers camera yaw over vehicle yaw', () => {
    const text =
      '1\n00:00:02,500 --> 00:00:03,000\n<font>[latitude: 37.8] [longitude: -122.4] [rel_alt: 50] [flight_yaw: 88] [gb_yaw: -10] [gb_pitch: -25] [gb_roll: 4]</font>';
    const frame = parseTelemetry(text, 'drone.srt').frames[0];
    expect(frame).toMatchObject({
      time: 2.5,
      lat: 37.8,
      lon: -122.4,
      heading: 350,
      pitch: -25,
      roll: 4,
      altitude: 50,
    });
  });
  it('parses legacy GPS ordering and warns about absent yaw and attitude', () => {
    const result = parseTelemetry(
      '1\n00:00:00,000 --> 00:00:01,000\nGPS (-122.4, 37.8, 45)',
      'drone.srt',
    );
    expect(result.frames[0]).toMatchObject({ lon: -122.4, lat: 37.8, altitude: 45 });
    expect(result.warnings.join(' ')).toContain('lack yaw');
    expect(() =>
      parseTelemetry('1\n00:00:00,000 --> 00:00:01,000\nNo GPS here', 'drone.srt'),
    ).toThrow('No valid');
  });
});

describe('Timeline interpolation', () => {
  const frames = normalizeTelemetry([
    row,
    {
      ...row,
      timestamp: 10,
      lat: 39,
      lon: -120,
      heading: 10,
      pitch: 20,
      roll: -170,
      altitude: 100,
    },
  ]).frames;
  it('interpolates position and shortest-arc heading and roll through north', () => {
    expect(interpolateFrame(frames, 5)).toMatchObject({
      time: 5,
      lat: 38,
      lon: -121,
      heading: 0,
      pitch: 10,
      roll: -180,
    });
    expect(interpolateFrame(frames, 5)?.altitude).toBeUndefined();
  });
  it('handles empty/single timelines, invalid time and both endpoint clamps', () => {
    expect(interpolateFrame([], 0)).toBeNull();
    expect(interpolateFrame(frames, NaN)).toBeNull();
    expect(interpolateFrame(frames, -100)).toEqual(frames[0]);
    expect(interpolateFrame(frames, 100)).toEqual(frames[1]);
    expect(interpolateFrame([frames[0]], 99)).toEqual(frames[0]);
  });
  it('crosses the dateline through ±180 and interpolates known altitude', () => {
    const timeline = normalizeTelemetry([
      { ...row, lon: 179, altitude: 10 },
      { ...row, timestamp: 2, lon: -179, altitude: 30 },
    ]).frames;
    expect(interpolateFrame(timeline, 1)).toMatchObject({ lon: -180, altitude: 20 });
  });
  it('binary search handles arbitrary seeks in a large timeline', () => {
    const timeline = Array.from({ length: 10000 }, (_, i) => ({
      ...frames[0],
      time: i,
      lat: i / 1000,
    }));
    expect(interpolateFrame(timeline, 8765.5)?.lat).toBeCloseTo(8.7655);
    expect(interpolateFrame(timeline, 12.25)?.lat).toBeCloseTo(0.01225);
    expect(sampleTelemetry().at(-1)?.time).toBe(30);
  });
});
