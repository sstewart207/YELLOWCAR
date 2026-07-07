const FORWARD_KEYS = ['KeyW', 'ArrowUp'];
const BACK_KEYS = ['KeyS', 'ArrowDown'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
const RIGHT_KEYS = ['KeyD', 'ArrowRight'];

export class InputManager {
  private keys = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
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
}
