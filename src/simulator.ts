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

  const soundBeamMeshes = generateSoundBeams(scene.children);
  scene.add(...soundBeamMeshes);

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
  const heatMapStep = config.settings?.heatMapStep ?? 0.25;
  const map: { [index: string]: { frequencySum: number; pressureSum: number } } = {};
  let maxPressure = 0;
  let minFrequency = Infinity;
  let maxFrequency = -Infinity;

  config.room.sources.forEach((src) => {
    const srcPosition = Utils.Pt2Vector3(src.position);
    const srcDirection = src.direction ? Utils.Pt2Vector3(src.direction) : new three.Vector3();
    const thetaLength = src.spreadAngle ? src.spreadAngle : 180;
    const resolution = config.settings?.sourceResolution ?? 1;
    const srcSoundPressure = Utils.mapFrequencyMap(src.volume, (f, v) => Utils.dB2Pa(v));
    const minStepThreshold = 0.001;

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
          const raycaster = new three.Raycaster(position, direction, minStepThreshold / 2, MAX_LEN);
          raycaster.layers.set(1);
          const intersections = raycaster.intersectObjects(obstructions);

          const endPoint = !intersections.length
            ? position.clone().add(direction.normalize().multiplyScalar(MAX_LEN))
            : intersections[0].point;

          let travel = 0;
          const totalDistance = position.distanceTo(endPoint);

          while (travel < totalDistance) {
            const t = travel / totalDistance;
            const currentPos = position.clone().lerp(endPoint, t);

            const x = Math.floor(currentPos.x / heatMapStep) * heatMapStep;
            const y = Math.floor(currentPos.y / heatMapStep) * heatMapStep;
            const z = Math.floor(currentPos.z / heatMapStep) * heatMapStep;

            const key = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
            if (!(key in map)) {
              map[key] = { frequencySum: 0, pressureSum: 0 };
            }
            const averages = Utils.avgFrequencyMap(soundPressure);
            map[key].frequencySum += averages.avgFrequency * averages.avgPressure;
            map[key].pressureSum += averages.avgPressure;

            const direction = endPoint.clone().sub(position).normalize();
            const nextX =
              direction.x > 0
                ? (Math.floor(currentPos.x / heatMapStep) + 1) * heatMapStep - currentPos.x
                : (Math.ceil(currentPos.x / heatMapStep) - 1) * heatMapStep - currentPos.x;

            const nextY =
              direction.y > 0
                ? (Math.floor(currentPos.y / heatMapStep) + 1) * heatMapStep - currentPos.y
                : (Math.ceil(currentPos.y / heatMapStep) - 1) * heatMapStep - currentPos.y;

            const nextZ =
              direction.z > 0
                ? (Math.floor(currentPos.z / heatMapStep) + 1) * heatMapStep - currentPos.z
                : (Math.ceil(currentPos.z / heatMapStep) - 1) * heatMapStep - currentPos.z;

            const dx = direction.x !== 0 ? Math.abs(nextX / direction.x) : Infinity;
            const dy = direction.y !== 0 ? Math.abs(nextY / direction.y) : Infinity;
            const dz = direction.z !== 0 ? Math.abs(nextZ / direction.z) : Infinity;

            const nextTravel = Math.min(
              dx < minStepThreshold ? Infinity : dx,
              dy < minStepThreshold ? Infinity : dy,
              dz < minStepThreshold ? Infinity : dz
            );
            travel += nextTravel + minStepThreshold;
          }

          if (!intersections.length) break;

          // Update for next bounce
          const intersection = intersections[0];
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
          position = intersection.point;
          bounces++;
        }
      }
    }
  });

  for (const key in map) {
    maxPressure = Math.max(maxPressure, map[key].pressureSum);
    minFrequency = Math.min(minFrequency, map[key].frequencySum / map[key].pressureSum);
    maxFrequency = Math.max(maxFrequency, map[key].frequencySum / map[key].pressureSum);
  }

  console.log(maxPressure, minFrequency, maxFrequency);

  return Object.entries(map)
    .map(([key, averages]) => {
      const [x, y, z] = key.split(",").map((v) => Number(v));
      const opacity = averages.pressureSum / maxPressure;
      if (opacity < 0.01) return null;
      const frequencyNormalized =
        (averages.frequencySum / averages.pressureSum - minFrequency) / (maxFrequency - minFrequency);
      if (frequencyNormalized < 0.1) console.log(key);
      const colorLerp = new three.Color(0xff0000).lerp(new three.Color(0x00ff00), frequencyNormalized);
      const geometry = new three.SphereGeometry(frequencyNormalized < 0.1 ? 2 : heatMapStep * 0.5);
      const material = new three.MeshBasicMaterial({
        color: frequencyNormalized < 0.1 ? new three.Color(0x0000ff) : colorLerp,
        transparent: true,
        opacity: frequencyNormalized < 0.1 ? 1.0 : opacity,
      });
      const mesh = new three.Mesh(geometry, material);
      mesh.position.set(x + heatMapStep / 2, y + heatMapStep / 2, z + heatMapStep / 2);
      return mesh;
    })
    .filter((mesh) => mesh !== null);
}
