import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { InputManager } from '../core/input';

const BODY_SIZE = { x: 1, y: 0.5, z: 2 };
const CABIN_SIZE = { x: 0.7, y: 0.35, z: 0.9 };
const WHEEL_RADIUS = 0.28;
const WHEEL_WIDTH = 0.2;

const MAX_SPEED = 8;
const REVERSE_SPEED = 4;
const ACCEL = 10;
const TURN_RATE = 2.8;

export class Car {
  readonly group: THREE.Group;

  private body: RAPIER.RigidBody;
  private wheels: THREE.Mesh[];
  private currentSpeed = 0;

  constructor(world: RAPIER.World) {
    this.group = new THREE.Group();

    const bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(BODY_SIZE.x, BODY_SIZE.y, BODY_SIZE.z),
      new THREE.MeshLambertMaterial({ color: 0xf4c515 }),
    );
    this.group.add(bodyMesh);

    const cabinMesh = new THREE.Mesh(
      new THREE.BoxGeometry(CABIN_SIZE.x, CABIN_SIZE.y, CABIN_SIZE.z),
      new THREE.MeshLambertMaterial({ color: 0xd9ad10 }),
    );
    cabinMesh.position.set(0, BODY_SIZE.y / 2 + CABIN_SIZE.y / 2, -0.15);
    this.group.add(cabinMesh);

    const wheelGeometry = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 12);
    wheelGeometry.rotateZ(Math.PI / 2);
    const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

    const wheelOffsetX = BODY_SIZE.x / 2 + WHEEL_WIDTH / 2 - 0.02;
    const wheelOffsetY = -BODY_SIZE.y / 2 + 0.05;
    const wheelOffsetZ = BODY_SIZE.z / 2 - WHEEL_RADIUS - 0.05;
    const wheelPositions: [number, number, number][] = [
      [-wheelOffsetX, wheelOffsetY, wheelOffsetZ],
      [wheelOffsetX, wheelOffsetY, wheelOffsetZ],
      [-wheelOffsetX, wheelOffsetY, -wheelOffsetZ],
      [wheelOffsetX, wheelOffsetY, -wheelOffsetZ],
    ];

    this.wheels = wheelPositions.map(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(x, y, z);
      this.group.add(wheel);
      return wheel;
    });

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 1, 0)
      .enabledRotations(false, true, false)
      .setLinearDamping(0.5)
      .setAngularDamping(4);
    this.body = world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(BODY_SIZE.x / 2, BODY_SIZE.y / 2, BODY_SIZE.z / 2)
      .setFriction(0.8)
      .setRestitution(0.1);
    world.createCollider(colliderDesc, this.body);
  }

  applyControls(input: InputManager, dt: number): void {
    const rotation = this.body.rotation();
    const quat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);

    let targetSpeed = 0;
    if (input.forward) targetSpeed = MAX_SPEED;
    else if (input.back) targetSpeed = -REVERSE_SPEED;

    const speedDelta = targetSpeed - this.currentSpeed;
    const maxStep = ACCEL * dt;
    this.currentSpeed += Math.sign(speedDelta) * Math.min(Math.abs(speedDelta), maxStep);

    const linvel = this.body.linvel();
    const planar = forward.multiplyScalar(this.currentSpeed);
    this.body.setLinvel({ x: planar.x, y: linvel.y, z: planar.z }, true);

    let turnInput = 0;
    if (input.left) turnInput += 1;
    if (input.right) turnInput -= 1;
    this.body.setAngvel({ x: 0, y: turnInput * TURN_RATE, z: 0 }, true);
  }

  syncFromPhysics(dt: number): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);

    const spin = (this.currentSpeed / WHEEL_RADIUS) * dt;
    for (const wheel of this.wheels) {
      wheel.rotation.x += spin;
    }
  }
}
