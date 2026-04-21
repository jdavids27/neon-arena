import * as THREE from 'three';

const REST_POS = new THREE.Vector3(0.22, -0.22, -0.55);
const KICK_OFFSET = new THREE.Vector3(0, 0.015, 0.09);
const RECOVER_RATE = 14;

export function createViewmodel(camera) {
  const root = new THREE.Group();
  root.position.copy(REST_POS);
  camera.add(root);

  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.14, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0x15202e,
      roughness: 0.7,
      metalness: 0.4,
      emissive: 0x0a1a2a,
      emissiveIntensity: 0.4,
    }),
  );
  grip.position.set(0, -0.04, 0.04);
  grip.rotation.x = -0.18;
  root.add(grip);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.07, 0.22),
    new THREE.MeshStandardMaterial({
      color: 0x18263a,
      roughness: 0.6,
      metalness: 0.5,
      emissive: 0x0a1a2a,
      emissiveIntensity: 0.5,
    }),
  );
  body.position.set(0, 0.04, -0.02);
  root.add(body);

  const barrelTip = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.045, 0.04),
    new THREE.MeshBasicMaterial({ color: 0x38f9ff }),
  );
  barrelTip.position.set(0, 0.04, -0.14);
  root.add(barrelTip);

  const muzzleWorld = new THREE.Vector3();
  function getMuzzleWorldPosition(out = muzzleWorld) {
    barrelTip.getWorldPosition(out);
    return out;
  }

  let kick = 0;

  function kickImpulse() {
    kick = 1;
  }

  const offset = new THREE.Vector3();
  function update(dt) {
    kick = Math.max(0, kick - RECOVER_RATE * dt);
    offset.copy(KICK_OFFSET).multiplyScalar(kick);
    root.position.copy(REST_POS).add(offset);
  }

  return { root, barrelTip, getMuzzleWorldPosition, kickImpulse, update };
}
