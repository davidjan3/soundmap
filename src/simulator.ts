import { room } from "./room";
import * as three from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";

const scene = new three.Scene();

const walls = loadWalls();
scene.add(...walls);

const sources = loadSources();
scene.add(...sources);

const camera = new three.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = -5;
const mergedRoomGeometry = BufferGeometryUtils.mergeGeometries(walls.map((obj) => obj.geometry));
mergedRoomGeometry.computeBoundingBox();
let center = new three.Vector3(0, 0, 0);
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
  return room.walls.map((wall) => {
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
    return mesh;
  });
}

function loadSources() {
  return room.sources.map((src) => {
    let phiStart = src.degreeRangeHorizontal ? src.degreeRangeHorizontal[0] * (Math.PI / 180) : 0;
    let phiLength = src.degreeRangeHorizontal ? src.degreeRangeHorizontal[1] * (Math.PI / 180) : Math.PI * 2;
    let thetaStart = src.degreeRangeVertical ? src.degreeRangeVertical[0] * (Math.PI / 180) : 0;
    let thetaLength = src.degreeRangeVertical ? src.degreeRangeVertical[1] * (Math.PI / 180) : Math.PI;
    let widthSegments = Math.ceil((phiLength / (Math.PI * 2)) * 32);
    let heightSegments = Math.ceil((thetaLength / Math.PI) * 16);
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
      opacity: 0.5,
      transparent: true,
      side: three.DoubleSide,
    });
    const mesh = new three.Mesh(geometry, material);
    mesh.position.copy(new three.Vector3(...src.position));
    return mesh;
  });
}
