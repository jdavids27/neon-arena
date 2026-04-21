import * as THREE from 'three';

const MAX_AMMO = 20;
const FIRE_RATE = 6;
const RELOAD_TIME = 0.9;
const DAMAGE = 25;
const RANGE = 120;

export function createWeapon({ camera, viewmodel, effects, hud, domElement, sound = null, onFire = null }) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = RANGE;
  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const hitPoint = new THREE.Vector3();

  let ammo = MAX_AMMO;
  let cooldown = 0;
  let reloading = 0;
  let firingHeld = false;
  let active = true;

  domElement.addEventListener('mousedown', (e) => {
    if (e.button === 0) firingHeld = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) firingHeld = false;
  });
  window.addEventListener('keydown', (e) => {
    if (active && e.code === 'KeyR') startReload();
  });

  hud.setAmmo(ammo, MAX_AMMO);

  function startReload() {
    if (reloading > 0 || ammo >= MAX_AMMO) return;
    reloading = RELOAD_TIME;
    hud.setReloading(true);
    sound?.playReload();
  }

  function finishReload() {
    ammo = MAX_AMMO;
    hud.setAmmo(ammo, MAX_AMMO);
    hud.setReloading(false);
  }

  function fire(raycastables) {
    ammo -= 1;
    cooldown = 1 / FIRE_RATE;
    hud.setAmmo(ammo, MAX_AMMO);
    viewmodel.kickImpulse();

    camera.getWorldPosition(origin);
    camera.getWorldDirection(dir);

    raycaster.set(origin, dir);
    const hits = raycaster.intersectObjects(raycastables, false);

    const muzzle = viewmodel.getMuzzleWorldPosition().clone();
    effects.spawnMuzzleFlash(muzzle);
    sound?.playFire();

    let hitVec = null;
    let hitRemoteId = null;
    if (hits.length > 0) {
      const first = hits[0];
      hitPoint.copy(first.point);
      hitVec = hitPoint.clone();
      effects.spawnTracer(muzzle, hitPoint);

      const target = first.object.userData.target;
      const remoteId = first.object.userData.remoteId;
      if (target && target.alive) {
        effects.spawnImpact(hitPoint, 0xff3ad6);
        target.hit(DAMAGE, hitPoint);
        hud.flashHit(target.hp <= 0);
      } else if (remoteId) {
        hitRemoteId = remoteId;
        effects.spawnImpact(hitPoint, 0xff3ad6);
        hud.flashHit(false);
        sound?.playHit();
      } else {
        effects.spawnImpact(hitPoint, 0x38f9ff);
      }
    } else {
      const far = origin.clone().add(dir.clone().multiplyScalar(RANGE));
      effects.spawnTracer(muzzle, far);
    }

    if (onFire) {
      onFire({
        o: { x: origin.x, y: origin.y, z: origin.z },
        d: { x: dir.x, y: dir.y, z: dir.z },
        m: { x: muzzle.x, y: muzzle.y, z: muzzle.z },
        h: hitVec ? { x: hitVec.x, y: hitVec.y, z: hitVec.z } : null,
        hitId: hitRemoteId,
      });
    }

    if (ammo <= 0) startReload();
  }

  function update(dt, raycastables) {
    if (reloading > 0) {
      reloading -= dt;
      if (reloading <= 0) finishReload();
    }
    if (cooldown > 0) cooldown -= dt;

    if (active && firingHeld && cooldown <= 0 && reloading <= 0 && ammo > 0) {
      fire(raycastables);
    }

    viewmodel.update(dt);
  }

  function setActive(a) {
    active = !!a;
    if (active) hud.setAmmo(ammo, MAX_AMMO);
  }

  return { update, startReload, setActive, get ammo() { return ammo; }, MAX_AMMO };
}
