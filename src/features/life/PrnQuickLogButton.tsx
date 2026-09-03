import { Button } from "antd";
import { TbPlus } from "react-icons/tb";
import { logMedicationDose } from "../../lib/medications";
import { hapticSuccess } from "../../lib/haptics";

interface Props {
  medicationId: number;
  label?: string;
  size?: "small" | "middle";
}

// A single tap logs "taken now" — no schedule required, matching how PRN
// meds actually get used (symptom-triggered, not clock-triggered). Reused by
// MedicationCard and (once Phase F ships) the Today Digest's Medications section.
export function PrnQuickLogButton({ medicationId, label = "Log dose now", size = "small" }: Props) {
  async function handleClick() {
    await logMedicationDose(medicationId, { status: "done" });
    hapticSuccess();
  }
  return (
    <Button size={size} icon={<TbPlus size={13} />} onClick={handleClick}>
      {label}
    </Button>
  );
}
