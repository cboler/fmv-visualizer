import { chromium } from '@playwright/test';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// A deliberately synthetic, self-authored clip: no remote media or licenses required.
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<canvas width="960" height="540"></canvas>');
const encoded = await page.evaluate(async () => {
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp8',
    videoBitsPerSecond: 1_000_000,
  });
  const chunks = [];
  recorder.ondataavailable = (event) => chunks.push(event.data);
  const finished = new Promise((resolve) => {
    recorder.onstop = resolve;
  });
  const start = performance.now();
  const draw = () => {
    const time = (performance.now() - start) / 1000;
    const drift = time * 4;
    ctx.fillStyle = '#316f7b';
    ctx.fillRect(0, 0, 960, 540);
    const water = ctx.createLinearGradient(0, 0, 960, 540);
    water.addColorStop(0, '#719d9f');
    water.addColorStop(1, '#1b525e');
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, 960, 540);
    for (let i = 0; i < 35; i++) {
      const y = ((i * 27 + drift * 1.2) % 650) - 40;
      ctx.strokeStyle = '#acd0cf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(400 + Math.sin(i * 13) * 200, y);
      ctx.quadraticCurveTo(650, y + 15, 1000, y + 8);
      ctx.stroke();
    }
    const coast = () => {
      ctx.moveTo(-50, -50);
      ctx.lineTo(525 - drift * 0.2, -50);
      ctx.bezierCurveTo(540, 100, 315, 190, 360 - drift * 0.3, 300);
      ctx.bezierCurveTo(420, 425, 270, 475, 305, 600);
      ctx.lineTo(-50, 600);
      ctx.closePath();
    };
    ctx.beginPath();
    coast();
    ctx.fillStyle = '#b1b695';
    ctx.fill();
    ctx.strokeStyle = '#c5d0b0';
    ctx.lineWidth = 18;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    coast();
    ctx.clip();
    ctx.fillStyle = '#627b5a';
    ctx.fillRect(0, 0, 470, 540);
    for (let i = 0; i < 150; i++) {
      const x = (Math.sin(i * 93.2) + 1) * 215;
      const y = (((Math.cos(i * 41.8) + 1) * 350 + drift) % 650) - 50;
      ctx.fillStyle = ['#42604b', '#4c6b50', '#587455', '#7b895c'][i % 4];
      ctx.beginPath();
      ctx.ellipse(x, y, 11 + (i % 17), 8 + (i % 14), i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#bcc6a2';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(115, -20);
    ctx.bezierCurveTo(340, 200, 80, 260, 240, 560);
    ctx.stroke();
    ctx.strokeStyle = '#697c60';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#f2f9edc0';
    ctx.font = '12px monospace';

    if (time < 30) requestAnimationFrame(draw);
    else recorder.stop();
  };
  recorder.start();
  draw();
  await finished;
  stream.getTracks().forEach((track) => track.stop());
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' }));
  });
});
await mkdir('tmp', { recursive: true });
await writeFile('tmp/sample-raw.webm', Buffer.from(encoded, 'base64'));
const executable =
  process.env['FFMPEG_PATH'] ??
  path.join(process.env['LOCALAPPDATA'], 'ms-playwright', 'ffmpeg-1011', 'ffmpeg-win64.exe');
const result = spawnSync(
  executable,
  ['-y', '-i', 'tmp/sample-raw.webm', '-c', 'copy', 'public/sample-mission.webm'],
  { windowsHide: true, encoding: 'utf8' },
);
if (result.status !== 0)
  throw new Error(
    `Remux sample with ffmpeg (or set FFMPEG_PATH): ${result.stderr ?? result.error}`,
  );
await page.goto('about:blank');
for (const size of [72, 96, 128, 144, 152, 192, 384, 512]) {
  const svg = await readFile('public/icons/mission.svg', 'utf8');
  const png = await page.evaluate(
    async ({ svg, size }) => {
      const image = new Image();
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d').drawImage(image, 0, 0, size, size);
      return canvas.toDataURL('image/png').split(',')[1];
    },
    { svg, size },
  );
  await writeFile(`public/icons/icon-${size}x${size}.png`, Buffer.from(png, 'base64'));
}
await browser.close();
console.log('Created 30-second synthetic WebM and branded PWA icons.');
