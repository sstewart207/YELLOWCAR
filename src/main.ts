import * as THREE from 'three';
import { createScene } from './core/scene';
import { initPhysics } from './core/physics';
import { InputManager } from './core/input';
import { createGround } from './world/ground';
import { Car } from './entities/car';
import { PauseMenu } from './ui/pauseMenu';

async function bootstrap() {
  const container = document.getElementById('app');
  if (!container) throw new Error('Missing #app container');

  const { scene, camera, renderer } = createScene(container);
  const world = await initPhysics();

  const ground = createGround(world);
  scene.add(ground);

  const car = new Car(world);
  scene.add(car.group);

  const input = new InputManager();
  const menu = new PauseMenu(() => car.respawn());

  const cameraOffset = new THREE.Vector3(0, 4, -8);
  const cameraPos = new THREE.Vector3();

  // Rapier integrates a fixed slice of simulated time per step() call, so the
  // sim must be advanced on a fixed-timestep accumulator; stepping once per
  // rAF frame would tie game speed to the monitor's refresh rate.
  const PHYSICS_STEP = 1 / 60;
  let accumulator = 0;
  let lastTime = performance.now();

  function tick() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (!menu.paused) {
      accumulator += dt;
      let simTime = 0;
      while (accumulator >= PHYSICS_STEP) {
        car.applyControls(input, PHYSICS_STEP);
        world.step();
        accumulator -= PHYSICS_STEP;
        simTime += PHYSICS_STEP;
      }
      car.syncFromPhysics(simTime);
    }

    cameraPos.copy(cameraOffset).applyEuler(car.group.rotation).add(car.group.position);
    camera.position.copy(cameraPos);
    camera.lookAt(car.group.position);

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

bootstrap().catch((err) => {
  console.error(err);
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'background:#1a1a1a;color:#fff;font-family:system-ui,sans-serif;padding:2rem;text-align:center;';
  overlay.textContent = `Failed to start: ${err instanceof Error ? err.message : String(err)}`;
  document.body.appendChild(overlay);
});
