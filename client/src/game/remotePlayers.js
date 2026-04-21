import * as THREE from 'three';

const COLORS = [0x38f9ff, 0xff3ad6, 0x7a5bff, 0xffd23a, 0x5bffb0, 0xff7a3a];
const INTERP_DELAY = 120; // ms — render this far behind latest received state
const SNAP_DIST = 8;      // m  — teleport threshold (respawn, not movement)

export function createRemotePlayers(scene, raycastables) {
  const byId = new Map();

  function upsert(info) {
    let r = byId.get(info.id);
    if (!r) {
      r = makeRemote(scene, raycastables, info);
      byId.set(info.id, r);
    }

    const t = performance.now();
    const x = info.position.x, y = info.position.y, z = info.position.z;

    // If it's a big jump (respawn), wipe history so we don't interpolate across the map
    const last = r.history[r.history.length - 1];
    if (last) {
      const dx = x - last.x, dy = y - last.y, dz = z - last.z;
      if (Math.sqrt(dx*dx + dy*dy + dz*dz) > SNAP_DIST) r.history.length = 0;
    }

    r.history.push({ t, x, y, z, yaw: info.yaw ?? 0 });
    if (r.history.length > 30) r.history.shift();
  }

  function remove(id) {
    const r = byId.get(id);
    if (!r) return;
    r.dispose();
    byId.delete(id);
  }

  function applySnapshot(list) {
    const seen = new Set();
    for (const info of list) { upsert(info); seen.add(info.id); }
    for (const id of byId.keys()) { if (!seen.has(id)) remove(id); }
  }

  function getById(id) { return byId.get(id) || null; }

  function update(dt) {
    const renderTime = performance.now() - INTERP_DELAY;

    for (const r of byId.values()) {
      const h = r.history;
      if (h.length === 0) continue;

      let x, y, z, yaw;

      if (h.length === 1) {
        ({ x, y, z, yaw } = h[0]);
      } else {
        // find the two samples that straddle renderTime
        let a = h[0], b = h[1];
        for (let i = 1; i < h.length; i++) {
          if (h[i].t >= renderTime) { a = h[i - 1]; b = h[i]; break; }
          // if we've exhausted the buffer, extrapolate from the last two
          if (i === h.length - 1) { a = h[i - 1]; b = h[i]; }
        }

        const span = b.t - a.t;
        const alpha = span > 0 ? Math.min(1.5, (renderTime - a.t) / span) : 1;
        x = a.x + (b.x - a.x) * alpha;
        y = a.y + (b.y - a.y) * alpha;
        z = a.z + (b.z - a.z) * alpha;
        yaw = lerpAngle(a.yaw, b.yaw, Math.min(1, alpha));
      }

      r.current.position.set(x, y, z);
      r.group.position.set(x, y - 1.7, z);
      r.group.rotation.y = yaw;
    }
  }

  function getAll() {
    const out = [];
    for (const [id, r] of byId) {
      out.push({ id, position: r.current.position, body: r.body, head: r.head });
    }
    return out;
  }

  return { applySnapshot, upsert, remove, update, getById, getAll, get size() { return byId.size; } };
}

function makeRemote(scene, raycastables, info) {
  const colorIdx = hashString(info.id) % COLORS.length;
  const color = COLORS[colorIdx];

  const group = new THREE.Group();
  scene.add(group);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f1a, roughness: 0.55, metalness: 0.3,
    emissive: color, emissiveIntensity: 0.45,
  });
  const limbMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f1a, roughness: 0.6, metalness: 0.25,
    emissive: color, emissiveIntensity: 0.35,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x080a12, emissive: color, emissiveIntensity: 0.85,
    roughness: 0.3, metalness: 0.5,
  });

  // Torso
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.75, 6, 12), bodyMat);
  body.position.y = 1.35;
  group.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), headMat);
  head.position.y = 2.02;
  group.add(head);

  // Visor
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.08, 0.02),
    new THREE.MeshBasicMaterial({ color }),
  );
  visor.position.set(0, 2.04, 0.21);
  group.add(visor);

  // Arms
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

  // Legs
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

  // Ground ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.03, 8, 24),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.position.y = 0.04;
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  const nameTag = makeNameSprite(info.name || info.id.slice(0, 4), color);
  nameTag.position.y = 2.55;
  group.add(nameTag);

  // Only torso + head are hittable
  raycastables.push(body);
  raycastables.push(head);
  body.userData.remoteId = info.id;
  head.userData.remoteId = info.id;

  const initPos = info.position
    ? new THREE.Vector3(info.position.x, info.position.y, info.position.z)
    : new THREE.Vector3();

  group.position.copy(initPos).setY(initPos.y - 1.7);

  return {
    group, body, head, ring, nameTag, color,
    history: [],
    current: { position: initPos.clone() },
    dispose() {
      scene.remove(group);
      removeFromArray(raycastables, body);
      removeFromArray(raycastables, head);
      for (const mat of [bodyMat, limbMat, headMat]) mat.dispose();
      group.traverse((obj) => { if (obj.geometry) obj.geometry.dispose(); });
      nameTag.material.map.dispose();
      nameTag.material.dispose();
    },
  };
}

function makeNameSprite(name, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '600 32px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 14;
  ctx.fillText(name, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.4, 1);
  sprite.renderOrder = 999;
  return sprite;
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function lerpAngle(a, b, k) {
  let diff = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + diff * k;
}

function removeFromArray(arr, item) {
  const i = arr.indexOf(item);
  if (i >= 0) arr.splice(i, 1);
}
