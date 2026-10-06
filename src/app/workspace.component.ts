import { Component, OnDestroy, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TelemetryService, readTelemetry, sampleTelemetry } from './telemetry';
import { VideoPlayerComponent } from './video-player.component';
import { MapViewerComponent } from './map-viewer.component';

@Component({
  selector: 'app-workspace',
  imports: [VideoPlayerComponent, MapViewerComponent, DecimalPipe],
  templateUrl: './workspace.html',
})
export class WorkspaceComponent implements OnDestroy {
  protected readonly telemetry = inject(TelemetryService);
  protected readonly source = signal('');
  protected readonly videoName = signal('Coastal survey · synthetic demo');
  protected readonly logName = signal('Sample mission · 61 records');
  protected readonly demo = signal(true);
  protected readonly busy = signal(false);
  protected readonly drag = signal(false);
  protected readonly error = signal('');
  protected readonly warnings = signal<string[]>([]);
  protected readonly showHelp = signal(false);
  protected readonly restart = signal(0);
  private objectUrl?: string;
  private generation = 0;
  private sampleGeneration = 0;
  constructor() {
    void this.sample();
  }
  protected select(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) void this.importFiles(Array.from(input.files));
    input.value = '';
  }
  protected drop(event: DragEvent): void {
    event.preventDefault();
    this.drag.set(false);
    if (event.dataTransfer) void this.importFiles(Array.from(event.dataTransfer.files));
  }
  protected dragOver(event: DragEvent): void {
    event.preventDefault();
    this.drag.set(true);
  }
  protected offset(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) this.telemetry.offset.set(Math.min(86400, Math.max(-86400, value)));
  }
  protected async sample(): Promise<void> {
    const token = ++this.sampleGeneration;
    this.generation++;
    this.busy.set(false);
    this.error.set('');
    this.warnings.set([]);
    this.source.set('');
    this.videoName.set('Coastal survey · synthetic demo');
    this.logName.set('Sample mission · 61 records');
    this.demo.set(true);
    this.telemetry.load(sampleTelemetry());
    this.telemetry.time.set(0);
    this.releaseUrl();
    this.restart.update((value) => value + 1);
    try {
      // Only the bundled 3 MB demo is fully fetched. This avoids uncachable HTTP 206 responses
      // racing Angular's prefetch; large user videos still use File object URLs directly.
      const response = await fetch(new URL('sample-mission.webm', document.baseURI));
      if (!response.ok) throw new Error('The sample video could not be loaded. Try a local video.');
      const blob = await response.blob();
      if (token !== this.sampleGeneration || !this.demo()) return;
      this.objectUrl = URL.createObjectURL(blob);
      this.source.set(this.objectUrl);
    } catch (error) {
      if (token === this.sampleGeneration && this.demo())
        this.error.set(error instanceof Error ? error.message : 'The sample video is unavailable.');
    }
  }
  private async importFiles(files: File[]): Promise<void> {
    if (!files.length) return;
    const token = ++this.generation;
    this.busy.set(true);
    this.error.set('');
    try {
      const videos = files.filter((file) => /\.(mp4|webm)$/i.test(file.name));
      const logs = files.filter((file) => /\.(csv|json|srt)$/i.test(file.name));
      if (videos.length + logs.length !== files.length)
        throw new Error('Supported files: MP4, WebM, CSV, JSON, and SRT.');
      if (videos.length > 1 || logs.length > 1)
        throw new Error('Load one video and one telemetry file at a time.');
      const imported = logs[0] ? await readTelemetry(logs[0]) : undefined;
      if (token !== this.generation) return;
      if (videos[0]) {
        const url = URL.createObjectURL(videos[0]);
        this.source.set(url);
        this.videoName.set(videos[0].name);
        if (this.demo() && !imported) {
          this.telemetry.load([]);
          this.logName.set('No telemetry · add a log to synchronize');
          this.warnings.set([]);
        }
        this.demo.set(false);
        this.telemetry.time.set(0);
        this.releaseUrl();
        this.objectUrl = url;
        this.restart.update((value) => value + 1);
      }
      if (imported) {
        this.telemetry.load(imported.frames);
        this.logName.set(`${logs[0].name} · ${imported.frames.length.toLocaleString()} records`);
        this.warnings.set([
          ...imported.warnings,
          ...(this.demo()
            ? [
                'Imported telemetry is displayed against the synthetic demo video. Add its matching local video.',
              ]
            : []),
        ]);
      }
    } catch (error) {
      if (token === this.generation)
        this.error.set(
          error instanceof Error ? error.message : 'Import failed. Check the telemetry format.',
        );
    } finally {
      if (token === this.generation) this.busy.set(false);
    }
  }
  private releaseUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = undefined;
    }
  }
  ngOnDestroy(): void {
    this.generation++;
    this.sampleGeneration++;
    this.releaseUrl();
  }
}
