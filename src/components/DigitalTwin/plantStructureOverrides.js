import * as THREE from 'three';

/* Runtime geometry overrides layered onto specific structures loaded
   from the scanned/authored facility GLB (public/models/iona-tesis-3d.glb)
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

function makeMesh(geometry, name, position, rotation, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
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

   Every part here shares one name ('container_panel') and one dark
   charcoal/steel material (see ENGINE_ROOM_CONTAINER_MESH_NAMES in
   GltfTwinScene.jsx, scoped to engine_room only so pump_room's canopy
   and scada_room's own prefab walls are untouched) except the hazard
   stripe, which needs its own yellow. */
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
      'container_panel', [0, CONTAINER_WALL_MID_Y, z]
    ));
  });
  [CONTAINER_HALF_W, -CONTAINER_HALF_W].forEach((x) => {
    container.add(makeMesh(
      box(CONTAINER_WALL_THK, CONTAINER_WALL_HALF_H * 2, CONTAINER_HALF_D * 2),
      'container_panel', [x, CONTAINER_WALL_MID_Y, 0]
    ));
  });

  const RIB_SIZE = [0.09, CONTAINER_WALL_HALF_H * 2 - 0.2, 0.05];
  const LONG_RIB_COUNT = 20;
  for (let i = 0; i < LONG_RIB_COUNT; i++) {
    const x = -CONTAINER_HALF_W + 0.2 + (i / (LONG_RIB_COUNT - 1)) * (CONTAINER_HALF_W * 2 - 0.4);
    [CONTAINER_HALF_D + 0.03, -CONTAINER_HALF_D - 0.03].forEach((z) => {
      container.add(makeMesh(box(...RIB_SIZE), 'container_panel', [x, CONTAINER_WALL_MID_Y, z]));
    });
  }
  const SHORT_RIB_COUNT = 11;
  const SHORT_RIB_SIZE = [0.05, CONTAINER_WALL_HALF_H * 2 - 0.2, 0.09];
  for (let i = 0; i < SHORT_RIB_COUNT; i++) {
    const z = -CONTAINER_HALF_D + 0.2 + (i / (SHORT_RIB_COUNT - 1)) * (CONTAINER_HALF_D * 2 - 0.4);
    [CONTAINER_HALF_W + 0.03, -CONTAINER_HALF_W - 0.03].forEach((x) => {
      container.add(makeMesh(box(...SHORT_RIB_SIZE), 'container_panel', [x, CONTAINER_WALL_MID_Y, z]));
    });
  }

  /* Reinforced corner castings — a real ISO container's 8 corner
     fittings, small solid blocks at every top/bottom corner. */
  const CASTING = [0.28, 0.28, 0.28];
  [CONTAINER_HALF_W - 0.14, -CONTAINER_HALF_W + 0.14].forEach((x) => {
    [CONTAINER_HALF_D - 0.14, -CONTAINER_HALF_D + 0.14].forEach((z) => {
      [CONTAINER_WALL_MID_Y + CONTAINER_WALL_HALF_H - 0.14, CONTAINER_WALL_MID_Y - CONTAINER_WALL_HALF_H + 0.14].forEach((y) => {
        container.add(makeMesh(box(...CASTING), 'container_panel', [x, y, z]));
      });
    });
  });

  /* Blank steel door panel (no window, no glass) on the front wall. */
  container.add(makeMesh(box(1.1, 2.05, 0.05), 'container_panel', [-4.6, 1.35, CONTAINER_HALF_D + 0.03]));

  /* Roof deck. */
  container.add(makeMesh(
    box(CONTAINER_HALF_W * 2 + 0.25, 0.15, CONTAINER_HALF_D * 2 + 0.25),
    'container_panel', [0, CONTAINER_ROOF_Y, 0]
  ));

  /* Dual rooftop cooling fans/radiators — two identical housing+blade
     assemblies, symmetric across the roof's centerline (spec: "dual
     industrial cooling fans/radiators", not the single unit Phase 47
     left in place — that whole original roof_radiator/radiator_fan
     fixture went with the deleted shell). */
  [-3.2, 3.2].forEach((x) => {
    const fanY = CONTAINER_ROOF_Y + 0.35;
    const housingGeo = new THREE.CylinderGeometry(0.78, 0.78, 0.5, 16);
    container.add(makeMesh(housingGeo, 'container_panel', [x, fanY, 0]));
    for (let b = 0; b < 3; b++) {
      const blade = makeMesh(box(0.09, 0.05, 1.35), 'container_panel', [x, fanY + 0.28, 0]);
      blade.rotation.y = (b / 3) * Math.PI * 2;
      container.add(blade);
    }
  });

  /* Vertical exhaust silencer chimney stack + cap, off to one corner —
     roughly where the deleted shell's own exhaust_stack sat. */
  const stackGeo = new THREE.CylinderGeometry(0.36, 0.36, 3.2, 12);
  container.add(makeMesh(stackGeo, 'container_panel', [5.6, CONTAINER_ROOF_Y + 1.75, -2.1]));
  container.add(makeMesh(
    new THREE.CylinderGeometry(0.44, 0.44, 0.12, 12),
    'container_panel', [5.6, CONTAINER_ROOF_Y + 3.42, -2.1]
  ));

  /* Air intake louvers: a bank of angled slats on the right wall. */
  const LOUVER_COUNT = 6;
  for (let i = 0; i < LOUVER_COUNT; i++) {
    const y = CONTAINER_WALL_MID_Y - 0.75 + i * 0.3;
    container.add(makeMesh(
      box(0.05, 0.24, 1.2), 'container_panel', [CONTAINER_HALF_W + 0.07, y, 1.1], [0, 0, Math.PI / 7]
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
  const POST_HEIGHT = 3.9;
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
  canopy.add(makeMesh(box(9.6, 0.22, 6.6), 'roof', [0, 4.21, 0], [0.07, 0, 0]));
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
const DIGESTER_MID_Y = 3.45;
const MIXER_AZIMUTHS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

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
const mixerSteelMaterial = new THREE.MeshStandardMaterial({
  color: '#c7c9cc', metalness: 0.85, roughness: 0.25, transparent: false, opacity: 1, depthWrite: true
});
/* Emissive baked in at creation (not toggled) — "pop through the
   frosted tank" per spec needs the glow present at rest, not only while
   selected; GltfTwinScene.jsx's useFrame pulses emissiveIntensity on
   top of this base value for the "subtle" animated part of that ask.
   roughness pushed up from the steel parts' 0.25 — spec calls for
   "high roughness/contrast" on the propellers specifically, a matte
   painted-metal read rather than the shaft/housing's polished one. */
const mixerPropellerMaterial = new THREE.MeshStandardMaterial({
  color: '#EF4444', metalness: 0.25, roughness: 0.75, emissive: '#ff3b3b', emissiveIntensity: 0.5,
  transparent: false, opacity: 1, depthWrite: true
});
const mixerBeaconMaterial = new THREE.MeshStandardMaterial({
  color: '#eafcff', metalness: 0.1, roughness: 0.4, emissive: '#66d9ff', emissiveIntensity: 0.6,
  transparent: false, opacity: 1, depthWrite: true
});

/* 4-blade propeller, `count` set by the caller — the wall mixers below
   ask for 4 (spec: "Mid & Lower Wall Mixers: Single 4-blade propeller
   assembly"), the twin top-slab mixers ask for 2 clusters of these
   spaced along one shaft, each cluster still built by this same
   function since nothing about blade count/shape differs between the
   two mixer types, only how many clusters and where they sit. */
function buildPropeller(count) {
  const hub = new THREE.Group();
  hub.name = 'side_mixer_prop_hub';

  const hubCoreGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.3, 10);
  hubCoreGeo.rotateX(Math.PI / 2);
  const hubCore = makeMesh(hubCoreGeo, 'side_mixer_hub', [0, 0, 0], null, mixerSteelMaterial);
  hubCore.renderOrder = MIXER_RENDER_ORDER;
  hub.add(hubCore);

  for (let i = 0; i < count; i++) {
    const blade = makeMesh(box(0.16, 0.85, 0.05), 'side_mixer_blade', [0, 0.5, 0], null, mixerPropellerMaterial);
    blade.rotation.z = (i / count) * Math.PI * 2;
    blade.rotateY(0.45); // blade pitch, so it reads as a real propeller, not a flat fan
    blade.renderOrder = MIXER_RENDER_ORDER;
    hub.add(blade);
  }
  return hub;
}

function buildSideMixer(azimuth) {
  const mountPos = new THREE.Vector3(
    DIGESTER_RADIUS * Math.cos(azimuth),
    DIGESTER_MID_Y,
    DIGESTER_RADIUS * Math.sin(azimuth)
  );
  const inwardDir = computeMixerDirection(mountPos, SIDE_MIXER_TANGENT_ANGLE, SIDE_MIXER_EXTRA_TILT);

  const group = new THREE.Group();
  group.name = 'side_entry_mixer';
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
  const existingSide = digester.children.filter((child) => child.name === 'side_entry_mixer');
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

export function applyStructureOverrides(plantRoot) {
  const engineRoom = plantRoot.getObjectByName('engine_room');
  if (engineRoom) rebuildEngineRoomContainer(engineRoom);

  const pumpRoom = plantRoot.getObjectByName('pump_room');
  if (pumpRoom) replacePumpRoomShell(pumpRoom);

  const digester = plantRoot.getObjectByName('digester');
  const mixers = digester ? addDigesterMixers(digester) : { propellerHubs: [], beacons: [] };

  return mixers;
}
