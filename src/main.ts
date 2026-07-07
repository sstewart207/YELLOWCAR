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

  const ground = createGround();
  scene.add(ground);

  const car = new Car();
  scene.add(car.mesh);

  const input = new InputManager();

  const cameraOffset = new THREE.Vector3(0, 4, -8);
  let lastTime = performance.now();

  function tick() {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    world.step();
    car.update(input, dt);

    const desiredCameraPos = cameraOffset
      .clone()
      .applyEuler(car.mesh.rotation)
      .add(car.mesh.position);
    camera.position.copy(desiredCameraPos);
    camera.lookAt(car.mesh.position);

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

bootstrap();
