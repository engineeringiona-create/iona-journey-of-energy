/* Narrow FOV matches src/three/scene-utils.js's PerspectiveCamera(32, ...)
   convention used by every other Three.js scene on the site — this is
   where their shared "isometric" feel comes from. */
export const CAMERA_FOV = 32;

/* Derived by hand-replicating drei's <Bounds fit> algorithm (see
   Bounds.js: fitHeightDistance = maxSize / (2*atan(halfFovRad)),
   distance = margin * max(fitHeightDistance, fitWidthDistance)) against
   this file's actual station geometry, a 16:9 canvas (aspect-video, see
   index.html), margin=1.25 and a chosen 30°-elevation / 40°-azimuth
   viewing direction ("3/4 isometric, hafif yandan"). <Bounds> is also
   mounted live around the model group in DigitalTwinScene.jsx with the
   same margin, so it self-corrects at runtime (real container aspect,
   future geometry edits) — this constant only needs to be a close
   starting point so CameraRig's reset() (Aşama 4 back/dot-nav) lands
   camera and <Bounds>'s own fit in agreement instead of visibly
   fighting each other on mount. Recompute by hand (or read it back from
   a live onFit callback) if the facility's bounding box changes a lot. */
export const DEFAULT_CAMERA_POSITION = [6.39, 7.35, 6.68];
export const DEFAULT_CAMERA_TARGET = [-1.58, 1.35, 0];

/* UI copy that isn't tied to a specific station, centralized here
   rather than inlined in JSX so it has one place to live. Values are
   i18n keys (see useI18n.js) — src/i18n/*.json carries the actual
   copy for every language, tr.json included. */
export const UI_TEXT = {
  learnMore: 'digitalTwin.ui.learnMore',
  back: 'digitalTwin.ui.back',
  close: 'digitalTwin.ui.close',
  fallbackAlt: 'digitalTwin.ui.fallbackAlt',
  fallbackDescription: 'digitalTwin.ui.fallbackDescription'
};

/* Facility material palette — a fixed light gray/white "studio render"
   tone, independent of the site's light/dark toggle (only the scene's
   background is theme-aware, via transparency; see DigitalTwinScene.jsx).
   Two tones (light for primary bodies, mid for secondary parts) give
   the low-poly composition a little depth without introducing a third
   color. `selected` replaces a part's own tone when its station is the
   active selection. Deliberately several shades darker than the ground/
   sky (Ground's canvas fill and the page's --surface token, both ~#f3f4f5)
   so the silhouette reads against the backdrop instead of "white on
   white" — this was a real contrast bug, not a style choice. */
export const SCENE_COLORS = {
  facilityLight: '#ced2d6',
  facilityMid: '#bcc0c6',
  selected: '#a8adb3'
};

/* Shared PBR values for every facility part (both the outer shell
   meshes and the digester's cutaway internals) — matte-ish so the
   studio env map reads as soft highlights rather than a mirror finish. */
export const MATERIAL_ROUGHNESS = 0.75;
export const MATERIAL_METALNESS = 0.05;

/* Relative offset (target -> camera) applied when a station is
   selected, tuned for this tighter facility layout (much closer
   together than the old widely-spaced placeholder stations). */
const FOCUS_OFFSET = [0, 0.9, 3.6];

function focusFor([x, y, z], offset = FOCUS_OFFSET) {
  return {
    cameraPosition: [x + offset[0], y + offset[1], z + offset[2]],
    target: [x, y, z]
  };
}

/* `available: false` stations skip the cutaway entirely (no clip plane
   is created for them in DigitalTwinScene.jsx, so `clipNormal`/
   `clipOffset`/`clipOpen` are irrelevant and left null/0). For the
   digester, which does support it: `clipNormal`/(local)plane pass
   through its origin in world space; `clipOffset` is the "closed"
   plane constant (large enough that nothing on the shell gets clipped)
   and `clipOpen` is the "open" constant CameraRig.jsx tweens to on
   arrival, revealing `internals` — primitives in the same shape as
   `geometry`, always mounted but ordinarily hidden behind the opaque
   shell until it's clipped away (no manual show/hide needed; regular
   depth-testing already does that). */
const NO_CUTAWAY = { available: false, clipNormal: null, clipOffset: 0, clipOpen: 0, internals: [] };

/* labelKey/descKey and each stat's labelKey are i18n keys, resolved
   through useI18n's t() at render time — see src/i18n/*.json for the
   copy itself (namespaced under "digitalTwin.stations.<id>.*") and
   useI18n.js for the fallback chain if a key is ever missing from the
   active language's dictionary.

   Each station is a `group` positioned at `origin`; `geometry` is a
   flat list of primitives rendered as children in that group's local
   space (so a station's parts move/click together). Every primitive
   type maps straight to a lower-camelCase Three.js geometry
   (`cylinderGeometry`, `sphereGeometry`, `boxGeometry`,
   `torusGeometry`) via createElement in DigitalTwinScene.jsx — except
   `tubeGeometry`, whose `points` (plain [x,y,z] tuples, world-space
   since the pipeline station's origin is [0,0,0]) get reconstructed
   into a CatmullRomCurve3 there, since a curve isn't plain JSON. */
export const TWIN_COMPONENTS = [
  {
    id: 'digester',
    labelKey: 'digitalTwin.stations.digester.label',
    descKey: 'digitalTwin.stations.digester.desc',
    origin: [-3.0, 0, 0],
    geometry: [
      {
        type: 'cylinderGeometry',
        args: [1.1, 1.1, 2.2, 12],
        position: [0, 1.1, 0],
        rotation: [0, 0, 0],
        color: SCENE_COLORS.facilityLight,
        /* The one part the digester's cutaway clips — see cutaway
           below. Every other part on every other station renders
           solid, uncut. */
        clip: true
      },
      {
        type: 'torusGeometry',
        args: [1.15, 0.05, 6, 20],
        position: [0, 2.15, 0],
        rotation: [Math.PI / 2, 0, 0],
        color: SCENE_COLORS.facilityMid
      }
    ],
    focus: focusFor([-3.0, 1.2, 0]),
    hoverLabel: [-3.0, 2.6, 0],
    cutaway: {
      available: true,
      /* WebGL clipping keeps the region where dot(point, normal) <=
         constant (see clipping_planes_fragment.glsl.js — the opposite
         sign convention from THREE.Plane.distanceToPoint, easy to get
         backwards). This station's focus camera sits on the +Z side
         (FOCUS_OFFSET is dominated by +Z), so clipNormal points
         towards it: with clipOpen=0, dot(point,(0,0,1))=point.z, kept
         where z<=0 — the far half survives, the near half facing the
         camera on arrival is what gets clipped away, opening a view
         into the tank. clipOffset=1.3 safely clears the cylinder's
         r=1.1 shell in every direction (nothing clipped, "closed"). */
      clipNormal: [0, 0, 1],
      clipOffset: 1.3,
      clipOpen: 0,
      internals: [
        {
          type: 'cylinderGeometry',
          args: [0.05, 0.05, 1.9, 8],
          position: [0.1, 1.1, -0.15],
          rotation: [0, 0, 0],
          color: SCENE_COLORS.facilityMid
        },
        {
          type: 'cylinderGeometry',
          args: [0.08, 0.08, 0.55, 8],
          position: [0.25, 0.55, -0.3],
          rotation: [0, 0, Math.PI / 2],
          color: SCENE_COLORS.facilityLight
        },
        {
          type: 'cylinderGeometry',
          args: [0.08, 0.08, 0.45, 8],
          position: [-0.15, 1.55, -0.25],
          rotation: [0, 0, Math.PI / 2],
          color: SCENE_COLORS.facilityLight
        },
        {
          type: 'sphereGeometry',
          args: [0.22, 10, 8],
          position: [0.3, 0.35, -0.45],
          rotation: [0, 0, 0],
          color: SCENE_COLORS.facilityMid
        }
      ]
    },
    stats: [
      {
        labelKey: 'digitalTwin.stations.digester.stats.temperature',
        value: 38.2,
        unit: '°C',
        kind: 'sparkline',
        series: [36.1, 36.8, 37.4, 37.9, 38.0, 38.2]
      },
      {
        labelKey: 'digitalTwin.stations.digester.stats.fillLevel',
        value: 92,
        unit: '%',
        kind: 'gauge',
        series: [90, 91, 91, 92, 92, 92]
      },
      {
        labelKey: 'digitalTwin.stations.digester.stats.pressure',
        value: 4.1,
        unit: ' mbar',
        kind: 'kpi',
        series: [4.6, 4.4, 4.3, 4.2, 4.1, 4.1]
      },
      {
        labelKey: 'digitalTwin.stations.digester.stats.flowRate',
        value: 12.4,
        unit: ' m³/sa',
        kind: 'kpi',
        series: [10.8, 11.3, 11.9, 12.1, 12.3, 12.4]
      }
    ]
  },
  {
    id: 'biogas-dome',
    labelKey: 'digitalTwin.stations.biogas-dome.label',
    descKey: 'digitalTwin.stations.biogas-dome.desc',
    /* Sized to ~2/3 of the digester's radius (1.1 * 0.68 ≈ 0.75).
       Gap to the digester's right edge (-3.0 + 1.1 = -1.9) widened to
       ~0.3 (was ~0.1) after a first pass looked like a mug-and-handle
       — packed that tight, the connecting pipe visually fused into the
       tank's silhouette instead of reading as a separate line between
       two vessels. */
    origin: [-0.85, 0, 0],
    geometry: [
      {
        type: 'sphereGeometry',
        args: [0.75, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2],
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        color: SCENE_COLORS.facilityMid
      }
    ],
    focus: focusFor([-0.85, 0.55, 0]),
    hoverLabel: [-0.85, 1.15, 0],
    cutaway: NO_CUTAWAY,
    stats: [
      {
        labelKey: 'digitalTwin.stations.biogas-dome.stats.pressure',
        value: 3.8,
        unit: ' mbar',
        kind: 'sparkline',
        series: [3.9, 3.8, 3.8, 3.9, 3.8, 3.8]
      },
      {
        labelKey: 'digitalTwin.stations.biogas-dome.stats.methaneRatio',
        value: 58,
        unit: '%',
        kind: 'gauge',
        series: [54, 55, 56, 57, 58, 58]
      },
      {
        labelKey: 'digitalTwin.stations.biogas-dome.stats.storageCapacity',
        value: 71,
        unit: '%',
        kind: 'kpi',
        series: [64, 66, 68, 69, 70, 71]
      },
      {
        labelKey: 'digitalTwin.stations.biogas-dome.stats.internalTemperature',
        value: 18.4,
        unit: '°C',
        kind: 'kpi',
        series: [18.0, 18.2, 18.3, 18.1, 18.4, 18.4]
      }
    ]
  },
  {
    id: 'pipeline',
    labelKey: 'digitalTwin.stations.pipeline.label',
    descKey: 'digitalTwin.stations.pipeline.desc',
    origin: [0, 0, 0],
    geometry: [
      {
        type: 'tubeGeometry',
        /* Endpoints sit ~0.05 *inside* each vessel's shell (digester's
           cylindrical surface at this height is x=-1.9; the dome's
           spherical surface at y=0.5 is x=-1.41 — see biogas-dome's
           sphere math) so the tube visually plugs into both bodies. A
           gentler, more open diagonal than the first pass — that one
           curled tightly enough, at a smaller gap, to read as a mug
           handle instead of a process pipe between two vessels. */
        points: [
          [-1.85, 1.65, 0],
          [-1.75, 1.35, 0],
          [-1.55, 0.85, 0],
          [-1.45, 0.5, 0]
        ],
        tubularSegments: 16,
        radius: 0.09,
        radialSegments: 6,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        color: SCENE_COLORS.facilityMid
      }
    ],
    focus: focusFor([-1.65, 1.05, 0]),
    hoverLabel: [-1.65, 2.0, 0],
    cutaway: NO_CUTAWAY,
    stats: [
      {
        labelKey: 'digitalTwin.stations.pipeline.stats.flowRate',
        value: 14.6,
        unit: ' m³/sa',
        kind: 'sparkline',
        series: [12.8, 13.4, 13.9, 14.2, 14.4, 14.6]
      },
      {
        labelKey: 'digitalTwin.stations.pipeline.stats.efficiency',
        value: 88,
        unit: '%',
        kind: 'gauge',
        series: [83, 84, 85, 86, 87, 88]
      },
      {
        labelKey: 'digitalTwin.stations.pipeline.stats.inletTemperature',
        value: 62,
        unit: '°C',
        kind: 'kpi',
        series: [61, 62, 62, 61, 62, 62]
      },
      {
        labelKey: 'digitalTwin.stations.pipeline.stats.outletTemperature',
        value: 58,
        unit: '°C',
        kind: 'kpi',
        series: [57, 58, 58, 57, 58, 58]
      }
    ]
  },
  {
    id: 'control-cabin',
    labelKey: 'digitalTwin.stations.control-cabin.label',
    descKey: 'digitalTwin.stations.control-cabin.desc',
    /* Left edge (0.55 - 0.5 = 0.05) sits close to the dome's right
       edge (-0.85 + 0.75 = -0.1), and the box itself is shrunk well
       below the digester/dome's footprint — "belirgin şekilde küçük"
       relative to the rest of the cluster, not just marginally so. */
    origin: [0.55, 0, 0],
    geometry: [
      {
        type: 'boxGeometry',
        args: [1.0, 0.9, 0.85],
        position: [0, 0.45, 0],
        rotation: [0, 0, 0],
        color: SCENE_COLORS.facilityLight
      },
      {
        /* Exhaust stack, not a decorative antenna: r=0.07 (a first pass
           at r=0.05 read as a broken hairline against the small box),
           tall enough (h=1.8) that its top (world y = 1.8 + 0.9 = 2.7)
           clears the digester's rim (world y=2.2) with real margin —
           "baca ince ve tanktan uzun" — without towering so far past
           its own box that it looked like a glitch. */
        type: 'cylinderGeometry',
        args: [0.07, 0.07, 1.8, 8],
        position: [0.3, 1.8, 0.1],
        rotation: [0, 0, 0],
        color: SCENE_COLORS.facilityMid
      }
    ],
    focus: focusFor([0.55, 0.65, 0]),
    hoverLabel: [0.55, 1.2, 0],
    cutaway: NO_CUTAWAY,
    stats: [
      {
        labelKey: 'digitalTwin.stations.control-cabin.stats.powerOutput',
        value: 487,
        unit: ' kW',
        kind: 'sparkline',
        series: [468, 472, 478, 481, 484, 487]
      },
      {
        labelKey: 'digitalTwin.stations.control-cabin.stats.loadFactor',
        value: 76,
        unit: '%',
        kind: 'gauge',
        series: [68, 70, 72, 74, 75, 76]
      },
      {
        labelKey: 'digitalTwin.stations.control-cabin.stats.engineTemperature',
        value: 82,
        unit: '°C',
        kind: 'kpi',
        series: [81, 82, 82, 83, 82, 82]
      },
      {
        labelKey: 'digitalTwin.stations.control-cabin.stats.operatingHours',
        value: 6214,
        unit: ' sa',
        kind: 'kpi',
        series: [6100, 6130, 6160, 6190, 6205, 6214]
      }
    ]
  }
];
