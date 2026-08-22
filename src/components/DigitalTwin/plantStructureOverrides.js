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

function makeMesh(geometry, name, position, rotation) {
  const mesh = new THREE.Mesh(geometry);
  mesh.name = name;
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
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

export function applyStructureOverrides(plantRoot) {
  const engineRoom = plantRoot.getObjectByName('engine_room');
  if (engineRoom) addEngineRoomDetails(engineRoom);

  const pumpRoom = plantRoot.getObjectByName('pump_room');
  if (pumpRoom) replacePumpRoomShell(pumpRoom);
}
