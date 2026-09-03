import { TbAlertTriangle, TbClock } from "react-icons/tb";
import { useTokens } from "../../hooks/useTokens";
import { EmberChain } from "../../components/EmberChain";
import { useMedicationBeads, logMedicationDose, needsRefillAlert, type MedicationOccurrence } from "../../lib/medications";
import { hapticSuccess, hapticLight } from "../../lib/haptics";
import { PrnQuickLogButton } from "./PrnQuickLogButton";
import type { MedicationDto } from "../../db/types";

const CHAIN_DAYS = 7;

interface Props {
  medication: MedicationDto;
  todayOccurrences: MedicationOccurrence[]; // this medication's due (time, status) pairs for today, empty for PRN
  onEdit: () => void;
}

// Tapping a time chip cycles pending -> done -> missed -> done (never back to
// pending from the card — same "explicit action, no silent reset" spirit as
// RoutineDetailSheet's Done/Missed buttons, just compressed into one tap
// target per dose instead of two buttons, since a med can have several
// doses/day and a full button pair per dose would crowd the card).
export function MedicationCard({ medication, todayOccurrences, onEdit }: Props) {
  const tokens = useTokens();
  const beads = useMedicationBeads(medication.id, CHAIN_DAYS);
  const refillDue = needsRefillAlert(medication);

  async function logTime(scheduledTime: string, currentStatus: MedicationOccurrence["status"]) {
    if (!medication.id) return;
    const next = currentStatus === "done" ? "missed" : "done";
    await logMedicationDose(medication.id, { status: next, scheduledTime });
    next === "done" ? hapticSuccess() : hapticLight();
  }

  return (
    <div
      style={{
        border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px",
        borderLeft: `3px solid ${medication.active ? tokens.accent : tokens.ash}`,
        opacity: medication.active ? 1 : 0.6,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div onClick={onEdit} style={{ cursor: "pointer", flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{medication.name}</div>
          {(medication.dosage || medication.form) && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
              {[medication.dosage, medication.form].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        {medication.scheduleType === "scheduled" && (
          <EmberChain beads={beads} size="compact" milestoneStreak={medication.streakCount} />
        )}
      </div>

      {refillDue && (
        <div className="label-caps" style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, color: "var(--gold)", fontSize: 11 }}>
          <TbAlertTriangle size={13} /> Refill soon — {medication.doseCountRemaining} dose{medication.doseCountRemaining === 1 ? "" : "s"} left
        </div>
      )}

      {medication.scheduleType === "prn" ? (
        <div style={{ marginTop: 10 }}>
          <PrnQuickLogButton medicationId={medication.id!} />
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {todayOccurrences.map((occ) => (
            <button
              key={occ.scheduledTime}
              onClick={() => logTime(occ.scheduledTime, occ.status)}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999,
                fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", cursor: "pointer",
                border: `1px solid ${occ.status === "done" ? "var(--accent)" : "var(--border)"}`,
                background: occ.status === "done" ? `${tokens.accent}22` : occ.status === "missed" ? tokens.ash : "transparent",
                color: occ.status === "done" ? "var(--accent)" : "var(--ink)",
                textDecoration: occ.status === "missed" ? "line-through" : "none",
              }}
            >
              <TbClock size={11} /> {occ.scheduledTime}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
