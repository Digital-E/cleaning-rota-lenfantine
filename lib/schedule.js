export const AREAS = ["Cuisine", "Salle de bain", "Toilettes/Entrée", "Salon/Véranda"];
export const DIFFICULTY = { "Cuisine": 4, "Salle de bain": 3, "Toilettes/Entrée": 2, "Salon/Véranda": 1 };

export function generateBaseSchedule(names, cycles = 4) {
  const allWeeks = [];
  for (let cycle = 0; cycle < cycles; cycle++) {
    for (let week = 0; week < 5; week++) {
      const assignments = {};
      for (let p = 0; p < 5; p++) {
        if (p === week) {
          assignments[names[p]] = "Pause";
        } else {
          // (p - week + 5) % 5 gives values 1–4 (never 0 since p ≠ week)
          // Subtracting 1 maps to 0–3 for unique area indices per week
          const offset = (p - week + 5) % 5;
          const areaIdx = (offset - 1 + 2 * cycle) % 4;
          assignments[names[p]] = AREAS[areaIdx];
        }
      }
      allWeeks.push(assignments);
    }
  }
  return allWeeks;
}

export function redistributeChores(baseAssignments, absentPeople, names) {
  if (!absentPeople || absentPeople.length === 0) return null;

  const absentSet = new Set(absentPeople);
  const presentPeople = names.filter(n => !absentSet.has(n));

  if (presentPeople.length === 0) {
    const result = {};
    names.forEach(n => { result[n] = absentSet.has(n) ? "🏠 Absent" : baseAssignments[n]; });
    return { assignments: result, skippedAreas: [...AREAS], extraDuties: {} };
  }

  // Priority: Always cover top 3. Cover 4th (Salon/Véranda) only if 4+ people present.
  const areasByPriority = [...AREAS];
  const targetCount = presentPeople.length >= 4 ? 4 : 3;
  const areasToCover = areasByPriority.slice(0, targetCount);
  const skippedAreas = areasByPriority.slice(targetCount);

  const newAssignments = {};
  names.forEach(n => { newAssignments[n] = absentSet.has(n) ? "🏠 Absent" : null; });

  const personTasks = {};
  presentPeople.forEach(n => personTasks[n] = []);
  const coveredAreas = new Set();

  // 1. Retention: Keep original assignment if it's in areasToCover
  presentPeople.forEach(person => {
    const orig = baseAssignments[person];
    if (areasToCover.includes(orig) && !coveredAreas.has(orig)) {
      personTasks[person].push(orig);
      coveredAreas.add(orig);
    }
  });

  // 2. Assign remaining tasks to those with fewest tasks
  const remaining = areasToCover.filter(a => !coveredAreas.has(a));
  
  // Distribute remaining areas to people with the lowest current workload
  for (const area of remaining) {
    presentPeople.sort((a, b) => personTasks[a].length - personTasks[b].length);
    personTasks[presentPeople[0]].push(area);
  }

  const extraDuties = {};

  presentPeople.forEach(person => {
    const tasks = personTasks[person];
    if (tasks.length === 0) {
      newAssignments[person] = "Pause";
    } else {
      newAssignments[person] = tasks.join(" + ");

      // Calculate Extra Duty / Fairness
      const origArea = baseAssignments[person];
      const origDiff = (origArea && DIFFICULTY[origArea]) ? DIFFICULTY[origArea] : 0;
      const newTotalDiff = tasks.reduce((sum, t) => sum + (DIFFICULTY[t] || 0), 0);

      if (origArea === "Pause") {
        // Called in
        const mainTask = tasks.sort((a,b) => (DIFFICULTY[b]||0) - (DIFFICULTY[a]||0))[0];
        extraDuties[person] = { type: "called_in", area: mainTask, difficulty: newTotalDiff };
      } else {
        const diffDelta = newTotalDiff - origDiff;
        if (diffDelta > 0) {
          // Upgraded or extra work (multiple tasks or harder task)
          const mainTask = tasks.find(t => t !== origArea) || tasks[0];
          extraDuties[person] = { type: "upgraded", from: origArea, area: mainTask, difficulty: diffDelta };
        } else if (tasks.length === 1 && tasks[0] !== origArea) {
           // Reassigned (single task, same or lower difficulty)
           extraDuties[person] = { type: "reassigned", from: origArea, area: tasks[0], difficulty: 0 };
        }
      }
    }
  });

  return { assignments: newAssignments, skippedAreas, extraDuties };
}
