import * as THREE from 'three';

/* Runtime geometry overrides layered onto specific structures loaded
   from the scanned/authored facility GLB (model-lab/src/iona-tesis-3d.glb)
   — that file is a static binary asset with no 3D editor available in
   this environment, so "replace the generic building" happens as an
   additive/subtractive pass over the already-loaded scene graph instead
   of touching the source file itself.

   Call once, synchronously, from Model's useLayoutEffect in
   GltfTwinScene.jsx — BEFORE that effect's own material-building pass
   and final scene.traverse() — so every mesh added here gets picked up
   by the exact same per-structure material/hover/click system as
   everything the GLB itself shipped with: name a new mesh like an
   existing *_MESH_NAMES entry (or a newly added one, see that file's
   ENGINE_ROOM_CONTAINER_MESH_NAMES/BUILDING_STRUCTURAL_STEEL_MESH_NAMES) and
   it's handled with zero further plumbing — findStructureNode() walks
   up to whichever top-level plantData structure owns it regardless of
   nesting depth, meshBaseName() only strips a trailing GLTFLoader
   dedupe suffix so it's a pure no-op on manually-created names that
   never had one. See those two functions' own comments in
   GltfTwinScene.jsx.

   Real dimensions below (wall spans, roof height, slab footprint) were
   read directly out of the GLB's own accessor bounds and node matrices
   with a small one-off script, not eyeballed — but this was written
   and reasoned about without ever being able to render it in a
   browser, so treat the numbers as "matched to the source data", not
   "visually verified". Idempotency guards throughout: index.html mounts
   this component under React.StrictMode, which double-invokes
   useLayoutEffect once in dev — without a guard, a second pass would
   duplicate every rib/post/stripe added here. */

function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

function makeMesh(geometry, name, position, rotation, material, castsShadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  /* Every one of these meshes used to cast a shadow, trim included —
     harmless back when the shadow map only rebaked on camera moves,
     but now that it rebakes on its own throttle (GltfTwinScene.jsx's
     SHADOW_BAKE_INTERVAL) every mesh in the depth pass has a real,
     recurring cost. Sub-centimeter trim (ribs, corner castings,
     louvers) has no visible shadow payoff at this facility's scale, so
     it still receives shadows (stays grounded/shaded) but no longer
     casts them. */
  mesh.castShadow = castsShadow;
  mesh.receiveShadow = true;
  return mesh;
}

/* ---------------- Engine room -> real ISO shipping container ----------------
   Phase 47 kept the GLB's original engine_room_shell (a plain 4-wall
   box with residential-looking door/windows) and only added corrugation
   on top of it — reported back as still reading as "a house", since the
   domestic door/windows/flat roof underneath were still there. This
   phase deletes that shell outright (same treatment pump_room_shell
   already got) and rebuilds every part of it — walls, corner castings,
   roof, dual roof fans, exhaust stack, intake louvers, hazard stripe,
   door — from scratch, no leftover residential parts anywhere.

   Real footprint dims carried over from the deleted shell (still a
   reasonable container envelope): wall_front/back were at z=+-3.41
   spanning x:[-7,7], wall_right/left at x=+-6.91 spanning z:[-3.32,
   3.32], all with local Y span [-2.3,2.3] centered at world y=2.6
   (floor-to-eave ~0.3-4.9). Slightly rounded down here (HALF_W/HALF_D
   below) so the new corrugated panels sit just inside where the old
   flush walls were, not floating past them.

   Originally every part here shared one name/material — a dark
   charcoal (#2b2e30) at metalness 0.45, which under this scene's
   lighting rendered as a near-featureless black block ("pitch-black
   void", reported back). Metallic PBR surfaces only read as lit where
   the environment/lights actually catch a specular highlight; a dark
   base color combined with real metalness has very little diffuse
   fallback to fill in everywhere else, so large flat dark-metal panels
   are especially prone to this. Split into 5 distinct named zones now
   (container_wall/container_frame/container_stack/container_fan/
   container_hazard_stripe, each with its own material in
   GltfTwinScene.jsx, scoped to engine_room only so pump_room's canopy
   and scada_room's own prefab walls are untouched) — lighter base
   colors and lower metalness throughout, per this phase's spec. */
const CONTAINER_HALF_W = 6.9;
const CONTAINER_HALF_D = 3.35;
const CONTAINER_WALL_HALF_H = 2.25;
const CONTAINER_WALL_MID_Y = 2.6;
const CONTAINER_WALL_THK = 0.1;
const CONTAINER_ROOF_Y = CONTAINER_WALL_MID_Y + CONTAINER_WALL_HALF_H + 0.12;

function rebuildEngineRoomContainer(engineRoom) {
  if (engineRoom.getObjectByName('container_shell')) return;

  const oldShell = engineRoom.getObjectByName('engine_room_shell');
  if (oldShell) engineRoom.remove(oldShell);

  const container = new THREE.Group();
  container.name = 'container_shell';
  engineRoom.add(container);

  /* Walls: 4 flat panels first, then vertical corrugation ribs proud of
     each one — the front/back (long, x-spanning) walls get more ribs
     than the side (short, z-spanning) ones, same rib cross-section
     throughout. No door/window meshes anywhere in this whole function —
     "no glass house windows" per spec; container_door below is a plain
     blank steel panel, not a separate cutout. */
  [CONTAINER_HALF_D, -CONTAINER_HALF_D].forEach((z) => {
    container.add(makeMesh(
      box(CONTAINER_HALF_W * 2, CONTAINER_WALL_HALF_H * 2, CONTAINER_WALL_THK),
      'container_wall', [0, CONTAINER_WALL_MID_Y, z]
    ));
  });
  [CONTAINER_HALF_W, -CONTAINER_HALF_W].forEach((x) => {
    container.add(makeMesh(
      box(CONTAINER_WALL_THK, CONTAINER_WALL_HALF_H * 2, CONTAINER_HALF_D * 2),
      'container_wall', [x, CONTAINER_WALL_MID_Y, 0]
    ));
  });

  const RIB_SIZE = [0.09, CONTAINER_WALL_HALF_H * 2 - 0.2, 0.05];
  const LONG_RIB_COUNT = 20;
  for (let i = 0; i < LONG_RIB_COUNT; i++) {
    const x = -CONTAINER_HALF_W + 0.2 + (i / (LONG_RIB_COUNT - 1)) * (CONTAINER_HALF_W * 2 - 0.4);
    [CONTAINER_HALF_D + 0.03, -CONTAINER_HALF_D - 0.03].forEach((z) => {
      container.add(makeMesh(box(...RIB_SIZE), 'container_wall', [x, CONTAINER_WALL_MID_Y, z], null, undefined, false));
    });
  }
  const SHORT_RIB_COUNT = 11;
  const SHORT_RIB_SIZE = [0.05, CONTAINER_WALL_HALF_H * 2 - 0.2, 0.09];
  for (let i = 0; i < SHORT_RIB_COUNT; i++) {
    const z = -CONTAINER_HALF_D + 0.2 + (i / (SHORT_RIB_COUNT - 1)) * (CONTAINER_HALF_D * 2 - 0.4);
    [CONTAINER_HALF_W + 0.03, -CONTAINER_HALF_W - 0.03].forEach((x) => {
      container.add(makeMesh(box(...SHORT_RIB_SIZE), 'container_wall', [x, CONTAINER_WALL_MID_Y, z], null, undefined, false));
    });
  }

  /* Reinforced corner castings — a real ISO container's 8 corner
     fittings, small solid blocks at every top/bottom corner. Own name/
     material (container_frame, medium/dark slate) so they read as
     distinct geometric definition against the lighter wall panels,
     per spec, instead of blending into them. */
  const CASTING = [0.28, 0.28, 0.28];
  [CONTAINER_HALF_W - 0.14, -CONTAINER_HALF_W + 0.14].forEach((x) => {
    [CONTAINER_HALF_D - 0.14, -CONTAINER_HALF_D + 0.14].forEach((z) => {
      [CONTAINER_WALL_MID_Y + CONTAINER_WALL_HALF_H - 0.14, CONTAINER_WALL_MID_Y - CONTAINER_WALL_HALF_H + 0.14].forEach((y) => {
        container.add(makeMesh(box(...CASTING), 'container_frame', [x, y, z], null, undefined, false));
      });
    });
  });

  /* Blank steel door panel (no window, no glass) on the front wall — named
     'door' so the shared recipe map paints it IONA green like the other
     building doors. */
  container.add(makeMesh(box(1.1, 2.05, 0.05), 'door', [-4.6, 1.35, CONTAINER_HALF_D + 0.03]));

  /* Roof deck. */
  container.add(makeMesh(
    box(CONTAINER_HALF_W * 2 + 0.25, 0.15, CONTAINER_HALF_D * 2 + 0.25),
    'container_wall', [0, CONTAINER_ROOF_Y, 0]
  ));

  /* Dual rooftop cooling fans/radiators — two identical housing+blade
     assemblies, symmetric across the roof's centerline. The blades sit
     in their own 'container_fan_hub' group so GltfTwinScene's useFrame
     can spin them in place (same pattern as the mixer propeller hubs);
     the housing stays static. */
  [-3.2, 3.2].forEach((x) => {
    const fanY = CONTAINER_ROOF_Y + 0.35;
    const housingGeo = new THREE.CylinderGeometry(0.78, 0.78, 0.5, 16);
    container.add(makeMesh(housingGeo, 'container_fan', [x, fanY, 0]));
    const hub = new THREE.Group();
    hub.name = 'container_fan_hub';
    hub.position.set(x, fanY + 0.28, 0);
    for (let b = 0; b < 3; b++) {
      const blade = makeMesh(box(0.09, 0.05, 1.35), 'container_fan', [0, 0, 0], null, undefined, false);
      blade.rotation.y = (b / 3) * Math.PI * 2;
      hub.add(blade);
    }
    container.add(hub);
  });

  /* Vertical exhaust silencer chimney stack + cap, off to one corner —
     roughly where the deleted shell's own exhaust_stack sat. Own name/
     material (container_stack, clean galvanized/stainless steel). */
  const stackGeo = new THREE.CylinderGeometry(0.36, 0.36, 3.2, 12);
  container.add(makeMesh(stackGeo, 'container_stack', [5.6, CONTAINER_ROOF_Y + 1.75, -2.1]));
  container.add(makeMesh(
    new THREE.CylinderGeometry(0.44, 0.44, 0.12, 12),
    'container_stack', [5.6, CONTAINER_ROOF_Y + 3.42, -2.1]
  ));

  /* Air intake louvers: a bank of angled slats on the right wall —
     same dark metallic mesh-grille material as the roof fans. */
  const LOUVER_COUNT = 6;
  for (let i = 0; i < LOUVER_COUNT; i++) {
    const y = CONTAINER_WALL_MID_Y - 0.75 + i * 0.3;
    container.add(makeMesh(
      box(0.05, 0.24, 1.2), 'container_fan', [CONTAINER_HALF_W + 0.07, y, 1.1], [0, 0, Math.PI / 7], undefined, false
    ));
  }

  /* Hazard stripe: a low horizontal safety band near grade on the front
     wall — its own name/material (ENGINE_ROOM_HAZARD_MESH_NAME), the
     only non-charcoal part of this whole container. */
  container.add(makeMesh(box(CONTAINER_HALF_W * 2 - 1.2, 0.35, 0.03), 'container_hazard_stripe', [0, 0.55, CONTAINER_HALF_D + 0.05]));
}

/* ---------------- Pump room -> open-air covered pump station ----------------
   Real dims from the GLB: slab spans x:[-5.3,5.3] z:[-3.8,3.8], top
   face at y~0.15; the removed shell's own roof sat at y=4.21 spanning
   x:[-4.75,4.75] z:[-3.25,3.25]. pump_room_shell (walls/roof/door/
   window/vent — all 10 of its children) is removed outright, not
   hidden — "walls are completely open" is a permanent architectural
   change here, not a togglable state. `slab` (kept, untouched — the
   spec's own "Foundation: heavy concrete slab base") and `pump_set`
   (kept, untouched — three complete pump assemblies already modeled:
   baseplate/volute/suction/discharge/motor/fins per pump, already
   exactly the spec's "visible 3D slurry/feed pump assemblies... drive
   motors, manifolds") both live directly under pump_room, siblings of
   the removed shell, so removing only the shell node leaves them
   exactly as they were. */
function replacePumpRoomShell(pumpRoom) {
  if (pumpRoom.getObjectByName('pump_room_canopy')) return;

  const shell = pumpRoom.getObjectByName('pump_room_shell');
  if (shell) pumpRoom.remove(shell);

  const canopy = new THREE.Group();
  canopy.name = 'pump_room_canopy';
  pumpRoom.add(canopy);

  /* 6 posts on a 3x2 grid inset from the slab's own edges — corner +
     mid-span columns, holding the canopy at roughly the removed shell's
     own eave height (was 2.2+-1.9, i.e. floor-to-eave ~0.3-4.1). Named
     'canopy_post' — see BUILDING_STRUCTURAL_STEEL_MESH_NAMES in
     GltfTwinScene.jsx for its bare-steel material. */
  const POST_RADIUS = 0.12;
  const POST_HEIGHT = 4.9;
  [-4.4, 0, 4.4].forEach((x) => {
    [-3.1, 3.1].forEach((z) => {
      canopy.add(makeMesh(
        new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS, POST_HEIGHT, 10),
        'canopy_post',
        [x, 0.15 + POST_HEIGHT / 2, z]
      ));
    });
  });

  /* Canopy roof: the removed shell's own roof footprint/height, tilted
     ~4 deg (0.07 rad) for rain runoff — "angled slightly" per spec, not
     a full mono-pitch redesign. Named 'roof' on purpose:
     BUILDING_ROOF_MESH_NAMES already covers that name (the same dark
     standing-seam material the other two buildings' roofs use), so
     this needs zero new material wiring even though the shell it
     replaces is gone. */
  canopy.add(makeMesh(box(9.6, 0.22, 6.6), 'roof', [0, 5.21, 0], [0.07, 0, 0]));
}

/* ---------------- Digester -> seal the wall/tabliye seam ----------------
   Real dims from the GLB: tank_wall (radius 12) tops out at world
   y=6.0; top_ring (the tabliye) is centered at y=5.85, its own bounds
   spanning y:[5.625,6.075] and x/z:[-12.3,12.3]. Those two bounding
   boxes DO already overlap vertically (the wall's own top, y=6.0, sits
   inside the ring's y-span) — so the reported gap isn't a simple
   vertical shortfall between two boxes that don't touch, it's almost
   certainly a thin RADIAL slit: whatever the ring's actual solid
   geometry looks like inside that outer x/z:±12.3 bounding box (an
   annulus/rim shape, not a solid disk — its inner edge isn't captured
   by a bounding box at all), it apparently doesn't sit flush against
   the wall's own outer surface at radius 12 everywhere around the
   circumference, leaving a hairline gap the internal mixers show
   through from outside.

   Can't resolve that precisely without decoding the mesh's actual
   vertex/triangle data (its true inner radius isn't visible from the
   GLB's JSON alone the way outer bounding boxes are) — no 3D editor
   available in this environment either way. Sealed pragmatically
   instead: an extra opaque lateral cylinder surface, radius 12 (exactly
   matching the wall), spanning generously past both the wall's own top
   (6.0) and the ring's full bounds (5.625-6.075) with real margin each
   way, rather than trying to hit a precise 0.05m overlap I can't
   verify. Named 'tank_wall' on purpose — DIGESTER_WALL_MESH_NAME in
   GltfTwinScene.jsx already routes that exact name to the tank wall's
   own material (with its corrugation bump map), so this patch reads as
   a seamless continuation of the real wall, not a visibly different
   band, with zero new material wiring needed. openEnded (no top/bottom
   caps) since only the lateral surface is needed to plug a radial slit
   — caps would just be flat opaque discs sitting uselessly inside the
   ring/dome geometry that's already there. */
function sealDigesterWallSeam(digester) {
  /* Can't rename this mesh to anything other than 'tank_wall' (that's
     what routes it to the wall's own material, see this function's own
     comment above) or use getObjectByName for the idempotency check the
     way every other override in this file does — a userData marker
     instead, checked across digester's direct children (tank_wall,
     like every other real mesh here, is one). */
  if (digester.children.some((child) => child.userData.isWallSeamSeal)) return;

  const SEAL_RADIUS = 12;
  const SEAL_BOTTOM_Y = 5.55;
  const SEAL_TOP_Y = 6.15;
  const sealGeo = new THREE.CylinderGeometry(
    SEAL_RADIUS, SEAL_RADIUS, SEAL_TOP_Y - SEAL_BOTTOM_Y, 64, 1, true
  );
  const seal = makeMesh(sealGeo, 'tank_wall', [0, (SEAL_BOTTOM_Y + SEAL_TOP_Y) / 2, 0], null, null);
  seal.userData.isWallSeamSeal = true;
  digester.add(seal);
}

/* ---------------- Digester -> 4 side-entry wall mixers ----------------
   Real dims from the GLB: tank_wall is a cylinder of radius 12 centered
   at world y=3.45, wall face spanning world y:[0.9,6.0] — mid-wall
   height (3.45) is what MID_Y below matches. The GLB already has 2
   *different* wall-mounted mixers (nodes mixer_1/mixer_2 under the
   `mixers` group, at the diagonal/corner azimuths ~45 deg and ~225 deg)
   — a separate, pre-existing feature this doesn't touch, remove, or
   reuse; these 4 are new, at true 0/90/180/270 deg, and use entirely
   distinct mesh names (DIGESTER_MIXER_MESH_NAMES in GltfTwinScene.jsx)
   so there's no chance of colliding with that existing pair.

   CONFIRMED BUG, now fixed: the previous version oriented each mixer
   with `group.lookAt(tankCenter)` and built the shaft along local -Z,
   assuming -Z would point at the target the way it does for a camera.
   It doesn't. Checked directly against this project's installed
   three@0.185.1 source (node_modules/three/src/core/Object3D.js,
   Object3D.prototype.lookAt): for a Camera or Light it calls
   `_m1.lookAt(_position, _target, up)`, but for every other Object3D
   (a plain Group, like these) it calls `_m1.lookAt(_target, _position,
   up)` — eye and target swapped — which makes local +Z point at the
   target, not -Z. So the old code's "interior" shaft (built at -Z) was
   actually pointing AWAY from the tank center, into open air — exactly
   the "shafts extending outwards" bug report. Rebuilt below using
   explicit Vector3 math instead of lookAt at all: computeMixerDirection
   returns a real world-space unit vector, and
   quaternion.setFromUnitVectors(+Z, thatVector) maps local +Z onto it
   directly — no eye/target convention to get backwards a second time. */
const DIGESTER_RADIUS = 12;
/* Phase 99: was 3.45 (mid-wall). The heating coil now fills the inner wall
   from y 1.25 to 3.55 (COIL_LAST_Y), and the side mixers mount just above
   its top ring, per the brief: "karıştırıcılar en üstteki ısı boru sırasının
   biraz üstünde". 4.15 leaves the shaft's slight downward run clear of the
   top ring as it passes the ring's radius. */
const DIGESTER_MID_Y = 4.15;
/* Phase 98: was [0, 90, 180, 270]. Azimuth 0 is exactly where the pump
   room's feed line lands on the wall (feed_nozzle, measured at x=12.3, z=0),
   so mixer #1 and that pipe occupied the same nozzle — the reported clash.
   Rotated 30 deg: 30/120/210/300 clears the feed nozzle (0), the stair
   (180) and the two heat nozzles (~263/277) with margin at r=12. */
const MIXER_AZIMUTHS = [Math.PI / 6, (2 * Math.PI) / 3, (7 * Math.PI) / 6, (5 * Math.PI) / 3];

/* Computes a real inward-pointing unit vector for a mixer mounted at
   `mountPos`: base direction is straight from mountPos to a point
   directly below it on the tank's own vertical axis
   (0, mountPos.y - 0.4, 0) — for a wall mount (mountPos.x/z far from 0)
   this points strongly inward with a mild built-in downward bias; for
   the top mixers (mountPos.x/z close to the axis already) it's mostly
   just "down", which combined with their own larger extraDownwardTilt
   below is what gives them their steep, near-vertical incline.
   `tangentAngle` rotates that base direction around the world Y axis
   (an unambiguous, always-correct way to add "swirl" — real Y-axis
   rotation, no sign trap possible). `extraDownwardTilt` then pushes the
   vector's own Y component down further by sin(angle) and renormalizes
   — deliberately NOT another axis-angle rotation: decreasing Y directly
   is downward regardless of the vector's current azimuth/tilt, so
   there's no second sign to get wrong on top of the lookAt one above. */
function computeMixerDirection(mountPos, tangentAngle, extraDownwardTilt) {
  const dir = new THREE.Vector3(0, mountPos.y - 0.4, 0).sub(mountPos).normalize();
  dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), tangentAngle);
  dir.y -= Math.sin(extraDownwardTilt);
  return dir.normalize();
}

/* ~17 deg tangential swirl on every side mixer, same sign each time so
   the 4 of them swirl the same rotational way around the tank rather
   than fighting each other — matches "canted slightly to the right"
   well enough without a defined viewer position to make "right"
   itself unambiguous. ~10 deg *additional* downward pitch, on top of
   the mild downward bias computeMixerDirection's base formula already
   has built in. */
const SIDE_MIXER_TANGENT_ANGLE = 0.30;
const SIDE_MIXER_EXTRA_TILT = 0.17;
const SIDE_MIXER_SHAFT_LENGTH = 2.5;

/* Guarantees these render after (on top of) the tank wall's alpha-
   blended material regardless of draw-order/depth-sort edge cases in
   X-ray mode — belt-and-suspenders alongside these meshes never being
   handed to the dimming system at all (see this block's own comment
   below) for "propellers, shafts, motors clearly pop inside the liquid
   volume" per spec. THREE's default renderOrder is 0; opaque meshes
   normally don't need this, but the tank wall going transparent right
   in front of them while they're deep inside a bounding box that
   overlaps it is exactly the case this exists for. */
const MIXER_RENDER_ORDER = 10;

/* These meshes are routed around GltfTwinScene.jsx's whole per-structure
   material system on purpose (see DIGESTER_MIXER_MESH_NAMES's own
   comment there, and the scene.traverse() skip-check next to it) — the
   X-ray effect only ever dims materials it finds registered in that
   system, so the cleanest way to guarantee these assemblies stay 100%
   opaque through every state is to never hand their materials to it at
   all. transparent:false / opacity:1 / depthWrite:true set explicitly
   (not just left at the THREE defaults, which happen to already be
   this) so that's true by inspection here, not by coincidence. Built
   once, shared across every mixer instance — none of these ever differ
   per-mixer. */
/* Phase 102: brushed stainless — the mixers are the one non-white thing in
   the white maquette so they stay legible. Same numbers as GltfTwinScene's
   BRUSHED_STEEL recipe (the pool mixer uses that one); still built here,
   still opaque, still outside the x-ray system. To put a real metal PBR set
   on them, fill MIXER_TEXTURE_SET below. */
const MIXER_TEXTURE_SET = null; // e.g. { map: '/textures/metal/color.jpg', normalMap: '/textures/metal/normal_gl.jpg', roughnessMap: '/textures/metal/roughness.jpg', metalnessMap: '/textures/metal/metalness.jpg', repeat: 2 }
const BRUSHED = { metalness: 0.8, roughness: 0.38, clearcoat: 0.3, clearcoatRoughness: 0.25, envMapIntensity: 1.7, anisotropy: 0.6 };
const mixerSteelMaterial = new THREE.MeshPhysicalMaterial({
  color: '#cfd3d6', ...BRUSHED,
  transparent: false, opacity: 1, depthWrite: true
});
/* Emissive baked in at creation (not toggled) — "pop through the
   frosted tank" per spec needs the glow present at rest, not only while
   selected; GltfTwinScene.jsx's useFrame pulses emissiveIntensity on
   top of this base value for the "subtle" animated part of that ask.
   roughness pushed up from the steel parts' 0.25 — spec calls for
   "high roughness/contrast" on the propellers specifically, a matte
   painted-metal read rather than the shaft/housing's polished one. */
/* Phase 103 (Murat): the propeller blades are the one colour in the maquette —
   glazed signal red on the brushed-steel hub/shaft, so the mixers read at a
   glance even through the white tank wall. */
const mixerPropellerMaterial = new THREE.MeshPhysicalMaterial({
  color: '#d0261c', metalness: 0.05, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.2,
  transparent: false, opacity: 1, depthWrite: true
});
const mixerBeaconMaterial = new THREE.MeshPhysicalMaterial({
  color: '#ffffff', metalness: 0.05, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.08,
  emissive: '#ffffff', emissiveIntensity: 0.5,
  transparent: false, opacity: 1, depthWrite: true
});
/* Propeller hub cone — dark metallic, distinct from both the shaft's
   light polished steel and the blades' bright red, so the hub still
   reads as its own part instead of blending into either. */
const mixerHubMaterial = new THREE.MeshPhysicalMaterial({
  color: '#a9aeb2', ...BRUSHED, roughness: 0.34,
  transparent: false, opacity: 1, depthWrite: true
});

/* Optional metal PBR set on every mixer material, attached once loaded (no
   black flash while the images are in flight). */
if (MIXER_TEXTURE_SET) {
  const { repeat = 1, ...slots } = MIXER_TEXTURE_SET;
  const loader = new THREE.TextureLoader();
  Object.entries(slots).forEach(([slot, url]) => {
    loader.load(url, (texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeat, repeat);
      texture.colorSpace = slot === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      [mixerSteelMaterial, mixerPropellerMaterial, mixerHubMaterial].forEach((material) => {
        material[slot] = texture;
        material.needsUpdate = true;
      });
    });
  });
}

/* CONFIRMED BUG, now fixed: every blade used to be built as a plain
   centered box (BoxGeometry defaults to centered on its own origin)
   given a fixed position offset like [0, 0.5, 0], with rotation.z
   varying per blade to "fan them out". That doesn't work — an
   Object3D's transform rotates its geometry around its OWN local
   origin *first*, then translates by `position`; rotating a shape
   that's centered on that same origin leaves its centroid sitting
   exactly at the origin no matter the rotation, so `position` then
   moves that already-centered shape by the same fixed offset every
   time regardless of rotation.z. Net effect: all `count` blades ended
   up stacked on top of each other at the same single point (0, 0.5, 0)
   relative to the hub, each just individually spun in place there —
   not fanned out around the hub center at all. Then, since that whole
   overlapping clump sits 0.5 units away from the hub's true rotation
   center, spinning the hub via hub.rotation.z every frame swept that
   off-center clump around in a circle — the reported "orbiting/
   revolving in a wide circle instead of spinning in place" bug.

   Fixed by moving the offset into the GEOMETRY itself instead of the
   mesh's position: bladeGeo.translate() shifts the box's own vertices
   so its root edge sits at object-space (0,0,0) and its tip extends
   outward to (0, BLADE_LENGTH, 0) — the blade's rotation origin is now
   the hub center, zero lever arm, by construction. Each blade's mesh
   position stays [0,0,0] (same origin as the hub core); only its
   rotation.z (baked in once, at build time, not touched by the spin
   animation) differs per blade, correctly fanning them out around the
   shared center this time. `count` set by the caller — the wall mixers
   ask for 4 (spec: "Mid & Lower Wall Mixers: Single 4-blade propeller
   assembly"), the twin top-slab mixers ask for 2 clusters of 3, each
   cluster still built by this same function since nothing about
   blade count/shape differs between the two mixer types, only how many
   clusters and where they sit. */
const BLADE_LENGTH = 0.85;

function buildPropeller(count) {
  const propellerGroup = new THREE.Group();
  propellerGroup.name = 'side_mixer_prop_hub';

  /* Tapered (0.16 -> 0.06), not a straight cylinder — reads as a
     bullet-nosed hub cone per spec, still built from CylinderGeometry
     (just with different top/bottom radii) rather than swapping
     primitive types for a detail this small. Dark, not the shaft's
     light polished steel — mixerHubMaterial, defined alongside the
     other mixer materials above. */
  const hubCoreGeo = new THREE.CylinderGeometry(0.16, 0.06, 0.32, 12);
  hubCoreGeo.rotateX(Math.PI / 2);
  const hubCore = makeMesh(hubCoreGeo, 'side_mixer_hub', [0, 0, 0], null, mixerHubMaterial);
  hubCore.renderOrder = MIXER_RENDER_ORDER;
  propellerGroup.add(hubCore);

  for (let i = 0; i < count; i++) {
    const bladeGeo = box(0.16, BLADE_LENGTH, 0.05);
    bladeGeo.translate(0, BLADE_LENGTH / 2, 0); // root at origin, tip extends outward
    bladeGeo.rotateY(0.45); // blade pitch, baked into the geometry so it doesn't fight the per-blade fan-out rotation below
    const blade = makeMesh(bladeGeo, 'side_mixer_blade', [0, 0, 0], [0, 0, (i / count) * Math.PI * 2], mixerPropellerMaterial);
    blade.renderOrder = MIXER_RENDER_ORDER;
    propellerGroup.add(blade);
  }
  return propellerGroup;
}

function buildSideMixer(azimuth) {
  const mountPos = new THREE.Vector3(
    DIGESTER_RADIUS * Math.cos(azimuth),
    DIGESTER_MID_Y,
    DIGESTER_RADIUS * Math.sin(azimuth)
  );
  const inwardDir = computeMixerDirection(mountPos, SIDE_MIXER_TANGENT_ANGLE, SIDE_MIXER_EXTRA_TILT);

  const group = new THREE.Group();
  /* Phase 74: renamed from 'side_entry_mixer' — this name now doubles as
     the plantData selection key (GltfTwinScene.jsx's handleClick walks
     up from a raycast hit looking for a node named 'biogas_mixer'
     specifically, distinct from the normal findStructureNode walk that
     always resolves to a top-level structure like 'digester'), so the 4
     side-entry mixers are independently clickable as their own thing
     once the digester is already selected/transparent, instead of every
     click on them just re-selecting the whole digester. */
  group.name = 'biogas_mixer';
  group.position.copy(mountPos);
  /* Maps local +Z onto inwardDir directly — by definition, local +Z is
     "into the tank" for this group from here on, local -Z is "out into
     the exterior air". No lookAt, no eye/target convention to invert. */
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), inwardDir);

  /* Exterior: flanged mounting collar flush with the wall (z~0, right
     at the wall surface) + a compact drive-motor housing just outside
     it — both at NEGATIVE local Z now (outward), the corrected side of
     the bug fixed above. */
  const collarGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.18, 16);
  collarGeo.rotateX(Math.PI / 2);
  const collar = makeMesh(collarGeo, 'side_mixer_collar', [0, 0, -0.05], null, mixerSteelMaterial);
  collar.renderOrder = MIXER_RENDER_ORDER;
  group.add(collar);

  const housing = makeMesh(box(0.7, 0.7, 0.9), 'side_mixer_housing', [0, 0, -0.55], null, mixerSteelMaterial);
  housing.renderOrder = MIXER_RENDER_ORDER;
  group.add(housing);

  /* Interior: shaft + propeller, at POSITIVE local Z (inward — the
     other corrected side). SIDE_MIXER_SHAFT_LENGTH (2.5) plus the
     collar's own small standoff keeps the propeller tip well short of
     the tank's own radius (12), so it's strictly inside the volume
     regardless of the tangential/downward bias baked into inwardDir. */
  const shaftGeo = new THREE.CylinderGeometry(0.09, 0.09, SIDE_MIXER_SHAFT_LENGTH, 10);
  shaftGeo.rotateX(Math.PI / 2);
  const shaft = makeMesh(shaftGeo, 'side_mixer_shaft', [0, 0, SIDE_MIXER_SHAFT_LENGTH / 2], null, mixerSteelMaterial);
  shaft.renderOrder = MIXER_RENDER_ORDER;
  group.add(shaft);

  const hub = buildPropeller(4);
  hub.position.set(0, 0, SIDE_MIXER_SHAFT_LENGTH);
  group.add(hub);

  /* Pulse-ring beacon at the wall insertion point, just proud of the
     collar (exterior side) — a bright, distinctly-not-red accent
     (cyan-white) so it reads as "sensor/indicator" rather than blending
     with the propeller. Pulsed via emissiveIntensity in
     GltfTwinScene.jsx's useFrame, alongside the propeller spin. */
  const beaconGeo = new THREE.TorusGeometry(0.68, 0.035, 8, 24);
  const beacon = makeMesh(beaconGeo, 'side_mixer_beacon', [0, 0, -0.08], null, mixerBeaconMaterial);
  beacon.renderOrder = MIXER_RENDER_ORDER;
  group.add(beacon);

  return { group, hub, beacon };
}

/* The GLB ships 2 pre-existing wall-mounted mixers (`mixers` group,
   mixer_1/mixer_2, diagonal ~45/225 deg azimuths) and 2 pre-existing
   top-mounted ones (`top_mixers` group, top_mixer_1/2) — all four use
   the digester's shared flat-ceramic clay material (no dedicated color
   of their own), which under the X-ray effect's opacity:0.25 fade reads
   as a large, pale, semi-transparent shape floating inside the tank —
   reported back as "the oversized floating white ghost mixer". Removed
   outright rather than restyled: this phase's 6 new mixers (4 side +
   2 twin top-slab, below) are meant to be the digester's only mixer
   system, "exactly 2 mixer types" per spec, not a 3rd/4th alongside
   two different pre-existing ones. */
function removeGhostMixers(digester) {
  ['mixers', 'top_mixers'].forEach((name) => {
    const node = digester.getObjectByName(name);
    if (node) digester.remove(node);
  });
}

/* ---------------- Digester -> 2 twin-propeller top-slab mixers ----------------
   "Tabliyeden eğimli girenler" (top-slab inclined mixers) — mounted at
   the perimeter slab ring near the tank's own rim (top_ring sits at
   world y=5.85, tank_wall's own top edge at y=6.0; radius 10.5 below
   sits just inside the tank's own r=12, matching the ring rather than
   the tank's vertical centerline), penetrating steeply downward into
   the liquid with 2 propeller clusters spaced along one shaft ("twin"
   per spec), as opposed to the 4 side mixers' single 4-blade cluster
   each. Same computeMixerDirection()/quaternion approach as
   buildSideMixer, with a much larger extraDownwardTilt (these
   penetrate steeply, close to vertical, not the side mixers' mostly-
   horizontal entry) and no tangential cant (spec describes these as
   "angled downwards", not swirled — cant is a side-mixer-only detail). */
const TOP_MIXER_MOUNT_RADIUS = 10.5;
const TOP_MIXER_MOUNT_Y = 5.7;
const TOP_MIXER_SHAFT_LENGTH = 4.2;
const TOP_MIXER_EXTRA_TILT = 0.9;
const TOP_MIXER_AZIMUTHS = [Math.PI / 4, (5 * Math.PI) / 4];

function buildTwinTopMixer(azimuth) {
  const mountPos = new THREE.Vector3(
    TOP_MIXER_MOUNT_RADIUS * Math.cos(azimuth),
    TOP_MIXER_MOUNT_Y,
    TOP_MIXER_MOUNT_RADIUS * Math.sin(azimuth)
  );
  const inwardDir = computeMixerDirection(mountPos, 0, TOP_MIXER_EXTRA_TILT);

  const group = new THREE.Group();
  group.name = 'top_slab_mixer';
  group.position.copy(mountPos);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), inwardDir);

  /* Mount flange at deck level + compact motor housing above it —
     NEGATIVE local Z (outward/up, above the slab), corrected side. */
  const flangeGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.16, 16);
  const flange = makeMesh(flangeGeo, 'side_mixer_collar', [0, 0, -0.04], null, mixerSteelMaterial);
  flange.renderOrder = MIXER_RENDER_ORDER;
  group.add(flange);

  const housing = makeMesh(box(0.6, 0.85, 0.6), 'side_mixer_housing', [0, 0, -0.5], null, mixerSteelMaterial);
  housing.renderOrder = MIXER_RENDER_ORDER;
  group.add(housing);

  /* Shaft + twin propellers at POSITIVE local Z (downward/inward into
     the tank, submerged) — the corrected side. */
  const shaftGeo = new THREE.CylinderGeometry(0.08, 0.08, TOP_MIXER_SHAFT_LENGTH, 10);
  shaftGeo.rotateX(Math.PI / 2);
  const shaft = makeMesh(shaftGeo, 'side_mixer_shaft', [0, 0, TOP_MIXER_SHAFT_LENGTH / 2], null, mixerSteelMaterial);
  shaft.renderOrder = MIXER_RENDER_ORDER;
  group.add(shaft);

  /* Twin: 2 propeller clusters spaced along the shaft (55% and 95% of
     its length), each a 3-blade cluster — the spec only calls out
     4-blade specifically for the *wall* mixers, so these keep the same
     3-blade shape buildPropeller was originally written for. */
  const hubs = [0.55, 0.95].map((t) => {
    const hub = buildPropeller(3);
    hub.position.set(0, 0, TOP_MIXER_SHAFT_LENGTH * t);
    group.add(hub);
    return hub;
  });

  const beaconGeo = new THREE.TorusGeometry(0.58, 0.035, 8, 24);
  const beacon = makeMesh(beaconGeo, 'side_mixer_beacon', [0, 0, -0.06], null, mixerBeaconMaterial);
  beacon.renderOrder = MIXER_RENDER_ORDER;
  group.add(beacon);

  return { group, hubs, beacon };
}

/* Re-discovers the hub/beacon refs of already-built mixers instead of
   just bailing empty-handed — React.StrictMode double-invokes this
   component's useLayoutEffect once in dev (see this file's own header
   comment), and the caller stores whatever this function returns
   directly into a ref every time it runs. Returning empty arrays on
   that second, "nothing to build" call would silently overwrite the
   real refs the first call already produced, permanently killing the
   propeller-spin/beacon-pulse animation with no error to show for it —
   this is what actually keeps that from happening. */
function addDigesterMixers(digester) {
  const existingSide = digester.children.filter((child) => child.name === 'biogas_mixer');
  const existingTop = digester.children.filter((child) => child.name === 'top_slab_mixer');
  if (existingSide.length || existingTop.length) {
    return {
      propellerHubs: [
        ...existingSide.map((g) => g.getObjectByName('side_mixer_prop_hub')),
        ...existingTop.flatMap((g) => g.children.filter((c) => c.name === 'side_mixer_prop_hub'))
      ].filter(Boolean),
      beacons: [...existingSide, ...existingTop].map((g) => g.getObjectByName('side_mixer_beacon')).filter(Boolean)
    };
  }

  removeGhostMixers(digester);

  const propellerHubs = [];
  const beacons = [];
  MIXER_AZIMUTHS.forEach((azimuth) => {
    const { group, hub, beacon } = buildSideMixer(azimuth);
    digester.add(group);
    propellerHubs.push(hub);
    beacons.push(beacon);
  });
  TOP_MIXER_AZIMUTHS.forEach((azimuth) => {
    const { group, hubs, beacon } = buildTwinTopMixer(azimuth);
    digester.add(group);
    propellerHubs.push(...hubs);
    beacons.push(beacon);
  });
  return { propellerHubs, beacons };
}

/* ---------------- Inline gate valves on the process lines ----------------
   ANKA reference vocabulary: a gate valve is body + bonnet + stem +
   handwheel + a flange pair. Placement is measured, not guessed: the
   target pipe's world bounding box gives the run axis (longest of x/z),
   the pipe radius (smallest extent / 2) and the point `t` along the run.
   Meshes are parented under the pipe's own structure so clicks resolve
   to it, and the names below are routed to their materials by
   GltfTwinScene's recipe map (inline_valve_*). */
const VALVE_TARGETS = [
  ['site_piping', 'gas_main', 0.3],
  ['site_piping', 'feed_from_pool', 0.45],
  ['pump_room', 'discharge_header', 0.5],
];

function buildGateValve(pipeRadius) {
  const group = new THREE.Group();
  const bodyR = Math.max(pipeRadius * 1.7, 0.22);
  const bodyL = bodyR * 1.7;

  const bodyGeo = new THREE.CylinderGeometry(bodyR, bodyR, bodyL, 14);
  bodyGeo.rotateZ(Math.PI / 2);
  group.add(makeMesh(bodyGeo, 'inline_valve_body', [0, 0, 0], null, undefined, false));

  [-1, 1].forEach((side) => {
    const flangeGeo = new THREE.CylinderGeometry(pipeRadius * 1.45, pipeRadius * 1.45, 0.07, 14);
    flangeGeo.rotateZ(Math.PI / 2);
    group.add(makeMesh(flangeGeo, 'inline_valve_flange', [side * (bodyL / 2 + 0.04), 0, 0], null, undefined, false));
  });

  const bonnetH = bodyR * 1.35;
  group.add(makeMesh(
    new THREE.CylinderGeometry(bodyR * 0.5, bodyR * 0.62, bonnetH, 12),
    'inline_valve_body', [0, bodyR * 0.4 + bonnetH / 2, 0], null, undefined, false
  ));

  const stemH = bodyR * 1.1;
  const stemTopY = bodyR * 0.4 + bonnetH + stemH / 2;
  group.add(makeMesh(
    new THREE.CylinderGeometry(0.035, 0.035, stemH, 8),
    'inline_valve_stem', [0, stemTopY, 0], null, undefined, false
  ));

  const wheelY = stemTopY + stemH / 2;
  const wheelR = bodyR * 0.8;
  const wheelGeo = new THREE.TorusGeometry(wheelR, 0.045, 8, 20);
  wheelGeo.rotateX(Math.PI / 2);
  group.add(makeMesh(wheelGeo, 'inline_valve_wheel', [0, wheelY, 0], null, undefined, false));
  for (let s = 0; s < 3; s++) {
    const spoke = makeMesh(box(wheelR * 2 - 0.06, 0.03, 0.03), 'inline_valve_wheel', [0, wheelY, 0], null, undefined, false);
    spoke.rotation.y = (s / 3) * Math.PI;
    group.add(spoke);
  }
  return group;
}

function addInlineValves(plantRoot) {
  plantRoot.updateMatrixWorld(true);
  VALVE_TARGETS.forEach(([structureName, meshName, t]) => {
    const structure = plantRoot.getObjectByName(structureName);
    if (!structure) return;
    const guardName = `inline_valve_${meshName}`;
    if (structure.getObjectByName(guardName)) return;

    let pipe = null;
    const pattern = new RegExp(`^${meshName}(?:_\\d+)?$`);
    structure.traverse((node) => { if (!pipe && node.isMesh && pattern.test(node.name)) pipe = node; });
    if (!pipe) return;

    const bbox = new THREE.Box3().setFromObject(pipe);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    const alongX = size.x >= size.z;
    const pipeRadius = Math.max(Math.min(size.y, alongX ? size.z : size.x) / 2, 0.12);

    const pos = center.clone();
    if (alongX) pos.x = bbox.min.x + size.x * t;
    else pos.z = bbox.min.z + size.z * t;

    const valve = buildGateValve(pipeRadius);
    valve.name = guardName;
    if (!alongX) valve.rotation.y = Math.PI / 2;
    structure.add(valve);
    // World → the structure's local frame, in case the structure carries
    // its own transform.
    structure.worldToLocal(pos);
    valve.position.copy(pos);
  });
}

function collectFanHubs(plantRoot) {
  const hubs = [];
  plantRoot.traverse((node) => { if (node.name === 'container_fan_hub') hubs.push(node); });
  return hubs;
}


/* ---------------- Digester -> trapez sac duvar ----------------------------
   Phase 98 (Murat, biblo/vitrin dili): the tank wall is no longer a smooth
   cylinder with 72 separate applique ribs stuck on it — it IS a trapezoidal
   profiled sheet (trapez sac), the way a real tank's cladding is. The rib
   meshes the old look needed are removed with it, so the wall costs 1 mesh
   instead of 73 and reads as one folded sheet instead of a drum with slats.

   Profile: one pitch = flat crest -> slope -> flat valley -> slope, all four
   an equal quarter of the pitch. That puts every fold exactly on a vertex ring
   (8 radial segments per rib, breakpoints at .25/.5/.75), so the folds stay
   crisp instead of being averaged away by the tessellation. Geometry is
   de-indexed before computeVertexNormals so each facet gets a flat normal —
   a smooth-shaded trapezoid sheet looks like a wobbly cylinder, not sheet
   metal. */
const TRAPEZ_RIBS = 72;
const TRAPEZ_DEPTH = 0.17;
const TRAPEZ_SEGMENTS_PER_RIB = 8;

function trapezProfile(t) {
  /* t in [0,1) inside one pitch. 0 = valley plane, 1 = crest plane. */
  if (t < 0.25) return 1;              // flat crest
  if (t < 0.5) return 1 - (t - 0.25) * 4;  // falling flank
  if (t < 0.75) return 0;              // flat valley
  return (t - 0.75) * 4;               // rising flank
}

function trapezoidalCylinderGeometry(radius, height, depth = TRAPEZ_DEPTH) {
  const radialSegments = TRAPEZ_RIBS * TRAPEZ_SEGMENTS_PER_RIB;
  const geo = new THREE.CylinderGeometry(radius, radius, height, radialSegments, 1, true);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const len = Math.hypot(x, z);
    if (len < 1e-6) continue;
    const theta = Math.atan2(z, x);
    // +1000 keeps the modulo positive for negative theta without a branch.
    const phase = ((theta * TRAPEZ_RIBS) / (Math.PI * 2) + 1000) % 1;
    const r = radius + depth * trapezProfile(phase);
    pos.setX(i, (x / len) * r);
    pos.setZ(i, (z / len) * r);
  }
  pos.needsUpdate = true;
  const flat = geo.toNonIndexed();
  geo.dispose();
  flat.computeVertexNormals();
  return flat;
}

/* Every mesh named 'tank_wall' — the GLB's own wall AND the seam seal
   sealDigesterWallSeam() adds — is re-profiled in place from its own measured
   geometry, so the seal keeps matching the wall it plugs instead of turning
   into a smooth band sitting proud of a folded one. */
function applyTrapezWall(digester) {
  digester.traverse((node) => {
    if (!node.isMesh || node.name !== 'tank_wall' || node.userData.ionaTrapez) return;
    node.geometry.computeBoundingBox();
    const bb = node.geometry.boundingBox;
    const radius = (bb.max.x - bb.min.x) / 2;
    const height = bb.max.y - bb.min.y;
    const midY = (bb.max.y + bb.min.y) / 2;
    const next = trapezoidalCylinderGeometry(radius, height);
    if (midY !== 0) next.translate(0, midY, 0);
    node.geometry.dispose();
    node.geometry = next;
    node.userData.ionaTrapez = true;
  });

  /* The applique ribs and the three horizontal bands existed to give a flat
     cylinder some relief. The profile does that now; leaving them on top reads
     as clutter on a wall that already has a texture of its own. */
  ['wall_rib', 'wall_band'].forEach((name) => {
    digester.children
      .filter((child) => child.name === name || child.name.startsWith(name + '_'))
      .forEach((child) => digester.remove(child));
  });
}

/* ---------------- Digester -> kubbe korkuluğunu kaldır --------------------
   The tabliye carries TWO concentric rails: an outer one on the deck edge
   (torus Ø27.7, the real fall protection) and an inner one hugging the gas
   dome's own base (Ø18.5 — the dome is Ø18.4). The inner ring reads as a cage
   around the balloon from every hero angle and is what gets removed here; the
   deck-edge ring stays. Posts are one flat list of 62 shared by both rings, so
   they're separated by measured radius, not by name. */
const DOME_RAIL_MAX_RADIUS = 10.5; // dome base ~9.2, deck edge ~11.9-13.8

function removeDomeRailing(digester) {
  const doomed = [];
  digester.traverse((node) => {
    if (!node.isMesh) return;
    const base = node.name.replace(/_\d+$/, '');
    if (base !== 'walkway_rail' && base !== 'walkway_midrail' && base !== 'walkway_post') return;
    node.geometry.computeBoundingBox();
    const bb = node.geometry.boundingBox;
    // A ring's own bbox gives its radius; a post's doesn't, so use its position.
    const ringRadius = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
    const world = node.getWorldPosition(new THREE.Vector3());
    const radius = ringRadius > 1 ? ringRadius : Math.hypot(world.x, world.z);
    if (radius <= DOME_RAIL_MAX_RADIUS) doomed.push(node);
  });
  doomed.forEach((node) => node.parent?.remove(node));
}

/* ---------------- Digester -> ısı boruları: içeride, 12 sıra ---------------
   Murat, Phase 99: the heating coil is INSIDE the tank, the way a real
   wall-mounted heating loop is — the GLB's exterior hoops (and the exterior
   rebuild before this) were wrong. 12 full rings on the inner wall face, a
   little off the floor, evenly spaced, the top ring at about half the wall's
   height, so the loop only shows when the shell goes see-through (selection /
   "Reaktörün içini aç"). The side mixers are mounted just above the top ring
   (DIGESTER_MID_Y below) so nothing on the wall crosses the coil band.
   Measured: wall face y 0.9-6.0, inner radius 12. */
const COIL_ROWS = 12;
const COIL_TUBE_RADIUS = 0.06;
const COIL_WALL_CLEARANCE = 0.45; // ring centreline this far inside the wall face
const COIL_FIRST_Y = 1.25;        // ~0.35 above the tank floor (0.9)
const COIL_LAST_Y = 3.55;         // ~half the wall height (0.9 + 5.1/2 = 3.45)
const COIL_JUMPER_AZIMUTH = 1.5 * Math.PI; // the heating nozzles' side (~263/277 deg)

function rebuildHeatingCoils(digester) {
  const group = digester.getObjectByName('heating_coils');
  if (!group || group.userData.ionaCoilsRebuilt) return;
  [...group.children].forEach((child) => group.remove(child));

  const radius = DIGESTER_RADIUS - COIL_WALL_CLEARANCE;
  const step = (COIL_LAST_Y - COIL_FIRST_Y) / (COIL_ROWS - 1);

  for (let row = 0; row < COIL_ROWS; row++) {
    const geo = new THREE.TorusGeometry(radius, COIL_TUBE_RADIUS, 8, 120);
    geo.rotateX(Math.PI / 2); // torus plane XY -> XZ (horizontal ring)
    group.add(makeMesh(geo, 'heating_coil_row', [0, COIL_FIRST_Y + row * step, 0], null, null, false));
  }

  /* Row-to-row jumpers stacked on the heating nozzles' side, so the 12 rings
     read as one serpentine circuit fed from heat_inlet/heat_return rather
     than as 12 loose hoops. */
  for (let row = 0; row < COIL_ROWS - 1; row++) {
    const y = COIL_FIRST_Y + row * step + step / 2;
    const geo = new THREE.CylinderGeometry(COIL_TUBE_RADIUS, COIL_TUBE_RADIUS, step, 8);
    group.add(makeMesh(
      geo, 'coil_jumper',
      [Math.cos(COIL_JUMPER_AZIMUTH) * radius, y, Math.sin(COIL_JUMPER_AZIMUTH) * radius],
      null, null, false
    ));
  }
  group.userData.ionaCoilsRebuilt = true;
}

/* ---------------- Feed pool -> yarısı kapalı, yarısı açık ve derin --------
   Measured: pool_wall Ø11 spanning y 0.3-3.5 at world (18,18), pool_rim at
   y 3.5, substrate_surface a Ø10.4 disc sitting high at y 2.28 — which made
   the pool read as a full, shallow saucer. Two changes: the substrate drops so
   the open side has real depth to look down into, and a half-deck covers the
   other half (the -X semicircle, i.e. the side away from the hero camera), so
   the pool reads as a covered tank that has been opened, not as a paddling
   pool. Named 'pool_rim' on purpose — that name already routes to the pool's
   own stone finish in GltfTwinScene's recipe map. */
const POOL_CENTER = new THREE.Vector3(18, 0, 18);
const POOL_COVER_RADIUS = 5.62;
const POOL_COVER_Y = 3.66; // sits on the rim (rim top ~3.6), like a lid
const POOL_SUBSTRATE_Y = 1.35;

function openHalfOfFeedPool(feedPool) {
  if (feedPool.userData.ionaPoolOpened) return;

  const substrate = feedPool.getObjectByName('substrate_surface');
  if (substrate) {
    const world = substrate.getWorldPosition(new THREE.Vector3());
    world.y = POOL_SUBSTRATE_Y;
    substrate.position.copy(feedPool.worldToLocal(world));
  }

  /* Named 'pool_cover' — routed to the dark standing-seam roof finish in
     GltfTwinScene's feed_pool recipe map, the same as the buildings' roofs, so
     it reads as a lid and not as more of the pale rim it sits on. */
  const coverGeo = new THREE.CylinderGeometry(
    POOL_COVER_RADIUS, POOL_COVER_RADIUS, 0.18, 56, 1, false, Math.PI, Math.PI
  );
  const centre = feedPool.worldToLocal(new THREE.Vector3(POOL_CENTER.x, POOL_COVER_Y, POOL_CENTER.z));
  feedPool.add(makeMesh(coverGeo, 'pool_cover', [centre.x, centre.y, centre.z]));

  /* The straight edge of the opening wants a lip, or the cover reads as a
     sheet of paper laid on top. */
  const lipGeo = box(0.24, 0.42, POOL_COVER_RADIUS * 2);
  feedPool.add(makeMesh(lipGeo, 'pool_cover', [centre.x - 0.12, centre.y + 0.12, centre.z]));

  feedPool.userData.ionaPoolOpened = true;
}

/* ---------------- Digester -> deck opened for the sinking lid --------------
   Phase 100: the tabliye (dome_walkway) shipped as a SOLID Ø24 disc under the
   dome. Now that the dome slides into the tank when the digester is selected
   (GltfTwinScene DOME_SINK), the deck has to be what it would be on a real
   tank: an annulus from the dome's base (r 9.2, where walkway_inner_kerb
   sits) out to the wall (r 12). Rebuilt in place from a Shape with a hole so
   the slab keeps its 0.16 thickness and reads as a real plate edge at the
   opening, not a zero-thickness ring. */
const DECK_INNER_RADIUS = 9.2;
const DECK_OUTER_RADIUS = 12;
const DECK_THICKNESS = 0.16;

function openDeckForDome(digester) {
  const deck = digester.getObjectByName('dome_walkway');
  if (!deck || deck.userData.ionaDeckOpened) return;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, DECK_OUTER_RADIUS, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, DECK_INNER_RADIUS, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: DECK_THICKNESS, bevelEnabled: false, curveSegments: 96 });
  geo.rotateX(-Math.PI / 2);            // extrude along +Z -> +Y
  geo.translate(0, -DECK_THICKNESS / 2, 0); // centre on the old slab's own mid-plane
  deck.geometry.dispose();
  deck.geometry = geo;
  deck.userData.ionaDeckOpened = true;
}

/* GLTFLoader makes node names unique on import (biogas_mixer, biogas_mixer_1,
   biogas_mixer_2 ...). Most of the runtime already compares base names
   (meshBaseName in GltfTwinScene), but the mixer/fan handles and the mixer
   click target are looked up by exact name, so the baked file's suffixes are
   stripped again here for exactly those names — three itself is fine with
   duplicate names. */
const BAKED_NAME_RESTORE = new Set([
  'biogas_mixer', 'top_slab_mixer', 'side_mixer_prop_hub', 'side_mixer_beacon',
  'side_mixer_blade', 'side_mixer_hub', 'side_mixer_shaft', 'side_mixer_collar',
  'side_mixer_housing', 'container_fan_hub',
]);
function restoreBakedNames(plantRoot) {
  plantRoot.traverse((node) => {
    const base = node.name.replace(/_\d+$/, '');
    if (BAKED_NAME_RESTORE.has(base)) node.name = base;
  });
}

export function applyStructureOverrides(plantRoot) {
  /* Phase 104: a baked GLB (scripts/model-lab/bake-plant.mjs) already carries
     every change below; only the animation handles still need collecting. */
  if (plantRoot.userData?.ionaBaked) {
    restoreBakedNames(plantRoot);
    const digester = plantRoot.getObjectByName('digester');
    const mixers = digester ? addDigesterMixers(digester) : { propellerHubs: [], beacons: [] };
    return { ...mixers, fanHubs: collectFanHubs(plantRoot) };
  }
  const engineRoom = plantRoot.getObjectByName('engine_room');
  if (engineRoom) rebuildEngineRoomContainer(engineRoom);

  const pumpRoom = plantRoot.getObjectByName('pump_room');
  if (pumpRoom) replacePumpRoomShell(pumpRoom);

  const digester = plantRoot.getObjectByName('digester');
  if (digester) {
    sealDigesterWallSeam(digester);
    /* Order matters: the seal is another 'tank_wall' mesh, so it has to exist
       before the trapez pass re-profiles every wall mesh it finds. */
    applyTrapezWall(digester);
    removeDomeRailing(digester);
    rebuildHeatingCoils(digester);
    openDeckForDome(digester);
  }
  const mixers = digester ? addDigesterMixers(digester) : { propellerHubs: [], beacons: [] };

  const feedPool = plantRoot.getObjectByName('feed_pool');
  if (feedPool) openHalfOfFeedPool(feedPool);

  addInlineValves(plantRoot);

  return { ...mixers, fanHubs: collectFanHubs(plantRoot) };
}
