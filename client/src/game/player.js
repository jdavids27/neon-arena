import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { resolveMove, PLAYER } from './collision.js';

const MOVE = {
  walkSpeed: 6,
  sprintMult: 1.55,
  accel: 60,
  airAccel: 12,
  friction: 10,
  jumpVel: 7.2,
  gravity: -22,
};

export function createPlayer({ camera, domElement, scene, input, spawn }) {
  const controls = new PointerLockControls(camera, domElement);
  scene.add(controls.getObject());

  const object = controls.getObject();
  object.position.copy(spawn);

  const velocity = new THREE.Vector3();
  let grounded = false;
  let wantJump = false;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') wantJump = true;
  });

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();

  function update(dt, colliders) {
    const locked = controls.isLocked;

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.copy(forward).cross(camera.up).normalize();

    wish.set(0, 0, 0);
    if (locked) {
      if (input.isAny('KeyW', 'ArrowUp')) wish.add(forward);
      if (input.isAny('KeyS', 'ArrowDown')) wish.sub(forward);
      if (input.isAny('KeyD', 'ArrowRight')) wish.add(right);
      if (input.isAny('KeyA', 'ArrowLeft')) wish.sub(right);
    }

    const sprinting = locked && input.isAny('ShiftLeft', 'ShiftRight');
    const targetSpeed = (sprinting ? MOVE.walkSpeed * MOVE.sprintMult : MOVE.walkSpeed);

    if (wish.lengthSq() > 0) {
      wish.normalize().multiplyScalar(targetSpeed);
      const accel = grounded ? MOVE.accel : MOVE.airAccel;
      approach2D(velocity, wish, accel * dt);
    } else if (grounded) {
      applyFriction2D(velocity, MOVE.friction * dt);
    }

    if (grounded && wantJump && locked) {
      velocity.y = MOVE.jumpVel;
      grounded = false;
    }
    wantJump = false;

    velocity.y += MOVE.gravity * dt;

    const res = resolveMove(object.position, velocity, dt, colliders);
    grounded = res.grounded;
  }

  return {
    controls,
    object,
    update,
    get position() { return object.position; },
    get isLocked() { return controls.isLocked; },
  };
}

function approach2D(v, target, maxDelta) {
  const dx = target.x - v.x;
  const dz = target.z - v.z;
  const d = Math.hypot(dx, dz);
  if (d <= maxDelta || d < 1e-6) {
    v.x = target.x;
    v.z = target.z;
    return;
  }
  const k = maxDelta / d;
  v.x += dx * k;
  v.z += dz * k;
}

function applyFriction2D(v, drop) {
  const speed = Math.hypot(v.x, v.z);
  if (speed < 1e-5) {
    v.x = 0; v.z = 0;
    return;
  }
  const newSpeed = Math.max(0, speed - drop);
  const k = newSpeed / speed;
  v.x *= k;
  v.z *= k;
}

export { PLAYER };
