import { useMemo, useState } from "react";
import { Button, Switch, Empty } from "antd";
import { TbPlus, TbPill } from "react-icons/tb";
import { useMedications, useTodayMedicationOccurrences, type MedicationOccurrence } from "../../lib/medications";
import { MedicationCard } from "./MedicationCard";
import { MedicationEditorSheet } from "./MedicationEditorSheet";
import type { MedicationDto } from "../../db/types";

export function MedicationsView() {
  const [includeInactive, setIncludeInactive] = useState(false);
  const medications = useMedications({ includeInactive });
  const todayOccurrences = useTodayMedicationOccurrences();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MedicationDto | null>(null);

  const occurrencesByMedication = useMemo(() => {
    const map = new Map<number, MedicationOccurrence[]>();
    for (const occ of todayOccurrences) {
      if (occ.medication.id == null) continue;
      const arr = map.get(occ.medication.id);
      if (arr) arr.push(occ);
      else map.set(occ.medication.id, [occ]);
    }
    return map;
  }, [todayOccurrences]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(m: MedicationDto) {
    setEditing(m);
    setEditorOpen(true);
  }

  return (
    <div style={{ padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Button icon={<TbPlus size={14} />} size="small" type="primary" onClick={openCreate}>Add medication</Button>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Show inactive</span>
          <Switch size="small" checked={includeInactive} onChange={setIncludeInactive} />
        </div>
      </div>

      {medications.length === 0 ? (
        <Empty
          image={<TbPill size={32} style={{ opacity: 0.4, margin: "0 auto" }} />}
          description="No medications yet"
          style={{ marginTop: 48 }}
        />
      ) : (
        medications.map((m) => (
          <MedicationCard key={m.id} medication={m} todayOccurrences={m.id ? occurrencesByMedication.get(m.id) ?? [] : []} onEdit={() => openEdit(m)} />
        ))
      )}

      <MedicationEditorSheet open={editorOpen} onClose={() => setEditorOpen(false)} medication={editing} />
    </div>
  );
}
