export function createHud() {
  const crosshair = document.getElementById('crosshair');
  const ammoEl = document.getElementById('ammo');
  const reloadEl = document.getElementById('reload');
  const weaponEl = document.getElementById('weapon');

  let hitFlashTimer = 0;
  let killFlash = false;

  function setAmmo(ammo, max) {
    if (ammoEl) ammoEl.textContent = `${ammo} / ${max}`;
  }

  function setReloading(active) {
    if (reloadEl) reloadEl.classList.toggle('visible', active);
  }

  function setWeapon(label) {
    if (weaponEl) weaponEl.textContent = label;
  }

  function flashHit(isKill) {
    hitFlashTimer = isKill ? 0.35 : 0.16;
    killFlash = !!isKill;
    crosshair.classList.add('hit');
    if (isKill) crosshair.classList.add('kill');
  }

  function update(dt) {
    if (hitFlashTimer > 0) {
      hitFlashTimer -= dt;
      if (hitFlashTimer <= 0) {
        crosshair.classList.remove('hit');
        crosshair.classList.remove('kill');
        killFlash = false;
      }
    }
  }

  return { setAmmo, setReloading, setWeapon, flashHit, update };
}
