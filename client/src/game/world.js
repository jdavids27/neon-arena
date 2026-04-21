import * as THREE from 'three';

export const ARENA = {
  size: 40,
  wallHeight: 6,
  wallThickness: 1,
};

const NEON_CYAN = 0x38f9ff;
const NEON_MAGENTA = 0xff3ad6;
const NEON_VIOLET = 0x7a5bff;

export function createWorld(scene) {
  scene.background = new THREE.Color(0x05060a);
  scene.fog = new THREE.Fog(0x05060a, 18, 80);

  const colliders = [];
  const raycastables = [];

  scene.add(new THREE.AmbientLight(0x223344, 0.6));

  const keyLight = new THREE.DirectionalLight(0x88aaff, 0.35);
  keyLight.position.set(20, 30, 10);
  scene.add(keyLight);

  addFloor(scene, raycastables);
  addWalls(scene, colliders, raycastables);
  addCover(scene, colliders, raycastables);
  addAmbientNeonLights(scene);

  return { colliders, raycastables, spawnPoints: makeSpawnPoints() };
}

function addFloor(scene, raycastables) {
  const { size } = ARENA;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({
      color: 0x060912,
      roughness: 0.35,
      metalness: 0.7,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  raycastables.push(floor);

  const grid = new THREE.GridHelper(size, size / 2, NEON_CYAN, 0x132033);
  grid.position.y = 0.01;
  const gridMat = grid.material;
  gridMat.transparent = true;
  gridMat.opacity = 0.75;
  scene.add(grid);
}

function addWalls(scene, colliders, raycastables) {
  const { size, wallHeight, wallThickness } = ARENA;
  const half = size / 2;

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x0a1220,
    roughness: 0.75,
    metalness: 0.2,
    emissive: 0x0a1a2a,
    emissiveIntensity: 0.4,
  });

  const wallDefs = [
    { x: 0, z: -half, w: size + wallThickness, d: wallThickness },
    { x: 0, z: half, w: size + wallThickness, d: wallThickness },
    { x: -half, z: 0, w: wallThickness, d: size },
    { x: half, z: 0, w: wallThickness, d: size },
  ];

  for (const def of wallDefs) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(def.w, wallHeight, def.d),
      wallMat,
    );
    mesh.position.set(def.x, wallHeight / 2, def.z);
    scene.add(mesh);
    colliders.push(aabbFromBox(mesh, def.w, wallHeight, def.d));
    raycastables.push(mesh);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(def.w, 0.08, def.d),
      new THREE.MeshBasicMaterial({ color: NEON_CYAN }),
    );
    trim.position.set(def.x, wallHeight - 0.05, def.z);
    scene.add(trim);

    const baseGlow = new THREE.Mesh(
      new THREE.BoxGeometry(def.w, 0.05, def.d),
      new THREE.MeshBasicMaterial({ color: NEON_CYAN }),
    );
    baseGlow.position.set(def.x, 0.06, def.z);
    scene.add(baseGlow);
  }
}

function addCover(scene, colliders, raycastables) {
  const coverDefs = [
    { x: 6, z: 4, w: 2, h: 2, d: 2, color: NEON_CYAN },
    { x: -6, z: 4, w: 2, h: 2, d: 2, color: NEON_MAGENTA },
    { x: 6, z: -4, w: 2, h: 2, d: 2, color: NEON_MAGENTA },
    { x: -6, z: -4, w: 2, h: 2, d: 2, color: NEON_CYAN },
    { x: 0, z: 10, w: 6, h: 3, d: 1.5, color: NEON_VIOLET },
    { x: 0, z: -10, w: 6, h: 3, d: 1.5, color: NEON_VIOLET },
    { x: 12, z: 0, w: 1.5, h: 4, d: 4, color: NEON_CYAN },
    { x: -12, z: 0, w: 1.5, h: 4, d: 4, color: NEON_MAGENTA },
    { x: 0, z: 0, w: 3, h: 1.2, d: 3, color: NEON_VIOLET },
  ];

  for (const def of coverDefs) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(def.w, def.h, def.d),
      new THREE.MeshStandardMaterial({
        color: 0x0a0f1a,
        roughness: 0.6,
        metalness: 0.3,
        emissive: def.color,
        emissiveIntensity: 0.18,
      }),
    );
    mesh.position.set(def.x, def.h / 2, def.z);
    scene.add(mesh);
    colliders.push(aabbFromBox(mesh, def.w, def.h, def.d));
    raycastables.push(mesh);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: def.color }),
    );
    edges.position.copy(mesh.position);
    scene.add(edges);
  }
}

function addAmbientNeonLights(scene) {
  const positions = [
    { x: 15, z: 15, color: NEON_CYAN },
    { x: -15, z: 15, color: NEON_MAGENTA },
    { x: 15, z: -15, color: NEON_MAGENTA },
    { x: -15, z: -15, color: NEON_CYAN },
  ];
  for (const p of positions) {
    const light = new THREE.PointLight(p.color, 1.6, 22, 1.8);
    light.position.set(p.x, 4, p.z);
    scene.add(light);
  }
}

function aabbFromBox(mesh, w, h, d) {
  return {
    min: new THREE.Vector3(
      mesh.position.x - w / 2,
      mesh.position.y - h / 2,
      mesh.position.z - d / 2,
    ),
    max: new THREE.Vector3(
      mesh.position.x + w / 2,
      mesh.position.y + h / 2,
      mesh.position.z + d / 2,
    ),
  };
}

function makeSpawnPoints() {
  const r = 14;
  return [
    new THREE.Vector3(r, 1.7, r),
    new THREE.Vector3(-r, 1.7, r),
    new THREE.Vector3(r, 1.7, -r),
    new THREE.Vector3(-r, 1.7, -r),
    new THREE.Vector3(0, 1.7, r),
    new THREE.Vector3(0, 1.7, -r),
  ];
}
