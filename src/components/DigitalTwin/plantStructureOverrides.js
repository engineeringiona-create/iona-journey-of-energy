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
   BUILDING_HAZARD_MESH_NAMES/BUILDING_STRUCTURAL_STEEL_MESH_NAMES) and
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

/* ---------------- Engine room -> containerized CHP unit ----------------
   Real dims from the GLB (engine_room_shell, local to engine_room's own
   origin): wall_front/back sit at z=+-3.41 spanning x:[-7,7],
   wall_right/left at x=+-6.91 spanning z:[-3.32,3.32], all four with
   local Y span [-2.3,2.3] centered at world y=2.6 (floor-to-eave
   ~0.3-4.9); roof at y=5.01. roof_radiator, radiator_fan x2,
   exhaust_stack and exhaust_cap already exist on the roof and already
   carry dedicated materials (BUILDING_MECH_CASING_MESH_NAMES /
   BUILDING_STACK_MESH_NAMES in GltfTwinScene.jsx) — the spec's
   "exhaust stack" and "cooling radiator units" bullets are already
   true of the source model, nothing added for those here. */
function addEngineRoomDetails(engineRoom) {
  const shell = engineRoom.getObjectByName('engine_room_shell');
  if (!shell || shell.getObjectByName('engine_room_ribs')) return;

  /* Vertical corrugation ribs along the two long (x-spanning) walls —
     thin, closely spaced, barely proud of the flat wall plane, the same
     visual device the digester's own wall_rib already uses around its
     tank (see DIGESTER_LATTICE_MESH_NAMES's comment) — reusing that
     established look for "ISO shipping container... corrugated rib
     ridges" rather than inventing a new one. Named 'wall_rib' so it
     picks up BUILDING_WALL_MESH_NAMES' steel/slate sandwich-panel
     material once that Set is extended with this name. */
  const ribGroup = new THREE.Group();
  ribGroup.name = 'engine_room_ribs';
  shell.add(ribGroup);

  const RIB_COUNT = 20;
  const RIB_WIDTH = 0.09;
  const RIB_DEPTH = 0.05;
  const RIB_HEIGHT = 4.3;
  const WALL_HALF_SPAN = 6.85;
  const WALL_Z = 3.42;

  for (let i = 0; i < RIB_COUNT; i++) {
    const x = -WALL_HALF_SPAN + (i / (RIB_COUNT - 1)) * (WALL_HALF_SPAN * 2);
    ribGroup.add(makeMesh(box(RIB_WIDTH, RIB_HEIGHT, RIB_DEPTH), 'wall_rib', [x, 2.6, WALL_Z]));
    ribGroup.add(makeMesh(box(RIB_WIDTH, RIB_HEIGHT, RIB_DEPTH), 'wall_rib', [x, 2.6, -WALL_Z]));
  }

  /* Ventilation louvers: a small bank of angled slats on the right wall
     (x=6.91), roughly mid-height. Named 'roof_vent' on purpose — that
     name is already in BUILDING_MECH_CASING_MESH_NAMES (the roof AC/
     radiator grille material), so this needs zero new material wiring. */
  const louverGroup = new THREE.Group();
  louverGroup.name = 'engine_room_louvers';
  shell.add(louverGroup);
  const LOUVER_COUNT = 5;
  for (let i = 0; i < LOUVER_COUNT; i++) {
    const y = 2.0 + i * 0.35;
    louverGroup.add(makeMesh(box(0.05, 0.28, 1.4), 'roof_vent', [6.92, y, -1.2], [0, 0, Math.PI / 7]));
  }

  /* Hazard stripe: a low horizontal safety band across the front wall
     near grade — the spec's "yellow/green hazard accents". New
     dedicated name/material (nothing existing fits a safety marking),
     see BUILDING_HAZARD_MESH_NAMES in GltfTwinScene.jsx. */
  shell.add(makeMesh(box(11.5, 0.4, 0.03), 'hazard_stripe', [0, 0.6, 3.47]));
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

   Each assembly is built along local -Z = "toward tank center" via
   group.lookAt(center) rather than hand-derived rotation.y trig — the
   safe way to get 4 different azimuths pointed correctly without ever
   being able to render and check one visually. Blade/hub geometry lives
   in its own child group (not the outer per-mixer group) so
   `rotation.z` on just that child spins the propeller around the
   shaft's own axis without having to fight the parent's lookAt/downward-
   tilt rotations already baked into it. */
const DIGESTER_RADIUS = 12;
const DIGESTER_MID_Y = 3.45;
const MIXER_AZIMUTHS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
/* Small negative rotateX on the interior (shaft+propeller) sub-group
   tilts local -Z ("inward") toward -Y ("downward") — derived from the
   standard rotate-around-X matrix (Y' = Y*cos(t) - Z*sin(t)) applied to
   a pure (0,0,-1) inward vector: Y' = sin(t), which only goes negative
   (downward) for negative t. 0.09 rad ~= 5 deg, "slight" per spec. */
const MIXER_DOWNWARD_TILT = -0.09;

/* These meshes are routed around GltfTwinScene.jsx's whole per-structure
   material system on purpose (see DIGESTER_MIXER_MESH_NAMES's own
   comment there, and the scene.traverse() skip-check next to it) — the
   X-ray effect only ever dims materials it finds registered in that
   system, so the cleanest way to guarantee these 4 assemblies stay
   100% opaque through every state is to never hand their materials to
   it at all. Built here instead, directly, once, and shared across all
   4 mixers (same reasoning as this file's other shared textures/
   materials — one steel look, one red look, doesn't need 4 separate
   instances since none of these ever change per-mixer). */
const mixerSteelMaterial = new THREE.MeshStandardMaterial({ color: '#c7c9cc', metalness: 0.85, roughness: 0.25 });
/* Emissive baked in at creation (not toggled) — "pop through the
   frosted tank" per spec needs the glow present at rest, not only while
   selected; GltfTwinScene.jsx's useFrame pulses emissiveIntensity on
   top of this base value for the "subtle" animated part of that ask. */
const mixerPropellerMaterial = new THREE.MeshStandardMaterial({
  color: '#DC2626', metalness: 0.3, roughness: 0.35, emissive: '#ff3b3b', emissiveIntensity: 0.5
});
const mixerBeaconMaterial = new THREE.MeshStandardMaterial({
  color: '#eafcff', metalness: 0.1, roughness: 0.4, emissive: '#66d9ff', emissiveIntensity: 0.6
});

function buildSideMixer(azimuth) {
  const group = new THREE.Group();
  group.name = 'side_entry_mixer';
  group.position.set(
    DIGESTER_RADIUS * Math.cos(azimuth),
    DIGESTER_MID_Y,
    DIGESTER_RADIUS * Math.sin(azimuth)
  );
  group.lookAt(0, DIGESTER_MID_Y, 0);

  /* Exterior: flanged mounting collar flush with the wall (z=0, right
     where lookAt's local -Z crosses the tank surface) + a compact
     drive-motor housing just outside it (+Z = away from center). */
  const collarGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.18, 16);
  collarGeo.rotateX(Math.PI / 2);
  group.add(makeMesh(collarGeo, 'side_mixer_collar', [0, 0, 0.05], null, mixerSteelMaterial));

  group.add(makeMesh(box(0.7, 0.7, 0.9), 'side_mixer_housing', [0, 0, 0.55], null, mixerSteelMaterial));

  /* Interior: shaft + propeller, tilted down slightly as a group so the
     propeller spin animation (rotation.z on the hub group alone, see
     GltfTwinScene.jsx's useFrame) isn't fighting this tilt every frame. */
  const interior = new THREE.Group();
  interior.name = 'side_entry_mixer_interior';
  interior.rotateX(MIXER_DOWNWARD_TILT);
  group.add(interior);

  const SHAFT_LENGTH = 3.2;
  const shaftGeo = new THREE.CylinderGeometry(0.09, 0.09, SHAFT_LENGTH, 10);
  shaftGeo.rotateX(Math.PI / 2);
  interior.add(makeMesh(shaftGeo, 'side_mixer_shaft', [0, 0, -SHAFT_LENGTH / 2], null, mixerSteelMaterial));

  const hub = new THREE.Group();
  hub.name = 'side_mixer_prop_hub';
  hub.position.set(0, 0, -SHAFT_LENGTH);
  interior.add(hub);

  const hubCoreGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.3, 10);
  hubCoreGeo.rotateX(Math.PI / 2);
  hub.add(makeMesh(hubCoreGeo, 'side_mixer_hub', [0, 0, 0], null, mixerSteelMaterial));

  /* 3-blade propeller, 120 deg apart, each blade a thin pitched
     rectangle radiating from the hub — signal red, per spec. */
  const BLADE_COUNT = 3;
  for (let i = 0; i < BLADE_COUNT; i++) {
    const blade = makeMesh(box(0.16, 0.85, 0.05), 'side_mixer_blade', [0, 0.5, 0], null, mixerPropellerMaterial);
    blade.rotation.z = (i / BLADE_COUNT) * Math.PI * 2;
    blade.rotateY(0.45); // blade pitch, so it reads as a real propeller, not a flat fan
    hub.add(blade);
  }

  /* Pulse-ring beacon at the wall insertion point, just proud of the
     collar — a bright, distinctly-not-red accent (cyan-white) so it
     reads as "sensor/indicator" rather than blending with the
     propeller. Pulsed via emissiveIntensity in GltfTwinScene.jsx's
     useFrame, alongside the propeller spin. */
  const beaconGeo = new THREE.TorusGeometry(0.68, 0.035, 8, 24);
  const beacon = makeMesh(beaconGeo, 'side_mixer_beacon', [0, 0, 0.08], null, mixerBeaconMaterial);
  group.add(beacon);

  return { group, hub, beacon };
}

/* Re-discovers the hub/beacon refs of already-built mixers instead of
   just bailing empty-handed — React.StrictMode double-invokes this
   component's useLayoutEffect once in dev (see this file's own header
   comment), and the caller stores whatever this function returns
   directly into a ref every time it runs. Returning {propellerHubs:[],
   beacons:[]} on that second, "nothing to build" call would silently
   overwrite the real refs the first call already produced, permanently
   killing the propeller-spin/beacon-pulse animation with no error to
   show for it — this is what actually keeps that from happening. */
function addDigesterMixers(digester) {
  const existing = digester.children.filter((child) => child.name === 'side_entry_mixer');
  if (existing.length) {
    return {
      propellerHubs: existing.map((group) => group.getObjectByName('side_mixer_prop_hub')).filter(Boolean),
      beacons: existing.map((group) => group.getObjectByName('side_mixer_beacon')).filter(Boolean)
    };
  }

  const propellerHubs = [];
  const beacons = [];
  MIXER_AZIMUTHS.forEach((azimuth) => {
    const { group, hub, beacon } = buildSideMixer(azimuth);
    digester.add(group);
    propellerHubs.push(hub);
    beacons.push(beacon);
  });
  return { propellerHubs, beacons };
}

export function applyStructureOverrides(plantRoot) {
  const engineRoom = plantRoot.getObjectByName('engine_room');
  if (engineRoom) addEngineRoomDetails(engineRoom);

  const pumpRoom = plantRoot.getObjectByName('pump_room');
  if (pumpRoom) replacePumpRoomShell(pumpRoom);

  const digester = plantRoot.getObjectByName('digester');
  const mixers = digester ? addDigesterMixers(digester) : { propellerHubs: [], beacons: [] };

  return mixers;
}
