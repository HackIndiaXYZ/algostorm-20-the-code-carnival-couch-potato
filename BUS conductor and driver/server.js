const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3004;

// ---------- Single active route ----------
// Only Route 1 is shown so the map tracks a single bus route.
const ROUTES = [
  { id: "route-1", name: "Route 1", color: "#0f766e", stops: [
    { name: "Rajwada",        latitude: 22.7189, longitude: 75.8553 },
    { name: "Regal Square",   latitude: 22.7203, longitude: 75.8650 },
    { name: "Sapna Sangeeta", latitude: 22.7225, longitude: 75.8700 },
    { name: "Palasia",        latitude: 22.7240, longitude: 75.8830 },
    { name: "LIG Square",     latitude: 22.7330, longitude: 75.8870 },
    { name: "Vijay Nagar",    latitude: 22.7533, longitude: 75.8937 },
    { name: "Scheme 54",      latitude: 22.7550, longitude: 75.8990 },
  ]},
];

// The school is the common starting point of every route (placeholder coordinates).
const SCHOOL = { id: "school", name: "School", latitude: 22.7150, longitude: 75.8400 };

// Every stop lives in one pool and is referenced by id. A stop may also belong to no route.
const pool = [SCHOOL];
let stopSeq = 0;
function rebuildRoute(r) {         // resolve stop ids and recompute distances
  r.stops = r.stopIds.map((id) => pool.find((p) => p.id === id));
  r.cum = [0];
  for (let i = 1; i < r.stops.length; i++) r.cum.push(r.cum[i - 1] + distanceM(r.stops[i - 1], r.stops[i]));
  r.total = r.cum[r.cum.length - 1];
}
ROUTES.forEach((r) => {
  r.stopIds = ["school", ...r.stops.map((p) => { const stop = { id: `stop-${++stopSeq}`, ...p }; pool.push(stop); return stop.id; })];
  rebuildRoute(r);
});

// ---------- Students waiting at each stop (placeholder data) ----------
const STUDENT_NAMES = ["Ravi","Priya","Aman","Neha","Rohan","Sneha","Karan","Anjali","Vikram","Pooja","Arjun","Meera","Rahul","Kavya","Sahil","Isha","Nikhil","Divya","Aditya","Riya","Manish","Tanvi","Yash","Simran","Harsh","Nisha","Kunal","Swati","Deepak","Ananya","Varun","Shreya","Mohit","Pallavi","Gaurav","Ritu","Ayush","Komal","Tarun","Jyoti","Sachin","Mansi","Piyush","Bhavna","Akash","Sakshi","Lokesh","Payal","Dev","Kritika","Naman","Aarti","Ishaan","Radhika","Tushar"];
const STUDENT_COUNTS = [3,2,4,2,3,5,1, 4,2,3,1,5,2,3, 2,4,3,1,2,3]; // per stop, in route order
{
  let n = 0;
  pool.filter((p) => p.id !== "school").forEach((p, i) => {
    p.students = STUDENT_NAMES.slice(n, n + STUDENT_COUNTS[i]);
    n += STUDENT_COUNTS[i];
  });
}

// ---------- Driver and conductor of each bus (placeholder details) ----------
const BUS_CREW = [
  { driver: { name: "Suresh Patil",  phone: "+91 98765 00001" }, conductor: { name: "Ramesh Verma",  phone: "+91 98765 00002" } },
  { driver: { name: "Mahesh Yadav",  phone: "+91 98765 00003" }, conductor: { name: "Dinesh Chouhan", phone: "+91 98765 00004" } },
  { driver: { name: "Anil Sharma",   phone: "+91 98765 00005" }, conductor: { name: "Sunil Joshi",   phone: "+91 98765 00006" } },
];

// ---------- Settings ----------
let toSchool = false; // false: buses drive away from school to the last stop. true: buses drive back to school.
const SPEED_MPS = Number(process.env.SPEED_MPS) || 40; // bus speed, metres/second
const DWELL_SECONDS = 5;          // wait at each stop
const TICK_MS = 1000;             // broadcast interval
const STOP_ALERT_SECONDS = 120;   // alert if a bus stays stopped this long
const DEVIATION_ALERT_KM = [1, 3];// popup when a bus is this far off its route (first warning, then escalation)

// Simulated traffic per route segment: 0 light, 1 moderate, 2 heavy
const TRAFFIC_SPEED = [1, 0.6, 0.3];
const TRAFFIC_EVERY_MS = 15000;
const randomLevel = () => { const r = Math.random(); return r < 0.5 ? 0 : r < 0.8 ? 1 : 2; };
const traffic = ROUTES.map((r) => r.stops.slice(1).map(randomLevel));

// ---------- Geometry helpers ----------
function distanceM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function segmentAt(route, s) {
  for (let i = 0; i < route.cum.length - 1; i++) if (s <= route.cum[i + 1]) return i;
  return route.cum.length - 2;
}

function pointAt(route, s) {       // position after travelling s metres along the route
  const i = segmentAt(route, s), a = route.stops[i], b = route.stops[i + 1];
  const t = (s - route.cum[i]) / (route.cum[i + 1] - route.cum[i]);
  return { latitude: a.latitude + (b.latitude - a.latitude) * t, longitude: a.longitude + (b.longitude - a.longitude) * t };
}

function nearestOnRoute(route, lat, lon) { // closest point on the route: { dist (m), s }
  const kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 111320;
  let best = { dist: Infinity, s: 0 };
  for (let i = 0; i < route.stops.length - 1; i++) {
    const a = route.stops[i], b = route.stops[i + 1];
    const ax = (a.longitude - lon) * kx, ay = (a.latitude - lat) * ky;
    const dx = (b.longitude - lon) * kx - ax, dy = (b.latitude - lat) * ky - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    const dist = Math.hypot(ax + t * dx, ay + t * dy);
    if (dist < best.dist) best = { dist, s: route.cum[i] + t * (route.cum[i + 1] - route.cum[i]) };
  }
  return best;
}

function fmtDuration(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

// ---------- Buses ----------
// mode: "route" (follows its route), "deviating" (random wandering), "returning" (heading back to route)
const buses = ROUTES.map((route, i) => {
  const s = 0; // every bus starts at the school
  const p = pointAt(route, s);
  return {
    id: `bus-${i + 1}`, name: `Bus ${i + 1}`, route: i,
    s, dir: 1, dwell: i * 4, mode: "route", // staggered departures
    lat: p.latitude, lon: p.longitude, heading: 0, devKm: 0, devLevel: 0,
    stopped: false, stoppedAt: 0, alerted: false,
    passengerIn: 0, passengerOut: 0, lastPassengerStop: -1,
  };
});

const devices = {}; // phones and buses

function moveOnRoute(bus, route, dt) {
  bus.dir = toSchool ? -1 : 1;                           // toward school, or away from it
  if ((bus.dir < 0 && bus.s <= 0) || (bus.dir > 0 && bus.s >= route.total)) return; // parked at the end
  if (bus.dwell > 0) { bus.dwell -= dt; return; }
  const speed = SPEED_MPS * TRAFFIC_SPEED[traffic[bus.route][segmentAt(route, bus.s)]];
  const prev = bus.s;
  let next = Math.max(0, Math.min(route.total, prev + bus.dir * speed * dt));
  for (let k = 0; k < route.cum.length; k++) {
    const d = route.cum[k];
    if ((bus.dir > 0 && prev < d && next >= d) || (bus.dir < 0 && prev > d && next <= d)) {
      next = d; bus.dwell = DWELL_SECONDS; break;
    }
  }
  bus.s = next;
}

function wander(bus, route, dt) {
  bus.heading += (Math.random() - 0.5) * 70; // random turns, so it drifts away unpredictably
  const dist = SPEED_MPS * dt, rad = Math.PI / 180;
  bus.lat += Math.cos(bus.heading * rad) * dist / 111320;
  bus.lon += Math.sin(bus.heading * rad) * dist / (111320 * Math.cos(bus.lat * rad));
  bus.devKm = nearestOnRoute(route, bus.lat, bus.lon).dist / 1000;
  DEVIATION_ALERT_KM.forEach((km, i) => {
    if (bus.devKm >= km && bus.devLevel <= i) {
      bus.devLevel = i + 1;
      io.emit("bus-alert", { type: "deviation", busId: bus.id, name: bus.name, km, level: i + 1 });
    }
  });
}

function headBack(bus, route, dt) {
  const off = nearestOnRoute(route, bus.lat, bus.lon), step = SPEED_MPS * dt;
  bus.devKm = off.dist / 1000;
  if (off.dist <= step) {
    Object.assign(bus, { mode: "route", s: off.s, devKm: 0, devLevel: 0, dwell: 0 });
    io.emit("bus-alert", { type: "back", busId: bus.id, name: bus.name });
    return;
  }
  const p = pointAt(route, off.s), f = step / off.dist;
  bus.lat += (p.latitude - bus.lat) * f;
  bus.lon += (p.longitude - bus.lon) * f;
}

function advance(bus) {
  const route = ROUTES[bus.route], dt = TICK_MS / 1000;
  if (!bus.stopped) {
    if (bus.mode === "route") moveOnRoute(bus, route, dt);
    else if (bus.mode === "deviating") wander(bus, route, dt);
    else headBack(bus, route, dt);
  }
  if (bus.mode === "route") { const p = pointAt(route, bus.s); bus.lat = p.latitude; bus.lon = p.longitude; }
}

function snapshot(bus) {
  const route = ROUTES[bus.route];
  const atStop = route.cum.findIndex((d) => Math.abs(d - bus.s) < 1);
  const nextIdx = bus.dir > 0
    ? route.cum.findIndex((d) => d > bus.s + 0.5)
    : route.cum.map((d, k) => (d < bus.s - 0.5 ? k : -1)).filter((k) => k >= 0).pop();

  let status;
  if (bus.stopped) status = `Stopped ${fmtDuration(Math.floor((Date.now() - bus.stoppedAt) / 1000))}`;
  else if (bus.mode === "deviating") status = `Off route · ${bus.devKm.toFixed(2)} km away`;
  else if (bus.mode === "returning") status = `Returning · ${bus.devKm.toFixed(2)} km away`;
  else if (atStop === 0 && (bus.dwell > 0 || toSchool)) status = toSchool ? "At school (arrived)" : "At school";
  else if (atStop === route.stops.length - 1 && !toSchool) status = `At ${route.stops[atStop].name} (end of route)`;
  else if (bus.dwell > 0 && atStop >= 0) status = `At ${route.stops[atStop].name}`;
  else status = nextIdx >= 0 ? `Next: ${route.stops[nextIdx].name}` : "On route";

  const wobble = () => (bus.stopped || bus.mode !== "route" ? 0 : (Math.random() - 0.5) * 0.00004);
  return {
    id: bus.id, name: bus.name, isBus: true,
    driver: BUS_CREW[bus.route]?.driver, conductor: BUS_CREW[bus.route]?.conductor,
    passengerIn: bus.passengerIn, passengerOut: bus.passengerOut, passengerCapacity: 5,
    routeName: route.name, color: route.color, mode: bus.mode,
    latitude: bus.lat + wobble(), longitude: bus.lon + wobble(),
    stopped: bus.stopped, stoppedAt: bus.stopped ? bus.stoppedAt : null,
    status, time: Date.now(),
  };
}

function updatePassengerCounts(bus) {
  const route = ROUTES[bus.route];
  const stopIndex = route.cum.findIndex((d) => Math.abs(d - bus.s) < 1);
  if (stopIndex <= 0 || stopIndex === bus.lastPassengerStop) return;

  bus.lastPassengerStop = stopIndex;
  bus.passengerIn = Math.min(STUDENT_COUNTS[stopIndex - 1] || 0, 5);
  const previousOut = bus.passengerOut;
  bus.passengerOut = Math.min(stopIndex - 1, 5);
  if (bus.passengerOut > previousOut) {
    io.emit("bus-alert", {
      type: "out-count",
      busId: bus.id,
      name: bus.name,
      count: bus.passengerOut,
      capacity: 5,
    });
  }
}

function publish(bus) {
  updatePassengerCounts(bus);
  devices[bus.id] = snapshot(bus);
  io.emit("receive-location", devices[bus.id]);
}

setInterval(() => {
  buses.forEach((bus) => {
    advance(bus);
    publish(bus);
    if (bus.stopped && !bus.alerted && Date.now() - bus.stoppedAt >= STOP_ALERT_SECONDS * 1000) {
      bus.alerted = true;
      io.emit("bus-alert", { type: "overdue", busId: bus.id, name: bus.name, minutes: STOP_ALERT_SECONDS / 60 });
    }
  });
}, TICK_MS);

setInterval(() => {
  for (let n = 0; n < 2; n++) {
    const r = Math.floor(Math.random() * traffic.length);
    traffic[r][Math.floor(Math.random() * traffic[r].length)] = randomLevel();
  }
  io.emit("traffic", traffic);
}, TRAFFIC_EVERY_MS);

// ---------- MySQL (XAMPP): students boarded today ----------
// Keep rows after BUS_OUT is set so the side view can show who has been outBoarded.
let mysql = null;
try { mysql = require("mysql2/promise"); } catch { console.log("mysql2 is not installed. Run: npm install"); }

const DB = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",          // XAMPP default
  password: process.env.DB_PASSWORD ?? "",      // XAMPP default is an empty password
  database: process.env.DB_NAME || "school_bus_safety",
};
// attendance_events only stores student_id, so student NAMES come from the students table.
// The id and name columns are detected automatically. Set them here only if detection picks the wrong ones.
const STUDENT_TABLE = process.env.STUDENT_TABLE || "students";
const ABSENT_TABLE = process.env.ABSENT_TABLE || "absentes";
const STUDENT_ID_COL = process.env.STUDENT_ID_COL || null;     // e.g. "student_id"
const STUDENT_NAME_COL = process.env.STUDENT_NAME_COL || null; // e.g. "student_name"
// Optional: map our bus id to the bus_no value stored in MySQL when they don't look alike, e.g. { "bus-1": "MP09-1234" }
const BUS_NO_MAP = {};
const POLL_MS = Number(process.env.POLL_MS) || 5000;
const ONBOARD_TODAY_ONLY = process.env.ONBOARD_TODAY_ONLY !== "false"; // ignore open rows from earlier days

[STUDENT_TABLE, ABSENT_TABLE, STUDENT_ID_COL, STUDENT_NAME_COL].filter(Boolean).forEach((v) => {
  if (!/^[A-Za-z0-9_]+$/.test(v)) throw new Error(`Invalid table/column name: ${v}`);
});

function generateStudentUniqueId() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const parts = [
    Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join(""),
    Array.from({ length: 3 }, () => digits[Math.floor(Math.random() * digits.length)]).join(""),
  ];
  return parts.join("");
}

async function createStudentUniqueId() {
  if (!dbPool) throw new Error("MySQL is not configured.");
  for (let i = 0; i < 25; i++) {
    const uniqueId = generateStudentUniqueId();
    const [rows] = await dbPool.query(`SELECT 1 FROM \`${STUDENT_TABLE}\` WHERE \`Unique_ID\` = ? LIMIT 1`, [uniqueId]);
    if (!rows.length) return uniqueId;
  }
  throw new Error("Unable to generate a unique student ID.");
}

const norm = (v) => { const t = String(v).toLowerCase().replace(/[^a-z0-9]/g, ""); return /^\d+$/.test(t) ? "bus" + t : t; };
function busKeyFor(busNo) {                 // "Bus 1", "bus-1", "BUS1" or "1" all match bus-1
  const n = norm(busNo);
  const mapped = Object.keys(BUS_NO_MAP).find((id) => norm(BUS_NO_MAP[id]) === n);
  if (mapped) return mapped;
  const hit = buses.find((b) => norm(b.id) === n || norm(b.name) === n);
  return hit ? hit.id : null;
}

const emptyBuses = () => Object.fromEntries(buses.map((b) => [b.id, { busNo: null, students: [] }]));
let onboard = { connected: false, error: "Connecting to MySQL…", total: 0, buses: emptyBuses(), others: [] };
let absentes = { connected: false, error: "Connecting to MySQL…", total: 0, students: [] };
const dbPool = mysql ? mysql.createPool({ ...DB, connectionLimit: 3, connectTimeout: 4000 }) : null;

let nameSource = null; // { idCols, nameExpr } once the students table has been inspected

async function resolveNameSource() {
  const [cols] = await dbPool.query(`SHOW COLUMNS FROM \`${STUDENT_TABLE}\``);
  const names = cols.map((c) => c.Field).filter((n) => /^[A-Za-z0-9_$]+$/.test(n));
  const find = (...c) => names.find((n) => c.includes(n.toLowerCase()));
  const idCols = [...new Set([
    STUDENT_ID_COL,
    ...["student_id", "id", "studentid", "sid", "admission_no", "roll_no", "unique_id"]
      .map((candidate) => find(candidate))
      .filter(Boolean),
  ])].filter(Boolean);
  let nameExpr = null;
  if (STUDENT_NAME_COL) nameExpr = `s.\`${STUDENT_NAME_COL}\``;
  else {
    const single = find("name", "student_name", "full_name", "fullname", "studentname");
    const first = find("first_name", "firstname", "fname");
    const last = find("last_name", "lastname", "lname", "surname");
    if (single) nameExpr = `s.\`${single}\``;
    else if (first) nameExpr = last ? `CONCAT_WS(' ', s.\`${first}\`, s.\`${last}\`)` : `s.\`${first}\``;
    else { const any = names.find((n) => /name/i.test(n)); if (any) nameExpr = `s.\`${any}\``; }
  }
  return idCols.length && nameExpr ? { source: { idCols, nameExpr } } : { columns: names };
}

async function fetchOnboardRows() {
  try {
    if (!nameSource) {
      const r = await resolveNameSource();
      if (!r.source) {
        return { rows: [], namesOk: false, namesNote: `No name column found in table "${STUDENT_TABLE}". Its columns are: ${r.columns.join(", ")}.` };
      }
      nameSource = r.source;
    }

    // The students table supplies names. Attendance supplies the in/out status.
    const studentIdCol = nameSource.idCols[0];
    const normalizeStop = (column) =>
      `REGEXP_REPLACE(REPLACE(REPLACE(LOWER(TRIM(${column})), ' ', ''), '-', ''), '[aeiou]', '')`;
    const eventStop = normalizeStop("e.stop_name");
    const studentStop = normalizeStop("s.`bus_stop`");
    const attendanceMatch = `(e.student_id = s.\`${studentIdCol}\` OR ${eventStop} = ${studentStop})`;
    const [rows] = await dbPool.query(
      `SELECT s.\`${studentIdCol}\` AS student_id, s.\`bus_no\` AS bus_no,
       s.\`bus_stop\` AS stop_name, ${nameSource.nameExpr} AS student_name,
       e.BUS_IN, e.BUS_OUT
       FROM \`${STUDENT_TABLE}\` s
       LEFT JOIN attendance_events e
         ON e.BUS_IN IS NOT NULL
        AND LOWER(REPLACE(REPLACE(TRIM(e.bus_no), ' ', ''), '-', '')) IN ('bus1', '1')
        AND ${attendanceMatch}
       WHERE LOWER(REPLACE(REPLACE(TRIM(s.\`bus_no\`), ' ', ''), '-', '')) IN ('bus1', '1')
         AND NOT EXISTS (
           SELECT 1 FROM attendance_events newer
           WHERE newer.BUS_IN IS NOT NULL
             AND LOWER(REPLACE(REPLACE(TRIM(newer.bus_no), ' ', ''), '-', '')) IN ('bus1', '1')
             AND e.BUS_IN IS NOT NULL
             AND (newer.student_id = s.\`${studentIdCol}\`
               OR ${normalizeStop("newer.stop_name")} = ${studentStop})
             AND (newer.BUS_IN > e.BUS_IN
               OR (newer.BUS_IN = e.BUS_IN AND newer.event_id > e.event_id))
         )
       ORDER BY s.\`${studentIdCol}\``);
    return { rows, namesOk: true };
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE" || err.code === "ER_BAD_FIELD_ERROR") { // show ids instead of names
      nameSource = null;
      return { rows: [], namesOk: false, namesNote: err.code === "ER_NO_SUCH_TABLE" ? `Table "${STUDENT_TABLE}" was not found.` : `Column problem in "${STUDENT_TABLE}": ${err.message}` };
    }
    throw err;
  }
}

function buildOnboard(rows, namesOk) {
  const seen = new Set(), groups = emptyBuses(), others = {}, active = new Set();
  rows.forEach((r) => {
    if (seen.has(r.student_id)) return;      // newest row per student wins
    seen.add(r.student_id);

    const key = busKeyFor(r.bus_no);
    if (!key || key !== "bus-1") return;

    const boarded = r.BUS_IN !== null && r.BUS_IN !== "";
    const outBoarded = boarded && r.BUS_OUT !== null && r.BUS_OUT !== "";
    const st = {
      id: r.student_id,
      name: r.student_name || `Student ${r.student_id}`,
      stop: r.stop_name || null,
      since: r.BUS_IN ? new Date(r.BUS_IN).getTime() : null,
      boarded,
      outBoarded,
      outSince: outBoarded ? new Date(r.BUS_OUT).getTime() : null,
    };
    if (boarded && !outBoarded) active.add(r.student_id);

    groups[key].busNo = r.bus_no;
    groups[key].students.push(st);
  });
  return {
    connected: true, namesOk, total: groups["bus-1"].students.length, buses: groups, others: [],
  };
}

function dbErrorText(err) {
  if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT") return `Cannot reach MySQL at ${DB.host}:${DB.port}. Start MySQL in the XAMPP control panel.`;
  if (err.code === "ER_ACCESS_DENIED_ERROR") return "MySQL login failed. Check DB_USER and DB_PASSWORD.";
  if (err.code === "ER_BAD_DB_ERROR") return `Database "${DB.database}" was not found.`;
  if (err.code === "ER_NO_SUCH_TABLE") return "Table attendance_events was not found.";
  return `MySQL error: ${err.message}`;
}

async function pollOnboard() {
  let next;
  if (!dbPool) next = { connected: false, error: "mysql2 is not installed. Run npm install, then restart.", total: 0, buses: emptyBuses(), others: [] };
  else {
    try {
      const { rows, namesOk, namesNote } = await fetchOnboardRows();
      next = { ...buildOnboard(rows, namesOk), namesNote };
    } catch (err) {
      next = { connected: false, error: dbErrorText(err), total: 0, buses: emptyBuses(), others: [] };
    }
  }
  if (JSON.stringify(next) === JSON.stringify(onboard)) return;
  if (next.connected !== onboard.connected || next.error !== onboard.error) console.log(next.connected ? "MySQL connected" : next.error);
  if (next.connected && next.namesOk === false) console.log(next.namesNote + " Showing IDs.");
  onboard = next;
  io.emit("onboard", onboard);
}

async function pollAbsentes() {
  let next;
  if (!dbPool) {
    next = { connected: false, error: "mysql2 is not installed. Run npm install, then restart.", total: 0, students: [] };
  } else {
    try {
      const [rows] = await dbPool.query(
        `SELECT \`ID\` AS id, \`Name\` AS name, \`Bus_stop\` AS busStop, \`Timestamp\` AS timestamp
         FROM \`${ABSENT_TABLE}\`
         WHERE \`Timestamp\` >= CURDATE()
           AND \`Timestamp\` < CURDATE() + INTERVAL 1 DAY
         ORDER BY \`Timestamp\` DESC`
      );
      next = {
        connected: true,
        total: rows.length,
        students: rows.map((row) => ({
          id: row.id,
          name: row.name,
          busStop: row.busStop,
          timestamp: row.timestamp ? new Date(row.timestamp).getTime() : null,
        })),
      };
    } catch (err) {
      next = { connected: false, error: err.code === "ER_NO_SUCH_TABLE" ? `Table "${ABSENT_TABLE}" was not found.` : dbErrorText(err), total: 0, students: [] };
    }
  }
  if (JSON.stringify(next) === JSON.stringify(absentes)) return;
  if (next.connected !== absentes.connected || next.error !== absentes.error) console.log(next.connected ? "Absentes table connected" : next.error);
  absentes = next;
  io.emit("absentes", absentes);
  await broadcastRoutes();
}
setInterval(pollOnboard, POLL_MS);
pollOnboard();
setInterval(pollAbsentes, POLL_MS);
pollAbsentes();

// ---------- Bus stop API ----------
function routesPayload() {
  const used = new Set(ROUTES.flatMap((r) => r.stopIds));
  return {
    school: SCHOOL,
    routes: ROUTES.map(({ id, name, color, stops }) => ({ id, name, color, stops })),
    unassigned: pool.filter((p) => !used.has(p.id)),
  };
}

async function refreshStudentCounts() {
  if (!dbPool) return;
  const [rows] = await dbPool.query(
    `SELECT s.\`bus_stop\`, s.\`student_name\`
     FROM \`${STUDENT_TABLE}\` s
     WHERE NOT EXISTS (
       SELECT 1
       FROM \`${ABSENT_TABLE}\` a
       WHERE LOWER(TRIM(a.\`Name\`)) = LOWER(TRIM(s.\`student_name\`))
         AND LOWER(TRIM(a.\`Bus_stop\`)) = LOWER(TRIM(s.\`bus_stop\`))
         AND a.\`Timestamp\` >= CURDATE()
         AND a.\`Timestamp\` < CURDATE() + INTERVAL 1 DAY
     )`
  );
  const studentsByStop = new Map();
  rows.forEach((row) => {
    const stopName = String(row.bus_stop || "").trim().toLowerCase();
    if (!stopName) return;
    const students = studentsByStop.get(stopName) || [];
    if (row.student_name) students.push(String(row.student_name));
    studentsByStop.set(stopName, students);
  });
  pool.filter((stop) => stop.id !== "school").forEach((stop) => {
    stop.students = studentsByStop.get(stop.name.toLowerCase()) || [];
  });
}

function refreshRoute(route) {     // after a stop is added or removed
  rebuildRoute(route);
  const ri = ROUTES.indexOf(route), old = traffic[ri];
  traffic[ri] = Array.from({ length: route.stops.length - 1 }, (_, i) => old[i] ?? randomLevel());
  buses.filter((b) => b.route === ri).forEach((b) => {
    if (b.mode === "route") { b.s = Math.min(nearestOnRoute(route, b.lat, b.lon).s, route.total); b.dwell = 0; }
    publish(b);
  });
}

async function broadcastRoutes() {
  try {
    await refreshStudentCounts();
  } catch (err) {
    console.error("Could not refresh student counts:", err.message);
  }
  io.emit("routes", routesPayload());
  io.emit("traffic", traffic);
}

async function sendRoutes(socket) {
  try {
    await refreshStudentCounts();
  } catch (err) {
    console.error("Could not load student counts:", err.message);
  }
  socket.emit("routes", routesPayload());
  socket.emit("traffic", traffic);
}

function bestInsertIndex(route, p) { // cheapest place in the route to add a stop
  const st = route.stops, n = st.length;
  let best = { idx: n, cost: distanceM(st[n - 1], p) }; // never before the school (index 0)
  for (let i = 1; i < n; i++) {
    const cost = distanceM(st[i - 1], p) + distanceM(p, st[i]) - distanceM(st[i - 1], st[i]);
    if (cost < best.cost) best = { idx: i, cost };
  }
  return best.idx;
}

app.use(express.json());

// List all stops
app.get("/api/stops", (req, res) => {
  res.json(pool.filter((p) => p.id !== "school").map((p) => ({ ...p, routeId: ROUTES.find((r) => r.stopIds.includes(p.id))?.id || null })));
});

// Add a stop: { "name": "...", "latitude": 22.7, "longitude": 75.8, "routeId": "route-1" (optional) }
app.post("/api/stops", (req, res) => {
  const { name, latitude, longitude, routeId } = req.body || {};
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (!cleanName || cleanName.length > 40) return res.status(400).json({ error: "name is required (max 40 characters)" });
  if (typeof latitude !== "number" || latitude < -90 || latitude > 90) return res.status(400).json({ error: "latitude must be a number between -90 and 90" });
  if (typeof longitude !== "number" || longitude < -180 || longitude > 180) return res.status(400).json({ error: "longitude must be a number between -180 and 180" });
  const route = routeId ? ROUTES.find((r) => r.id === routeId) : null;
  if (routeId && !route) return res.status(404).json({ error: `no route with id ${routeId}` });

  let students = [];
  if (req.body.students !== undefined) {
    const list = Array.isArray(req.body.students) ? req.body.students : null;
    if (!list || list.some((n) => typeof n !== "string" || !n.trim() || n.trim().length > 30)) {
      return res.status(400).json({ error: "students must be an array of names (max 30 characters each)" });
    }
    const seen = new Set();
    list.map((n) => n.trim()).forEach((n) => { if (!seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); students.push(n); } });
  }

  const stop = { id: `stop-${++stopSeq}`, name: cleanName, latitude, longitude, students };
  pool.push(stop);
  if (route) {
    route.stopIds.splice(bestInsertIndex(route, stop), 0, stop.id);
    refreshRoute(route);
  }
  broadcastRoutes();
  res.status(201).json({ stop, routeId: route ? route.id : null });
});

app.post("/api/students", async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: "MySQL is not installed. Run npm install, then restart the server." });

  const body = req.body || {};
  const studentName = typeof body.student_name === "string" ? body.student_name.trim() : "";
  const busNo = typeof body.bus_no === "string" ? body.bus_no.trim() : String(body.bus_no || "").trim();
  const busStop = typeof body.bus_stop === "string" ? body.bus_stop.trim() : String(body.bus_stop || "").trim();
  const busDrop = typeof body.bus_drop === "string" ? body.bus_drop.trim() : String(body.bus_drop || "").trim();
  const parentMobile = typeof body.parent_mobile === "string" ? body.parent_mobile.trim() : String(body.parent_mobile || "").trim();
  const rollNo = typeof body.roll_no === "string" ? body.roll_no.trim() : String(body.roll_no || "").trim();

  if (!studentName) return res.status(400).json({ error: "student_name is required" });
  if (studentName.length > 100) return res.status(400).json({ error: "student_name must be 100 characters or less" });
  if (!busNo) return res.status(400).json({ error: "bus_no is required" });
  if (!busStop) return res.status(400).json({ error: "bus_stop is required so the stop count can be updated" });
  if (busStop.length > 100) return res.status(400).json({ error: "bus_stop must be 100 characters or less" });
  if (busDrop.length > 100) return res.status(400).json({ error: "bus_drop must be 100 characters or less" });
  if (parentMobile && !/^[0-9+()\-\s]{7,20}$/.test(parentMobile)) return res.status(400).json({ error: "parent_mobile must be a valid phone number" });
  if (rollNo && rollNo.length > 50) return res.status(400).json({ error: "roll_no must be 50 characters or less" });

  const stop = pool.find((p) => p.id !== "school" && p.name.toLowerCase() === busStop.toLowerCase());
  if (!stop) return res.status(404).json({ error: `No bus stop named "${busStop}" exists.` });
  if (stop.students.some((name) => name.toLowerCase() === studentName.toLowerCase())) {
    return res.status(409).json({ error: `${studentName} is already assigned to ${stop.name}.` });
  }

  try {
    const uniqueId = await createStudentUniqueId();
    const values = [
      rollNo || null,
      studentName,
      busNo,
      busStop || null,
      busDrop || null,
      parentMobile || null,
      uniqueId,
    ];
    const insertSql = `INSERT INTO \`${STUDENT_TABLE}\` (\`roll_no\`, \`student_name\`, \`bus_no\`, \`bus_stop\`, \`bus_drop\`, \`parent_mobile\`, \`Unique_ID\`, \`created_at\`, \`updated_at\`) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
    await dbPool.query(insertSql, values);
    stop.students.push(studentName);
    await broadcastRoutes();
    res.status(201).json({ success: true, message: "Student added successfully.", student: { student_name: studentName, bus_no: busNo, bus_stop: stop.name, bus_drop: busDrop, parent_mobile: parentMobile || null, Unique_ID: uniqueId } });
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") {
      return res.status(404).json({ error: `Table "${STUDENT_TABLE}" was not found in database "${DB.database}".` });
    }
    console.error("Student insert failed:", err);
    res.status(500).json({ error: err.message || "Failed to add student." });
  }
});

app.get("/api/students/:id", async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: "MySQL is not configured." });
  const studentId = Number(req.params.id);
  if (!Number.isInteger(studentId) || studentId < 1) return res.status(400).json({ error: "Student ID must be a positive integer." });
  try {
    const [rows] = await dbPool.query(
      `SELECT \`student_id\` AS id, \`student_name\` AS name, \`bus_no\` AS busNo, \`bus_stop\` AS busStop, \`bus_drop\` AS busDrop
       FROM \`${STUDENT_TABLE}\` WHERE \`student_id\` = ? LIMIT 1`,
      [studentId]
    );
    if (!rows.length) return res.status(404).json({ error: `Student ${studentId} was not found.` });
    res.json(rows[0]);
  } catch (err) {
    console.error("Student lookup failed:", err);
    res.status(500).json({ error: err.message || "Failed to load student." });
  }
});

app.post("/api/absentes", async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: "MySQL is not configured." });
  const studentId = Number(req.body?.student_id);
  if (!Number.isInteger(studentId) || studentId < 1) return res.status(400).json({ error: "student_id must be a positive integer." });
  try {
    const [students] = await dbPool.query(
      `SELECT \`student_name\` AS name, \`bus_stop\` AS busStop FROM \`${STUDENT_TABLE}\` WHERE \`student_id\` = ? LIMIT 1`,
      [studentId]
    );
    if (!students.length) return res.status(404).json({ error: `Student ${studentId} was not found.` });
    const student = students[0];
    const [existing] = await dbPool.query(
      `SELECT \`ID\` FROM \`${ABSENT_TABLE}\`
       WHERE LOWER(TRIM(\`Name\`)) = LOWER(TRIM(?))
         AND \`Timestamp\` >= CURDATE()
         AND \`Timestamp\` < CURDATE() + INTERVAL 1 DAY
       LIMIT 1`,
      [student.name]
    );
    if (!existing.length) {
      await dbPool.query(
        `INSERT INTO \`${ABSENT_TABLE}\` (\`Name\`, \`Bus_stop\`, \`Timestamp\`) VALUES (?, ?, NOW())`,
        [student.name, student.busStop]
      );
    }
    await pollAbsentes();
    res.status(201).json({ success: true, student });
  } catch (err) {
    console.error("Absence insert failed:", err);
    res.status(500).json({ error: err.message || "Failed to record absence." });
  }
});

function removeStop(stop) {       // returns null on success, or { status, error }
  const affected = ROUTES.filter((r) => r.stopIds.includes(stop.id));
  const tooShort = affected.find((r) => r.stopIds.length <= 2);
  if (tooShort) return { status: 409, error: `${tooShort.name} needs at least one stop besides the school` };
  pool.splice(pool.indexOf(stop), 1);
  affected.forEach((r) => { r.stopIds = r.stopIds.filter((id) => id !== stop.id); refreshRoute(r); });
  return null;
}

function stopOr404(req, res) {
  const stop = pool.find((p) => p.id === req.params.id);
  if (!stop) { res.status(404).json({ error: "stop not found" }); return null; }
  if (stop.id === "school") { res.status(403).json({ error: "the school has no student stop" }); return null; }
  return stop;
}

// Remove a stop by id. Its students are removed with it.
app.delete("/api/stops/:id", (req, res) => {
  const stop = pool.find((p) => p.id === req.params.id);
  if (!stop) return res.status(404).json({ error: "stop not found" });
  if (stop.id === "school") return res.status(403).json({ error: "the school cannot be removed" });
  const err = removeStop(stop);
  if (err) return res.status(err.status).json({ error: err.error });
  broadcastRoutes();
  io.emit("stop-notice", { type: "stop-removed", name: stop.name, students: stop.students.length });
  res.json({ removed: stop, studentsRemoved: stop.students.length });
});

// Add a student to a stop: { "name": "Ravi" }
app.post("/api/stops/:id/students", (req, res) => {
  const stop = stopOr404(req, res);
  if (!stop) return;
  const name = typeof (req.body || {}).name === "string" ? req.body.name.trim() : "";
  if (!name || name.length > 30) return res.status(400).json({ error: "name is required (max 30 characters)" });
  if (stop.students.some((n) => n.toLowerCase() === name.toLowerCase())) return res.status(409).json({ error: `${name} is already at ${stop.name}` });
  stop.students.push(name);
  broadcastRoutes();
  res.status(201).json({ student: name, stop: stop.name, students: stop.students.length });
});

// Mark a student as not coming. If the stop has no students left, the stop is removed.
app.delete("/api/stops/:id/students/:name", (req, res) => {
  const stop = stopOr404(req, res);
  if (!stop) return;
  const wanted = req.params.name.trim().toLowerCase();
  const idx = stop.students.findIndex((n) => n.toLowerCase() === wanted);
  if (idx < 0) return res.status(404).json({ error: `${req.params.name} is not at ${stop.name}` });

  const [student] = stop.students.splice(idx, 1);
  let stopRemoved = false, note;
  if (stop.students.length === 0) {
    const err = removeStop(stop);
    if (err) note = `${stop.name} has no students left but could not be removed: ${err.error}`;
    else stopRemoved = true;
  }
  broadcastRoutes();
  io.emit("student-notice", { type: "absent", student, stop: stop.name, stopRemoved, note });
  res.json({ student, stop: stop.name, studentsLeft: stop.students.length, stopRemoved, note });
});

// ---------- Sockets ----------
app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  sendRoutes(socket);
  socket.emit("school-mode", toSchool);
  socket.emit("onboard", onboard);
  socket.emit("absentes", absentes);
  socket.emit("all-devices", Object.values(devices));

  socket.on("send-location", (data) => {
    const { latitude, longitude, accuracy, name } = data || {};
    if (typeof latitude !== "number" || typeof longitude !== "number") return;
    devices[socket.id] = { id: socket.id, name: String(name || "Device").slice(0, 24), latitude, longitude, accuracy: accuracy || null, time: Date.now() };
    io.emit("receive-location", devices[socket.id]);
  });

  const find = (id) => buses.find((b) => b.id === id);

  socket.on("stop-bus", (id) => {
    const bus = find(id);
    if (!bus || bus.stopped) return;
    Object.assign(bus, { stopped: true, stoppedAt: Date.now(), alerted: false });
    publish(bus);
    io.emit("bus-alert", { type: "stopped", busId: id, name: bus.name });
  });

  socket.on("resume-bus", (id) => {
    const bus = find(id);
    if (!bus || !bus.stopped) return;
    Object.assign(bus, { stopped: false, alerted: false });
    publish(bus);
    io.emit("bus-alert", { type: "resumed", busId: id, name: bus.name });
  });

  socket.on("set-school-mode", (on) => {
    toSchool = !!on;
    io.emit("school-mode", toSchool);
  });

  socket.on("deviate-bus", (id) => {
    const bus = find(id);
    if (!bus || bus.mode !== "route") return;
    Object.assign(bus, { mode: "deviating", heading: Math.random() * 360, devKm: 0, devLevel: 0, dwell: 0 });
    publish(bus);
    io.emit("bus-alert", { type: "left-route", busId: id, name: bus.name });
  });

  socket.on("return-bus", (id) => {
    const bus = find(id);
    if (!bus || bus.mode !== "deviating") return;
    bus.mode = "returning";
    publish(bus);
  });

  socket.on("disconnect", () => {
    if (devices[socket.id]) { delete devices[socket.id]; io.emit("device-left", socket.id); }
  });
});

server.listen(PORT, () => console.log(`Tracker running on http://localhost:${PORT}`));