import type { Metadata } from "next";
import { LeafPickup } from "./LeafPickup";

export const metadata: Metadata = {
  title: "Leaf pickup · Richmond Tree Care Co.",
  description:
    "Schedule curb-side leaf vacuum service in Richmond, VA. Rake to the curb — we do the rest.",
};

export default function LeafPickupPage() {
  return <LeafPickup />;
}
