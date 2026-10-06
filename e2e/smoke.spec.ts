import { expect, test } from '@playwright/test';
import path from 'node:path';

const exampleCsv =
  'timestamp,lat,lon,heading,pitch,roll,fov,altitude\n0,37,-122,350,0,0,75,10\n10,38,-121,10,20,10,90,30';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play video', exact: true })).toBeEnabled();
  await expect(page.locator('.map-message')).toHaveCount(0);
});

test('sample playback, seeking, rate, attitude, and route work together', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.locator('.map-message')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play video', exact: true }).click();
  await expect
    .poll(() => page.locator('video').evaluate((video) => (video as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0.3);
  await page.getByRole('button', { name: 'Pause video', exact: true }).click();
  await page.getByLabel('Video timeline').evaluate((input) => {
    (input as HTMLInputElement).value = '15';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('.telemetry-values dd').nth(0)).toContainText('37.80635');
  await page.getByLabel('Playback speed').selectOption('2');
  await expect
    .poll(() => page.locator('video').evaluate((video) => (video as HTMLVideoElement).playbackRate))
    .toBe(2);
  await page.getByRole('button', { name: 'HUD', exact: true }).click();
  await expect(page.locator('app-attitude-hud')).toHaveCount(0);
  await page.getByRole('button', { name: 'HUD', exact: true }).click();
  await expect(page.locator('app-attitude-hud canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Load sample mission' }).click();
  await expect
    .poll(() => page.locator('video').evaluate((video) => (video as HTMLVideoElement).currentTime))
    .toBe(0);
  await expect(page.locator('.map-message')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('CSV worker import, local video URL, sync offset and failed-import preservation', async ({
  page,
}) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (
      /^https?:/.test(request.url()) &&
      !new URL(request.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/)
    )
      external.push(request.url());
  });
  await page.locator('#mission-files').setInputFiles([
    { name: 'flight.csv', mimeType: 'text/csv', buffer: Buffer.from(exampleCsv) },
    {
      name: 'flight.webm',
      mimeType: 'video/webm',
      buffer: await (
        await import('node:fs/promises')
      ).readFile(path.resolve('public/sample-mission.webm')),
    },
  ]);
  await expect(page.locator('.log-name')).toContainText('flight.csv · 2 records');
  await expect(page.locator('#video-heading')).toHaveText('flight.webm');
  await expect(page.locator('video')).toHaveAttribute('src', /^blob:/);
  await page.getByLabel('Sync offset').fill('5');
  await expect(page.locator('.telemetry-values dd').nth(0)).toContainText('37.50000');
  await expect(page.locator('.telemetry-values dd').nth(2)).toContainText('0');
  await page.locator('#mission-files').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"notFrames": []}'),
  });
  await expect(page.getByRole('alert')).toContainText('JSON must contain');
  await expect(page.locator('.log-name')).toContainText('flight.csv · 2 records');
  expect(external).toEqual([]);
});

test('SRT fields, missing camera warnings, JSON and out-of-coverage state', async ({ page }) => {
  await page.locator('#mission-files').setInputFiles({
    name: 'drone.srt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      '1\n00:00:00,000 --> 00:00:01,000\n[latitude: 37.8] [longitude: -122.4] [gb_yaw: 42] [gb_pitch: -20]\n\n2\n00:00:01,000 --> 00:00:02,000\nGPS (-122.41, 37.81, 50)',
    ),
  });
  await expect(page.locator('.log-name')).toContainText('drone.srt · 2 records');
  await expect(page.locator('.warning').filter({ hasText: 'lack yaw' })).toBeVisible();
  await page.getByLabel('Sync offset').fill('20');
  await expect(page.locator('.telemetry-status strong')).toHaveText('After telemetry');
  await page.locator('#mission-files').setInputFiles({
    name: 'flight.json',
    mimeType: 'application/json',
    buffer: Buffer.from('[{"timestamp":0,"lat":37,"lon":-122,"heading":10,"pitch":5,"roll":2}]'),
  });
  await expect(page.locator('.telemetry-values dd').nth(0)).toContainText('37.00000');
});

test('responsive layout, both themes, accessible targets and diagnostics route', async ({
  page,
}, testInfo) => {
  await expect.poll(() => page.locator('.maplibregl-canvas').count()).toBe(1);
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.getByRole('button', { name: 'Use light theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const small = await page
      .locator('button, nav a, .brand, .button, input:not(.visually-hidden), select')
      .evaluateAll((elements) =>
        elements
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.height < 43;
          })
          .map((element) => element.textContent || element.getAttribute('aria-label')),
      );
    expect(small).toEqual([]);
    await page.screenshot({
      path: `docs/evidence/${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  }
  await page.getByRole('link', { name: 'Diagnostics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Runtime & Routing Verification' })).toBeVisible();
  await page.reload();
  await expect(page.locator('#base-uri-val')).toContainText('http://localhost:4200');
  await page.getByRole('link', { name: 'Workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Every frame. In context.' })).toBeVisible();
});

test('drop ingestion and video without telemetry never retain sample attitude', async ({
  page,
}) => {
  await page.locator('.import-zone').evaluate((zone, csv) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([csv], 'dropped.csv', { type: 'text/csv' }));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  }, exampleCsv);
  await expect(page.locator('.log-name')).toContainText('dropped.csv');
  await page.getByRole('button', { name: 'Load sample mission' }).click();
  await page.locator('#mission-files').setInputFiles('public/sample-mission.webm');
  await expect(page.locator('.telemetry-status strong')).toHaveText('No telemetry');
  await expect(page.locator('app-attitude-hud')).toHaveCount(0);
  await expect(page.locator('.empty-telemetry')).toBeVisible();
});

test('requestAnimationFrame fallback tracks playback and cleans up on navigation', async ({
  page,
}) => {
  await page.addInitScript(() => {
    delete (HTMLVideoElement.prototype as unknown as Record<string, unknown>)[
      'requestVideoFrameCallback'
    ];
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Play video', exact: true })).toBeEnabled();
  await expect(page.locator('.map-message')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play video', exact: true }).click();
  await expect.poll(() => page.locator('.timecode').innerText()).not.toContain('00:00 /');
  await page.getByRole('link', { name: 'Diagnostics', exact: true }).click();
  await expect(page.locator('video')).toHaveCount(0);
});
