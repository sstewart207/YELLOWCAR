const MENU_CSS = `
.pm-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(20, 40, 80, 0.25);
  z-index: 10;
}
.pm-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 240px;
  padding: 28px 32px;
  border-radius: 28px;
  background: linear-gradient(135deg, rgba(120, 175, 255, 0.45), rgba(70, 120, 230, 0.35));
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow:
    0 12px 40px rgba(10, 25, 60, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.6),
    inset 0 -1px 0 rgba(255, 255, 255, 0.12);
  font-family: system-ui, sans-serif;
  text-align: center;
}
.pm-title {
  margin: 0 0 6px;
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #fff;
  text-shadow: 0 1px 3px rgba(10, 25, 60, 0.4);
}
.pm-btn {
  padding: 12px 20px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(150, 190, 255, 0.35);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.pm-btn:hover {
  background: rgba(190, 220, 255, 0.45);
}
.pm-btn:active {
  transform: scale(0.97);
}
.pm-pause-btn {
  position: fixed;
  top: 16px;
  right: 16px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(110, 165, 255, 0.25);
  backdrop-filter: blur(12px) saturate(170%);
  -webkit-backdrop-filter: blur(12px) saturate(170%);
  box-shadow:
    0 4px 16px rgba(10, 25, 60, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
  color: #fff;
  font-size: 1.1rem;
  cursor: pointer;
  z-index: 9;
}
.pm-pause-btn:hover {
  background: rgba(160, 200, 255, 0.4);
}
`;

export class PauseMenu {
  private overlay: HTMLDivElement;
  private pauseButton: HTMLButtonElement;
  private pausedState = false;

  constructor(onRestart: () => void) {
    const style = document.createElement('style');
    style.textContent = MENU_CSS;
    document.head.appendChild(style);

    this.overlay = document.createElement('div');
    this.overlay.className = 'pm-overlay';
    this.overlay.style.display = 'none';

    const panel = document.createElement('div');
    panel.className = 'pm-panel';

    const title = document.createElement('h1');
    title.className = 'pm-title';
    title.textContent = 'Paused';

    const resumeBtn = this.makeButton('Resume', () => this.setPaused(false));
    const restartBtn = this.makeButton('Restart', () => {
      onRestart();
      this.setPaused(false);
    });

    panel.append(title, resumeBtn, restartBtn);
    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    this.pauseButton = document.createElement('button');
    this.pauseButton.className = 'pm-pause-btn';
    this.pauseButton.textContent = '‖'; // ‖ pause glyph
    this.pauseButton.title = 'Pause (Esc)';
    this.pauseButton.addEventListener('click', () => {
      this.pauseButton.blur();
      this.setPaused(true);
    });
    document.body.appendChild(this.pauseButton);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this.setPaused(!this.pausedState);
    });
  }

  get paused(): boolean {
    return this.pausedState;
  }

  private setPaused(paused: boolean): void {
    this.pausedState = paused;
    this.overlay.style.display = paused ? 'flex' : 'none';
    this.pauseButton.style.display = paused ? 'none' : 'block';
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'pm-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      // Drop focus so Space (handbrake) can't re-trigger the button later.
      btn.blur();
      onClick();
    });
    return btn;
  }
}
