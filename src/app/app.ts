import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  protected readonly canInstall = signal(false);
  protected readonly light = signal(false);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private installPromptListener?: (e: Event) => void;

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      try {
        this.light.set(localStorage.getItem('fmv-theme') === 'light');
      } catch {
        /* Storage may be unavailable in private browsing. */
      }
      document.documentElement.dataset['theme'] = this.light() ? 'light' : 'dark';

      this.installPromptListener = (e: Event) => {
        e.preventDefault();
        this.deferredPrompt = e as BeforeInstallPromptEvent;
        this.canInstall.set(true);
      };
      window.addEventListener('beforeinstallprompt', this.installPromptListener);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      if (this.installPromptListener) {
        window.removeEventListener('beforeinstallprompt', this.installPromptListener);
      }
    }
  }

  protected toggleTheme(): void {
    this.light.update((value) => !value);
    document.documentElement.dataset['theme'] = this.light() ? 'light' : 'dark';
    try {
      localStorage.setItem('fmv-theme', this.light() ? 'light' : 'dark');
    } catch {
      /* Theme still works without persistence. */
    }
  }

  protected async installApp(): Promise<void> {
    if (!this.deferredPrompt) return;
    await this.deferredPrompt.prompt();
    const choice = await this.deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      this.canInstall.set(false);
      this.deferredPrompt = null;
    }
  }
}
