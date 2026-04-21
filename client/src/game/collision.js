import * as THREE from 'three';

export const PLAYER = {
  radius: 0.4,
  height: 1.7,
  eyeHeight: 1.7,
};

export function playerAABB(position) {
  return {
    min: new THREE.Vector3(
      position.x - PLAYER.radius,
      position.y - PLAYER.eyeHeight,
      position.z - PLAYER.radius,
    ),
    max: new THREE.Vector3(
      position.x + PLAYER.radius,
      position.y,
      position.z + PLAYER.radius,
    ),
  };
}

export function intersects(a, b) {
  return (
    a.min.x < b.max.x && a.max.x > b.min.x &&
    a.min.y < b.max.y && a.max.y > b.min.y &&
    a.min.z < b.max.z && a.max.z > b.min.z
  );
}

export function resolveMove(position, velocity, dt, colliders) {
  const step = new THREE.Vector3(
    velocity.x * dt,
    velocity.y * dt,
    velocity.z * dt,
  );

  let grounded = false;

  position.x += step.x;
  if (collides(position, colliders)) {
    position.x -= step.x;
    velocity.x = 0;
  }

  position.z += step.z;
  if (collides(position, colliders)) {
    position.z -= step.z;
    velocity.z = 0;
  }

  position.y += step.y;
  if (collides(position, colliders)) {
    position.y -= step.y;
    if (velocity.y < 0) grounded = true;
    velocity.y = 0;
  }

  if (position.y - PLAYER.eyeHeight <= 0) {
    position.y = PLAYER.eyeHeight;
    if (velocity.y < 0) velocity.y = 0;
    grounded = true;
  }

  return { grounded };
}

function collides(position, colliders) {
  const a = playerAABB(position);
  for (const b of colliders) {
    if (intersects(a, b)) return true;
  }
  return false;
}
