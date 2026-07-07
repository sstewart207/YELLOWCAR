import * as THREE from 'three';
import { createScene } from './core/scene';
import { initPhysics } from './core/physics';
import { InputManager } from './core/input';
import { createGround } from './world/ground';
import { Car } from './entities/car';

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

  const cameraOffset = new THREE.Vector3(0, 4, -8);
  let lastTime = performance.now();

  function tick() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    car.applyControls(input, dt);
    world.step();
    car.syncFromPhysics(dt);

    const desiredCameraPos = cameraOffset
      .clone()
      .applyEuler(car.group.rotation)
      .add(car.group.position);
    camera.position.copy(desiredCameraPos);
    camera.lookAt(car.group.position);

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

bootstrap();
