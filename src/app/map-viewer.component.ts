import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { sector } from '@turf/turf';
import type { Feature, LineString, Point } from 'geojson';
import type { GeoJSONSource, Map, Marker } from 'maplibre-gl';
import { TelemetryService } from './telemetry';

@Component({
  selector: 'app-map-viewer',
  template: `
    <div class="map-toolbar">
      <button type="button" class="quiet" (click)="toggleFollow()" [attr.aria-pressed]="follow()">
        {{ follow() ? '◎ Following' : '◎ Follow vehicle' }}
      </button>
      <button type="button" class="quiet" (click)="toggleBasemap()" [attr.aria-pressed]="online()">
        {{ online() ? 'Online streets' : 'Offline map' }}
      </button>
      <button type="button" class="quiet" (click)="fitTrack()">Fit route</button>
    </div>
    <div #container class="map-canvas" aria-label="Interactive vehicle map"></div>
    @if (!ready() && !error()) {
      <p class="map-message" role="status">Loading map…</p>
    }
    @if (error()) {
      <p class="map-message" role="status">{{ error() }}</p>
    }
    <div class="map-legend">
      <span><i class="legend-line"></i> Traveled</span
      ><span><i class="legend-cone"></i> Camera FOV</span
      ><span>{{
        online() ? 'Streets require network or cached tiles' : 'Bundled SF schematic · no network'
      }}</span>
    </div>
    <div class="map-settings">
      <label for="cone-range"
        >Cone range <strong>{{ radius() }} m</strong></label
      ><input
        id="cone-range"
        type="range"
        min="50"
        max="2000"
        step="25"
        [value]="radius()"
        (input)="setRadius($event)"
      /><span>Illustrative horizontal sector</span>
    </div>
  `,
})
export class MapViewerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container') private container!: ElementRef<HTMLDivElement>;
  protected readonly telemetry = inject(TelemetryService);
  protected readonly follow = signal(true);
  protected readonly online = signal(false);
  protected readonly radius = signal(250);
  protected readonly error = signal('');
  protected readonly ready = signal(false);
  private map?: Map;
  private marker?: Marker;
  private observer?: ResizeObserver;
  private timer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  private loaded = false;
  private path: { time: number; coordinates: number[] }[] = [];
  private lastFrames?: readonly unknown[];

  constructor() {
    effect(() => {
      this.telemetry.frame();
      this.telemetry.frames();
      this.radius();
      this.follow();
      // Map GeoJSON updates are capped at ~15Hz; video/HUD still follow each decoded frame.
      if (this.loaded && this.timer === undefined)
        this.timer = setTimeout(() => {
          this.timer = undefined;
          this.update();
        }, 66);
    });
  }
  async ngAfterViewInit(): Promise<void> {
    try {
      const {
        Map: MapLibreMap,
        Marker: MapLibreMarker,
        NavigationControl,
        setWorkerUrl,
        setWorkerCount,
      } = await import('maplibre-gl');
      if (this.destroyed) return;
      setWorkerUrl(new URL('maplibre/maplibre-gl-worker.mjs', document.baseURI).href);
      setWorkerCount(2);
      const center = this.telemetry.frame();
      const empty = { type: 'FeatureCollection' as const, features: [] };
      this.map = new MapLibreMap({
        container: this.container.nativeElement,
        center: center ? [center.lon, center.lat] : [-122.463, 37.806],
        zoom: 15,
        attributionControl: { compact: false },
        style: {
          version: 8,
          sources: {
            offline: {
              type: 'geojson',
              data: new URL('offline-map.geojson', document.baseURI).href,
            },
            route: { type: 'geojson', data: empty },
            trail: { type: 'geojson', data: empty },
            cone: { type: 'geojson', data: empty },
            vehicle: { type: 'geojson', data: empty },
          },
          layers: [
            { id: 'background', type: 'background', paint: { 'background-color': '#10252c' } },
            {
              id: 'land',
              type: 'fill',
              source: 'offline',
              filter: ['==', ['get', 'kind'], 'land'],
              paint: { 'fill-color': '#243835' },
            },
            {
              id: 'park',
              type: 'fill',
              source: 'offline',
              filter: ['==', ['get', 'kind'], 'park'],
              paint: { 'fill-color': '#2c4940' },
            },
            {
              id: 'roads',
              type: 'line',
              source: 'offline',
              filter: ['==', ['get', 'kind'], 'road'],
              paint: { 'line-color': '#6a8174', 'line-width': 2, 'line-opacity': 0.65 },
            },
            {
              id: 'route',
              type: 'line',
              source: 'route',
              paint: {
                'line-color': '#8da9a4',
                'line-width': 2,
                'line-dasharray': [2, 3],
                'line-opacity': 0.6,
              },
            },
            {
              id: 'cone-fill',
              type: 'fill',
              source: 'cone',
              paint: { 'fill-color': '#74dfc6', 'fill-opacity': 0.18 },
            },
            {
              id: 'cone-edge',
              type: 'line',
              source: 'cone',
              paint: { 'line-color': '#74dfc6', 'line-width': 1.5 },
            },
            {
              id: 'trail',
              type: 'line',
              source: 'trail',
              paint: { 'line-color': '#6de4c1', 'line-width': 3 },
            },
            {
              id: 'vehicle',
              type: 'circle',
              source: 'vehicle',
              paint: {
                'circle-radius': 5,
                'circle-color': '#e4fff4',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#0a2e25',
              },
            },
          ],
        },
      });
      this.map.addControl(new NavigationControl({ showCompass: true }), 'top-right');
      this.map.on('dragstart', () => this.follow.set(false));
      this.map.on('error', () => {
        this.error.set(
          this.online()
            ? 'Some street tiles are unavailable. Switch to the offline map to continue.'
            : 'Map data unavailable; vehicle overlays remain active.',
        );
      });
      this.map.on('load', () => {
        this.loaded = true;
        this.update();
        this.fitTrack();
      });
      this.map.on('idle', () => this.ready.set(true));
      const arrow = document.createElement('div');
      arrow.className = 'vehicle-arrow';
      arrow.setAttribute('aria-label', 'Vehicle heading');
      this.marker = new MapLibreMarker({ element: arrow, rotationAlignment: 'map' })
        .setLngLat(center ? [center.lon, center.lat] : [0, 0])
        .addTo(this.map);
      this.observer = new ResizeObserver(() => this.map?.resize());
      this.observer.observe(this.container.nativeElement);
    } catch {
      this.error.set(
        'Map could not initialize. WebGL must be available; video and telemetry still work.',
      );
    }
  }
  protected setRadius(event: Event): void {
    this.radius.set(Number((event.target as HTMLInputElement).value));
  }
  protected toggleFollow(): void {
    this.follow.update((value) => !value);
    this.update();
  }
  protected toggleBasemap(): void {
    if (!this.map || !this.loaded) return;
    this.online.update((value) => !value);
    this.error.set('');
    this.ready.set(false);
    if (!this.map.getSource('streets')) {
      this.map.addSource('streets', {
        type: 'vector',
        attribution:
          '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>',
        url: 'https://tiles.openfreemap.org/planet',
      });
      // A small vector style avoids remote fonts/sprites and keeps cached streets self-contained.
      this.map.addLayer(
        { id: 'street-land', type: 'background', paint: { 'background-color': '#263a35' } },
        'route',
      );
      this.map.addLayer(
        {
          id: 'street-water',
          type: 'fill',
          source: 'streets',
          'source-layer': 'water',
          paint: { 'fill-color': '#102b35' },
        },
        'route',
      );
      this.map.addLayer(
        {
          id: 'street-park',
          type: 'fill',
          source: 'streets',
          'source-layer': 'landcover',
          paint: { 'fill-color': '#365347', 'fill-opacity': 0.7 },
        },
        'route',
      );
      this.map.addLayer(
        {
          id: 'street-buildings',
          type: 'fill',
          source: 'streets',
          'source-layer': 'building',
          minzoom: 13,
          paint: { 'fill-color': '#65766a', 'fill-opacity': 0.6 },
        },
        'route',
      );
      this.map.addLayer(
        {
          id: 'streets',
          type: 'line',
          source: 'streets',
          'source-layer': 'transportation',
          paint: {
            'line-color': '#8aa494',
            'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.7, 16, 2.5, 20, 7],
            'line-opacity': 0.7,
          },
        },
        'route',
      );
    }
    for (const id of [
      'street-land',
      'street-water',
      'street-park',
      'street-buildings',
      'streets',
    ]) {
      this.map.setLayoutProperty(id, 'visibility', this.online() ? 'visible' : 'none');
    }
  }
  protected fitTrack(): void {
    if (!this.map || !this.telemetry.frames().length) return;
    const frames = this.telemetry.frames();
    const lons = frames.map((frame) => frame.lon);
    const lats = frames.map((frame) => frame.lat);
    // Route fitting across the dateline falls back to the current position; wrapped playback remains correct.
    const west = lons.reduce((a, b) => Math.min(a, b));
    const east = lons.reduce((a, b) => Math.max(a, b));
    const south = lats.reduce((a, b) => Math.min(a, b));
    const north = lats.reduce((a, b) => Math.max(a, b));
    if (east - west > 180) this.map.jumpTo({ center: [frames[0].lon, frames[0].lat], zoom: 13 });
    else
      this.map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 80, maxZoom: 16, duration: 0 },
      );
  }
  private update(): void {
    if (!this.map || !this.loaded) return;
    const frames = this.telemetry.frames();
    if (this.lastFrames !== frames) {
      this.lastFrames = frames;
      // Display at most ~2,000 breadcrumbs; full-resolution interpolation stays in the service.
      const stride = Math.max(1, Math.ceil(frames.length / 2000));
      this.path = frames
        .filter((_frame, i) => i % stride === 0 || i === frames.length - 1)
        .map((frame) => ({ time: frame.time, coordinates: [frame.lon, frame.lat] }));
      this.line(
        'route',
        this.path.map((point) => point.coordinates),
      );
      this.fitTrack();
    }
    const frame = this.telemetry.frame();
    if (!frame) {
      for (const name of ['cone', 'trail', 'vehicle'])
        this.setData(name, { type: 'FeatureCollection', features: [] });
      this.marker?.getElement().setAttribute('hidden', '');
      return;
    }
    this.marker?.getElement().removeAttribute('hidden');
    const center: [number, number] = [frame.lon, frame.lat];
    const cone = sector(
      center,
      this.radius() / 1000,
      frame.heading - frame.fov / 2,
      frame.heading + frame.fov / 2,
      { steps: 32, units: 'kilometers' },
    );
    this.setData('cone', cone);
    this.setData('vehicle', {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: center },
    } satisfies Feature<Point>);
    this.line('trail', [
      ...this.path.filter((point) => point.time <= frame.time).map((point) => point.coordinates),
      center,
    ]);
    this.marker?.setLngLat(center).setRotation(frame.heading);
    if (this.follow() && !this.map.isMoving())
      this.map.easeTo({ center, duration: 60, essential: false });
  }
  private line(name: string, coordinates: number[][]): void {
    this.setData(
      name,
      coordinates.length > 1
        ? ({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates },
          } satisfies Feature<LineString>)
        : { type: 'FeatureCollection', features: [] },
    );
  }
  private setData(name: string, data: Parameters<GeoJSONSource['setData']>[0]): void {
    (this.map?.getSource(name) as GeoJSONSource | undefined)?.setData(data);
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.observer?.disconnect();
    this.marker?.remove();
    this.map?.remove();
  }
}
