import { Redis } from "@upstash/redis";
import { google } from "googleapis";
import { generateBaseSchedule, redistributeChores, AREAS } from "../lib/schedule.js";

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const DEFAULTS = {
  names: ["Hannah", "Mikail", "Patxi", "Hélène", "Shelly", "Lara"],
  cycleCount: 4,
  absences: {},
  startDate: null,
  grandMenageAck: {},
};

// Format a UTC date as YYYY-MM-DD without timezone drift
function formatUTCDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Add days to a UTC date without timezone drift
function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return formatUTCDate(d);
}

function getMonday(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return formatUTCDate(d);
}

// Add calendar months to a UTC date without timezone drift
function addMonths(dateStr, months) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return formatUTCDate(d);
}

// The next upcoming quarterly "grand ménage" reminder date — the first
// startDate + 3*k months that hasn't passed yet, so it rolls forward on its
// own as each sync runs after a previous reminder date goes by.
function nextGrandMenageDate(startDate) {
  const start = getMonday(startDate);
  const today = formatUTCDate(new Date());
  let k = 3;
  let candidate = addMonths(start, k);
  while (candidate < today) {
    k += 3;
    candidate = addMonths(start, k);
  }
  return candidate;
}

async function syncCalendar() {
  // Signal that a sync is needed
  await kv.set("rota:sync-needed", "1");

  // Try to acquire the lock to process the sync queue
  const acquired = await kv.set("rota:sync-lock", "1", { nx: true, ex: 120 });
  if (!acquired) {
    console.warn("⚠️ Sync lock already held. (If your server restarted recently, wait 2 mins or reset data)");
    return;
  }

  try {
    while (true) {
      // Acknowledge current flag state
      await kv.set("rota:sync-needed", "0");

      // Fetch authoritative state from Redis
      const state = await kv.get("rota");
      if (state && state.startDate) {
        await doSync(state);
      }

      // Atomic check: if flag was set to 1 again, keep looping. Else delete lock and exit.
      const script = `
        if redis.call("GET", KEYS[1]) == "1" then
          return 1
        else
          redis.call("DEL", KEYS[2])
          return 0
        end`;
      const keepGoing = await kv.eval(script, ["rota:sync-needed", "rota:sync-lock"], []);
      
      if (keepGoing === 0) break;
      console.log("Pending changes detected, re-syncing...");
    }
  } catch (err) {
    await kv.del("rota:sync-lock");
    throw err;
  }
}

function makeCalendarClient() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) return null;
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return { calendar: google.calendar({ version: "v3", auth }), calendarId, auth };
}

async function fetchExistingEvents(calendar, calendarId) {
  let pageToken;
  const events = [];
  do {
    const res = await calendar.events.list({
      calendarId,
      privateExtendedProperty: "source=cleaningrota",
      maxResults: 2500,
      pageToken,
      singleEvents: true,
    });
    events.push(...(res.data.items || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return events;
}

// Generic batch processor for mixed DELETE, PATCH, and POST requests
async function processBatch(auth, requests) {
  if (requests.length === 0) return;
  const { token } = await auth.getAccessToken();

  for (let i = 0; i < requests.length; i += 50) {
    let chunk = requests.slice(i, i + 50);
    let attempt = 0;

    while (chunk.length > 0 && attempt < 3) {
      attempt++;
      const boundary = `rota_batch_${Date.now()}`;
      const currentMap = new Map();

      const parts = chunk.map((req, idx) => {
        const id = `req${idx}`;
        currentMap.set(id, req);
        const headers = [
          `--${boundary}`,
          `Content-Type: application/http`,
          `Content-ID: <${id}>`,
          ``,
          `${req.method} ${req.url}`,
        ];

        if (req.body) {
          headers.push(`Content-Type: application/json`);
          headers.push(``);
          headers.push(JSON.stringify(req.body));
        } else {
          headers.push(``);
        }
        return headers.join("\r\n");
      });

      const body = parts.join("\r\n") + `\r\n--${boundary}--`;

      try {
        const res = await fetch("https://www.googleapis.com/batch/calendar/v3", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/mixed; boundary="${boundary}"`,
          },
          body,
        });

        const text = await res.text();
        if (!res.ok) {
          console.warn(`Batch HTTP ${res.status}, retrying...`);
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }

        const failed = [];
        const responseParts = text.split(`--${boundary}`);
        
        for (const part of responseParts) {
          const idMatch = part.match(/Content-ID: <(?:response-)?(req\d+)>/i);
          const statusMatch = part.match(/HTTP\/1\.1 (\d{3})/);
          if (idMatch && statusMatch) {
            const status = parseInt(statusMatch[1], 10);
            // Retry on Rate Limit (403/429) or Server Error (5xx)
            if (status === 429 || status === 403 || status >= 500) {
              const req = currentMap.get(idMatch[1]);
              if (req) failed.push(req);
            } else if (status >= 400 && status !== 404) {
              console.error(`Item failed permanently: ${status}`);
            }
          }
        }

        if (failed.length > 0) {
          console.log(`${failed.length} items failed, retrying...`);
          chunk = failed;
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        } else {
          chunk = []; // Success
        }
      } catch (err) {
        console.error("Batch network error:", err);
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
    if (chunk.length > 0) console.error(`${chunk.length} items failed after retries`);
  }
}

async function doSync({ names, cycleCount, absences, startDate }) {
  const client = makeCalendarClient();
  if (!client) {
    console.log("Calendar env vars not set — skipping sync");
    return;
  }
  const { calendar, calendarId, auth } = client;

  console.log(`Starting sync for ${names.length} people. startDate: ${startDate}`);
  // 1. Fetch current state to perform diff
  const existingEvents = await fetchExistingEvents(calendar, calendarId);
  const existingMap = new Map();
  existingEvents.forEach(e => {
    const date = (e.start.dateTime || e.start.date || "").split("T")[0];
    if (e.extendedProperties?.private?.kind === "grandmenage") {
      existingMap.set("GRANDMENAGE", e);
    } else if (e.summary === "Cleaning Rota" || (e.summary && e.summary.startsWith("🧹🧼🫧 Ménage Semaine"))) {
      existingMap.set(`${date}_ALL`, e);
    } else {
      const name = (e.summary || "").split(" — ")[1];
      if (date && name) existingMap.set(`${date}_${name}`, e);
    }
  });

  // 2. Build desired state
  const baseSchedule = generateBaseSchedule(names, cycleCount);
  const requests = [];
  const encodedId = encodeURIComponent(calendarId);
  const matchedIds = new Set();

  // Define sync window: Today minus 7 days -> Today + 90 days (approx 3 months)
  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 90);
  windowStart.setUTCDate(windowStart.getUTCDate() - 7);

  baseSchedule.forEach((weekAssignments, weekIdx) => {
    const absentList = absences[String(weekIdx)] || [];
    const effective = absentList.length > 0
      ? (redistributeChores(weekAssignments, absentList, names)?.assignments ?? weekAssignments)
      : weekAssignments;

    const weekMondayStr = getMonday(addDays(startDate, weekIdx * 7));

    // Filter: Only sync events within the next ~3 months
    const eventDate = new Date(`${weekMondayStr}T00:00:00Z`);
    if (eventDate < windowStart || eventDate > windowEnd) {
      console.log(`Skipping week ${weekIdx + 1} (${weekMondayStr}) — outside 4-week window.`);
      return;
    }

    const weeksPerCycle = names.length;
    const cycleNumber = Math.floor(weekIdx / weeksPerCycle) + 1;
    const weekInCycle = (weekIdx % weeksPerCycle) + 1;

    const assignedMap = {};
    names.forEach(name => {
      const areaStr = effective[name];
      if (areaStr && areaStr !== "🏠 Absent" && areaStr !== "🌴 Pause") {
        const areas = areaStr.split(" + ");
        areas.forEach(area => {
          assignedMap[area] = name;
        });
      }
    });

    if (Object.keys(assignedMap).length === 0) return;

    const monDate = new Date(`${weekMondayStr}T00:00:00Z`);
    const sunDate = new Date(monDate);
    sunDate.setUTCDate(monDate.getUTCDate() + 6);
    const fmt = (d) => `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

    const descriptionLines = AREAS.map(area => assignedMap[area] ? `${area}: ${assignedMap[area]}` : null).filter(Boolean);
    const resource = {
      summary: `🧹🧼🫧 Ménage Semaine du ${fmt(monDate)} au ${fmt(sunDate)}`,
      description: `Cycle ${cycleNumber} · Semaine ${weekInCycle} sur ${weeksPerCycle}\n\n${descriptionLines.join("\n")}`,
      start: { dateTime: `${weekMondayStr}T09:00:00`, timeZone: "Europe/London" },
      end:   { dateTime: `${weekMondayStr}T10:00:00`, timeZone: "Europe/London" },
      extendedProperties: { private: { source: "cleaningrota" } },
    };

    const key = `${weekMondayStr}_ALL`;
    const existing = existingMap.get(key);

    if (existing) {
      matchedIds.add(existing.id);
      if (existing.summary !== resource.summary || existing.description !== resource.description) {
        requests.push({ method: "PATCH", url: `/calendar/v3/calendars/${encodedId}/events/${existing.id}`, body: resource });
      }
    } else {
      requests.push({ method: "POST", url: `/calendar/v3/calendars/${encodedId}/events`, body: resource });
    }
  });

  // 2b. Quarterly "grand ménage" reminder — a single all-day event that
  // rolls forward to the next due date each time this syncs.
  const gmDate = nextGrandMenageDate(startDate);
  const gmResource = {
    summary: "🧼 Rappel trimestriel — Grand ménage",
    description: "Pensez à fixer une date pour faire le grand ménage tous ensemble (rappel tous les 3 mois).",
    start: { date: gmDate },
    end: { date: addDays(gmDate, 1) },
    extendedProperties: { private: { source: "cleaningrota", kind: "grandmenage" } },
  };
  const existingGm = existingMap.get("GRANDMENAGE");
  if (existingGm) {
    matchedIds.add(existingGm.id);
    const existingGmDate = (existingGm.start.date || existingGm.start.dateTime || "").split("T")[0];
    if (existingGmDate !== gmDate) {
      requests.push({ method: "PATCH", url: `/calendar/v3/calendars/${encodedId}/events/${existingGm.id}`, body: gmResource });
    }
  } else {
    requests.push({ method: "POST", url: `/calendar/v3/calendars/${encodedId}/events`, body: gmResource });
  }

  // 3. Delete leftover events that weren't matched in the new schedule
  existingEvents.forEach(e => {
    if (!matchedIds.has(e.id)) {
      requests.push({ method: "DELETE", url: `/calendar/v3/calendars/${encodedId}/events/${e.id}` });
    }
  });

  console.log(`Syncing ${requests.length} changes to calendar`);
  await processBatch(auth, requests);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const state = (await kv.get("rota")) ?? DEFAULTS;
      return res.status(200).json(state);
    } catch (err) {
      console.error("Redis GET error:", err);
      return res.status(200).json(DEFAULTS);
    }
  }

  if (req.method === "POST") {
    const { names, cycleCount, absences, startDate, grandMenageAck } = req.body;

    try {
      await kv.set("rota", { names, cycleCount, absences, startDate, grandMenageAck });
    } catch (err) {
      return res.status(500).json({ error: "Erreur Redis (Vérifiez vos variables Upstash)" });
    }

    if (startDate) {
      try {
        await syncCalendar({ names, cycleCount, absences, startDate });
      } catch (err) {
        console.error("Calendar sync error:", err);
        return res.status(200).json({ ok: true, syncError: err.message });
      }
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    await kv.del("rota");
    await kv.del("rota:sync-lock");
    const client = makeCalendarClient();
    if (client) {
      try {
        const events = await fetchExistingEvents(client.calendar, client.calendarId);
        const encodedId = encodeURIComponent(client.calendarId);
        const requests = events.map(e => ({
          method: "DELETE",
          url: `/calendar/v3/calendars/${encodedId}/events/${e.id}`
        }));
        await processBatch(client.auth, requests);
      } catch (err) {
        console.error("Calendar clear error:", err);
      }
    }
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
