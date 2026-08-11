export const AREAS = ["Cuisine", "Toilettes", "Salle à manger", "Communs", "Salle sérigraphie", "Salle bois", "Poubelles"];
export const DIFFICULTY = {
  "Cuisine": 7,
  "Toilettes": 6,
  "Salle à manger": 5,
  "Communs": 4,
  "Salle sérigraphie": 3,
  "Salle bois": 2,
  "Poubelles": 1,
};

export function generateBaseSchedule(names, cycles = 4) {
  const n = names.length;
  const m = AREAS.length;
  const allWeeks = [];
  for (let cycle = 0; cycle < cycles; cycle++) {
    // Rotate which zone occupies which slot each cycle, so that when there
    // are more zones than people (and someone must double up), it isn't
    // always the same pair of zones bundled together long-term.
    const zoneOrder = AREAS.map((_, idx) => AREAS[(idx + 2 * cycle) % m]);
    for (let week = 0; week < n; week++) {
      const personZones = Array.from({ length: n }, () => []);
      for (let i = 0; i < m; i++) {
        // Zone slot i is handled by person (i + week) mod n. Over an
        // n-week mini-cycle this rotates every person through every zone
        // slot exactly once. If m > n, some person indices are hit by more
        // than one slot in the same week (they double up); if m < n, some
        // people are hit by none (they get "Pause").
        const personIdx = (i + week) % n;
        personZones[personIdx].push(zoneOrder[i]);
      }
      const assignments = {};
      names.forEach((name, p) => {
        assignments[name] = personZones[p].length === 0 ? "Pause" : personZones[p].join(" + ");
      });
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

  // Priority: cover as many top-priority zones as there are present people,
  // dropping the lowest-priority zones first when short-staffed.
  const areasByPriority = [...AREAS];
  const targetCount = Math.min(presentPeople.length, AREAS.length);
  const areasToCover = areasByPriority.slice(0, targetCount);
  const skippedAreas = areasByPriority.slice(targetCount);

  const newAssignments = {};
  names.forEach(n => { newAssignments[n] = absentSet.has(n) ? "🏠 Absent" : null; });

  const personTasks = {};
  presentPeople.forEach(n => personTasks[n] = []);
  const coveredAreas = new Set();

  // A person's base assignment may itself be multiple zones (e.g. "Cuisine
  // + Poubelles") when there are more zones than people, so split it out.
  const origZonesOf = (person) => {
    const orig = baseAssignments[person];
    if (!orig || orig === "Pause") return [];
    return orig.split(" + ");
  };

  // 1. Retention: keep each of a person's original zones if it's in areasToCover
  presentPeople.forEach(person => {
    origZonesOf(person).forEach(orig => {
      if (areasToCover.includes(orig) && !coveredAreas.has(orig)) {
        personTasks[person].push(orig);
        coveredAreas.add(orig);
      }
    });
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
      const origZones = origZonesOf(person);
      const origDiff = origZones.reduce((sum, z) => sum + (DIFFICULTY[z] || 0), 0);
      const newTotalDiff = tasks.reduce((sum, t) => sum + (DIFFICULTY[t] || 0), 0);

      if (origZones.length === 0) {
        // Called in from Pause
        const mainTask = [...tasks].sort((a, b) => (DIFFICULTY[b] || 0) - (DIFFICULTY[a] || 0))[0];
        extraDuties[person] = { type: "called_in", area: mainTask, difficulty: newTotalDiff };
      } else {
        const diffDelta = newTotalDiff - origDiff;
        if (diffDelta > 0) {
          // Upgraded or extra work (multiple tasks or harder task)
          const mainTask = tasks.find(t => !origZones.includes(t)) || tasks[0];
          extraDuties[person] = { type: "upgraded", from: origZones.join(" + "), area: mainTask, difficulty: diffDelta };
        } else if (tasks.length === 1 && !origZones.includes(tasks[0])) {
           // Reassigned (single task, same or lower difficulty)
           extraDuties[person] = { type: "reassigned", from: origZones.join(" + "), area: tasks[0], difficulty: 0 };
        }
      }
    }
  });

  return { assignments: newAssignments, skippedAreas, extraDuties };
}
