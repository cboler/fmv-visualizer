import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const base =
  (await readFile('dist/browser/index.html', 'utf8')).match(/<base href="([^"]+)"/)?.[1] ?? '/';
const config = JSON.parse(await readFile('dist/browser/ngsw.json', 'utf8'));
for (const asset of [
  'sample-mission.webm',
  'offline-map.geojson',
  'maplibre/maplibre-gl-worker.mjs',
  'maplibre/maplibre-gl-shared.mjs',
]) {
  assert.ok(config.hashTable[base + asset], `Offline manifest must include ${asset}`);
}
const server = spawn(process.execPath, ['scripts/preview.mjs'], {
  env: { ...process.env, PORT: '4301' },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('error', reject);
  server.once('exit', (code) => reject(new Error(`Preview failed: ${code}`)));
});
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://localhost:4301${base}`);
  await page.getByRole('button', { name: 'Play video', exact: true }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  await page.waitForFunction(
    () => document.querySelector('.maplibregl-canvas') && !document.querySelector('.map-message'),
  );
  const liveTile = page.waitForResponse(
    (response) =>
      response.url().includes('tiles.openfreemap.org/planet/') && response.status() === 200,
  );
  await page.getByRole('button', { name: 'Offline map', exact: true }).click();
  await liveTile;
  await page.waitForFunction(() => !document.querySelector('.map-message'));
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/production-online.png', fullPage: true });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: 'Every frame. In context.' }).waitFor();
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  await page.waitForFunction(
    () => document.querySelector('.maplibregl-canvas') && !document.querySelector('.map-message'),
  );
  const cachedTile = page.waitForResponse(
    (response) =>
      response.url().includes('tiles.openfreemap.org/planet/') && response.status() === 200,
  );
  await page.getByRole('button', { name: 'Offline map', exact: true }).click();
  await cachedTile;
  await page.waitForFunction(() => !document.querySelector('.map-message'));
  await page.getByRole('button', { name: 'Online streets', exact: true }).click();
  await page.getByRole('button', { name: 'Play video', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > 1);
  await page.getByRole('button', { name: 'Pause video', exact: true }).click();
  await page.locator('#mission-files').setInputFiles('public/sample-telemetry.csv');
  await page.getByText('sample-telemetry.csv · 7 records', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Diagnostics', exact: true }).click();
  await page.reload();
  await page.getByRole('heading', { name: 'Runtime & Routing Verification' }).waitFor();
  await page.getByRole('link', { name: 'Workspace', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('.maplibregl-canvas') && !document.querySelector('.map-message'),
  );
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/production-offline.png', fullPage: true });
  assert.deepEqual(errors, []);
  const evidence = {
    checkedAt: new Date().toISOString(),
    basePath: base,
    controlledOfflineReload: true,
    videoPlaybackOffline: true,
    mapWorkerAndFovOffline: true,
    csvWorkerImportOffline: true,
    diagnosticsDeepLinkOffline: true,
    liveStreetTiles: true,
    cachedStreetTilesOffline: true,
    pageErrors: errors,
  };
  await writeFile('docs/evidence/pwa-verification.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
