import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { config } from "./config";
import SoundBeam, { MAX_LEN } from "./soundbeam";
import Utils, { PA_REF } from "./utils";
import { Pt, Wall } from "configscheme";
import * as three from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";

main();

async function main() {
  const scene = new three.Scene();

  const walls = loadWalls();
  scene.add(...walls);

  const objects = await loadObjects();
  scene.add(...objects);

  const sources = loadSources();
  scene.add(...sources);

  const soundBeams = generateSoundBeams(scene.children);
  generateHeatmap(soundBeams).forEach((mesh) => scene.add(mesh));

  const camera = new three.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = -5;
  const mergedRoomGeometry = BufferGeometryUtils.mergeGeometries(walls.map((obj) => obj.geometry));
  mergedRoomGeometry.computeBoundingBox();
  const center = new three.Vector3(0, 0, 0);
  mergedRoomGeometry.boundingBox.getCenter(center);
  camera.lookAt(center);

  const renderer = new three.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const cameraDistance = 8;
  renderer.setAnimationLoop((time) => animate(time, camera, renderer, scene, center, cameraDistance));
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
}

let angle = 0;
function animate(time, camera, renderer, scene, center, cameraDistance) {
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
      emissive: 0xffffff,
      side: three.DoubleSide,
      wireframe: true,
    });
    const mesh = new three.Mesh(geometry, material);
    mesh.userData = wall;
    mesh.layers.enable(1);
    return mesh;
  });
}

async function loadObjects() {
  return (
    Promise.all(
      config.room.objects?.map(async (obj) => {
        const loader = new OBJLoader();
        const data = await (await fetch(obj.path)).text();
        const group = loader.parse(data);

        const geometries = [];
        group.traverse((child) => {
          if (child instanceof three.Mesh) {
            geometries.push(child.geometry);
          }
        });

        const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
        const material = new three.MeshStandardMaterial({
          emissive: 0xffffff,
          side: three.DoubleSide,
        });
        const mesh = new three.Mesh(mergedGeometry, material);
        mesh.position.set(...obj.position);
        if (obj.rotation) {
          mesh.rotation.set(...(obj.rotation.map((v) => (v * Math.PI) / 180) as Pt));
        }
        if (obj.scale) {
          mesh.scale.set(...obj.scale);
        }
        mesh.updateMatrixWorld();
        mesh.userData = obj;
        mesh.layers.enable(1);
        return mesh;
      })
    ) || []
  );
}

function loadSources() {
  return config.room.sources.map((src) => {
    const thetaLength = src.spreadAngle ? src.spreadAngle * (Math.PI / 360) : Math.PI / 2;
    const heightSegments = Math.ceil((thetaLength / Math.PI) * 32);
    const geometry = new three.SphereGeometry(src.radius ?? 0.2, 32, heightSegments, 0, Math.PI * 2, 0, thetaLength);
    const material = new three.MeshStandardMaterial({
      side: three.DoubleSide,
      emissive: 0xffffff,
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

function generateSoundBeams(obstructions: three.Object3D[]) {
  const maxBounces = config.settings?.maxBounces ?? 10;
  const soundBeams: SoundBeam[] = [];
  config.room.sources.forEach((src, sourceIndex) => {
    const srcPosition = Utils.Pt2Vector3(src.position);
    const srcDirection = src.direction ? Utils.Pt2Vector3(src.direction) : new three.Vector3();
    const thetaLength = src.spreadAngle ? src.spreadAngle : 180;
    const resolution = config.settings?.sourceResolution ?? 1;
    const srcSoundPressure = Utils.mapFrequencyMap(src.volume, (f, v) => Utils.dB2Pa(v));
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
        let position = srcPosition.clone().add(direction.clone().multiplyScalar(src.radius ?? 0.2));
        let bounces = 0;
        while (bounces < maxBounces) {
          if (Utils.sumFrequencyMap(soundPressure) < PA_REF) break;
          const raycaster = new three.Raycaster(position, direction, 0.000001, MAX_LEN);
          raycaster.layers.set(1);
          const intersections = raycaster.intersectObjects(obstructions);
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
          bounces++;
        }
      }
    }
  });
  return soundBeams;
}

function generateHeatmap(soundBeams: SoundBeam[]) {
  const heatMapStep = config.settings?.heatMapStep ?? 0.25;
  const map: { [index: string]: { avgFrequency: number; avgPressure: number } } = {};
  soundBeams.forEach((beam) => {
    let travel = 0;
    const totalDistance = beam.from.distanceTo(beam.to);

    while (travel < totalDistance) {
      const t = travel / totalDistance;
      const position = beam.from.clone().lerp(beam.to, t);

      const x = Math.floor(position.x / heatMapStep) * heatMapStep;
      const y = Math.floor(position.y / heatMapStep) * heatMapStep;
      const z = Math.floor(position.z / heatMapStep) * heatMapStep;

      const key = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
      if (!(key in map)) {
        map[key] = { avgFrequency: 0, avgPressure: 0 };
      }
      const averages = Utils.avgFrequencyMap(beam.soundPressure);
      map[key].avgFrequency = averages.avgFrequency;
      map[key].avgPressure += averages.avgPressure;

      const direction = beam.to.clone().sub(beam.from).normalize();

      const nextX =
        direction.x > 0
          ? (Math.floor(position.x / heatMapStep) + 1) * heatMapStep - position.x
          : (Math.ceil(position.x / heatMapStep) - 1) * heatMapStep - position.x;

      const nextY =
        direction.y > 0
          ? (Math.floor(position.y / heatMapStep) + 1) * heatMapStep - position.y
          : (Math.ceil(position.y / heatMapStep) - 1) * heatMapStep - position.y;

      const nextZ =
        direction.z > 0
          ? (Math.floor(position.z / heatMapStep) + 1) * heatMapStep - position.z
          : (Math.ceil(position.z / heatMapStep) - 1) * heatMapStep - position.z;

      const dx = direction.x !== 0 ? Math.abs(nextX / direction.x) : Infinity;
      const dy = direction.y !== 0 ? Math.abs(nextY / direction.y) : Infinity;
      const dz = direction.z !== 0 ? Math.abs(nextZ / direction.z) : Infinity;

      const nextTravel = Math.min(dx, dy, dz);

      travel += nextTravel + 0.000001;
    }
  });
  const values = Object.values(map);
  let maxPressure = values[0].avgPressure;
  let minFrequency = values[0].avgFrequency;
  let maxFrequency = values[0].avgFrequency;
  for (let i = 1; i < values.length; i++) {
    maxPressure = Math.max(maxPressure, values[i].avgPressure);
    minFrequency = Math.min(minFrequency, values[i].avgFrequency);
    maxFrequency = Math.max(maxFrequency, values[i].avgFrequency);
  }
  Object.keys(map).forEach((key) => {
    const averages = map[key];
    averages.avgPressure /= maxPressure;
    averages.avgFrequency = (averages.avgFrequency - minFrequency) / (maxFrequency - minFrequency);
  });

  return Object.entries(map)
    .map(([key, averages]) => {
      const [x, y, z] = key.split(",").map((v) => Number(v));
      const opacity = averages.avgPressure;
      if (opacity < 0.01) return null;
      const colorLerp = new three.Color(0xff0000).lerp(new three.Color(0x00ffff), averages.avgFrequency);
      const geometry = new three.SphereGeometry(heatMapStep * 0.5);
      const material = new three.MeshBasicMaterial({
        color: colorLerp,
        transparent: true,
        opacity: opacity,
      });
      const mesh = new three.Mesh(geometry, material);
      mesh.position.set(x + heatMapStep / 2, y + heatMapStep / 2, z + heatMapStep / 2);
      return mesh;
    })
    .filter((mesh) => mesh !== null);
}
