import * as THREE from 'three';

const HALF_STRAIGHT = 12;
const TURN_RADIUS = 8;
const ROAD_HALF_WIDTH = 3;
const OUTER_RADIUS = TURN_RADIUS + ROAD_HALF_WIDTH;
const INNER_RADIUS = TURN_RADIUS - ROAD_HALF_WIDTH;
// Shifts the whole track so its near straight passes through world z = 0,
// putting the car's spawn point right on the road surface.
const CENTER_Z = TURN_RADIUS;

const CURB_SPACING = 1.5;
const CURB_SIZE = { x: 0.7, y: 0.15, z: 0.35 };

// Traces a stadium (rounded-rectangle) boundary of the given radius into a
// Shape/Path: two straights of length 2*halfStraight joined by two semicircles.
// Used for both the outer edge and, at a smaller radius, the inner hole, so a
// single call site produces the road ring.
function traceStadium(path: THREE.Shape | THREE.Path, halfStraight: number, radius: number): void {
  path.moveTo(halfStraight, radius);
  path.lineTo(-halfStraight, radius);
  path.absarc(-halfStraight, 0, radius, Math.PI / 2, (3 * Math.PI) / 2, false);
  path.lineTo(halfStraight, -radius);
  path.absarc(halfStraight, 0, radius, -Math.PI / 2, Math.PI / 2, false);
  path.closePath();
}

function createRoadSurface(): THREE.Mesh {
  const shape = new THREE.Shape();
  traceStadium(shape, HALF_STRAIGHT, OUTER_RADIUS);
  const hole = new THREE.Path();
  traceStadium(hole, HALF_STRAIGHT, INNER_RADIUS);
  shape.holes.push(hole);

  const geometry = new THREE.ShapeGeometry(shape, 48);
  const material = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.01, CENTER_Z);
  return mesh;
}

// Parameterizes a stadium boundary of the given radius by arc-length fraction
// t in [0, 1), in world space, plus the heading of travel at that point (for
// orienting curb markers tangent to the track).
function stadiumPoint(t: number, radius: number): { x: number; z: number; heading: number } {
  const straightLen = 2 * HALF_STRAIGHT;
  const arcLen = Math.PI * radius;
  const perimeter = 2 * straightLen + 2 * arcLen;
  let s = t * perimeter;

  if (s < straightLen) {
    return { x: HALF_STRAIGHT - s, z: radius + CENTER_Z, heading: Math.PI };
  }
  s -= straightLen;

  if (s < arcLen) {
    const angle = Math.PI / 2 + s / radius;
    return {
      x: -HALF_STRAIGHT + radius * Math.cos(angle),
      z: radius * Math.sin(angle) + CENTER_Z,
      heading: Math.atan2(Math.cos(angle), -Math.sin(angle)),
    };
  }
  s -= arcLen;

  if (s < straightLen) {
    return { x: -HALF_STRAIGHT + s, z: -radius + CENTER_Z, heading: 0 };
  }
  s -= straightLen;

  const angle = -Math.PI / 2 + s / radius;
  return {
    x: HALF_STRAIGHT + radius * Math.cos(angle),
    z: radius * Math.sin(angle) + CENTER_Z,
    heading: Math.atan2(Math.cos(angle), -Math.sin(angle)),
  };
}

function createCurbs(radius: number): THREE.InstancedMesh[] {
  const perimeter = 4 * HALF_STRAIGHT + 2 * Math.PI * radius;
  const count = Math.round(perimeter / CURB_SPACING);
  const geometry = new THREE.BoxGeometry(CURB_SIZE.x, CURB_SIZE.y, CURB_SIZE.z);

  const redMesh = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshLambertMaterial({ color: 0xd23c3c }),
    Math.ceil(count / 2),
  );
  const whiteMesh = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }),
    Math.ceil(count / 2),
  );

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  let redIndex = 0;
  let whiteIndex = 0;

  for (let i = 0; i < count; i++) {
    const { x, z, heading } = stadiumPoint(i / count, radius);
    position.set(x, CURB_SIZE.y / 2, z);
    quaternion.setFromAxisAngle(up, heading);
    matrix.compose(position, quaternion, scale);

    if (i % 2 === 0) redMesh.setMatrixAt(redIndex++, matrix);
    else whiteMesh.setMatrixAt(whiteIndex++, matrix);
  }

  redMesh.count = redIndex;
  whiteMesh.count = whiteIndex;
  return [redMesh, whiteMesh];
}

export function createTrack(): THREE.Object3D[] {
  return [createRoadSurface(), ...createCurbs(OUTER_RADIUS), ...createCurbs(INNER_RADIUS)];
}
