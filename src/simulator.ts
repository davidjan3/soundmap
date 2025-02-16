import { config } from "./config";
import SoundBeam, { MAX_LEN } from "./soundbeam";
import Utils, { PA_REF } from "./utils";
import { FrequencyMap, Wall } from "configscheme";
import * as three from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";

const scene = new three.Scene();

const walls = loadWalls();
scene.add(...walls);

const SOURCE_RADIUS = 0.2;
const sources = loadSources();
scene.add(...sources);

const soundBeams = generateSoundBeams();
generateHeatmap(soundBeams).forEach((mesh) => scene.add(mesh));

const camera = new three.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = -5;
const mergedRoomGeometry = BufferGeometryUtils.mergeGeometries(walls.map((obj) => obj.geometry));
mergedRoomGeometry.computeBoundingBox();
const center = new three.Vector3(0, 0, 0);
mergedRoomGeometry.boundingBox.getCenter(center);
camera.lookAt(center);

const directionalLight0 = new three.DirectionalLight(0xffffff, 0.5);
directionalLight0.position.set(2, 10, 5);
directionalLight0.lookAt(center);
scene.add(directionalLight0);

const directionalLight1 = new three.DirectionalLight(0xffffff, 0.5);
directionalLight1.position.set(-2, 10, -5);
directionalLight1.lookAt(center);
scene.add(directionalLight1);

const renderer = new three.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);
window.addEventListener(
  "resize",
  () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
  },
  false
);

let angle = 0;
const cameraDistance = 8;

function animate(time) {
  angle = time * 0.0005;
  camera.position.x = center.x + Math.cos(angle) * cameraDistance;
  camera.position.y = 5;
  camera.position.z = center.z + Math.sin(angle) * cameraDistance;

  camera.lookAt(center);

  renderer.render(scene, camera);
}

function loadWalls() {
  return config.room.walls.map((wall) => {
    const geometry = new three.BufferGeometry();

    const points = new Float32Array(wall.vertices.flat());
    geometry.setAttribute("position", new three.BufferAttribute(points, 3));

    const indices = [];
    for (let i = 1; i < wall.vertices.length - 1; i++) {
      indices.push(0, i, i + 1);
    }
    geometry.setIndex(indices);

    geometry.computeVertexNormals();

    const material = new three.MeshStandardMaterial({
      color: 0xffffff,
      // opacity: 0.2,
      // transparent: true,
      side: three.DoubleSide,
      wireframe: true,
    });
    const mesh = new three.Mesh(geometry, material);
    mesh.userData = wall;
    mesh.layers.enable(1);
    return mesh;
  });
}

function loadSources() {
  return config.room.sources.map((src) => {
    const thetaLength = src.spreadAngle ? src.spreadAngle * (Math.PI / 360) : Math.PI / 2;
    const heightSegments = Math.ceil((thetaLength / Math.PI) * 32);
    const geometry = new three.SphereGeometry(SOURCE_RADIUS, 32, heightSegments, 0, Math.PI * 2, 0, thetaLength);
    const material = new three.MeshStandardMaterial({
      color: 0xff0000,
      side: three.DoubleSide,
      emissive: 0xff0000,
    });
    const mesh = new three.Mesh(geometry, material);
    mesh.position.copy(Utils.Pt2Vector3(src.position));
    if (src.direction) {
      const up = new three.Vector3(0, 1, 0);
      const direction = Utils.Pt2Vector3(src.direction);
      mesh.quaternion.setFromUnitVectors(up, direction.normalize());
    }
    return mesh;
  });
}

function generateSoundBeams() {
  const soundBeams: SoundBeam[] = [];
  config.room.sources.forEach((src, sourceIndex) => {
    const srcPosition = Utils.Pt2Vector3(src.position);
    const srcDirection = src.direction ? Utils.Pt2Vector3(src.direction) : new three.Vector3();
    const thetaLength = src.spreadAngle ? src.spreadAngle : 180;
    const resolution = config.settings?.sourceResolution ?? 1;
    const totalBeams = Math.floor(360 * resolution) * Math.floor(thetaLength * resolution + 1);
    const srcSoundPressure = Utils.mapFrequencyMap(src.volume, Utils.dB2Pa);
    for (let x = 0; x < 360 * resolution; x++) {
      const phi = x * (Math.PI / 180) * (1 / resolution);
      for (let y = 0; y <= thetaLength * resolution; y++) {
        let soundPressure = Utils.mapFrequencyMap(srcSoundPressure, (f, v) => v);
        const theta = y * (Math.PI / 360) * (1 / resolution);
        let direction = srcDirection
          .clone()
          .applyEuler(new three.Euler(0, theta, 0))
          .applyAxisAngle(srcDirection, phi)
          .normalize();
        let position = srcPosition.clone().add(direction.clone().multiplyScalar(SOURCE_RADIUS));

        while (true) {
          if (Utils.sumFrequencyMap(soundPressure) < PA_REF) break;
          const raycaster = new three.Raycaster(position, direction, 0.001, MAX_LEN);
          raycaster.layers.set(1);
          const intersections = raycaster.intersectObjects(scene.children);
          if (!intersections.length) {
            soundBeams.push({
              sourceIndex: sourceIndex,
              soundPressure: soundPressure,
              from: position,
              to: position.clone().add(direction.normalize().multiplyScalar(MAX_LEN)),
            });
            break;
          }
          const intersection = intersections[0];
          const intersectionPoint = intersection.point;
          soundBeams.push({
            sourceIndex: sourceIndex,
            soundPressure: soundPressure,
            from: position,
            to: intersectionPoint,
          });

          const wall = intersection.object.userData as Wall;
          const soundReflexionFac = wall.soundReflexionFac || {};
          Object.keys(soundPressure).forEach((frequency) => {
            if (!(frequency in soundReflexionFac) || soundReflexionFac[frequency] === 1) {
              soundReflexionFac[frequency] = 0.75;
            }
          });
          soundPressure = Utils.factorFrequencyMapEntries(soundPressure, soundReflexionFac);
          direction = direction
            .clone()
            .sub(intersection.normal.multiplyScalar(2 * direction.dot(intersection.normal)))
            .normalize();
          position = intersectionPoint;
        }
      }
    }
  });
  return soundBeams;
}

function generateHeatmap(soundBeams: SoundBeam[]) {
  const loudestSourceSum = Math.max(
    ...config.room.sources.map((src) => Utils.sumFrequencyMap(Utils.mapFrequencyMap(src.volume, Utils.dB2Pa)))
  );
  const HEAT_MAP_STEP = 0.25;
  const map: { [index: string]: number } = {};
  soundBeams.forEach((beam) => {
    const volume = Utils.sumFrequencyMap(beam.soundPressure) / loudestSourceSum;
    let travel = 0;
    const totalDistance = beam.from.distanceTo(beam.to);

    while (travel < totalDistance) {
      const t = travel / totalDistance;
      const position = beam.from.clone().lerp(beam.to, t);

      const x = Math.floor(position.x / HEAT_MAP_STEP) * HEAT_MAP_STEP;
      const y = Math.floor(position.y / HEAT_MAP_STEP) * HEAT_MAP_STEP;
      const z = Math.floor(position.z / HEAT_MAP_STEP) * HEAT_MAP_STEP;

      const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
      if (!(key in map)) {
        map[key] = 0;
      }
      map[key] += volume;

      const direction = beam.to.clone().sub(beam.from).normalize();

      const nextX =
        direction.x > 0
          ? (Math.floor(position.x / HEAT_MAP_STEP) + 1) * HEAT_MAP_STEP - position.x
          : (Math.ceil(position.x / HEAT_MAP_STEP) - 1) * HEAT_MAP_STEP - position.x;

      const nextY =
        direction.y > 0
          ? (Math.floor(position.y / HEAT_MAP_STEP) + 1) * HEAT_MAP_STEP - position.y
          : (Math.ceil(position.y / HEAT_MAP_STEP) - 1) * HEAT_MAP_STEP - position.y;

      const nextZ =
        direction.z > 0
          ? (Math.floor(position.z / HEAT_MAP_STEP) + 1) * HEAT_MAP_STEP - position.z
          : (Math.ceil(position.z / HEAT_MAP_STEP) - 1) * HEAT_MAP_STEP - position.z;

      const dx = direction.x !== 0 ? Math.abs(nextX / direction.x) : Infinity;
      const dy = direction.y !== 0 ? Math.abs(nextY / direction.y) : Infinity;
      const dz = direction.z !== 0 ? Math.abs(nextZ / direction.z) : Infinity;

      const nextTravel = Math.min(dx, dy, dz);

      travel += nextTravel + 0.000001;
    }
  });

  const values = Object.values(map);
  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] > max) {
      max = values[i];
    }
  }
  Object.keys(map).forEach((key) => {
    map[key] /= max;
  });

  return Object.entries(map)
    .map(([key, value]) => {
      const [x, y, z] = key.split(",").map((v) => Number(v));
      const opacity = value;
      if (opacity < 0.01) return null;
      const geometry = new three.SphereGeometry(HEAT_MAP_STEP * 0.5);
      const material = new three.MeshBasicMaterial({
        color: new three.Color(0xff0000),
        transparent: true,
        opacity: opacity,
      });
      const mesh = new three.Mesh(geometry, material);
      mesh.position.set(x + HEAT_MAP_STEP / 2, y + HEAT_MAP_STEP / 2, z + HEAT_MAP_STEP / 2);
      return mesh;
    })
    .filter((mesh) => mesh !== null);
}
