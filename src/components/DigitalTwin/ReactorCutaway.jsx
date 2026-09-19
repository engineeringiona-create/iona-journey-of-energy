import {useLayoutEffect, useRef} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import {reduceMotion} from '../../three/scene-utils.js';

/** Reversible educational overlay. The cached GLB and facility layout remain intact. */
export function ReactorCutaway({plantRootRef, open}) {
  const bubbles = useRef(null);
  const {gl, invalidate} = useThree();
  useLayoutEffect(() => {
    if (!open) return;
    const reactor = plantRootRef.current?.getObjectByName('digester');
    const wall = reactor?.getObjectByName('tank_wall');
    if (!reactor || !wall) return;
    reactor.updateWorldMatrix(true,true);
    wall.geometry.computeBoundingBox();
    const relative = new THREE.Matrix4().copy(reactor.matrixWorld).invert().multiply(wall.matrixWorld);
    const box = wall.geometry.boundingBox.clone().applyMatrix4(relative);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const radius = Math.min(size.x,size.z)*.46;
    const height = size.y;
    const group = new THREE.Group(); group.name='educational_cutaway'; group.raycast=()=>{};
    const resources = [];
    function mesh(geometry,material) {resources.push(geometry,material);const m=new THREE.Mesh(geometry,material);m.raycast=()=>{};group.add(m);return m;}
    const liquid = mesh(new THREE.CylinderGeometry(radius,radius,height*.62,64),new THREE.MeshStandardMaterial({color:'#8b9a49',transparent:true,opacity:.16,depthWrite:false,roughness:.6,side:THREE.DoubleSide}));
    liquid.position.set(center.x,box.min.y+height*.31,center.z);
    const surface = mesh(new THREE.RingGeometry(radius*.96,radius,64),new THREE.MeshBasicMaterial({color:'#ffc700',side:THREE.DoubleSide}));
    surface.rotation.x=-Math.PI/2;surface.position.set(center.x,box.min.y+height*.62,center.z);
    const gas = mesh(new THREE.CylinderGeometry(radius*.98,radius*.98,height*.29,64,1,true),new THREE.MeshBasicMaterial({color:'#ffc700',transparent:true,opacity:.075,depthWrite:false,side:THREE.DoubleSide}));
    gas.position.set(center.x,box.min.y+height*.805,center.z);
    const sphere = new THREE.SphereGeometry(radius*.018,8,6);
    const bubbleMaterial = new THREE.MeshBasicMaterial({color:'#d5ae27',transparent:true,opacity:.75});
    resources.push(sphere,bubbleMaterial);
    const particles = new THREE.InstancedMesh(sphere,bubbleMaterial,18); particles.raycast=()=>{}; group.add(particles);
    bubbles.current={particles,center,radius,min:box.min.y,height,time:0,dummy:new THREE.Object3D()};
    reactor.add(group);
    // Clone only the cut wall material; selection and hover retain their own materials.
    const original = wall.material;
    const normal = new THREE.Vector3(-1,0,-1).normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal,center).applyMatrix4(reactor.matrixWorld);
    const wallMaterials = (Array.isArray(original)?original:[original]).map(m=>{const c=m.clone();c.clippingPlanes=[plane];c.clipShadows=true;c.transparent=false;c.opacity=1;c.side=THREE.DoubleSide;return c;});
    wall.material=Array.isArray(original)?wallMaterials:wallMaterials[0];
    const previousClipping=gl.localClippingEnabled;gl.localClippingEnabled=true;
    const roofs=[];
    reactor.traverse(node=>{if (/^(gas_dome|dome_seam)(?:_\d+)?$/.test(node.name)) roofs.push({node,y:node.position.y});});
    const roofMaterials=[];
    roofs.forEach(({node})=>{
      if(!node.isMesh)return;
      const original=node.material;
      const clones=(Array.isArray(original)?original:[original]).map(m=>{const c=m.clone();c.opacity=1;c.transparent=false;c.depthWrite=true;return c;});
      roofMaterials.push({node,original,clones});node.material=Array.isArray(original)?clones:clones[0];
    });
    const tweens=roofs.map(({node,y})=>gsap.to(node.position,{y:y+height*.65,duration:reduceMotion?0:1,ease:'power2.inOut',onUpdate:invalidate}));
    invalidate();
    return ()=>{tweens.forEach(t=>t.kill());roofs.forEach(({node,y})=>{node.position.y=y;});roofMaterials.forEach(({node,original,clones})=>{node.material=original;clones.forEach(m=>m.dispose());});wall.material=original;wallMaterials.forEach(m=>m.dispose());gl.localClippingEnabled=previousClipping;reactor.remove(group);resources.forEach(r=>r.dispose());particles.dispose();bubbles.current=null;invalidate();};
  },[open,plantRootRef,gl,invalidate]);
  useFrame((_,delta)=>{
    const b=bubbles.current;if(!b)return;
    if(!reduceMotion)b.time+=Math.min(delta,.05)*.13;
    for(let i=0;i<18;i++){
      const angle=i*2.39996,r=b.radius*(.2+(i%5)*.13),progress=(i/18+b.time)%1;
      b.dummy.position.set(b.center.x+Math.cos(angle)*r,b.min+b.height*(.15+progress*.8),b.center.z+Math.sin(angle)*r);
      b.dummy.scale.setScalar(.6+Math.sin(progress*Math.PI)*.5);b.dummy.updateMatrix();b.particles.setMatrixAt(i,b.dummy.matrix);
    }
    b.particles.instanceMatrix.needsUpdate=true;
  });
  return null;
}
