import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createWorld } from './game/world.js';
import { createPlayer } from './game/player.js';
import { createInput } from './game/input.js';
import { createViewmodel } from './game/viewmodel.js';
import { createEffects } from './game/effects.js';
import { createTargets } from './game/targets.js';
import { createWeapon } from './game/weapon.js';
import { createRocketLauncher } from './game/rocket.js';
import { createHud } from './game/hud.js';
import { createNet } from './game/net.js';
import { createRemotePlayers } from './game/remotePlayers.js';
import { createScoreboard } from './game/scoreboard.js';
import { createSound } from './game/sound.js';
import { createAtmosphere } from './game/atmosphere.js';

const app = document.getElementById('app');
const overlay = document.getElementById('overlay');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  78,
  window.innerWidth / window.innerHeight,
  0.05,
  300,
);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.85,
  0.6,
  0.18,
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const world = createWorld(scene);
const atmosphere = createAtmosphere(scene);
const input = createInput(renderer.domElement);

const spawn = world.spawnPoints[Math.floor(Math.random() * world.spawnPoints.length)];
const player = createPlayer({
  camera,
  domElement: renderer.domElement,
  scene,
  input,
  spawn,
});

const effects = createEffects(scene);
const targets = createTargets(scene, effects, world.raycastables);
const viewmodel = createViewmodel(camera);
const hud = createHud();

const net = createNet();
const remotePlayers = createRemotePlayers(scene, world.raycastables);
const scoreboardUi = createScoreboard();
const sound = createSound();

const weapon = createWeapon({
  camera,
  viewmodel,
  effects,
  hud,
  sound,
  domElement: renderer.domElement,
  onFire: (shot) => net.sendFire(shot),
});

const rocket = createRocketLauncher({
  camera,
  viewmodel,
  effects,
  hud,
  sound,
  scene,
  domElement: renderer.domElement,
  remotePlayers,
  onFire: (shot) => net.sendFire(shot),
});

let currentWeapon = 'rifle';
function selectWeapon(name) {
  currentWeapon = name;
  const isRifle = name === 'rifle';
  weapon.setActive(isRifle);
  rocket.setActive(!isRifle);
  hud.setWeapon(isRifle ? '[1] RIFLE' : '[2] ROCKET');
}
selectWeapon('rifle');

window.addEventListener('keydown', (e) => {
  if (e.code === 'Digit1') selectWeapon('rifle');
  else if (e.code === 'Digit2') selectWeapon('rocket');
});

net.on('welcome', (msg) => {
  if (msg.spawn) player.object.position.set(msg.spawn.x, msg.spawn.y, msg.spawn.z);
  if (Array.isArray(msg.players)) remotePlayers.applySnapshot(msg.players);
  scoreboardUi.setLocalId(msg.id || net.id);
  if (msg.scoreboard) scoreboardUi.render(msg.scoreboard);
  console.log('[net] welcome as', msg.name, '— others:', msg.players?.length ?? 0);
});
net.on('players', (msg) => {
  if (!Array.isArray(msg.list)) return;
  remotePlayers.applySnapshot(msg.list.filter((p) => p.id !== net.id));
});
net.on('player:join', (p) => {
  if (p.id !== net.id) remotePlayers.upsert(p);
});
net.on('player:leave', ({ id }) => remotePlayers.remove(id));
net.on('fire', (shot) => {
  renderRemoteFire(shot);
  if (!shot?.explosive && shot?.m) {
    const dx = shot.m.x - player.object.position.x;
    const dy = shot.m.y - player.object.position.y;
    const dz = shot.m.z - player.object.position.z;
    sound.playRemoteFire(Math.hypot(dx, dy, dz));
  }
  if (shot?.hitId && shot.hitId === net.id) sound.playDamaged();
});
net.on('scoreboard', (msg) => {
  if (Array.isArray(msg?.list)) scoreboardUi.render(msg.list);
});
net.on('death', ({ victim, killer }) => {
  if (killer === net.id) {
    hud.flashHit(true);
    sound.playKill();
  }
});
net.on('respawn', ({ spawn }) => {
  if (spawn) player.object.position.set(spawn.x, spawn.y, spawn.z);
  sound.playRespawn();
  rocket.refill();
});

function renderRemoteFire(shot) {
  if (!shot?.m) return;
  const muzzle = new THREE.Vector3(shot.m.x, shot.m.y, shot.m.z);
  if (shot.explosive && shot.h) {
    const hitPos = new THREE.Vector3(shot.h.x, shot.h.y, shot.h.z);
    effects.spawnExplosion(hitPos, 3.8);
    const dx = hitPos.x - player.object.position.x;
    const dy = hitPos.y - player.object.position.y;
    const dz = hitPos.z - player.object.position.z;
    sound.playRemoteExplosion(Math.hypot(dx, dy, dz));
    return;
  }
  effects.spawnMuzzleFlash(muzzle);
  if (shot.h) {
    const hitPos = new THREE.Vector3(shot.h.x, shot.h.y, shot.h.z);
    effects.spawnTracer(muzzle, hitPos);
    effects.spawnImpact(hitPos, shot.hitId ? 0xff3ad6 : 0x38f9ff);
  } else if (shot.d) {
    const dir = new THREE.Vector3(shot.d.x, shot.d.y, shot.d.z);
    const far = muzzle.clone().add(dir.multiplyScalar(120));
    effects.spawnTracer(muzzle, far);
  }
}

overlay.addEventListener('click', () => {
  sound.resume();
  sound.startMusic();
  player.controls.lock();
});
player.controls.addEventListener('lock', () => overlay.classList.add('hidden'));
player.controls.addEventListener('unlock', () => overlay.classList.remove('hidden'));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

const STATE_INTERVAL = 1000 / 30;
let lastStateSent = 0;
const euler = new THREE.Euler(0, 0, 0, 'YXZ');

function sendState(now) {
  if (!net.connected) return;
  if (now - lastStateSent < STATE_INTERVAL) return;
  lastStateSent = now;
  euler.setFromQuaternion(camera.quaternion);
  net.sendState({
    x: player.object.position.x,
    y: player.object.position.y,
    z: player.object.position.z,
    yaw: euler.y,
    pitch: euler.x,
  });
}

const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  player.update(dt, world.colliders);
  targets.update(dt);
  remotePlayers.update(dt);
  atmosphere.update(dt);
  weapon.update(dt, world.raycastables);
  rocket.update(dt, world.raycastables);
  effects.update(dt);
  hud.update(dt);
  sendState(now);
  composer.render();
  requestAnimationFrame(animate);
}
animate();
