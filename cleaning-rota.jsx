import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { AREAS, DIFFICULTY, generateBaseSchedule, redistributeChores } from "./lib/schedule.js";

const FLATMATES_DEFAULT = ["Hannah", "Mikail", "Patxi", "Hélène", "Shelly", "Lara"];

const AREA_COLORS = {
  "Cuisine":            { bg: "rgba(255, 45, 85, 0.15)", border: "rgba(255, 45, 85, 0.3)", text: "#FF375F", accent: "#FF375F" },
  "Toilettes":          { bg: "rgba(100, 210, 255, 0.15)", border: "rgba(100, 210, 255, 0.3)", text: "#64D2FF", accent: "#64D2FF" },
  "Salle à manger":     { bg: "rgba(255, 159, 10, 0.15)", border: "rgba(255, 159, 10, 0.3)", text: "#FF9F0A", accent: "#FF9F0A" },
  "Communs":            { bg: "rgba(160, 255, 3, 0.15)", border: "rgba(160, 255, 3, 0.3)", text: "#A0FF03", accent: "#A0FF03" },
  "Salle sérigraphie":  { bg: "rgba(199, 125, 255, 0.15)", border: "rgba(199, 125, 255, 0.3)", text: "#C77DFF", accent: "#C77DFF" },
  "Salle bois":         { bg: "rgba(200, 152, 48, 0.15)", border: "rgba(200, 152, 48, 0.3)", text: "#C89830", accent: "#C89830" },
  "Poubelles":          { bg: "rgba(143, 163, 30, 0.15)", border: "rgba(143, 163, 30, 0.3)", text: "#8FA31E", accent: "#8FA31E" },
};
const BREAK_STYLE =  { bg: "rgba(191, 90, 242, 0.15)", border: "rgba(191, 90, 242, 0.3)", text: "#BF5AF2", accent: "#BF5AF2" }; // Purple
const ABSENT_STYLE = { bg: "#2C2C2E", border: "#3A3A3C", text: "#98989D", accent: "#8E8E93" }; // System Grey
const EXTRA_STYLE =  { bg: "rgba(255, 214, 10, 0.15)", border: "rgba(255, 214, 10, 0.3)", text: "#FFD60A", accent: "#FFD60A" }; // Yellow

const AREA_ICONS = {
  "Cuisine":            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>,
  "Toilettes":          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 19v2"/><path d="M18 19v2"/><path d="M3 13h18c.6 0 1 .4 1 1v2c0 1.7-1.3 3-3 3H5c-1.7 0-3-1.3-3-3v-2c0-.6.4-1 1-1Z"/><path d="M7 13V8c0-1.7 1.3-3 3-3h4c1.7 0 3 1.3 3 3v5"/><line x1="12" y1="3" x2="12" y2="5"/></svg>,
  "Salle à manger":     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="3" rx="1"/><line x1="6" y1="11" x2="6" y2="19"/><line x1="18" y1="11" x2="18" y2="19"/></svg>,
  "Communs":            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9Z"/><path d="M4 13v7"/><path d="M20 13v7"/></svg>,
  "Salle sérigraphie":  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="14" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5-4 4-2-2-5 5"/></svg>,
  "Salle bois":         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="9" width="18" height="6" rx="1"/><line x1="7" y1="9" x2="7" y2="15"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="17" y1="9" x2="17" y2="15"/></svg>,
  "Poubelles":          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
  "Pause":              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>,
};
const CHORES = {
  "Cuisine": [
    "Nettoyer les plans de travail",
    "Dégraisser la cuisinière et les plaques",
    "Nettoyer le micro-ondes (intérieur)",
    "Récurer l'évier",
    "Balayer et laver le sol",
    "Vider la poubelle et changer le sac",
    "Vérifier stocks produits ménagers et faire une liste de courses si besoin",
    "Essuyer l'extérieur du frigo",
  ],
  "Toilettes": [
    "Nettoyer la cuvette, la lunette et l'abattant",
    "Laver le sol des toilettes",
    "Nettoyer le lavabo et le robinet",
    "Essuyer le miroir",
    "Balayer et laver le sol de l'entrée",
    "Vider la poubelle",
    "Essuyer les interrupteurs et poignées de porte",
  ],
  "Salle à manger": [
    "Nettoyer les tables",
    "Balayer et laver le sol",
    "Dépoussiérer les surfaces et rebords",
    "Ranger les chaises",
    "Vider la poubelle",
    "Nettoyer les vitres si besoin",
  ],
  "Communs": [
    "Passer l'aspirateur",
    "Dépoussiérer les surfaces et meubles",
    "Nettoyer les vitres et portes",
    "Ranger et désencombrer",
    "Laver le sol",
    "Arroser les plantes",
  ],
  "Salle sérigraphie": [
    "Nettoyer les tables et plans de travail",
    "Rincer et ranger les écrans et racles",
    "Essuyer les résidus d'encre",
    "Balayer et laver le sol",
    "Vérifier et ranger les produits chimiques",
    "Vider la poubelle",
  ],
  "Salle bois": [
    "Balayer la sciure et les copeaux",
    "Passer l'aspirateur sur les machines",
    "Ranger les outils à leur place",
    "Nettoyer les établis",
    "Vérifier et ranger les chutes de bois",
    "Vider la poubelle",
  ],
  "Poubelles": [
    "Vider toutes les poubelles des salles communes",
    "Trier et sortir les poubelles de tri sélectif",
    "Changer les sacs poubelle",
    "Sortir les poubelles le soir de collecte",
    "Nettoyer les containers si besoin",
  ],
};

const LIGHTNING_ICON =<svg width="11" height="11" viewBox="0 0 24 24" fill="#8E8E93" stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;

const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
};

// Returns "2–8 Mar" style range for a given week index relative to startDate
const weekDate = (weekIdx, startDate) => {
  // Ensure startDate is treated as local time (append T00:00:00) then snap to Monday
  const base = startDate ? new Date(startDate.includes("T") ? startDate : `${startDate}T00:00:00`) : new Date();
  const start = getMonday(base);
  start.setDate(start.getDate() + weekIdx * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  if (start.getMonth() === end.getMonth()) return `${start.getDate()}–${fmt(end)}`;
  return `${fmt(start)}–${fmt(end)}`;
};

const ActivityRing = ({ progress, color, size = 52, stroke = 5, children }) => {
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(Math.abs(progress), 1) * circumference);

  return (
    <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={stroke} fill="none" strokeOpacity={0.2} />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease-out" }}
        />
      </svg>
      <div style={{ position: "absolute", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
};

const DonutChart = ({ data, size = 220 }) => {
  if (!data || data.length === 0) return null;
  const total = data.length;
  const center = size / 2;
  const radius = size / 2 - 10;
  const thickness = 50;
  const innerRadius = radius - thickness;
  let cumPercent = 0;

  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((slice, i) => {
          const startP = cumPercent;
          const endP = cumPercent + (1 / total);
          cumPercent = endP;

          const startA = startP * 2 * Math.PI - Math.PI / 2;
          const endA = endP * 2 * Math.PI - Math.PI / 2;
          const midA = (startA + endA) / 2;

          const x1 = center + innerRadius * Math.cos(startA);
          const y1 = center + innerRadius * Math.sin(startA);
          const x2 = center + radius * Math.cos(startA);
          const y2 = center + radius * Math.sin(startA);
          const x3 = center + radius * Math.cos(endA);
          const y3 = center + radius * Math.sin(endA);
          const x4 = center + innerRadius * Math.cos(endA);
          const y4 = center + innerRadius * Math.sin(endA);
          const largeArc = (endA - startA) > Math.PI ? 1 : 0;
          const d = `M ${x1} ${y1} L ${x2} ${y2} A ${radius} ${radius} 0 ${largeArc} 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1} ${y1} Z`;
          
          const textRadius = innerRadius + (thickness / 2);
          const tx = center + textRadius * Math.cos(midA);
          const ty = center + textRadius * Math.sin(midA);

          return (
            <g key={i}>
              <path d={d} fill={slice.color} stroke="#000" strokeWidth="4" />
              <text x={tx} y={ty} textAnchor="middle" dy="0.35em" fill="#000" fontSize="11" fontWeight="700" style={{ pointerEvents: "none" }}>
                {slice.label.substring(0, 2).toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  .rota-nav-btn:hover:not(:disabled) {
    background: #3A3A3C !important;
    color: #FFF !important;
  }
  .rota-action-btn:hover {
    background: #3A3A3C !important;
    color: #FFF !important;
    border-color: #3A3A3C !important;
  }
  .rota-table-row:hover td {
    background: #2C2C2E !important;
  }
  .rota-absence-btn:hover {
    background: #3A3A3C !important;
    border-color: #48484A !important;
  }
  .rota-cycle-btn:hover:not(.active) {
    background: #3A3A3C !important;
    color: #FFF !important;
  }
  .rota-mark-btn:hover {
    background: #2C2C2E !important;
    border-color: #48484A !important;
  }
  .rota-input:focus {
    border-color: #636366 !important;
    background: #1C1C1E !important;
    outline: none;
  }
  body { background: #000; font-family: "SF Pro Rounded", "SF Pro Display", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
`;

export default function CleaningRota() {
  const [names, setNames] = useState([...FLATMATES_DEFAULT]);
  const [editing, setEditing] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [cycleCount, setCycleCount] = useState(4);
  const [absences, setAbsences] = useState({});
  const [absenceMode, setAbsenceMode] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle"); // "idle" | "saving" | "saved" | "error"
  const [syncErrorMsg, setSyncErrorMsg] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [openChore, setOpenChore] = useState(null);
  const loaded = useRef(false);
  const webcalUrl = import.meta.env.VITE_CALENDAR_WEBCAL_URL;

  // Load persisted state on mount
  useEffect(() => {
    fetch("/api/state")
      .then(r => r.json())
      .then(data => {
        if (data.names) setNames(data.names);
        if (data.cycleCount) setCycleCount(data.cycleCount);
        if (data.absences) setAbsences(data.absences);
        const sd = data.startDate || new Date().toISOString().split("T")[0];
        setStartDate(sd);
        // Jump to current week on load
        const base = getMonday(new Date(`${sd}T00:00:00`));
        const now = getMonday(new Date());
        const diffMs = now - base;
        const weekIdx = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
        setCurrentWeek(Math.max(0, weekIdx));
        loaded.current = true;
      })
      .catch(() => { loaded.current = true; });
  }, []);

  const saveState = useCallback((overrideNames = names) => {
    if (!startDate) return Promise.resolve();
    setSyncStatus("saving");
    setSyncErrorMsg(null);
    return fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: overrideNames, cycleCount, absences, startDate }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `Erreur serveur HTTP ${r.status}`);
        
        if (data.syncError) {
          setSyncStatus("error");
          setSyncErrorMsg(data.syncError);
        } else {
          setSyncStatus("saved");
        }
      })
      .catch((err) => {
        setSyncStatus("error");
        setSyncErrorMsg(err.message);
      });
  }, [names, cycleCount, absences, startDate]);

  const resetAll = () => {
    setSyncStatus("saving");
    setSyncErrorMsg(null);
    fetch("/api/state", { method: "DELETE" })
      .then(r => {
        if (!r.ok) { setSyncStatus("error"); return; }
        setNames([...FLATMATES_DEFAULT]);
        setCycleCount(4);
        setAbsences({});
        setCurrentWeek(0);
        setAbsenceMode(false);
        setConfirmReset(false);
        setSyncStatus("saved");
      })
      .catch(() => setSyncStatus("error"));
  };

  // Auto-save + calendar sync, debounced 2s after any rota change
  useEffect(() => {
    if (!loaded.current || !startDate) return;
    setSyncStatus("saving");
    const t = setTimeout(() => saveState(), 2000);
    return () => clearTimeout(t);
  }, [names, cycleCount, absences, startDate, saveState]);

  const baseSchedule = useMemo(() => generateBaseSchedule(names, cycleCount), [names, cycleCount]);
  const weeksPerCycle = names.length;
  const totalWeeks = cycleCount * weeksPerCycle;
  const pauseWeeksPerCycle = Math.max(0, names.length - AREAS.length);

  const getEffective = useCallback((weekIdx) => {
    const base = baseSchedule[weekIdx];
    if (!base) return { assignments: {}, redistribution: null };
    const absentList = absences[weekIdx];
    if (!absentList || absentList.length === 0) return { assignments: base, redistribution: null };
    const result = redistributeChores(base, absentList, names);
    if (!result) return { assignments: base, redistribution: null };
    return { assignments: result.assignments, redistribution: result };
  }, [baseSchedule, absences, names]);

  const { assignments: currentAssignments, redistribution: currentRedist } = getEffective(currentWeek);
  const currentAbsent = absences[currentWeek] || [];

  const fairnessLedger = useMemo(() => {
    const ledger = {};
    names.forEach(n => { ledger[n] = { extraShifts: 0, totalDifficulty: 0, absences: 0 }; });
    Object.entries(absences).forEach(([weekIdx, absentList]) => {
      const base = baseSchedule[parseInt(weekIdx)];
      if (!base) return;
      const result = redistributeChores(base, absentList, names);
      if (!result) return;
      absentList.forEach(p => { if (ledger[p]) ledger[p].absences += 1; });
      Object.entries(result.extraDuties).forEach(([person, duty]) => {
        if (!ledger[person]) return;
        if (duty.type === "called_in") {
          ledger[person].extraShifts += 1;
          ledger[person].totalDifficulty += duty.difficulty;
        } else if (duty.type === "upgraded") {
          ledger[person].totalDifficulty += duty.difficulty;
        }
      });
    });
    return ledger;
  }, [absences, baseSchedule, names]);

  const hasAnyAbsences = Object.keys(absences).length > 0;

  const handleNameChange = (index, value) => {
    const updated = [...names];
    updated[index] = value;
    setNames(updated);
  };

  const toggleAbsent = (person) => {
    setAbsences(prev => {
      const list = prev[currentWeek] ? [...prev[currentWeek]] : [];
      const idx = list.indexOf(person);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(person);
      if (list.length === 0) {
        const next = { ...prev };
        delete next[currentWeek];
        return next;
      }
      return { ...prev, [currentWeek]: list };
    });
  };

  const clearAllAbsences = (weekIdx) => {
    setAbsences(prev => { const n = { ...prev }; delete n[weekIdx]; return n; });
    setAbsenceMode(false);
  };

  const getStyle = (area) => {
    if (area === "Pause") return BREAK_STYLE;
    if (area === "🏠 Absent") return ABSENT_STYLE;
    return AREA_COLORS[area] || { bg: "#1C1C1E", border: "#2C2C2E", text: "#8E8E93", accent: "#8E8E93" };
  };

  const cycleNumber = Math.floor(currentWeek / weeksPerCycle) + 1;
  const weekInCycle = (currentWeek % weeksPerCycle) + 1;
  const allAbsentCandidates = names;
  const accentColor = "#0A84FF"; // Apple System Blue for interactions

  // Compute data for the Donut Chart
  const pieData = names.map(name => {
    const areaStr = currentAssignments[name];
    if (!areaStr) return { color: "#2C2C2E", label: name };
    const isBreak = areaStr === "Pause";
    const isAbsent = areaStr === "🏠 Absent";
    const areas = (isBreak || isAbsent) ? [areaStr] : areaStr.split(" + ");
    const style = getStyle(areas[0]);
    return { color: style.accent, label: name };
  });

  return (
    <>
      <style>{CSS}</style>
      <div style={{
        minHeight: "100vh",
        background: "#000000",
        padding: "52px 20px 64px",
        color: "#FFFFFF",
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: 40 }}>
            <p style={{
              fontSize: 13, fontWeight: 600, textTransform: "uppercase",
              color: "#8E8E93", marginBottom: 4, letterSpacing: 0.5
            }}>Ménage L'Enfantine</p>
            <h1 style={{
              fontSize: 40, fontWeight: 700, color: "#FFF",
              margin: 0, letterSpacing: -0.5,
            }}>Le Planning</h1>
            <p style={{ fontSize: 15, color: "#8E8E93", marginTop: 6, fontWeight: 400 }}>
              {names.length} colocs · {AREAS.length} zones · Rotation équitable
            </p>
          </div>

          {/* Sync Panel */}
          <div style={{
            background: "#1C1C1E", borderRadius: 12,
            padding: "14px 20px", marginBottom: 28,
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {webcalUrl ? (
                <div>
                  <p style={{ fontSize: 11, color: "#8E8E93", fontWeight: 600, textTransform: "uppercase", margin: "0 0 2px" }}>Lien Google Calendar</p>
                  <a href={webcalUrl} style={{ fontSize: 13, color: accentColor, fontWeight: 500, wordBreak: "break-all", textDecoration: "none" }}>
                    {webcalUrl}
                  </a>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "#8E8E93", margin: 0 }}>
                  Ajouter <code style={{ color: "#636366" }}>VITE_CALENDAR_WEBCAL_URL</code> pour le lien
                </p>
              )}
            </div>
            <div style={{ fontSize: 10, letterSpacing: 1 }}>
              {syncStatus === "saving" && <span style={{ color: "#8E8E93" }}>synchronisation…</span>}
              {syncStatus === "saved"  && <span style={{ color: "#32D74B" }}>✓ synchronisé</span>}
              {syncStatus === "error"  && <span style={{ color: "#FF453A" }}>{syncErrorMsg ? `échec: ${syncErrorMsg}` : "échec de la synchronisation"}</span>}
            </div>
          </div>

          {/* Area Legend */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {AREAS.map(area => {
                const c = AREA_COLORS[area];
                const isOpen = openChore === area;
                return (
                  <button key={area} onClick={() => setOpenChore(isOpen ? null : area)} style={{
                    background: isOpen ? c.bg : "#1C1C1E",
                    border: `1px solid ${isOpen ? c.accent : "transparent"}`,
                    borderRadius: 20, padding: "6px 12px",
                    fontSize: 13, color: c.text, fontWeight: 500,
                    display: "flex", alignItems: "center", gap: 7,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    {AREA_ICONS[area]}
                    <span>{area}</span>
                  </button>
                );
              })}
            </div>
            {openChore && CHORES[openChore] && (
              <div style={{
                marginTop: 10, background: "#1C1C1E", borderRadius: 12,
                padding: "14px 18px",
                borderLeft: `3px solid ${AREA_COLORS[openChore]?.accent}`,
              }}>
                <ul style={{ margin: 0, padding: "0 0 0 16px", listStyle: "disc" }}>
                  {CHORES[openChore].map((chore, i) => (
                    <li key={i} style={{ fontSize: 13, color: "#EBEBF5CC", lineHeight: 1.8 }}>{chore}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Attribution Wheel */}
          <DonutChart data={pieData} />

          {/* Names Editor */}
          <div style={{
            background: "#1C1C1E", borderRadius: 12,
            padding: "20px 24px", marginBottom: 12,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: editing ? 16 : 0 }}>
              <span style={{ fontSize: 11, color: "#8E8E93", fontWeight: 600, textTransform: "uppercase" }}>Colocs</span>
              <button className="rota-action-btn" onClick={() => { if (editing) saveState(); setEditing(!editing); }} style={{
                background: "#2C2C2E", border: "none", borderRadius: 14,
                padding: "4px 12px", cursor: "pointer", fontSize: 13, fontWeight: 500,
                color: accentColor, fontFamily: "inherit", transition: "all 0.1s",
              }}>{editing ? "Terminé" : "Modifier"}</button>
            </div>
            {editing ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {names.map((name, i) => (
                  <input key={i} value={name} onChange={(e) => handleNameChange(i, e.target.value)}
                    className="rota-input"
                    style={{
                      flex: "1 1 140px", padding: "9px 14px",
                    border: "1px solid #3A3A3C", borderRadius: 8,
                      fontSize: 14, fontFamily: "inherit",
                      background: "#000", color: "#FFF",
                      transition: "border-color 0.15s",
                    }} />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {names.map((name, i) => (
                  <span key={i} style={{
                    background: "#000",
                    padding: "6px 14px", borderRadius: 20,
                    fontSize: 15, fontWeight: 500, color: "#FFF",
                  }}>{name}</span>
                ))}
              </div>
            )}
          </div>

          {/* Week Navigator */}
          <div style={{
            background: "#1C1C1E", borderRadius: 12,
            padding: "24px 20px", marginBottom: 12,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <button className="rota-nav-btn"
              onClick={() => { setCurrentWeek(Math.max(0, currentWeek - 1)); setAbsenceMode(false); }}
              disabled={currentWeek === 0}
              style={{
                background: "#2C2C2E", border: "none", borderRadius: "50%",
                width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: currentWeek === 0 ? "default" : "pointer",
                fontSize: 18, color: currentWeek === 0 ? "#48484A" : accentColor,
                fontFamily: "inherit", transition: "all 0.15s",
              }}>←</button>

            <div style={{ textAlign: "center" }}>
              <div style={{
                fontSize: 32, fontWeight: 700, color: "#FFF",
                lineHeight: 1, letterSpacing: -0.5,
              }}>Semaine {currentWeek + 1}</div>
              <div style={{
                fontSize: 12, color: "#FF9F0A", textTransform: "uppercase",
                marginTop: 6, fontWeight: 600, letterSpacing: 0.5
              }}>Cycle {cycleNumber} · Semaine {weekInCycle} / {weeksPerCycle}</div>
              <div style={{
                fontSize: 15, color: "#8E8E93",
                marginTop: 4, fontWeight: 400
              }}>{weekDate(currentWeek, startDate)}</div>
            </div>

            <button className="rota-nav-btn"
              onClick={() => { setCurrentWeek(Math.min(totalWeeks - 1, currentWeek + 1)); setAbsenceMode(false); }}
              disabled={currentWeek === totalWeeks - 1}
              style={{
                background: "#2C2C2E", border: "none", borderRadius: "50%",
                width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: currentWeek === totalWeeks - 1 ? "default" : "pointer",
                fontSize: 18, color: currentWeek === totalWeeks - 1 ? "#48484A" : accentColor,
                fontFamily: "inherit", transition: "all 0.15s",
              }}>→</button>
          </div>

          {/* Redistribution Banner */}
          {currentRedist && (
            <div style={{
              background: "rgba(255, 159, 10, 0.1)",
              borderLeft: "4px solid #FF9F0A",
              borderRadius: 10, padding: "14px 20px", marginBottom: 12,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 11, color: "#FF9F0A", fontWeight: 600,
                    textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 6
                  }}>
                    {LIGHTNING_ICON}
                    <span>{currentAbsent.length} ABSENT(S) ({currentAbsent.join(", ")}) — REDISTRIBUÉ</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#D1D1D6", lineHeight: 1.5 }}>
                    {currentRedist.skippedAreas.length > 0 && (
                      <span>Sauté : {currentRedist.skippedAreas.join(", ")}. </span>
                    )}
                    {Object.entries(currentRedist.extraDuties).filter(([, d]) => d.type === "called_in").map(([person, d]) => (
                      <span key={person}><span style={{ color: "#FFF", fontWeight: 600 }}>{person}</span> appelé en renfort → {d.area}. </span>
                    ))}
                    {Object.entries(currentRedist.extraDuties).filter(([, d]) => d.type === "upgraded").map(([person, d]) => (
                      <span key={person}><span style={{ color: "#FFF", fontWeight: 600 }}>{person}</span> passe à {d.area}. </span>
                    ))}
                  </div>
                </div>
                <button className="rota-action-btn" onClick={() => clearAllAbsences(currentWeek)} style={{
                  background: "#2C2C2E", border: "none",
                  borderRadius: 14, padding: "4px 12px", cursor: "pointer",
                  fontSize: 11, color: "#FF9F0A", fontWeight: 600,
                  whiteSpace: "nowrap", transition: "all 0.15s",
                }}>Effacer</button>
              </div>
            </div>
          )}

          {/* Assignment Cards */}
          <div style={{ display: "grid", gap: 7, marginBottom: 12 }}>
            {names.map((name) => {
              const areaStr = currentAssignments[name];
              if (!areaStr) return null;
              
              const isBreak = areaStr === "Pause";
              const isAbsent = areaStr === "🏠 Absent";
              const areas = (isBreak || isAbsent) ? [areaStr] : areaStr.split(" + ");
              
              // Use style of first area for border accent if multiple
              const primarySt = getStyle(areas[0]);
              
              const extraInfo = currentRedist?.extraDuties?.[name];
              const wasCalledIn = extraInfo?.type === "called_in";
              const wasUpgraded = extraInfo?.type === "upgraded";
              const wasReassigned = extraInfo?.type === "reassigned";
              const hasExtra = wasCalledIn || wasUpgraded;
              // const difficulty = DIFFICULTY[area]; // Calculated per pill

              return (
                <div key={name} style={{
                  background: "#1C1C1E",
                  borderLeft: `4px solid ${isAbsent ? "#3A3A3C" : hasExtra ? EXTRA_STYLE.accent : primarySt.accent}`,
                  borderRadius: 10, padding: "14px 20px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  opacity: isAbsent ? 0.3 : 1,
                  transition: "opacity 0.2s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 17, color: "#FFF", fontWeight: 600 }}>{name}</span>
                    {wasCalledIn && (
                      <span style={{
                        fontSize: 8, color: "#C89030",
                        background: "rgba(200,144,48,0.1)", border: "1px solid #4A3010",
                        padding: "2px 7px", borderRadius: 4,
                        fontWeight: 700, letterSpacing: 0.5,
                      }}>RENFORT</span>
                    )}
                    {wasUpgraded && (
                      <span style={{
                        fontSize: 8, color: "#C89030",
                        background: "rgba(200,144,48,0.1)", border: "1px solid #4A3010",
                        padding: "2px 7px", borderRadius: 4,
                        fontWeight: 700, letterSpacing: 0.5,
                      }}>PROMU</span>
                    )}
                    {wasReassigned && (
                      <span style={{
                        fontSize: 8, color: "#8E8E93",
                        background: "#2C2C2E",
                        padding: "2px 7px", borderRadius: 4,
                        fontWeight: 700, letterSpacing: 0.5,
                      }}>DÉPLACÉ</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {areas.map((area, idx) => {
                      const st = getStyle(area);
                      const diff = DIFFICULTY[area];
                      const icon = AREA_ICONS[area];
                      return (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            fontSize: 13, fontWeight: 600,
                            color: isAbsent ? "#48484A" : st.text,
                            fontStyle: (isBreak || isAbsent) ? "italic" : "normal",
                            background: isAbsent ? "transparent" : st.bg,
                            padding: "6px 12px", borderRadius: 12, display: "flex", alignItems: "center", gap: 6,
                          }}>{icon}{isAbsent ? <div style={{ width: 6, height: 6, background: "#FFF", borderRadius: "50%" }} /> : (isBreak ? null : area)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Absence UI */}
          <div style={{
            background: "#1C1C1E", borderRadius: 12,
            padding: "18px 24px", marginBottom: 12,
          }}>
            {!absenceMode ? (
              <button className="rota-mark-btn" onClick={() => setAbsenceMode(true)} style={{
                width: "100%", background: "none",
                border: "1px dashed #3A3A3C",
                borderRadius: 12, padding: "14px", cursor: "pointer",
                fontSize: 14, color: accentColor, fontWeight: 500, fontFamily: "inherit",
                transition: "all 0.15s", letterSpacing: 0.5,
              }}>Gérer les absences cette semaine</button>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontSize: 11, color: "#8E8E93", fontWeight: 600, textTransform: "uppercase" }}>Basculer absent</span>
                  <button className="rota-action-btn" onClick={() => setAbsenceMode(false)} style={{
                    background: "#2C2C2E", border: "none", borderRadius: 14,
                    padding: "4px 12px", cursor: "pointer", fontSize: 13,
                    color: accentColor, fontFamily: "inherit", transition: "all 0.15s",
                  }}>Terminé</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {allAbsentCandidates.map(name => {
                    const isMarked = currentAbsent.includes(name);
                    const origArea = baseSchedule[currentWeek]?.[name] || "";
                    const isOnBreak = origArea === "Pause";
                    return (
                      <button key={name} className="rota-absence-btn" onClick={() => toggleAbsent(name)} style={{
                        padding: "10px 16px", borderRadius: 12,
                        border: isMarked ? "1px solid #FF453A" : "1px solid #3A3A3C",
                        background: isMarked ? "rgba(255, 69, 58, 0.1)" : "#2C2C2E",
                        cursor: "pointer", fontSize: 15, fontWeight: 500,
                        fontFamily: "inherit",
                        color: isMarked ? "#FF453A" : "#8E8E93",
                        transition: "all 0.15s", textAlign: "left",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 9, opacity: 0.6 }}>
                            {isMarked ? "✕" : "○"}
                          </span>
                          {name}
                        </div>
                        <div style={{ fontSize: 11, color: isMarked ? "#FF453A" : "#636366", marginTop: 3, opacity: 0.8 }}>
                          {isOnBreak ? "en pause" : origArea}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {currentAbsent.length > 0 && (
                  <div style={{
                    marginTop: 12, padding: "9px 14px",
                    background: "rgba(255, 159, 10, 0.1)", borderRadius: 7,
                    fontSize: 12, color: "#FF9F0A", fontWeight: 500,
                  }}>
                    {(() => {
                      const present = names.filter(n => !currentAbsent.includes(n)).length;
                      const coverable = Math.min(present, AREAS.length);
                      const skipped = AREAS.length - coverable;
                      return `${currentAbsent.length} absents · ${present} présents · ${coverable} zone${coverable !== 1 ? "s" : ""} couvertes${skipped > 0 ? ` · ${skipped} sautées` : ""}`;
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fairness Ledger */}
          {hasAnyAbsences && (
            <div style={{
              background: "#1C1C1E", borderRadius: 12,
              padding: "20px 24px", marginBottom: 12,
            }}>
              <div
                onClick={() => setShowLedger(v => !v)}
                style={{ marginBottom: showLedger ? 16 : 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <div>
                  <span style={{ fontSize: 11, color: "#8E8E93", fontWeight: 600, textTransform: "uppercase" }}>Registre d'Équité</span>
                  {showLedger && <p style={{ fontSize: 12, color: "#636366", margin: "5px 0 0" }}>
                    {AREAS.map(a => `${a} ${"★".repeat(DIFFICULTY[a])}`).join(" · ")}
                  </p>}
                </div>
                <span style={{ fontSize: 12, color: "#636366" }}>{showLedger ? "▲" : "▼"}</span>
              </div>
              {showLedger && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                {names.map(name => {
                  const data = fairnessLedger[name];
                  const netScore = data.totalDifficulty - (data.absences * 2);
                  const accent = netScore > 0 ? "#32D74B" : netScore < 0 ? "#FF453A" : "#8E8E93";
                  const border = netScore > 0 ? "rgba(50, 215, 75, 0.3)" : netScore < 0 ? "rgba(255, 69, 58, 0.3)" : "#3A3A3C";
                  const progress = Math.min(Math.abs(netScore) / 10, 1); // 10 points = 100% ring

                  return (
                    <div key={name} style={{
                      border: `1px solid ${border}`,
                      borderRadius: 12, padding: "14px", textAlign: "center",
                    }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: "#FFF", marginBottom: 10,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{name}</div>

                      <div style={{ marginBottom: 12 }}>
                        <ActivityRing progress={progress} color={accent}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#FFF", letterSpacing: -0.5 }}>
                            {netScore > 0 ? "+" : ""}{netScore}
                          </span>
                        </ActivityRing>
                      </div>

                      <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: 10, color: "#8E8E93", marginBottom: 10 }}>
                        <div>
                          <div style={{
                            fontSize: 20, fontWeight: 600,
                            color: data.extraShifts > 0 ? "#32D74B" : "#3A3A3C",
                            lineHeight: 1, marginBottom: 4,
                          }}>{data.extraShifts}</div>
                          <div style={{ letterSpacing: 0.5 }}>extra</div>
                        </div>
                        <div style={{ width: 1, background: "#3A3A3C" }} />
                        <div>
                          <div style={{
                            fontSize: 20, fontWeight: 600,
                            color: data.absences > 0 ? "#FF453A" : "#3A3A3C",
                            lineHeight: 1, marginBottom: 4,
                          }}>{data.absences}</div>
                          <div style={{ letterSpacing: 0.5 }}>absences</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>}
            </div>
          )}

          {/* Full Schedule Table */}
          <div style={{
            background: "#1C1C1E", borderRadius: 12,
            padding: "20px 24px",
            overflowX: "auto",
          }}>
            <p style={{
              fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              color: "#8E8E93", marginBottom: 16, marginTop: 0,
            }}>Planning Complet — {totalWeeks} Semaines</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{
                    textAlign: "left", padding: "8px 12px 10px",
                    borderBottom: "1px solid #3A3A3C",
                    color: "#8E8E93", fontWeight: 600, fontSize: 10,
                  }}>SEM</th>
                  {names.map(name => (
                    <th key={name} style={{
                      textAlign: "center", padding: "8px 4px 10px",
                      borderBottom: "1px solid #3A3A3C",
                      color: "#8E8E93", fontWeight: 600, fontSize: 10,
                    }}>{name.toUpperCase().substring(0, 9)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {baseSchedule.map((_, weekIdx) => {
                  const { assignments: wa, redistribution: rd } = getEffective(weekIdx);
                  const isCycleBoundary = weekIdx > 0 && weekIdx % weeksPerCycle === 0;
                  const isCurrentRow = weekIdx === currentWeek;
                  const weekAbsent = absences[weekIdx] || [];
                  const hasAbsence = weekAbsent.length > 0;
                  return (
                    <tr key={weekIdx} className="rota-table-row"
                      onClick={() => { setCurrentWeek(weekIdx); setAbsenceMode(false); }}
                      style={{
                        cursor: "pointer",
                        borderTop: isCycleBoundary ? "1px solid #3A3A3C" : "none",
                      }}>
                      <td style={{
                        padding: "7px 12px", borderBottom: "1px solid #2C2C2E",
                        borderLeft: isCurrentRow ? "3px solid #0A84FF" : "3px solid transparent",
                        fontWeight: isCurrentRow ? 600 : 500,
                        color: isCurrentRow ? "#FFF" : "#8E8E93",
                        fontSize: 11, whiteSpace: "nowrap",
                        background: isCurrentRow ? "rgba(10, 132, 255, 0.1)" : "transparent",
                      }}>
                        {weekIdx + 1}
                        {hasAbsence && <span style={{ color: "#FF9F0A", marginLeft: 4, display: "inline-flex", alignItems: "center" }}>{LIGHTNING_ICON}</span>}
                        <div style={{
                          fontSize: 10, fontWeight: 400, marginTop: 2,
                          color: isCurrentRow ? "#64D2FF" : "#636366",
                        }}>{weekDate(weekIdx, startDate)}</div>
                      </td>
                      {names.map(name => {
                        const areaStr = wa[name];
                        const isBreak = areaStr === "Pause";
                        const isAbsent = areaStr === "🏠 Absent";
                        const areas = (isBreak || isAbsent) ? [areaStr] : areaStr.split(" + ");
                        
                        const extraInfo = rd?.extraDuties?.[name];
                        const hasExtra = extraInfo?.type === "called_in" || extraInfo?.type === "upgraded";
                        
                        return (
                          <td key={name} style={{
                            padding: "7px 3px", borderBottom: "1px solid #2C2C2E",
                            textAlign: "center",
                            background: isCurrentRow ? "rgba(10, 132, 255, 0.05)" : "transparent",
                          }}>
                            {areas.map((area, idx) => {
                              const st = getStyle(area);
                              const icon = AREA_ICONS[area];
                              return (
                                <span key={idx} style={{
                                  display: "inline-block",
                                  background: isAbsent ? "transparent" : hasExtra ? EXTRA_STYLE.bg : st.bg || "#333",
                                  color: isAbsent ? "#636366" : hasExtra ? EXTRA_STYLE.text : st.text || "#FFF",
                                  padding: "3px 8px", borderRadius: 6, fontSize: 10,
                                  fontWeight: (isBreak || isAbsent) ? 400 : 600,
                                  fontStyle: (isBreak || isAbsent) ? "italic" : "normal",
                                  whiteSpace: "nowrap",
                                  textDecoration: "none",
                                  margin: "0 2px", display: "inline-flex", alignItems: "center", gap: 4
                                }}>
                                  {icon}{isAbsent ? <div style={{ width: 6, height: 6, background: "#FFF", borderRadius: "50%" }} /> : (isBreak ? null : area)}
                                </span>
                              );
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cycle Count */}
          <div style={{ marginTop: 14, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: "#636366", fontWeight: 600, letterSpacing: 1 }}>CYCLES</span>
            {[2, 4, 6, 8].map(n => (
              <button key={n}
                className={`rota-cycle-btn${cycleCount === n ? " active" : ""}`}
                onClick={() => { setCycleCount(n); setCurrentWeek(Math.min(currentWeek, n * weeksPerCycle - 1)); }}
                style={{
                  background: cycleCount === n ? "#FFF" : "#1C1C1E",
                  color: cycleCount === n ? "#000" : "#8E8E93",
                  border: "none",
                  borderRadius: 14, padding: "6px 14px",
                  cursor: "pointer", fontSize: 13,
                  fontWeight: 600,
                  transition: "all 0.15s",
                }}>{n}</button>
            ))}
          </div>

          <p style={{
            textAlign: "center", fontSize: 13, color: "#636366",
            marginTop: 40, lineHeight: 1.6, maxWidth: 600, marginInline: "auto"
          }}>
            Chaque cycle de {weeksPerCycle} semaines : chacun fait toutes les zones{pauseWeeksPerCycle > 0 ? ` et a ${pauseWeeksPerCycle > 1 ? `${pauseWeeksPerCycle} semaines de pause` : "une semaine de pause"}` : ""}.<br />
            Les absences redistribuent les tâches — les zones prioritaires restent couvertes.<br />
            Le registre d'équité suit la charge supplémentaire via les points de difficulté.
          </p>

          {/* Reset */}
          <div style={{ textAlign: "center", marginTop: 24, paddingBottom: 40 }}>
            {confirmReset ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                <span style={{ fontSize: 12, color: "#FF453A" }}>
                  Effacer toutes les données ?
                </span>
                <button onClick={resetAll} style={{
                  background: "#FF453A", border: "none", borderRadius: 14,
                  padding: "6px 16px", cursor: "pointer", fontSize: 12,
                  color: "#FFF", fontWeight: 600,
                }}>Confirmer</button>
                <button onClick={() => setConfirmReset(false)} style={{
                  background: "#2C2C2E", border: "none", borderRadius: 14,
                  padding: "6px 16px", cursor: "pointer", fontSize: 12,
                  color: "#FFF", fontWeight: 600,
                }}>Annuler</button>
              </div>
            ) : (
              <button onClick={() => setConfirmReset(true)} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12, color: "#636366",
                textDecoration: "underline", padding: 0,
              }}>Réinitialiser tout</button>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
