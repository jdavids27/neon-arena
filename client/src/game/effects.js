import * as THREE from 'three';

export function createEffects(scene) {
  const active = [];

  function spawnMuzzleFlash(position) {
    const flash = new THREE.PointLight(0x38f9ff, 6, 6, 2);
    flash.position.copy(position);
    scene.add(flash);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xdaffff, transparent: true, opacity: 1 }),
    );
    core.position.copy(position);
    scene.add(core);

    active.push({
      life: 0.08,
      maxLife: 0.08,
      update(t) {
        const k = t;
        flash.intensity = 6 * k;
        core.material.opacity = k;
        core.scale.setScalar(1 + (1 - k) * 1.6);
      },
      dispose() {
        scene.remove(flash);
        scene.remove(core);
        core.geometry.dispose();
        core.material.dispose();
      },
    });
  }

  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const mid = new THREE.Vector3();
  function spawnTracer(from, to) {
    dir.subVectors(to, from);
    const len = dir.length();
    if (len < 0.001) return;

    const geo = new THREE.CylinderGeometry(0.02, 0.02, len, 6, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9ff7ff,
      transparent: true,
      opacity: 0.9,
    });
    const cyl = new THREE.Mesh(geo, mat);

    mid.copy(from).add(to).multiplyScalar(0.5);
    cyl.position.copy(mid);

    const normDir = dir.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(up, normDir);
    cyl.quaternion.copy(q);

    scene.add(cyl);
    active.push({
      life: 0.1,
      maxLife: 0.1,
      update(t) {
        mat.opacity = t * 0.9;
      },
      dispose() {
        scene.remove(cyl);
        geo.dispose();
        mat.dispose();
      },
    });
  }

  function spawnImpact(position, color = 0xff3ad6) {
    const light = new THREE.PointLight(color, 3, 4, 2);
    light.position.copy(position);
    scene.add(light);

    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
    );
    spark.position.copy(position);
    scene.add(spark);

    active.push({
      life: 0.22,
      maxLife: 0.22,
      update(t) {
        light.intensity = 3 * t;
        spark.material.opacity = t;
        spark.scale.setScalar(1 + (1 - t) * 2);
      },
      dispose() {
        scene.remove(light);
        scene.remove(spark);
        spark.geometry.dispose();
        spark.material.dispose();
      },
    });
  }

  function spawnExplosion(position, radius = 3.5) {
    const light = new THREE.PointLight(0xffb060, 40, radius * 4, 1.8);
    light.position.copy(position);
    scene.add(light);

    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffe1a0,
      transparent: true,
      opacity: 1,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), coreMat);
    core.position.copy(position);
    scene.add(core);

    const shockMat = new THREE.MeshBasicMaterial({
      color: 0xff8a3a,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const shock = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), shockMat);
    shock.position.copy(position);
    scene.add(shock);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd080,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.08, 8, 32), ringMat);
    ring.position.copy(position);
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);

    active.push({
      life: 0.55,
      maxLife: 0.55,
      update(t) {
        const inv = 1 - t;
        light.intensity = 40 * t;
        core.material.opacity = t;
        core.scale.setScalar(1 + inv * 2.5);
        shock.material.opacity = t * 0.8;
        shock.scale.setScalar(1 + inv * (radius / 0.5));
        ring.material.opacity = t * 0.9;
        ring.scale.setScalar(1 + inv * (radius / 0.4));
      },
      dispose() {
        scene.remove(light);
        scene.remove(core);
        scene.remove(shock);
        scene.remove(ring);
        core.geometry.dispose(); core.material.dispose();
        shock.geometry.dispose(); shock.material.dispose();
        ring.geometry.dispose(); ring.material.dispose();
      },
    });

    for (let i = 0; i < 18; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = radius * (0.4 + Math.random() * 0.6);
      const p = position.clone().add(new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * r,
        Math.cos(phi) * r * 0.6 + 0.1,
        Math.sin(phi) * Math.sin(theta) * r,
      ));
      spawnImpact(p, i % 2 === 0 ? 0xff8a3a : 0xffd080);
    }
  }

  function update(dt) {
    for (let i = active.length - 1; i >= 0; i--) {
      const e = active[i];
      e.life -= dt;
      if (e.life <= 0) {
        e.dispose();
        active.splice(i, 1);
      } else {
        e.update(e.life / e.maxLife);
      }
    }
  }

  return { spawnMuzzleFlash, spawnTracer, spawnImpact, spawnExplosion, update };
}
