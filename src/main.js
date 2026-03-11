import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

const scene = new THREE.Scene();
scene.background = new THREE.Color('#20242b');
scene.fog = new THREE.Fog('#20242b', 8, 24);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(4.5, 4.2, 5.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.2, 0);
controls.enableDamping = true;
controls.minDistance = 2.5;
controls.maxDistance = 12;

scene.add(new THREE.AmbientLight('#ffffff', 0.35));
const keyLight = new THREE.DirectionalLight('#ffd9aa', 1.2);
keyLight.position.set(5, 8, 6);
keyLight.castShadow = true;
scene.add(keyLight);

const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver.iterations = 16;
world.defaultContactMaterial.friction = 0.45;
world.defaultContactMaterial.restitution = 0.02;

const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(floorBody);

const floorMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: '#2e323a', roughness: 0.95, metalness: 0.05 })
);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

function createShoe() {
  const group = new THREE.Group();
  scene.add(group);

  const shoeMat = new THREE.MeshStandardMaterial({ color: '#3f7de8', flatShading: true, roughness: 0.85 });
  const soleMat = new THREE.MeshStandardMaterial({ color: '#d7d7d7', flatShading: true, roughness: 0.9 });

  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 1.4), shoeMat);
  bodyMesh.position.set(0, 1.1, 0);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  const toeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 1.3), shoeMat);
  toeMesh.position.set(1.45, 1.05, 0);
  toeMesh.castShadow = true;
  group.add(toeMesh);

  const soleMesh = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.35, 1.6), soleMat);
  soleMesh.position.set(0, 0.45, 0);
  soleMesh.castShadow = true;
  soleMesh.receiveShadow = true;
  group.add(soleMesh);

  const tongue = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.9), new THREE.MeshStandardMaterial({ color: '#9ec1ff', flatShading: true }));
  tongue.position.set(0.15, 1.58, 0);
  tongue.rotation.z = 0.16;
  group.add(tongue);

  const staticBodies = [];
  const addCollider = (shape, pos) => {
    const body = new CANNON.Body({ mass: 0 });
    body.addShape(shape);
    body.position.copy(pos);
    world.addBody(body);
    staticBodies.push(body);
  };

  addCollider(new CANNON.Box(new CANNON.Vec3(1.3, 0.55, 0.7)), new CANNON.Vec3(0, 1.1, 0));
  addCollider(new CANNON.Box(new CANNON.Vec3(0.4, 0.5, 0.65)), new CANNON.Vec3(1.45, 1.05, 0));
  addCollider(new CANNON.Box(new CANNON.Vec3(1.45, 0.175, 0.8)), new CANNON.Vec3(0, 0.45, 0));

  const eyeletMeshes = [];
  const eyeletBodies = [];
  const eyeletPositions = [];
  const rowX = [-0.7, -0.25, 0.2, 0.65];
  for (let i = 0; i < rowX.length; i++) {
    eyeletPositions.push(new THREE.Vector3(rowX[i], 1.45, 0.46));
    eyeletPositions.push(new THREE.Vector3(rowX[i], 1.45, -0.46));
  }

  eyeletPositions.forEach((p) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.03, 8, 14),
      new THREE.MeshStandardMaterial({ color: '#adb2c3', metalness: 0.25, roughness: 0.5, flatShading: true })
    );
    mesh.position.copy(p);
    mesh.rotation.y = Math.PI / 2;
    group.add(mesh);
    eyeletMeshes.push(mesh);

    const ring = new CANNON.Body({ mass: 0 });
    // 4 small spheres to approximate torus collider while keeping hole passable
    const r = 0.09;
    const t = 0.03;
    ring.addShape(new CANNON.Sphere(t), new CANNON.Vec3(0, r, 0));
    ring.addShape(new CANNON.Sphere(t), new CANNON.Vec3(0, -r, 0));
    ring.addShape(new CANNON.Sphere(t), new CANNON.Vec3(0, 0, r));
    ring.addShape(new CANNON.Sphere(t), new CANNON.Vec3(0, 0, -r));
    ring.position.set(p.x, p.y, p.z);
    world.addBody(ring);
    eyeletBodies.push(ring);
  });

  return { eyeletPositions, eyeletBodies, staticBodies };
}

createShoe();

const ropeSegments = [];
const ropeBodies = [];
const ropeCount = 26;
const segmentLength = 0.14;
const ropeRadius = 0.05;

const ropeMat = new THREE.MeshStandardMaterial({ color: '#ff9f43', flatShading: true, roughness: 0.7 });
const agletMat = new THREE.MeshStandardMaterial({ color: '#f5f5f5', flatShading: true, roughness: 0.3, metalness: 0.2 });

for (let i = 0; i < ropeCount; i++) {
  const isAglet = i === 0 || i === ropeCount - 1;
  const geom = isAglet
    ? new THREE.CylinderGeometry(ropeRadius * 0.8, ropeRadius * 0.8, segmentLength * 0.9, 8)
    : new THREE.SphereGeometry(ropeRadius, 8, 8);

  const mesh = new THREE.Mesh(geom, isAglet ? agletMat : ropeMat);
  mesh.castShadow = true;
  scene.add(mesh);
  ropeSegments.push(mesh);

  const body = new CANNON.Body({ mass: isAglet ? 0.04 : 0.02, linearDamping: 0.2, angularDamping: 0.35 });
  body.addShape(isAglet ? new CANNON.Cylinder(ropeRadius * 0.8, ropeRadius * 0.8, segmentLength * 0.9, 8) : new CANNON.Sphere(ropeRadius));

  const t = i / (ropeCount - 1);
  body.position.set(-0.7 + t * 1.8, 1.95, 0.05 * Math.sin(t * Math.PI * 2));
  world.addBody(body);
  ropeBodies.push(body);

  if (i > 0) {
    world.addConstraint(new CANNON.DistanceConstraint(ropeBodies[i - 1], body, segmentLength * 0.95));
  }
}

for (let i = 0; i < ropeCount - 2; i++) {
  world.addConstraint(new CANNON.DistanceConstraint(ropeBodies[i], ropeBodies[i + 2], segmentLength * 1.9));
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const dragPoint = new THREE.Vector3();
let draggedIndex = null;

function setAgletPinned(index, pinned) {
  const body = ropeBodies[index];
  if (pinned) {
    body.type = CANNON.Body.STATIC;
    body.mass = 0;
    body.updateMassProperties();
    body.velocity.setZero();
    body.angularVelocity.setZero();
  } else {
    body.type = CANNON.Body.DYNAMIC;
    body.mass = 0.05;
    body.updateMassProperties();
  }
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const candidates = [ropeSegments[0], ropeSegments[ropeSegments.length - 1]];
  const hits = raycaster.intersectObjects(candidates, false);
  if (!hits.length) return;

  draggedIndex = ropeSegments.indexOf(hits[0].object);
  setAgletPinned(draggedIndex, false);
  dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), hits[0].point);
});

window.addEventListener('pointermove', (event) => {
  if (draggedIndex == null) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
    const b = ropeBodies[draggedIndex];
    b.position.set(dragPoint.x, Math.max(0.2, dragPoint.y), dragPoint.z);
    b.velocity.setZero();
    b.angularVelocity.setZero();
  }
});

window.addEventListener('pointerup', () => {
  if (draggedIndex == null) return;
  setAgletPinned(draggedIndex, true);
  draggedIndex = null;
});

const clock = new THREE.Clock();
let accumulator = 0;
const fixedStep = 1 / 60;

function tick() {
  requestAnimationFrame(tick);

  accumulator += Math.min(clock.getDelta(), 0.05);
  while (accumulator >= fixedStep) {
    world.step(fixedStep);
    accumulator -= fixedStep;
  }

  ropeSegments.forEach((mesh, i) => {
    mesh.position.copy(ropeBodies[i].position);
    mesh.quaternion.copy(ropeBodies[i].quaternion);
  });

  controls.update();
  renderer.render(scene, camera);
}

tick();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
