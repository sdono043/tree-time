// Saved assessments used in demo mode (no API key) and in tests. Each one is
// shaped exactly like what the vision model returns for a set of photos.
import type { JobAssessment } from "./assessment";
import type { JobOptions } from "./job-estimator";

export interface SampleJob {
  id: string;
  title: string;
  photoNote: string;
  options: Partial<JobOptions>;
  assessment: JobAssessment;
}

export const SAMPLE_JOBS: SampleJob[] = [
  {
    id: "front-maple",
    title: "Front-yard maple, open lawn",
    photoNote: "2 photos: whole tree from the street; base of trunk with a garden hose for scale.",
    options: { service: "removal", locality: "Henrico" },
    assessment: {
      summary: "Single red maple in an open front lawn, well clear of the house and driveway. Straightforward fell toward the street side of the lawn.",
      trees: [
        { label: "Red maple, front lawn", species: "Red maple (Acer rubrum)", heightFtLow: 30, heightFtHigh: 40, heightConfidence: "medium", trunkDiameterInLow: 12, trunkDiameterInHigh: 16, condition: "declining", lean: "none", defects: ["Dieback in upper third of crown"] },
      ],
      targets: [],
      nearestStructureFt: 55,
      powerLines: "none_visible",
      truckAccess: "driveway_adjacent",
      terrain: "flat",
      dropZone: "open_fell_possible",
      nearRoadway: false,
      nearWater: false,
      stumpsVisible: 0,
      scaleReference: "Two-story house in background; garden hose at base",
      photoQuality: "good",
      overallConfidence: "high",
      missingInfo: ["Should the stump be ground, and should wood be left for firewood?"],
    },
  },
  {
    id: "backyard-oak",
    title: "Backyard white oak over the house",
    photoNote: "3 photos: canopy over the roof, view from the gate, trunk base.",
    options: { service: "removal", locality: "Richmond" },
    assessment: {
      summary: "Mature white oak in a fenced backyard with a large limb over the roof. Truck can't get past the 4 ft gate, so the tree is climbed and rigged down in sections and brush is carried to the street.",
      trees: [
        { label: "White oak, back corner", species: "White oak (Quercus alba)", heightFtLow: 60, heightFtHigh: 75, heightConfidence: "medium", trunkDiameterInLow: 30, trunkDiameterInHigh: 36, condition: "healthy", lean: "slight", defects: ["Codominant stems at ~20 ft", "One limb extends over the roof"] },
      ],
      targets: ["house", "fence", "landscaping"],
      nearestStructureFt: 12,
      powerLines: "service_drop_nearby",
      truckAccess: "through_gate",
      terrain: "flat",
      dropZone: "limited_sectional",
      nearRoadway: false,
      nearWater: false,
      stumpsVisible: 0,
      scaleReference: "Two-story house roofline; 6 ft privacy fence",
      photoQuality: "good",
      overallConfidence: "medium",
      missingInfo: ["Gate width (looks about 4 ft)", "Is the house service line on this side?"],
    },
  },
  {
    id: "dead-pine-street",
    title: "Dead pine beside the street",
    photoNote: "2 photos: from across the street showing lines, close-up of the bark.",
    options: { service: "removal", locality: "Chesterfield" },
    assessment: {
      summary: "Dead loblolly pine at the front property line with the crown over the sidewalk and parked cars. Primary lines run along the street about 15 ft away. Bucket truck from the curb avoids climbing a dead stem.",
      trees: [
        { label: "Dead loblolly pine", species: "Loblolly pine (Pinus taeda)", heightFtLow: 45, heightFtHigh: 60, heightConfidence: "medium", trunkDiameterInLow: 16, trunkDiameterInHigh: 20, condition: "dead", lean: "slight", defects: ["No needles", "Bark sloughing (pine beetle)", "Brittle top"] },
      ],
      targets: ["road_or_sidewalk", "vehicle"],
      nearestStructureFt: 35,
      powerLines: "primary_lines_nearby",
      truckAccess: "driveway_adjacent",
      terrain: "flat",
      dropZone: "limited_sectional",
      nearRoadway: true,
      nearWater: false,
      stumpsVisible: 0,
      scaleReference: "Utility pole and parked SUV",
      photoQuality: "fair",
      overallConfidence: "medium",
      missingInfo: ["Is the tree on private property or in the county right-of-way?", "Exact distance from the canopy to the primary lines"],
    },
  },
  {
    id: "storm-poplar",
    title: "Storm-split tulip poplar on a house",
    photoNote: "4 photos: split trunk, top resting on the roof, side yard, creek behind the lot.",
    options: { service: "removal", locality: "Chesterfield" },
    assessment: {
      summary: "Large tulip poplar split at the main union in a storm; one half is resting on the roof. No safe drop zone and the tree can't be climbed, so this is a crane pick. A creek runs behind the lot.",
      trees: [
        { label: "Split tulip poplar", species: "Tulip poplar (Liriodendron tulipifera)", heightFtLow: 80, heightFtHigh: 95, heightConfidence: "low", trunkDiameterInLow: 34, trunkDiameterInHigh: 40, condition: "storm_damaged", lean: "severe", defects: ["Split at main union", "Half the crown resting on roof", "Hanging broken limbs"] },
      ],
      targets: ["house", "vehicle", "neighbor_property"],
      nearestStructureFt: 0,
      powerLines: "service_drop_nearby",
      truckAccess: "driveway_adjacent",
      terrain: "moderate_slope",
      dropZone: "no_drop_zone",
      nearRoadway: false,
      nearWater: true,
      stumpsVisible: 0,
      scaleReference: "House roofline and gutters",
      photoQuality: "fair",
      overallConfidence: "low",
      missingInfo: ["Is anyone still living in the affected rooms?", "Has the homeowner opened an insurance claim?", "Can a crane set up in the driveway?"],
    },
  },
];
