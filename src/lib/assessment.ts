// Schema for what the vision model reports about a job from photos. Only things
// a photo can show live here; pricing decisions are made in job-estimator.ts.
import { z } from "zod";

export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

export const TreeAssessment = z.object({
  label: z.string().describe("Short name to tell trees apart, e.g. 'Large oak behind house'"),
  species: z.string().describe("Most likely species or 'Unknown'"),
  heightFtLow: z.number().describe("Low end of estimated height in feet"),
  heightFtHigh: z.number().describe("High end of estimated height in feet"),
  heightConfidence: Confidence,
  trunkDiameterInLow: z.number().describe("Low end of trunk diameter at chest height, inches"),
  trunkDiameterInHigh: z.number().describe("High end of trunk diameter at chest height, inches"),
  condition: z.enum(["healthy", "declining", "dead", "storm_damaged"]),
  lean: z.enum(["none", "slight", "severe"]),
  defects: z.array(z.string()).describe("Visible defects: cavities, cracks, hangers, fungal bodies, codominant stems"),
});
export type TreeAssessment = z.infer<typeof TreeAssessment>;

export const JobAssessment = z.object({
  summary: z.string().describe("Two or three sentences describing the job as a crew lead would"),
  trees: z.array(TreeAssessment),
  targets: z
    .array(z.enum(["house", "outbuilding", "fence", "vehicle", "road_or_sidewalk", "pool", "landscaping", "neighbor_property"]))
    .describe("What could be damaged if a piece fell uncontrolled"),
  nearestStructureFt: z.number().nullable().describe("Distance from the tree to the nearest building, feet; null if no building visible"),
  powerLines: z.enum(["none_visible", "service_drop_nearby", "primary_lines_nearby", "lines_in_canopy"]),
  truckAccess: z.enum(["driveway_adjacent", "through_gate", "no_vehicle_access"]),
  terrain: z.enum(["flat", "moderate_slope", "steep"]),
  dropZone: z.enum(["open_fell_possible", "limited_sectional", "no_drop_zone"]),
  nearRoadway: z.boolean().describe("Tree or work zone is at or over a public street or sidewalk"),
  nearWater: z.boolean().describe("A stream, pond, wetland or shoreline is visible within about 100 ft"),
  stumpsVisible: z.number().describe("Existing stumps visible that may need grinding"),
  scaleReference: z.string().nullable().describe("What was used to judge size (door, house story, person, car), or null"),
  photoQuality: z.enum(["good", "fair", "poor"]),
  overallConfidence: Confidence,
  missingInfo: z.array(z.string()).describe("Questions to ask the customer or photos to request"),
});
export type JobAssessment = z.infer<typeof JobAssessment>;
