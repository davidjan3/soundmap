import { room } from "./room";
import * as three from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";

const width = window.innerWidth;
const height = window.innerHeight;

const camera = new three.PerspectiveCamera(90, width / height, 0.01, 1000);
camera.position.z = -5;
camera.lookAt(0, 0, 0);
const scene = new three.Scene();
const renderer = new three.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

const roomObjects = parseRoom();
scene.add(...roomObjects);

const mergedRoomGeometry = BufferGeometryUtils.mergeGeometries(roomObjects.map((obj) => obj.geometry));
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

let angle = 0;
const cameraDistance = 10;

function animate() {
  angle += 0.005;
  camera.position.x = center.x + Math.cos(angle) * cameraDistance;
  camera.position.y = 5;
  camera.position.z = center.z + Math.sin(angle) * cameraDistance;

  camera.lookAt(center);

  renderer.render(scene, camera);
}

animate();

function parseRoom() {
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
    return new three.Mesh(geometry, material);
  });
}
