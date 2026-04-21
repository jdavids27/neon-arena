import * as THREE from 'three';

const MAX_AMMO = 3;
const FIRE_RATE = 1.2;
const ROCKET_SPEED = 48;
const ROCKET_RADIUS = 0.16;
const ROCKET_LIFETIME = 3.5;
const EXPLOSION_RADIUS = 3.8;
const RANGE = 140;

export function createRocketLauncher({ camera, viewmodel, effects, hud, sound, scene, domElement, remotePlayers, onFire = null }) {
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const stepVec = new THREE.Vector3();
  const prevPos = new THREE.Vector3();

  let ammo = MAX_AMMO;
  let cooldown = 0;
  let firingHeld = false;
  let active = false;
  const rockets = [];

  domElement.addEventListener('mousedown', (e) => {
    if (e.button === 0) firingHeld = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) firingHeld = false;
  });

  function spawnRocket() {
    camera.getWorldPosition(origin);
    camera.getWorldDirection(dir);

    const muzzle = viewmodel.getMuzzleWorldPosition().clone();
    effects.spawnMuzzleFlash(muzzle);
    sound?.playFire();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2a0a0a,
      emissive: 0xff6020,
      emissiveIntensity: 1.6,
      roughness: 0.4,
      metalness: 0.5,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(ROCKET_RADIUS, ROCKET_RADIUS, 0.5, 10), bodyMat);
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(ROCKET_RADIUS, 0.22, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff0a0 }),
    );
    tip.position.y = 0.36;
    body.add(tip);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(ROCKET_RADIUS * 1.1, 0.6, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    flame.position.y = -0.45;
    flame.rotation.x = Math.PI;
    body.add(flame);

    const light = new THREE.PointLight(0xff9040, 6, 8, 2);
    body.add(light);

    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    body.quaternion.copy(q);
    body.position.copy(muzzle);
    scene.add(body);

    rockets.push({
      mesh: body,
      position: body.position,
      velocity: dir.clone().multiplyScalar(ROCKET_SPEED),
      muzzle: muzzle.clone(),
      life: ROCKET_LIFETIME,
      detonated: false,
      materials: [bodyMat, tip.material, flame.material],
    });
  }

  function fire() {
    if (ammo <= 0) return;
    ammo -= 1;
    cooldown = 1 / FIRE_RATE;
    hud.setAmmo(ammo, MAX_AMMO);
    viewmodel.kickImpulse();
    spawnRocket();
  }

  function disposeRocket(r) {
    scene.remove(r.mesh);
    for (const m of r.materials) m.dispose?.();
    r.mesh.traverse?.((obj) => {
      if (obj.geometry) obj.geometry.dispose();
    });
  }

  function detonate(r, hitPos, raycastables, directRemoteId = null) {
    if (r.detonated) return;
    r.detonated = true;

    effects.spawnExplosion(hitPos, EXPLOSION_RADIUS);
    sound?.playExplosion();

    let hitId = directRemoteId;
    if (!hitId) {
      let minDist = Infinity;
      const remotes = remotePlayers?.getAll?.() || [];
      for (const p of remotes) {
        const bodyPos = new THREE.Vector3();
        p.body.getWorldPosition(bodyPos);
        const d = bodyPos.distanceTo(hitPos);
        if (d <= EXPLOSION_RADIUS && d < minDist) {
          minDist = d;
          hitId = p.id;
        }
      }
    }

    if (onFire) {
      onFire({
        o: { x: r.muzzle.x, y: r.muzzle.y, z: r.muzzle.z },
        d: null,
        m: { x: r.muzzle.x, y: r.muzzle.y, z: r.muzzle.z },
        h: { x: hitPos.x, y: hitPos.y, z: hitPos.z },
        hitId,
        explosive: true,
      });
    }
  }

  function stepRocket(r, dt, raycastables) {
    prevPos.copy(r.position);
    stepVec.copy(r.velocity).multiplyScalar(dt);
    const stepLen = stepVec.length();
    if (stepLen <= 0) return;
    const stepDir = stepVec.clone().normalize();

    raycaster.set(prevPos, stepDir);
    raycaster.far = stepLen + ROCKET_RADIUS;

    const candidates = raycastables;
    const hits = raycaster.intersectObjects(candidates, false);
    let hitPoint = null;
    let hitRemoteId = null;
    if (hits.length > 0) {
      hitPoint = hits[0].point.clone();
      hitRemoteId = hits[0].object.userData.remoteId || null;
    }

    if (!hitPoint) {
      const remotes = remotePlayers?.getAll?.() || [];
      for (const p of remotes) {
        const toP = p.position.clone().sub(prevPos);
        const t = toP.dot(stepDir);
        if (t < 0 || t > stepLen) continue;
        const closest = prevPos.clone().add(stepDir.clone().multiplyScalar(t));
        if (closest.distanceTo(p.position) <= 0.7) {
          hitPoint = closest;
          hitRemoteId = p.id;
          break;
        }
      }
    }

    if (hitPoint) {
      r.position.copy(hitPoint);
      r.mesh.position.copy(hitPoint);
      detonate(r, hitPoint, candidates, hitRemoteId);
      return;
    }

    r.position.add(stepVec);
    r.mesh.position.copy(r.position);
  }

  function update(dt, raycastables) {
    if (cooldown > 0) cooldown -= dt;
    if (active && firingHeld && cooldown <= 0 && ammo > 0) fire();

    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      if (!r.detonated) stepRocket(r, dt, raycastables);
      r.life -= dt;
      if (r.detonated || r.life <= 0) {
        disposeRocket(r);
        rockets.splice(i, 1);
      }
    }
  }

  function setActive(a) {
    active = !!a;
    if (active) hud.setAmmo(ammo, MAX_AMMO);
  }

  function refill() {
    ammo = MAX_AMMO;
    if (active) hud.setAmmo(ammo, MAX_AMMO);
  }

  return { update, setActive, refill, get ammo() { return ammo; }, MAX_AMMO };
}
