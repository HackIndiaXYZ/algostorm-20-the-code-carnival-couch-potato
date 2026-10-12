const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
let mysql = null;
try {
  mysql = require("mysql2/promise");
} catch (e) {
  console.warn("mysql2 not found:", e.message);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3002;

// ---------- MySQL Configuration (XAMPP default) ----------
const DB = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME || "school_bus_safety",
};

const STUDENT_TABLE = "students";
const ABSENT_TABLE = "absentes";

const dbPool = mysql
  ? mysql.createPool({ ...DB, connectionLimit: 5, connectTimeout: 4000 })
  : null;

// ---------- Route 1 and Bus 1 simulation data ----------
const SCHOOL = { id: "school", name: "School Campus", latitude: 22.7150, longitude: 75.8400 };

const ROUTE_1_STOPS = [
  { id: "stop-1", name: "Rajwada",        latitude: 22.7189, longitude: 75.8553, isStudentStop: true },
  { id: "stop-2", name: "Regal Square",   latitude: 22.7203, longitude: 75.8650 },
  { id: "stop-3", name: "Sapna Sangeeta", latitude: 22.7225, longitude: 75.8700 },
  { id: "stop-4", name: "Palasia",        latitude: 22.7240, longitude: 75.8830 },
  { id: "stop-5", name: "LIG Square",     latitude: 22.7330, longitude: 75.8870 },
  { id: "stop-6", name: "Vijay Nagar",    latitude: 22.7533, longitude: 75.8937 },
  { id: "stop-7", name: "Scheme 54",      latitude: 22.7550, longitude: 75.8990 },
];

const ROUTE_1 = {
  id: "route-1",
  name: "Route 1",
  color: "#16834a",
  stops: [SCHOOL, ...ROUTE_1_STOPS],
};

function distanceM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Precalculate cumulative distances along Route 1
ROUTE_1.cum = [0];
for (let i = 1; i < ROUTE_1.stops.length; i++) {
  ROUTE_1.cum.push(ROUTE_1.cum[i - 1] + distanceM(ROUTE_1.stops[i - 1], ROUTE_1.stops[i]));
}
ROUTE_1.total = ROUTE_1.cum[ROUTE_1.cum.length - 1];

function segmentAt(route, s) {
  for (let i = 0; i < route.cum.length - 1; i++) {
    if (s <= route.cum[i + 1]) return i;
  }
  return route.cum.length - 2;
}

function pointAt(route, s) {
  const i = segmentAt(route, s), a = route.stops[i], b = route.stops[i + 1];
  const denom = (route.cum[i + 1] - route.cum[i]) || 1;
  const t = Math.max(0, Math.min(1, (s - route.cum[i]) / denom));
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

// Bus 1 state
const SPEED_MPS = 35; // meters per second
const DWELL_SECONDS = 4;
const TICK_MS = 1000;

const bus1 = {
  id: "bus-1",
  name: "Bus 1",
  route: ROUTE_1,
  s: 0,
  dir: 1, // 1: going along stops, -1: returning
  dwell: 0,
  latitude: ROUTE_1.stops[0].latitude,
  longitude: ROUTE_1.stops[0].longitude,
  stopped: false,
};

function advanceBus(dt) {
  if (bus1.stopped) return;
  if (bus1.dwell > 0) {
    bus1.dwell -= dt;
    return;
  }

  const prev = bus1.s;
  let next = prev + bus1.dir * SPEED_MPS * dt;

  if (next >= bus1.route.total) {
    next = bus1.route.total;
    bus1.dir = -1;
    bus1.dwell = DWELL_SECONDS;
  } else if (next <= 0) {
    next = 0;
    bus1.dir = 1;
    bus1.dwell = DWELL_SECONDS;
  } else {
    // Check stop dwell
    for (let k = 0; k < bus1.route.cum.length; k++) {
      const d = bus1.route.cum[k];
      if ((bus1.dir > 0 && prev < d && next >= d) || (bus1.dir < 0 && prev > d && next <= d)) {
        next = d;
        bus1.dwell = DWELL_SECONDS;
        break;
      }
    }
  }

  bus1.s = next;
  const p = pointAt(bus1.route, bus1.s);
  bus1.latitude = p.latitude;
  bus1.longitude = p.longitude;
}

function getBusSnapshot() {
  const atStop = bus1.route.cum.findIndex((d) => Math.abs(d - bus1.s) < 1.5);
  const nextIdx = bus1.dir > 0
    ? bus1.route.cum.findIndex((d) => d > bus1.s + 0.5)
    : bus1.route.cum.map((d, k) => (d < bus1.s - 0.5 ? k : -1)).filter((k) => k >= 0).pop();

  let status = "On route";
  let locationLabel = "Traveling along Route 1";

  if (bus1.dwell > 0 && atStop >= 0) {
    status = `At ${bus1.route.stops[atStop].name}`;
    locationLabel = `At stop: ${bus1.route.stops[atStop].name}`;
  } else if (nextIdx >= 0) {
    status = `Next: ${bus1.route.stops[nextIdx].name}`;
    locationLabel = `En route to ${bus1.route.stops[nextIdx].name}`;
  }

  // Distance to Student's stop (Rajwada)
  const rajwadaStop = ROUTE_1_STOPS.find(s => s.name.toLowerCase() === "rajwada");
  let distToStudentM = 0;
  if (rajwadaStop) {
    distToStudentM = Math.round(distanceM(bus1, rajwadaStop));
  }
  const etaMinutes = Math.max(1, Math.round(distToStudentM / (SPEED_MPS * 60) * 2));

  return {
    id: bus1.id,
    name: bus1.name,
    isBus: true,
    latitude: bus1.latitude,
    longitude: bus1.longitude,
    routeName: bus1.route.name,
    color: bus1.route.color,
    status,
    locationLabel,
    etaMinutes,
    distToStudentM,
    time: Date.now(),
  };
}

setInterval(() => {
  advanceBus(TICK_MS / 1000);
  const snap = getBusSnapshot();
  io.emit("receive-location", snap);
}, TICK_MS);

// ---------- Middleware & Static Files ----------
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- API Routes ----------

// 1. Get Route 1 details
app.get("/api/route1", (req, res) => {
  res.json({
    route: ROUTE_1,
    school: SCHOOL,
    stops: ROUTE_1_STOPS,
  });
});

// 2. Get student record by ID (defaults to 3)
app.get("/api/students/:id", async (req, res) => {
  const studentId = Number(req.params.id) || 3;
  if (!dbPool) {
    return res.status(500).json({ error: "MySQL database is not connected. Make sure XAMPP MySQL is running." });
  }

  try {
    const [rows] = await dbPool.query(
      `SELECT student_id, roll_no, student_name, bus_no, bus_stop, bus_drop, parent_mobile, Unique_ID, created_at, updated_at
       FROM \`${STUDENT_TABLE}\`
       WHERE student_id = ?
       LIMIT 1`,
      [studentId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: `Student with ID ${studentId} not found in database.` });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error loading student:", err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Check absence status for today
app.get("/api/absentes/status/:id", async (req, res) => {
  const studentId = Number(req.params.id) || 3;
  if (!dbPool) {
    return res.status(500).json({ error: "MySQL database is not connected." });
  }

  try {
    const [students] = await dbPool.query(
      `SELECT student_name, bus_stop FROM \`${STUDENT_TABLE}\` WHERE student_id = ? LIMIT 1`,
      [studentId]
    );

    if (!students.length) {
      return res.status(404).json({ error: "Student not found." });
    }

    const student = students[0];
    const [absentRows] = await dbPool.query(
      `SELECT ID, Name, Bus_stop, Timestamp
       FROM \`${ABSENT_TABLE}\`
       WHERE LOWER(TRIM(Name)) = LOWER(TRIM(?))
         AND Timestamp >= CURDATE()
         AND Timestamp < CURDATE() + INTERVAL 1 DAY
       ORDER BY Timestamp DESC
       LIMIT 1`,
      [student.student_name]
    );

    const isAbsent = absentRows.length > 0;
    res.json({
      student_id: studentId,
      student_name: student.student_name,
      isAbsent,
      record: isAbsent ? absentRows[0] : null,
    });
  } catch (err) {
    console.error("Error checking absence status:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Mark student as NOT going today (Insert row into absentes table)
app.post("/api/absentes", async (req, res) => {
  const studentId = Number(req.body?.student_id) || 3;
  if (!dbPool) {
    return res.status(500).json({ error: "MySQL database is not connected. Make sure XAMPP MySQL is running." });
  }

  try {
    // Fetch student info
    const [students] = await dbPool.query(
      `SELECT student_name, bus_stop FROM \`${STUDENT_TABLE}\` WHERE student_id = ? LIMIT 1`,
      [studentId]
    );

    if (!students.length) {
      return res.status(404).json({ error: `Student ID ${studentId} not found in database.` });
    }

    const student = students[0];

    // Check if already marked absent today
    const [existing] = await dbPool.query(
      `SELECT ID, Timestamp FROM \`${ABSENT_TABLE}\`
       WHERE LOWER(TRIM(Name)) = LOWER(TRIM(?))
         AND Timestamp >= CURDATE()
         AND Timestamp < CURDATE() + INTERVAL 1 DAY
       LIMIT 1`,
      [student.student_name]
    );

    let insertedId = null;
    if (!existing.length) {
      const [insertResult] = await dbPool.query(
        `INSERT INTO \`${ABSENT_TABLE}\` (Name, Bus_stop, Timestamp) VALUES (?, ?, NOW())`,
        [student.student_name, student.bus_stop || "Rajwada"]
      );
      insertedId = insertResult.insertId;
      console.log(`[ABSENCE RECORDED] Added student "${student.student_name}" (ID ${studentId}) to absentes table. Row ID: ${insertedId}`);
    } else {
      insertedId = existing[0].ID;
      console.log(`[ABSENCE ALREADY RECORDED] Student "${student.student_name}" is already in absentes table today.`);
    }

    io.emit("student-absence-changed", {
      student_id: studentId,
      student_name: student.student_name,
      isAbsent: true,
    });

    res.status(201).json({
      success: true,
      message: `Marked ${student.student_name} as NOT going today. Row recorded in absentes table.`,
      student_name: student.student_name,
      bus_stop: student.bus_stop,
      row_id: insertedId,
    });
  } catch (err) {
    console.error("Error inserting absence:", err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Restore student as going to school (Remove row from absentes table for today)
app.delete("/api/absentes/:id", async (req, res) => {
  const studentId = Number(req.params.id) || 3;
  if (!dbPool) {
    return res.status(500).json({ error: "MySQL database is not connected." });
  }

  try {
    const [students] = await dbPool.query(
      `SELECT student_name FROM \`${STUDENT_TABLE}\` WHERE student_id = ? LIMIT 1`,
      [studentId]
    );

    if (!students.length) {
      return res.status(404).json({ error: "Student not found." });
    }

    const studentName = students[0].student_name;

    await dbPool.query(
      `DELETE FROM \`${ABSENT_TABLE}\`
       WHERE LOWER(TRIM(Name)) = LOWER(TRIM(?))
         AND Timestamp >= CURDATE()
         AND Timestamp < CURDATE() + INTERVAL 1 DAY`,
      [studentName]
    );

    console.log(`[ABSENCE CLEARED] Restored attendance for student "${studentName}" (ID ${studentId}) for today.`);

    io.emit("student-absence-changed", {
      student_id: studentId,
      student_name: studentName,
      isAbsent: false,
    });

    res.json({
      success: true,
      message: `Restored attendance for ${studentName}. Removed from absentes table.`,
      student_name: studentName,
    });
  } catch (err) {
    console.error("Error removing absence:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Sockets ----------
io.on("connection", (socket) => {
  // Send initial Route 1 and Bus 1 location
  socket.emit("route-data", {
    route: ROUTE_1,
    school: SCHOOL,
    stops: ROUTE_1_STOPS,
  });
  socket.emit("receive-location", getBusSnapshot());
});

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 SchoolRide Parent Dashboard running on:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`Connected to XAMPP MySQL Database: ${DB.database}`);
  console.log(`Simulating Bus 1 on Route 1 (Indore stops)`);
  console.log(`Displaying student record for student_id = 3`);
  console.log(`=================================================`);
});
