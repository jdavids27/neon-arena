import * as THREE from 'three';

const COLORS = [0x38f9ff, 0xff3ad6, 0x7a5bff, 0xffd23a, 0x5bffb0, 0xff7a3a];
const LERP_RATE = 14;

export function createRemotePlayers(scene, raycastables) {
  const byId = new Map();

  function upsert(info) {
    let r = byId.get(info.id);
    if (!r) {
      r = makeRemote(scene, raycastables, info);
      byId.set(info.id, r);
    }
    r.target.position.set(info.position.x, info.position.y, info.position.z);
    r.target.yaw = info.yaw ?? 0;
    r.target.pitch = info.pitch ?? 0;
  }

  function remove(id) {
    const r = byId.get(id);
    if (!r) return;
    r.dispose();
    byId.delete(id);
  }

  function applySnapshot(list) {
    const seen = new Set();
    for (const info of list) {
      upsert(info);
      seen.add(info.id);
    }
    for (const id of byId.keys()) {
      if (!seen.has(id)) remove(id);
    }
  }

  function getById(id) {
    const r = byId.get(id);
    return r || null;
  }

  function update(dt) {
    const k = 1 - Math.exp(-LERP_RATE * dt);
    for (const r of byId.values()) {
      r.current.position.lerp(r.target.position, k);
      r.group.position.copy(r.current.position).setY(r.current.position.y - 1.7);
      r.current.yaw = lerpAngle(r.current.yaw, r.target.yaw, k);
      r.group.rotation.y = r.current.yaw;
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
    color: 0x0a0f1a,
    roughness: 0.55,
    metalness: 0.3,
    emissive: color,
    emissiveIntensity: 0.5,
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.3, 6, 12), bodyMat);
  body.position.y = 1.0;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.32, 0),
    new THREE.MeshStandardMaterial({
      color: 0x080a12,
      emissive: color,
      emissiveIntensity: 0.85,
      roughness: 0.3,
      metalness: 0.5,
    }),
  );
  head.position.y = 2.0;
  group.add(head);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.035, 8, 24),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.position.y = 0.05;
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  const nameTag = makeNameSprite(info.name || info.id.slice(0, 4), color);
  nameTag.position.y = 2.55;
  group.add(nameTag);

  raycastables.push(body);
  raycastables.push(head);
  body.userData.remoteId = info.id;
  head.userData.remoteId = info.id;

  const current = { position: new THREE.Vector3(info.position.x, info.position.y, info.position.z), yaw: info.yaw ?? 0 };
  const target = { position: new THREE.Vector3(info.position.x, info.position.y, info.position.z), yaw: info.yaw ?? 0, pitch: 0 };
  group.position.copy(current.position).setY(current.position.y - 1.7);

  return {
    group, body, head, ring, nameTag, color,
    current, target,
    dispose() {
      scene.remove(group);
      removeFromArray(raycastables, body);
      removeFromArray(raycastables, head);
      body.geometry.dispose(); bodyMat.dispose();
      head.geometry.dispose(); head.material.dispose();
      ring.geometry.dispose(); ring.material.dispose();
      nameTag.material.map.dispose();
      nameTag.material.dispose();
    },
  };
}

function makeNameSprite(name, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
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
