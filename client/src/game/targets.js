import * as THREE from 'three';

const MAX_HP = 100;
const RESPAWN_DELAY = 2.5;
const NEON_COLORS = [0xff3ad6, 0x38f9ff, 0x7a5bff];

const TARGET_POSITIONS = [
  { x: 8, z: 12 },
  { x: -8, z: 12 },
  { x: 8, z: -12 },
  { x: -8, z: -12 },
  { x: 16, z: 0 },
  { x: -16, z: 0 },
];

export function createTargets(scene, effects, raycastables) {
  const targets = TARGET_POSITIONS.map((pos, i) =>
    makeTarget(scene, effects, raycastables, pos, NEON_COLORS[i % NEON_COLORS.length]),
  );

  function update(dt) {
    for (const t of targets) t.update(dt);
  }

  function activeCount() {
    return targets.filter((t) => t.alive).length;
  }

  return { update, targets, activeCount };
}

function makeTarget(scene, effects, raycastables, pos, color) {
  const group = new THREE.Group();
  group.position.set(pos.x, 0, pos.z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f1a,
    roughness: 0.55,
    metalness: 0.3,
    emissive: color,
    emissiveIntensity: 0.45,
  });

  const limbMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f1a,
    roughness: 0.6,
    metalness: 0.25,
    emissive: color,
    emissiveIntensity: 0.35,
  });

  const headMat = new THREE.MeshStandardMaterial({
    color: 0x080a12,
    emissive: color,
    emissiveIntensity: 0.85,
    roughness: 0.3,
    metalness: 0.5,
  });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.75, 6, 12), bodyMat);
  torso.position.y = 1.35;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), headMat);
  head.position.y = 2.02;
  group.add(head);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.08, 0.02),
    new THREE.MeshBasicMaterial({ color }),
  );
  visor.position.set(0, 2.04, 0.21);
  group.add(visor);

  const leftArm = new THREE.Group();
  leftArm.position.set(0.38, 1.72, 0);
  const leftArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.6, 4, 8), limbMat);
  leftArmMesh.position.y = -0.35;
  leftArm.add(leftArmMesh);
  group.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(-0.38, 1.72, 0);
  const rightArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.6, 4, 8), limbMat);
  rightArmMesh.position.y = -0.35;
  rightArm.add(rightArmMesh);
  group.add(rightArm);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(0.16, 0.9, 0);
  const leftLegMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.7, 4, 8), limbMat);
  leftLegMesh.position.y = -0.4;
  leftLeg.add(leftLegMesh);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(-0.16, 0.9, 0);
  const rightLegMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.7, 4, 8), limbMat);
  rightLegMesh.position.y = -0.4;
  rightLeg.add(rightLegMesh);
  group.add(rightLeg);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.03, 8, 24),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.position.y = 0.04;
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  const hitMeshes = [torso, head, leftArmMesh, rightArmMesh, leftLegMesh, rightLegMesh];
  for (const m of hitMeshes) raycastables.push(m);

  const bobPhase = (pos.x + pos.z) * 0.37;
  const impactPoint = new THREE.Vector3();
  const torsoBaseY = torso.position.y;
  const headBaseY = head.position.y;
  const visorBaseY = visor.position.y;

  const state = {
    alive: true,
    hp: MAX_HP,
    respawnTimer: 0,
    hitFlash: 0,
    mesh: torso,
    group,
    color,

    hit(damage) {
      if (!this.alive) return;
      this.hp -= damage;
      this.hitFlash = 0.15;
      if (this.hp <= 0) this.die();
    },

    die() {
      this.alive = false;
      this.respawnTimer = RESPAWN_DELAY;
      group.visible = false;
      for (const m of hitMeshes) removeFromArray(raycastables, m);
      torso.getWorldPosition(impactPoint);
      for (let i = 0; i < 6; i++) {
        effects.spawnImpact(
          impactPoint.clone().add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 1.4,
              Math.random() * 1.4,
              (Math.random() - 0.5) * 1.4,
            ),
          ),
          color,
        );
      }
    },

    respawn() {
      this.alive = true;
      this.hp = MAX_HP;
      this.hitFlash = 0;
      group.visible = true;
      bodyMat.emissiveIntensity = 0.45;
      for (const m of hitMeshes) raycastables.push(m);
    },

    update(dt) {
      if (!this.alive) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) this.respawn();
        return;
      }
      if (this.hitFlash > 0) {
        this.hitFlash = Math.max(0, this.hitFlash - dt);
        const k = this.hitFlash / 0.15;
        bodyMat.emissiveIntensity = 0.45 + k * 1.6;
      }
      group.rotation.y += dt * 0.35;
      const t = performance.now() * 0.002 + bobPhase;
      const bob = Math.sin(t) * 0.05;
      torso.position.y = torsoBaseY + bob;
      head.position.y = headBaseY + bob;
      visor.position.y = visorBaseY + bob;
      leftArm.rotation.x = Math.sin(t * 0.9) * 0.18;
      rightArm.rotation.x = Math.sin(t * 0.9 + Math.PI) * 0.18;
    },
  };

  for (const m of hitMeshes) m.userData.target = state;

  return state;
}

function removeFromArray(arr, item) {
  const i = arr.indexOf(item);
  if (i >= 0) arr.splice(i, 1);
}
