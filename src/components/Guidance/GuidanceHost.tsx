// Mount point for guidance modals. Reads active guidance from the store
// and renders the matching surface. Coach cards are rendered by their
// owning component (see PathRibbon), not here.

import { useGuidance } from "../../lib/guidanceStore";
import TeachingModal from "./TeachingModal";

export default function GuidanceHost() {
  const { active } = useGuidance();
  if (!active) return null;
  if (active.surface !== "modal") return null;
  return <TeachingModal def={active} />;
}
