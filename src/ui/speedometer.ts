const SPEEDOMETER_CSS = `
.hud-speedo {
  position: fixed;
  bottom: 20px;
  left: 20px;
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 10px 18px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(120, 175, 255, 0.35), rgba(70, 120, 230, 0.25));
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow:
    0 8px 24px rgba(10, 25, 60, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  font-family: system-ui, sans-serif;
  color: #fff;
  text-shadow: 0 1px 3px rgba(10, 25, 60, 0.4);
  z-index: 8;
  user-select: none;
}
.hud-speedo-value {
  font-size: 2rem;
  font-weight: 700;
  min-width: 2.5ch;
  text-align: right;
}
.hud-speedo-unit {
  font-size: 0.85rem;
  opacity: 0.85;
}
.hud-speedo-gear {
  font-size: 1.1rem;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
}
`;

export class Speedometer {
  private valueEl: HTMLSpanElement;
  private gearEl: HTMLSpanElement;

  constructor() {
    const style = document.createElement('style');
    style.textContent = SPEEDOMETER_CSS;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.className = 'hud-speedo';

    this.valueEl = document.createElement('span');
    this.valueEl.className = 'hud-speedo-value';
    this.valueEl.textContent = '0';

    const unit = document.createElement('span');
    unit.className = 'hud-speedo-unit';
    unit.textContent = 'mph';

    this.gearEl = document.createElement('span');
    this.gearEl.className = 'hud-speedo-gear';
    this.gearEl.textContent = '1';

    root.append(this.valueEl, unit, this.gearEl);
    document.body.appendChild(root);
  }

  update(speedMph: number, gearLabel: string): void {
    this.valueEl.textContent = String(Math.round(speedMph));
    this.gearEl.textContent = gearLabel;
  }
}
