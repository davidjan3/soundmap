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

const soundBeams = propagateSoundBeams();
scene.add(...renderBeams(soundBeams));

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

function propagateSoundBeams() {
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
        const direction = srcDirection
          .clone()
          .applyEuler(new three.Euler(0, theta, 0))
          .applyAxisAngle(srcDirection, phi)
          .normalize();
        const position = srcPosition.clone().add(direction.clone().multiplyScalar(SOURCE_RADIUS));
        soundBeams.push(...propagateSoundBeam(sourceIndex, position, direction, soundPressure));
      }
    }
  });
  return soundBeams;
}

function infiniteSoundBeam(
  sourceIndex: number,
  position: three.Vector3,
  direction: three.Vector3,
  soundPressure: FrequencyMap
) {
  const beam: SoundBeam = {
    sourceIndex: sourceIndex,
    soundPressure: soundPressure,
    from: position,
    to: position.clone().add(direction.normalize().multiplyScalar(MAX_LEN)),
  };
  return beam;
}

function propagateSoundBeam(
  sourceIndex: number,
  position: three.Vector3,
  direction: three.Vector3,
  soundPressure: FrequencyMap
) {
  if (Utils.sumFrequencyMap(soundPressure) < PA_REF) return [];
  const raycaster = new three.Raycaster(position, direction, 0.001, MAX_LEN);
  raycaster.layers.set(1);
  const intersections = raycaster.intersectObjects(scene.children);
  if (!intersections.length) return [infiniteSoundBeam(sourceIndex, position, direction, soundPressure)];
  const intersection = intersections[0];
  const intersectionPoint = intersection.point;
  const beam: SoundBeam = {
    sourceIndex: sourceIndex,
    soundPressure: soundPressure,
    from: position,
    to: intersectionPoint,
  };

  const wall = intersection.object.userData as Wall;
  const soundReflexionFac = wall.soundReflexionFac || {};
  Object.keys(soundPressure).forEach((frequency) => {
    if (!(frequency in soundReflexionFac) || soundReflexionFac[frequency] === 1) {
      soundReflexionFac[frequency] = 0.75;
    }
  });
  const reflectedSoundPressure = Utils.factorFrequencyMapEntries(soundPressure, soundReflexionFac);
  const reflectedDirection = direction
    .clone()
    .sub(intersection.normal.multiplyScalar(2 * direction.dot(intersection.normal)))
    .normalize();
  return [beam, ...propagateSoundBeam(sourceIndex, intersectionPoint, reflectedDirection, reflectedSoundPressure)];
}

function renderBeams(soundBeams: SoundBeam[]) {
  const loudestSourceSum = Math.max(
    ...config.room.sources.map((src) => Utils.sumFrequencyMap(Utils.mapFrequencyMap(src.volume, Utils.dB2Pa)))
  );
  return soundBeams.map((beam) => {
    const opacity = Utils.sumFrequencyMap(beam.soundPressure) / loudestSourceSum;
    // const color = new three.Color().setHSL(0, 1, opacity * 0.5);
    const lineGeometry = new three.BufferGeometry().setFromPoints([beam.from, beam.to]);
    const lineMaterial = new three.LineBasicMaterial({ color: 0xff0000, opacity: opacity, transparent: true });
    const line = new three.Line(lineGeometry, lineMaterial);
    return line;
  });
}
