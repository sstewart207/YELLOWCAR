import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { InputManager } from '../core/input';

const MODEL_URL = '/models/taxi.glb';
const WHEEL_NAMES = ['wheel-front-right', 'wheel-front-left', 'wheel-back-left', 'wheel-back-right'];

// Real drivetrain model: engine torque curve (RPM -> torque) x gear ratio x
// final drive / wheel radius = drive force; F = m*a. Top speed emerges from
// where drive force equals aerodynamic drag, rather than being hard-capped.
const VEHICLE_MASS = 1200;
const TORQUE_CURVE: [rpm: number, torque: number][] = [
  [800, 380],
  [2000, 520],
  [4000, 620],
  [5500, 560],
  [6800, 420],
  [7500, 150],
];
const IDLE_RPM = TORQUE_CURVE[0][0];
const SHIFT_UP_RPM = 6800;
const SHIFT_DOWN_RPM = 3200; // gap below SHIFT_UP_RPM prevents gear hunting at the boundary
const GEAR_RATIOS = [2.8, 1.9, 1.35, 1.0];
const FINAL_DRIVE = 20;
const TRANSMISSION_EFFICIENCY = 0.9;
const BOOST_TORQUE_MULT = 1.5;
// Traction-limited launch cap: real tires can't transmit unlimited torque to
// the road either, so raw low-gear force is clamped rather than left to
// produce an instant, wheel-spinning jump to full accel.
const MAX_FORWARD_ACCEL = 14;

const DRAG_COEFF = 64; // aerodynamic drag: opposing force = DRAG_COEFF * v^2
const ROLL_RESISTANCE = 100; // constant resistance whenever moving, on top of drag
const REVERSE_FORCE = 1100;
const BRAKE_DECEL = 20; // direct deceleration toward a stop; never overshoots into reverse

const MAX_TURN_RATE = 3.2; // at a standstill
const MIN_TURN_RATE = 1.4; // at/above TURN_TAPER_SPEED
const TURN_TAPER_SPEED = 12; // roughly the unboosted top speed
const DRIFT_TURN_ASSIST = 1.2;
const NORMAL_GRIP = 24;
const DRIFT_GRIP = 8;

const MPH_PER_UNIT = 8; // cosmetic scale for the speedometer readout only

function moveToward(current: number, target: number, maxDelta: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

function lookupTorque(rpm: number): number {
  const clamped = Math.max(TORQUE_CURVE[0][0], Math.min(rpm, TORQUE_CURVE[TORQUE_CURVE.length - 1][0]));
  for (let i = 0; i < TORQUE_CURVE.length - 1; i++) {
    const [rpmA, torqueA] = TORQUE_CURVE[i];
    const [rpmB, torqueB] = TORQUE_CURVE[i + 1];
    if (clamped <= rpmB) {
      const t = (clamped - rpmA) / (rpmB - rpmA);
      return torqueA + (torqueB - torqueA) * t;
    }
  }
  return TORQUE_CURVE[TORQUE_CURVE.length - 1][1];
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
  private gear = 1;
  private engineRpm = IDLE_RPM;
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
      // No linear damping: applyControls owns forward/lateral speed outright every
      // frame (drivetrain force model + explicit grip decay). Any damping here
      // silently fights that model at high speed/low accel, capping top speed well
      // below what the drivetrain math intends (this bit us once already).
      .setLinearDamping(0)
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
      .setRestitution(0.1)
      .setMass(VEHICLE_MASS);
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

    // Gearbox tracks current wheel speed continuously, like an automatic
    // transmission, independent of whether the throttle is currently held —
    // so it keeps shifting appropriately through coasting or braking too.
    const wheelAngularSpeed = Math.abs(forwardSpeed) / this.wheelRadius;
    this.engineRpm = Math.max(
      IDLE_RPM,
      wheelAngularSpeed * GEAR_RATIOS[this.gear - 1] * FINAL_DRIVE * (60 / (2 * Math.PI)),
    );
    if (this.engineRpm > SHIFT_UP_RPM && this.gear < GEAR_RATIOS.length) this.gear++;
    else if (this.engineRpm < SHIFT_DOWN_RPM && this.gear > 1) this.gear--;

    let nextForwardSpeed: number;
    if (input.back && forwardSpeed > 0.1) {
      // Braking: strong direct deceleration toward a stop, never overshoots into reverse.
      nextForwardSpeed = moveToward(forwardSpeed, 0, BRAKE_DECEL * dt);
    } else {
      let netForce = 0;
      if (input.forward) {
        const torque = lookupTorque(this.engineRpm) * (input.boost ? BOOST_TORQUE_MULT : 1);
        netForce += (torque * GEAR_RATIOS[this.gear - 1] * FINAL_DRIVE * TRANSMISSION_EFFICIENCY) / this.wheelRadius;
      } else if (input.back) {
        netForce -= REVERSE_FORCE;
      }
      if (Math.abs(forwardSpeed) > 0.001) {
        netForce -= Math.sign(forwardSpeed) * (DRAG_COEFF * forwardSpeed * forwardSpeed + ROLL_RESISTANCE);
      }
      let accel = netForce / VEHICLE_MASS;
      if (input.forward) accel = Math.min(accel, MAX_FORWARD_ACCEL);
      nextForwardSpeed = forwardSpeed + accel * dt;
      if (!input.forward && !input.back && Math.sign(nextForwardSpeed) !== Math.sign(forwardSpeed)) {
        nextForwardSpeed = 0;
      }
    }
    this.forwardSpeed = nextForwardSpeed;

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
    const speedFactor = Math.min(Math.abs(forwardSpeed) / TURN_TAPER_SPEED, 1);
    let turnRate = MAX_TURN_RATE + (MIN_TURN_RATE - MAX_TURN_RATE) * speedFactor;
    if (input.handbrake && turnInput !== 0) turnRate += DRIFT_TURN_ASSIST;
    this.body.setAngvel({ x: 0, y: turnInput * turnRate, z: 0 }, true);
  }

  get speedMph(): number {
    return Math.abs(this.forwardSpeed) * MPH_PER_UNIT;
  }

  get gearLabel(): string {
    return this.forwardSpeed < -0.5 ? 'R' : String(this.gear);
  }

  respawn(): void {
    this.body.setTranslation({ x: 0, y: this.spawnHeight, z: 0 }, true);
    this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.forwardSpeed = 0;
    this.gear = 1;
    this.engineRpm = IDLE_RPM;
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
