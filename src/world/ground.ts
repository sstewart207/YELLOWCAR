import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const GROUND_SIZE = 100;
const GROUND_THICKNESS = 0.2;

export function createGround(world: RAPIER.World): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
  const material = new THREE.MeshLambertMaterial({ color: 0x7fbf5f });
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;

  const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -GROUND_THICKNESS / 2, 0);
  const body = world.createRigidBody(bodyDesc);
  // Friction is zero to match the car's collider: applyControls' drivetrain/grip
  // model IS the friction. Rapier's default nonzero collider friction would
  // otherwise blend in via the contact's friction-combine rule and silently
  // oppose the drive model, capping top speed below what the drivetrain math
  // intends (the car collider was already fixed this way; the ground was missed).
  const colliderDesc = RAPIER.ColliderDesc.cuboid(GROUND_SIZE / 2, GROUND_THICKNESS / 2, GROUND_SIZE / 2).setFriction(
    0,
  );
  world.createCollider(colliderDesc, body);

  return ground;
}
