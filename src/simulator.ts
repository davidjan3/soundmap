import { SoundBeam } from "soundbeam";
import { config } from "./config";
import Utils from "./utils";
import * as three from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";

const scene = new three.Scene();

const walls = loadWalls();
scene.add(...walls);

const sources = loadSources();
scene.add(...sources);

const soundbeams = propagateSoundBeams();

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

function animate() {
  angle += 0.005;
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
      opacity: 0.5,
      transparent: true,
    });
    const mesh = new three.Mesh(geometry, material);
    mesh.layers.enable(1);
    return mesh;
  });
}

function loadSources() {
  return config.room.sources.map((src) => {
    const phiStart = src.degreeRangeHorizontal ? src.degreeRangeHorizontal[0] * (Math.PI / 180) : 0;
    const phiLength = src.degreeRangeHorizontal ? src.degreeRangeHorizontal[1] * (Math.PI / 180) : Math.PI * 2;
    const thetaStart = src.degreeRangeVertical ? src.degreeRangeVertical[0] * (Math.PI / 180) : 0;
    const thetaLength = src.degreeRangeVertical ? src.degreeRangeVertical[1] * (Math.PI / 180) : Math.PI;
    const widthSegments = Math.ceil((phiLength / (Math.PI * 2)) * 32);
    const heightSegments = Math.ceil((thetaLength / Math.PI) * 16);
    const geometry = new three.SphereGeometry(
      0.2,
      widthSegments,
      heightSegments,
      phiStart,
      phiLength,
      thetaStart,
      thetaLength
    );
    const material = new three.MeshStandardMaterial({
      color: 0xff0000,
      side: three.DoubleSide,
    });
    const mesh = new three.Mesh(geometry, material);
    mesh.position.copy(Utils.Pt2Vector3(src.position));
    return mesh;
  });
}

function propagateSoundBeams() {
  const soundbeams: SoundBeam[] = [];
  config.room.sources.forEach((src, sourceIndex) => {
    const phiStart = src.degreeRangeHorizontal ? src.degreeRangeHorizontal[0] * (Math.PI / 180) : 0;
    const phiLength = src.degreeRangeHorizontal ? src.degreeRangeHorizontal[1] : 360;
    const thetaStart = src.degreeRangeVertical ? src.degreeRangeVertical[0] * (Math.PI / 180) : 0;
    const thetaLength = src.degreeRangeVertical ? src.degreeRangeVertical[1] : 180;
    const resolution = config.settings?.sourceResolution ?? 1;
    const totalBeams = Math.floor(phiLength * resolution + 1) * Math.floor(thetaLength * resolution + 1);
    const srcSoundPressure = Utils.mapFrequencyMap(src.volume, Utils.dB2Pa);
    for (let x = 0; x <= phiLength * resolution; x++) {
      const phi = phiStart + x * (Math.PI / 180) * (1 / resolution);
      for (let y = 0; y <= thetaLength * resolution; y++) {
        let soundPressure = Utils.mapFrequencyMap(srcSoundPressure, (v) => v / totalBeams);
        const theta = thetaStart + y * (Math.PI / 180) * (1 / resolution);
        const raycaster = new three.Raycaster(
          Utils.Pt2Vector3(src.position),
          new three.Vector3(1, 0, 0).applyEuler(new three.Euler(phi, theta, 0, "XYZ"))
        );
        raycaster.layers.set(1);
        const intersections = raycaster.intersectObjects(scene.children);
        if (!intersections.length) continue;
        const intersectionPoint = intersections[0].point;
        const beam: SoundBeam = {
          sourceIndex: sourceIndex,
          soundPressure: soundPressure,
          from: Utils.Pt2Vector3(src.position),
          to: intersectionPoint,
        };
        soundbeams.push(beam);

        const lineGeometry = new three.BufferGeometry().setFromPoints([beam.from, beam.to]);
        const lineMaterial = new three.LineBasicMaterial({ color: 0xff0000 });
        const line = new three.Line(lineGeometry, lineMaterial);
        scene.add(line);
      }
    }
  });
  return soundbeams;
}
