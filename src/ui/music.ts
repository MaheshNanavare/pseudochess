/**
 * Background music: one looping track for the home screen, one for the game.
 *
 * - Browsers only allow sound after the person has interacted with the page,
 *   so nothing plays until the first tap, click or key press.
 * - Each file is fetched whole (so the service worker can cache it for
 *   offline play) and played from a blob URL.
 * - The tracks have no gapless-playback header, so a plain loop would stutter.
 *   Instead each track has two players that crossfade the end into the start.
 * - Switching screens crossfades between tracks; hiding the app pauses it.
 */
export type Track = 'home' | 'game';

const SOURCES: Record<Track, string> = { home: 'audio/home.mp3', game: 'audio/game.mp3' };
/** Music sits under the sound effects; the game track is quieter so it does not distract. */
const VOLUME: Record<Track, number> = { home: 0.45, game: 0.3 };
const LOOP_FADE_S = 2.5;
const SWITCH_FADE_MS = 900;
const PAUSE_FADE_MS = 300;

/** Fades an element's volume, cancelling any fade already running on it. */
const fades = new WeakMap<HTMLAudioElement, number>();
function fade(el: HTMLAudioElement, to: number, ms: number, done?: () => void): void {
  const running = fades.get(el);
  if (running !== undefined) cancelAnimationFrame(running);
  const from = el.volume;
  const start = performance.now();
  const step = (now: number) => {
    // A frame's timestamp can be slightly earlier than `start`, so clamp both ends.
    const k = Math.min(1, Math.max(0, (now - start) / ms));
    el.volume = Math.min(1, Math.max(0, from + (to - from) * k));
    if (k < 1) fades.set(el, requestAnimationFrame(step));
    else {
      fades.delete(el);
      done?.();
    }
  };
  fades.set(el, requestAnimationFrame(step));
}

/** One track, played by two elements in turn so the loop point is a crossfade. */
class LoopingTrack {
  private players: [HTMLAudioElement, HTMLAudioElement] | null = null;
  private loading: Promise<void> | null = null;
  private active = 0;
  private playing = false;

  constructor(
    private readonly src: string,
    private readonly volume: number,
  ) {}

  private load(): Promise<void> {
    this.loading ??= fetch(this.src)
      .then((res) => {
        if (!res.ok) throw new Error(`${this.src}: HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const make = () => {
          const el = new Audio(url);
          el.preload = 'auto';
          el.volume = 0;
          el.addEventListener('timeupdate', () => this.checkLoop(el));
          return el;
        };
        this.players = [make(), make()];
      })
      .catch((err: unknown) => {
        this.loading = null; // try again next time
        throw err;
      });
    return this.loading;
  }

  /** Near the end of the active player, start the other one from the top and crossfade. */
  private checkLoop(el: HTMLAudioElement): void {
    if (!this.players || !this.playing || el !== this.players[this.active]) return;
    if (!Number.isFinite(el.duration) || el.duration - el.currentTime > LOOP_FADE_S) return;
    const next = this.players[1 - this.active]!;
    this.active = 1 - this.active;
    next.currentTime = 0;
    next.volume = 0;
    void next.play().catch(() => undefined);
    fade(next, this.volume, LOOP_FADE_S * 1000);
    fade(el, 0, LOOP_FADE_S * 1000, () => el.pause());
  }

  async play(): Promise<void> {
    this.playing = true;
    await this.load();
    if (!this.playing || !this.players) return;
    const el = this.players[this.active]!;
    await el.play();
    fade(el, this.volume, SWITCH_FADE_MS);
  }

  stop(ms: number): void {
    this.playing = false;
    for (const el of this.players ?? []) {
      if (!el.paused) fade(el, 0, ms, () => el.pause());
    }
  }
}

class MusicPlayer {
  private readonly tracks = new Map<Track, LoopingTrack>();
  private wanted: Track | null = null;
  private current: Track | null = null;
  private enabled = true;
  private unlocked = false;

  constructor() {
    if (typeof document === 'undefined') return;
    const unlock = () => {
      this.unlocked = true;
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      this.update();
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', () => this.update());
  }

  setTrack(track: Track | null): void {
    this.wanted = track;
    this.update();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.update();
  }

  private track(name: Track): LoopingTrack {
    let track = this.tracks.get(name);
    if (!track) {
      track = new LoopingTrack(SOURCES[name], VOLUME[name]);
      this.tracks.set(name, track);
    }
    return track;
  }

  private update(): void {
    const audible = this.enabled && this.unlocked && document.visibilityState === 'visible';
    const next = audible ? this.wanted : null;
    if (next === this.current) return;
    const fadeMs = document.visibilityState === 'visible' ? SWITCH_FADE_MS : PAUSE_FADE_MS;
    if (this.current) this.track(this.current).stop(fadeMs);
    this.current = next;
    if (next) {
      this.track(next)
        .play()
        .catch((err: unknown) => {
          // Music is a nicety: a missing file or a blocked play() must not break the game.
          console.warn('Music could not play:', err);
          if (this.current === next) this.current = null;
        });
    }
  }
}

export const music = new MusicPlayer();
