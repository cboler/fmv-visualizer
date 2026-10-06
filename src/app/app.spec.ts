import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('Frame / Field shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });
  it('renders the brand, navigation, and accessible skip link', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.brand')?.textContent).toContain('FRAME');
    expect(element.querySelector('nav')?.textContent).toContain('Workspace');
    expect(element.querySelector('.skip-link')?.getAttribute('href')).toBe('#main-content');
  });
  it('switches themes using the accessible theme button', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const previous = document.documentElement.dataset['theme'];
    (element.querySelector('.theme-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(document.documentElement.dataset['theme']).not.toBe(previous);
  });
});
