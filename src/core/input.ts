const FORWARD_KEYS = ['KeyW', 'ArrowUp'];
const BACK_KEYS = ['KeyS', 'ArrowDown'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
const RIGHT_KEYS = ['KeyD', 'ArrowRight'];
const BOOST_KEYS = ['ShiftLeft', 'ShiftRight'];
const HANDBRAKE_KEYS = ['Space'];

const ALL_ACTION_KEYS = new Set([
  ...FORWARD_KEYS,
  ...BACK_KEYS,
  ...LEFT_KEYS,
  ...RIGHT_KEYS,
  ...BOOST_KEYS,
  ...HANDBRAKE_KEYS,
]);

export class InputManager {
  private keys = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (ALL_ACTION_KEYS.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    // Keyup events fire on whatever has focus, so losing focus mid-press
    // would otherwise leave keys stuck down (car driving itself on Alt-Tab).
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.keys.clear();
    });
  }

  private isAnyDown(codes: string[]): boolean {
    return codes.some((code) => this.keys.has(code));
  }

  get forward(): boolean {
    return this.isAnyDown(FORWARD_KEYS);
  }

  get back(): boolean {
    return this.isAnyDown(BACK_KEYS);
  }

  get left(): boolean {
    return this.isAnyDown(LEFT_KEYS);
  }

  get right(): boolean {
    return this.isAnyDown(RIGHT_KEYS);
  }

  get boost(): boolean {
    return this.isAnyDown(BOOST_KEYS);
  }

  get handbrake(): boolean {
    return this.isAnyDown(HANDBRAKE_KEYS);
  }
}
