import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TelemetryService } from './telemetry';
import { AttitudeHudComponent } from './attitude-hud.component';

@Component({
  selector: 'app-video-player',
  imports: [AttitudeHudComponent, DecimalPipe],
  templateUrl: './video-player.html',
})
export class VideoPlayerComponent implements OnDestroy {
  readonly source = input.required<string>();
  readonly demo = input(false);
  readonly restart = input(0);
  protected readonly telemetry = inject(TelemetryService);
  protected readonly playing = signal(false);
  protected readonly duration = signal(0);
  protected readonly rate = signal(1);
  protected readonly hud = signal(true);
  protected readonly error = signal('');
  @ViewChild('video') private video?: ElementRef<HTMLVideoElement>;
  private videoCallback?: number;
  private raf?: number;

  constructor() {
    effect(() => {
      this.restart();
      const video = this.video?.nativeElement;
      if (video) {
        video.pause();
        if (video.readyState > 0) video.currentTime = 0;
        this.sync();
      }
    });
  }

  protected metadata(): void {
    const video = this.video!.nativeElement;
    this.duration.set(Number.isFinite(video.duration) ? video.duration : 0);
    video.playbackRate = this.rate();
    this.error.set('');
    this.telemetry.time.set(video.currentTime);
  }
  protected failed(): void {
    this.duration.set(0);
    this.error.set(
      'This video could not be decoded. Try an MP4 with H.264 or a WebM supported by your browser.',
    );
  }
  protected async toggle(): Promise<void> {
    const video = this.video?.nativeElement;
    if (!video) return;
    if (!video.paused) video.pause();
    else {
      try {
        await video.play();
      } catch {
        this.error.set(
          'Playback failed. Check that the video format is supported by this browser.',
        );
      }
    }
  }
  protected seek(event: Event): void {
    const video = this.video?.nativeElement;
    if (!video || !this.duration()) return;
    video.currentTime = Number((event.target as HTMLInputElement).value);
    this.sync();
  }
  protected changeRate(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.rate.set(value);
    if (this.video) this.video.nativeElement.playbackRate = value;
  }
  protected sync(): void {
    if (this.video) this.telemetry.time.set(this.video.nativeElement.currentTime);
  }
  protected start(): void {
    this.playing.set(true);
    this.cancel();
    this.tick();
  }
  protected stop(): void {
    this.playing.set(false);
    this.cancel();
    this.sync();
  }
  protected reset(): void {
    this.playing.set(false);
    this.duration.set(0);
    this.error.set('');
    this.cancel();
    this.telemetry.time.set(0);
  }
  protected clock(time: number): string {
    return `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
  }
  private tick(): void {
    const video = this.video?.nativeElement;
    if (!video || video.paused || video.ended) return;
    if (typeof video.requestVideoFrameCallback === 'function') {
      this.videoCallback = video.requestVideoFrameCallback((_now, metadata) => {
        this.telemetry.time.set(metadata.mediaTime);
        this.tick();
      });
    } else {
      this.raf = requestAnimationFrame(() => {
        this.sync();
        this.tick();
      });
    }
  }
  private cancel(): void {
    if (this.videoCallback !== undefined)
      this.video?.nativeElement.cancelVideoFrameCallback(this.videoCallback);
    if (this.raf !== undefined) cancelAnimationFrame(this.raf);
    this.videoCallback = undefined;
    this.raf = undefined;
  }
  ngOnDestroy(): void {
    this.cancel();
    this.video?.nativeElement.pause();
  }
}
