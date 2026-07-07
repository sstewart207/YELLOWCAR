import * as THREE from 'three';
import type { InputManager } from '../core/input';

const SPEED = 6;
const TURN_SPEED = 2.5;

export class Car {
  readonly mesh: THREE.Mesh;

  constructor() {
    const geometry = new THREE.BoxGeometry(1, 0.5, 2);
    const material = new THREE.MeshLambertMaterial({ color: 0xf4c515 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.y = 0.25;
  }

  update(input: InputManager, dt: number): void {
    if (input.left) this.mesh.rotation.y += TURN_SPEED * dt;
    if (input.right) this.mesh.rotation.y -= TURN_SPEED * dt;

    let move = 0;
    if (input.forward) move += SPEED * dt;
    if (input.back) move -= SPEED * dt;

    if (move !== 0) {
      const forward = new THREE.Vector3(0, 0, 1).applyEuler(this.mesh.rotation);
      this.mesh.position.addScaledVector(forward, move);
    }
  }
}
