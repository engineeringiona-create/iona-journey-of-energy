import { Vector3 } from 'three';

/** Fit all eight corners in perspective, accounting for each corner's depth. */
export function fitPerspectiveBox(box, camera, direction, margin = 1.12) {
  const center = box.getCenter(new Vector3());
  const half = box.getSize(new Vector3()).multiplyScalar(.5);
  const backward = direction.clone().normalize();
  const right = new Vector3().crossVectors(camera.up, backward).normalize();
  const up = new Vector3().crossVectors(backward, right).normalize();
  const tanY = Math.tan(camera.getEffectiveFOV() * Math.PI / 360);
  const tanX = tanY * Math.max(camera.aspect, .01);
  let distance = camera.near * 2;
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const corner = new Vector3(x * half.x, y * half.y, z * half.z);
    const depth = corner.dot(backward);
    distance = Math.max(distance, depth + Math.abs(corner.dot(right)) * margin / tanX,
      depth + Math.abs(corner.dot(up)) * margin / tanY, depth + camera.near * 2);
  }
  return { center, position: center.clone().addScaledVector(backward, distance) };
}

/** Fit the actual visible geometry instead of empty corners of a site-wide box. */
export function fitPerspectiveObject(root, camera, direction, margin = 1.07) {
  root.updateWorldMatrix(true, true);
  const backward = direction.clone().normalize();
  const right = new Vector3().crossVectors(camera.up, backward).normalize();
  const up = new Vector3().crossVectors(backward, right).normalize();
  const points = [];
  const point = new Vector3();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  root.traverseVisible(node => {
    const positions = node.geometry?.attributes?.position;
    if (!node.isMesh || !positions) return;
    if (node.material && !Array.isArray(node.material) && (!node.material.visible || node.material.opacity === 0)) return;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
      const x = point.dot(right), y = point.dot(up), z = point.dot(backward);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      points.push(x, y, z);
    }
  });
  if (!points.length) throw new Error('Cannot frame an empty model');
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  const center = right.clone().multiplyScalar(cx).addScaledVector(up, cy).addScaledVector(backward, cz);
  const tanY = Math.tan(camera.getEffectiveFOV() * Math.PI / 360);
  const tanX = tanY * Math.max(camera.aspect, .01);
  let distance = camera.near * 2;
  for (let i = 0; i < points.length; i += 3) {
    const depth = points[i + 2] - cz;
    distance = Math.max(distance, depth + Math.abs(points[i] - cx) * margin / tanX,
      depth + Math.abs(points[i + 1] - cy) * margin / tanY, depth + camera.near * 2);
  }
  return { center, position: center.clone().addScaledVector(backward, distance) };
}
