import * as THREE from 'three';

const STAR_COUNT = 1400;
const DUST_COUNT = 600;
const DUST_RANGE_XZ = 40;
const DUST_MIN_Y = 0.2;
const DUST_MAX_Y = 8;

export function createAtmosphere(scene) {
  const stars = makeStars();
  scene.add(stars);

  const dust = makeDust();
  scene.add(dust.points);

  function update(dt) {
    stars.rotation.y += dt * 0.004;
    dust.update(dt);
  }

  return { update };
}

function makeStars() {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);

  const palette = [
    new THREE.Color(0xffffff),
    new THREE.Color(0x9fd5ff),
    new THREE.Color(0xffb6ff),
    new THREE.Color(0xffe2a8),
  ];

  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 120 + Math.random() * 20;
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.8 + 6;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3 + 0] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    sizes[i] = 0.4 + Math.random() * 1.2;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.6,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

  return new THREE.Points(geom, mat);
}

function makeDust() {
  const positions = new Float32Array(DUST_COUNT * 3);
  const velocities = new Float32Array(DUST_COUNT * 3);

  for (let i = 0; i < DUST_COUNT; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * DUST_RANGE_XZ;
    positions[i * 3 + 1] = DUST_MIN_Y + Math.random() * (DUST_MAX_Y - DUST_MIN_Y);
    positions[i * 3 + 2] = (Math.random() - 0.5) * DUST_RANGE_XZ;

    velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.08;
    velocities[i * 3 + 1] = 0.06 + Math.random() * 0.14;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.05,
    color: 0x66d9ff,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geom, mat);

  function update(dt) {
    const p = geom.attributes.position.array;
    for (let i = 0; i < DUST_COUNT; i++) {
      const ix = i * 3;
      p[ix] += velocities[ix] * dt;
      p[ix + 1] += velocities[ix + 1] * dt;
      p[ix + 2] += velocities[ix + 2] * dt;

      if (p[ix + 1] > DUST_MAX_Y) {
        p[ix] = (Math.random() - 0.5) * DUST_RANGE_XZ;
        p[ix + 1] = DUST_MIN_Y;
        p[ix + 2] = (Math.random() - 0.5) * DUST_RANGE_XZ;
      }
      if (p[ix] > DUST_RANGE_XZ / 2) p[ix] -= DUST_RANGE_XZ;
      if (p[ix] < -DUST_RANGE_XZ / 2) p[ix] += DUST_RANGE_XZ;
      if (p[ix + 2] > DUST_RANGE_XZ / 2) p[ix + 2] -= DUST_RANGE_XZ;
      if (p[ix + 2] < -DUST_RANGE_XZ / 2) p[ix + 2] += DUST_RANGE_XZ;
    }
    geom.attributes.position.needsUpdate = true;
  }

  return { points, update };
}
