import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { InputManager } from '../core/input';

const MODEL_URL = '/models/taxi.glb';
const WHEEL_NAMES = ['wheel-front-right', 'wheel-front-left', 'wheel-back-left', 'wheel-back-right'];

// Each gear has its own top speed and its own (progressively lower)
// acceleration, so holding the throttle feels like climbing through gears
// rather than ramping once to a flat cap.
const GEARS = [
  { ceiling: 3.5, accel: 16 },
  { ceiling: 6.5, accel: 11 },
  { ceiling: 9, accel: 7.5 },
  { ceiling: 11, accel: 5 },
];
const NORMAL_TOP_SPEED = GEARS[GEARS.length - 1].ceiling;
const BOOST_TOP_SPEED = 17;
const BOOST_ACCEL = 8; // used once past the top normal gear while boosting (overdrive)
const REVERSE_SPEED = 4;
const REVERSE_ACCEL = 8;
const COAST_DECEL = 6; // deceleration toward 0 when no throttle/reverse input

const MAX_TURN_RATE = 3.2; // at a standstill
const MIN_TURN_RATE = 1.4; // at/above NORMAL_TOP_SPEED
const DRIFT_TURN_ASSIST = 1.2;
const NORMAL_GRIP = 24;
const DRIFT_GRIP = 8;

const MPH_PER_UNIT = 8; // cosmetic scale for the speedometer readout only

function moveToward(current: number, target: number, maxDelta: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

function gearForSpeed(speed: number): { index: number; accel: number } {
  for (let i = 0; i < GEARS.length; i++) {
    if (speed < GEARS[i].ceiling) return { index: i + 1, accel: GEARS[i].accel };
  }
  const top = GEARS[GEARS.length - 1];
  return { index: GEARS.length, accel: top.accel };
}

const _quat = new THREE.Quaternion();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();

export class Car {
  readonly group: THREE.Group;

  private body: RAPIER.RigidBody;
  private wheels: THREE.Object3D[];
  private wheelRadius: number;
  private forwardSpeed = 0;
  private gearIndex = 1;
  private spawnHeight: number;

  private constructor(
    world: RAPIER.World,
    model: THREE.Object3D,
    wheels: THREE.Object3D[],
    wheelRadius: number,
    colliderHalfExtents: THREE.Vector3,
    colliderCenter: THREE.Vector3,
    spawnHeight: number,
  ) {
    this.group = new THREE.Group();
    this.group.add(model);
    this.wheels = wheels;
    this.wheelRadius = wheelRadius;
    this.spawnHeight = spawnHeight;

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, spawnHeight, 0)
      .enabledRotations(false, true, false)
      .setLinearDamping(0.5)
      .setAngularDamping(4);
    this.body = world.createRigidBody(bodyDesc);

    // Friction is zero because applyControls implements grip itself (NORMAL_GRIP /
    // DRIFT_GRIP); contact friction on top would fight the drive model every step.
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      colliderHalfExtents.x,
      colliderHalfExtents.y,
      colliderHalfExtents.z,
    )
      .setTranslation(colliderCenter.x, colliderCenter.y, colliderCenter.z)
      .setFriction(0)
      .setRestitution(0.1);
    world.createCollider(colliderDesc, this.body);
  }

  static async create(world: RAPIER.World): Promise<Car> {
    const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
    const model = gltf.scene;

    const wheels = WHEEL_NAMES.map((name) => {
      const wheel = model.getObjectByName(name);
      if (!wheel) throw new Error(`Car model missing expected node: ${name}`);
      return wheel;
    });

    const wheelBox = new THREE.Box3().setFromObject(wheels[0]);
    const wheelRadius = wheelBox.getSize(new THREE.Vector3()).y / 2;

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // Model is authored with wheel-bottom at y ~= 0; lift the body so the
    // lowest point of the bounding box rests just above the ground plane.
    const spawnHeight = -box.min.y + 0.02;

    return new Car(world, model, wheels, wheelRadius, size.multiplyScalar(0.5), center, spawnHeight);
  }

  applyControls(input: InputManager, dt: number): void {
    const rotation = this.body.rotation();
    _quat.set(rotation.x, rotation.y, rotation.z, rotation.w);
    _forward.set(0, 0, 1).applyQuaternion(_quat);
    _right.set(1, 0, 0).applyQuaternion(_quat);

    const linvel = this.body.linvel();
    const forwardSpeed = linvel.x * _forward.x + linvel.z * _forward.z;
    const lateralSpeed = linvel.x * _right.x + linvel.z * _right.z;

    let targetForwardSpeed = 0;
    let accel = COAST_DECEL;
    if (input.forward) {
      const gear = gearForSpeed(forwardSpeed);
      if (input.boost) {
        targetForwardSpeed = BOOST_TOP_SPEED;
        accel = forwardSpeed < NORMAL_TOP_SPEED ? gear.accel : BOOST_ACCEL;
      } else {
        targetForwardSpeed = NORMAL_TOP_SPEED;
        accel = gear.accel;
      }
    } else if (input.back) {
      targetForwardSpeed = -REVERSE_SPEED;
      accel = REVERSE_ACCEL;
    }
    this.forwardSpeed = moveToward(forwardSpeed, targetForwardSpeed, accel * dt);
    this.gearIndex = this.forwardSpeed < -0.5 ? 0 : gearForSpeed(Math.abs(this.forwardSpeed)).index;

    const grip = input.handbrake ? DRIFT_GRIP : NORMAL_GRIP;
    const newLateralSpeed = moveToward(lateralSpeed, 0, grip * dt);

    this.body.setLinvel(
      {
        x: _forward.x * this.forwardSpeed + _right.x * newLateralSpeed,
        y: linvel.y,
        z: _forward.z * this.forwardSpeed + _right.z * newLateralSpeed,
      },
      true,
    );

    let turnInput = 0;
    if (input.left) turnInput += 1;
    if (input.right) turnInput -= 1;
    const speedFactor = Math.min(Math.abs(forwardSpeed) / NORMAL_TOP_SPEED, 1);
    let turnRate = MAX_TURN_RATE + (MIN_TURN_RATE - MAX_TURN_RATE) * speedFactor;
    if (input.handbrake && turnInput !== 0) turnRate += DRIFT_TURN_ASSIST;
    this.body.setAngvel({ x: 0, y: turnInput * turnRate, z: 0 }, true);
  }

  get speedMph(): number {
    return Math.abs(this.forwardSpeed) * MPH_PER_UNIT;
  }

  get gearLabel(): string {
    return this.gearIndex === 0 ? 'R' : String(this.gearIndex);
  }

  respawn(): void {
    this.body.setTranslation({ x: 0, y: this.spawnHeight, z: 0 }, true);
    this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.forwardSpeed = 0;
    this.gearIndex = 1;
  }

  syncFromPhysics(dt: number): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);

    const spin = (this.forwardSpeed / this.wheelRadius) * dt;
    for (const wheel of this.wheels) {
      wheel.rotation.x += spin;
    }
  }
}
