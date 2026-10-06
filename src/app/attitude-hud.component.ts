import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { TelemetryService, wrap } from './telemetry';

@Component({
  selector: 'app-attitude-hud',
  template:
    '<canvas #canvas aria-label="Artificial horizon; numerical attitude is available below the video"></canvas>',
  styles:
    ':host { position:absolute; inset:0; pointer-events:none } canvas { width:100%; height:100%; display:block }',
})
export class AttitudeHudComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') private canvas?: ElementRef<HTMLCanvasElement>;
  private telemetry = inject(TelemetryService);
  private observer?: ResizeObserver;

  constructor() {
    effect(() => {
      this.telemetry.frame();
      this.draw();
    });
  }
  ngAfterViewInit(): void {
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(this.canvas!.nativeElement);
    this.draw();
  }
  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private draw(): void {
    const canvas = this.canvas?.nativeElement;
    const frame = this.telemetry.frame();
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (
      canvas.width !== Math.round(width * ratio) ||
      canvas.height !== Math.round(height * ratio)
    ) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!frame) return;
    const scale = Math.min(width / 700, height / 400);
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);
    ctx.strokeStyle = '#beffd7';
    ctx.fillStyle = '#beffd7';
    ctx.lineWidth = 1.5;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#122018';
    ctx.shadowBlur = 4;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-190, -112, 380, 224);
    ctx.clip();
    ctx.rotate((-frame.roll * Math.PI) / 180);
    // 3px/degree is an illustrative ladder, not a calibrated camera projection.
    ctx.translate(0, frame.pitch * 3);
    ctx.fillStyle = '#6ebced12';
    ctx.fillRect(-400, -400, 800, 400);
    ctx.fillStyle = '#ad935812';
    ctx.fillRect(-400, 0, 800, 400);
    for (let pitch = -90; pitch <= 90; pitch += 10) {
      const y = -pitch * 3;
      const span = pitch === 0 ? 180 : 50;
      ctx.setLineDash(pitch < 0 ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(-span, y);
      ctx.lineTo(-12, y);
      ctx.moveTo(12, y);
      ctx.lineTo(span, y);
      ctx.stroke();
      if (pitch) {
        ctx.fillStyle = '#beffd7';
        ctx.fillText(String(pitch), -span - 20, y + 4);
        ctx.fillText(String(pitch), span + 20, y + 4);
      }
    }
    ctx.restore();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-34, 0);
    ctx.lineTo(-12, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(12, 0);
    ctx.lineTo(34, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = '#beffd7';
    for (let delta = -40; delta <= 40; delta += 10) {
      const x = delta * 4;
      ctx.beginPath();
      ctx.moveTo(x, -140);
      ctx.lineTo(x, -133);
      ctx.stroke();
      ctx.fillText(String(Math.round(wrap(frame.heading + delta))).padStart(3, '0'), x, -150);
    }
    ctx.beginPath();
    ctx.moveTo(-5, -128);
    ctx.lineTo(0, -134);
    ctx.lineTo(5, -128);
    ctx.stroke();
  }
}
