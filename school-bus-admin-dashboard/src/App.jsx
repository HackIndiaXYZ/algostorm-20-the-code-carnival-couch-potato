import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, Bus, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  Clock3, Download, Eye, FileText, Gauge, GraduationCap, LayoutDashboard, LogOut,
  MapPin, Menu, MoreHorizontal, Plus, Radio, RefreshCw, Route, ScanLine, Search,
  ShieldCheck, SlidersHorizontal, Users, UserRound, X, Zap
} from 'lucide-react';

const USERS = {
  admin: { password: 'admin123', role: 'administration', name: 'Aarav Mehta', title: 'Transport Administrator', initials: 'AM' },
  driver1: { password: 'driver123', role: 'driver', name: 'Rakesh Verma', title: 'Bus Driver', initials: 'RV', busId: 'BUS-05' },
  teacher1: { password: 'teacher123', role: 'teacher', name: 'Neha Sharma', title: 'Class Teacher', initials: 'NS', className: 'Class 5' },
  conductor1: { password: 'conductor123', role: 'conductor', name: 'Sanjay Kumar', title: 'Bus Conductor', initials: 'SK', busId: 'BUS-05' }
};

const ROUTE = [
  [21.2514, 81.6296], [21.255, 81.633], [21.260, 81.637], [21.265, 81.642],
  [21.269, 81.646], [21.273, 81.650], [21.276, 81.655]
];
const BUS_SEEDS = [
  { id: 'BUS-05', route: 'Route A · North Loop', driver: 'Rakesh Verma', conductor: 'Sanjay Kumar', students: 28, boarded: 24, status: 'On route', eta: '8 min', lat: ROUTE[2][0], lng: ROUTE[2][1], step: 2, color: '#2e77e5' },
  { id: 'BUS-08', route: 'Route B · Lake Road', driver: 'Anil Patel', conductor: 'Mahesh Singh', students: 31, boarded: 31, status: 'On time', eta: '14 min', lat: 21.243, lng: 81.621, step: 1, color: '#20a477' },
  { id: 'BUS-12', route: 'Route C · East Sector', driver: 'Deepak Sahu', conductor: 'Nitin Das', students: 26, boarded: 23, status: 'Needs review', eta: '3 min', lat: 21.271, lng: 81.626, step: 4, color: '#de9b32' }
];
const STUDENT_SEEDS = [
  { id: 'STU001', name: 'Ravi Sharma', className: 'Class 5', section: 'A', busId: 'BUS-05', stop: 'Shankar Nagar', parentName: 'Pooja Sharma', status: 'Boarded', tag: 'RFID-1041' },
  { id: 'STU002', name: 'Priya Verma', className: 'Class 5', section: 'A', busId: 'BUS-05', stop: 'Civil Lines', parentName: 'Amit Verma', status: 'Boarded', tag: 'RFID-1042' },
  { id: 'STU003', name: 'Aman Gupta', className: 'Class 4', section: 'B', busId: 'BUS-05', stop: 'Telibandha', parentName: 'Ritu Gupta', status: 'Not scanned', tag: 'RFID-1043' },
  { id: 'STU004', name: 'Ananya Singh', className: 'Class 5', section: 'A', busId: 'BUS-08', stop: 'Pandri', parentName: 'Karan Singh', status: 'Boarded', tag: 'RFID-1044' },
  { id: 'STU005', name: 'Vihaan Jain', className: 'Class 6', section: 'C', busId: 'BUS-08', stop: 'Devendra Nagar', parentName: 'Meera Jain', status: 'Boarded', tag: 'RFID-1045' },
  { id: 'STU006', name: 'Sara Khan', className: 'Class 3', section: 'A', busId: 'BUS-12', stop: 'Amanaka', parentName: 'Imran Khan', status: 'Absent reported', tag: 'RFID-1046' },
  { id: 'STU007', name: 'Kabir Rao', className: 'Class 5', section: 'A', busId: 'BUS-05', stop: 'Shankar Nagar', parentName: 'Nisha Rao', status: 'Boarded', tag: 'RFID-1047' },
  { id: 'STU008', name: 'Diya Mishra', className: 'Class 2', section: 'B', busId: 'BUS-12', stop: 'Mowa', parentName: 'Amit Mishra', status: 'Not scanned', tag: 'RFID-1048' },
  { id: 'STU009', name: 'Ishaan Das', className: 'Class 5', section: 'A', busId: 'BUS-08', stop: 'Pandri', parentName: 'Rashmi Das', status: 'Boarded', tag: 'RFID-1049' },
  { id: 'STU010', name: 'Myra Joshi', className: 'Class 7', section: 'B', busId: 'BUS-12', stop: 'Amanaka', parentName: 'Raj Joshi', status: 'Boarded', tag: 'RFID-1050' }
];
const ALERT_SEEDS = [
  { id: 'AL-1', title: 'Boarding mismatch on BUS-12', detail: '3 students are not yet accounted for on Route C.', severity: 'high', time: '2 min ago', status: 'Open' },
  { id: 'AL-2', title: 'GPS signal briefly interrupted', detail: 'BUS-08 has resumed sending location updates.', severity: 'medium', time: '11 min ago', status: 'Resolved' },
  { id: 'AL-3', title: 'Absence reported by parent', detail: 'Sara Khan · BUS-12 · Morning trip.', severity: 'low', time: '18 min ago', status: 'Reviewed' }
];

const NAV = {
  administration: [
    ['Overview', LayoutDashboard], ['Live Fleet', MapPin], ['Students', GraduationCap], ['Attendance', CalendarDays], ['Staff & Roles', ShieldCheck], ['Alerts & Events', Bell]
  ],
  driver: [['My Route', Route], ['Live Fleet', MapPin], ['Trip Roster', Users], ['Alerts & Events', Bell]],
  teacher: [['Overview', LayoutDashboard], ['My Students', GraduationCap], ['Attendance', CalendarDays], ['Alerts & Events', Bell]],
  conductor: [['Trip Roster', Users], ['Live Fleet', MapPin], ['Attendance', CalendarDays], ['Alerts & Events', Bell]]
};
const ROLE_LABEL = { administration: 'Administration', driver: 'Driver', teacher: 'Teacher', conductor: 'Conductor' };

function readStore(key, fallback) {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
}
function timeNow() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

export default function App() {
  const [session, setSession] = useState(() => readStore('sw-demo-session', null));
  const [activePage, setActivePage] = useState('Overview');
  const [students, setStudents] = useState(() => readStore('sw-demo-students', STUDENT_SEEDS));
  const [buses, setBuses] = useState(() => readStore('sw-demo-buses', BUS_SEEDS));
  const [alerts, setAlerts] = useState(() => readStore('sw-demo-alerts', ALERT_SEEDS));
  const [events, setEvents] = useState(() => readStore('sw-demo-events', [
    { id: 'EV-1001', event: 'Trip started', item: 'BUS-05 · Route A', result: 'Success', time: '07:12 AM' },
    { id: 'EV-1002', event: 'Boarding recorded', item: 'Ravi Sharma · BUS-05', result: 'Recorded', time: '07:18 AM' },
    { id: 'EV-1003', event: 'Absence reported', item: 'Sara Khan · BUS-12', result: 'Recorded', time: '07:21 AM' }
  ]));
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [toast, setToast] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedBus, setSelectedBus] = useState('BUS-05');

  useEffect(() => { localStorage.setItem('sw-demo-students', JSON.stringify(students)); }, [students]);
  useEffect(() => { localStorage.setItem('sw-demo-buses', JSON.stringify(buses)); }, [buses]);
  useEffect(() => { localStorage.setItem('sw-demo-alerts', JSON.stringify(alerts)); }, [alerts]);
  useEffect(() => { localStorage.setItem('sw-demo-events', JSON.stringify(events)); }, [events]);
  useEffect(() => { if (session) localStorage.setItem('sw-demo-session', JSON.stringify(session)); else localStorage.removeItem('sw-demo-session'); }, [session]);

  // Simulated telemetry: this moves demo markers so the map looks live. It is not real GPS.
  useEffect(() => {
    const timer = setInterval(() => {
      setBuses(prev => prev.map((bus, i) => {
        const step = (bus.step + 1) % ROUTE.length;
        const point = ROUTE[(step + i) % ROUTE.length];
        return { ...bus, step, lat: point[0] + i * 0.0013, lng: point[1] + (i - 1) * 0.0016 };
      }));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { if (session) setActivePage(defaultPage(session.role)); }, [session?.role]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3600); return () => clearTimeout(timer); }, [toast]);

  const menu = session ? NAV[session.role] || NAV.administration : [];
  const filteredStudents = useMemo(() => students.filter(s => {
    const term = search.toLowerCase();
    const visibleForRole = session?.role === 'teacher' ? s.className === (session.className || 'Class 5') : true;
    return visibleForRole && [s.name, s.id, s.className, s.busId, s.stop].some(x => (x || '').toLowerCase().includes(term));
  }), [students, search, session]);

  function login(username, password) {
    const key = username.trim().toLowerCase();
    const user = USERS[key];
    if (!user || user.password !== password) { setToast('Invalid username or password. Use one of the demo accounts below.'); return; }
    if (user.role === 'administration') {
      window.location.assign('http://localhost:3001');
      return;
    }
    if (['driver', 'conductor'].includes(user.role)) {
      window.location.assign('http://localhost:3004/');
      return;
    }
    setSession({ username: key, ...user });
    setActivePage(defaultPage(user.role));
    setToast(`Welcome, ${user.name}. Signed in as ${ROLE_LABEL[user.role]}.`);
  }
  function logout() { setSession(null); setToast('You have been signed out.'); }
  function addEvent(event, item, result = 'Recorded') {
    setEvents(prev => [{ id: `EV-${Date.now()}`, event, item, result, time: timeNow() }, ...prev].slice(0, 100));
  }
  function addStudent(form) {
    const id = form.id.trim().toUpperCase();
    if (students.some(s => s.id.toLowerCase() === id.toLowerCase())) { setToast('That student ID already exists.'); return false; }
    const newStudent = { ...form, id, status: 'Not scanned', tag: form.tag.trim() || `RFID-${Math.floor(1000 + Math.random() * 8999)}` };
    setStudents(prev => [newStudent, ...prev]);
    addEvent('Student added', `${newStudent.name} · ${newStudent.id}`);
    setToast(`${newStudent.name} added to the student registry.`);
    setShowAddStudent(false);
    return true;
  }
  function scanStudent(studentId, action = 'Boarding') {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    if (action === 'Boarding' && student.status === 'Absent reported') {
      addEvent('Absence / scan conflict', `${student.name} · ${student.busId}`, 'Review required');
      setAlerts(prev => [{ id: `AL-${Date.now()}`, title: `Absence conflict · ${student.name}`, detail: 'A boarding scan was attempted for a student marked absent. Verify with the school before changing the record.', severity: 'high', time: 'Just now', status: 'Open' }, ...prev]);
      setToast(`${student.name} is marked absent. The scan was flagged for review.`);
      return;
    }
    if (action === 'Boarding' && ['Boarded', 'Arrived at school'].includes(student.status)) {
      addEvent('Duplicate boarding scan', `${student.name} · ${student.busId}`, 'Flagged');
      setAlerts(prev => [{ id: `AL-${Date.now()}`, title: `Duplicate scan · ${student.name}`, detail: 'This student already has a boarding record for the demo trip.', severity: 'medium', time: 'Just now', status: 'Open' }, ...prev]);
      setToast(`Duplicate scan for ${student.name} flagged.`);
      return;
    }
    if (action === 'Deboarding' && student.status !== 'Boarded') {
      addEvent('Deboarding check failed', `${student.name} · ${student.busId}`, 'Review required');
      setToast(`No accepted boarding record found for ${student.name}.`);
      return;
    }
    const nextStatus = action === 'Boarding' ? 'Boarded' : 'Arrived at school';
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: nextStatus } : s));
    setBuses(prev => prev.map(b => b.id === student.busId ? { ...b, boarded: Math.max(0, b.boarded + (action === 'Boarding' ? 1 : -1)) } : b));
    addEvent(action === 'Boarding' ? 'Boarding recorded' : 'Deboarding recorded', `${student.name} · ${student.busId}`, 'Success');
    setToast(`${action} event saved for ${student.name}.`);
  }
  function markAbsent(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student || student.status === 'Boarded') { setToast('This student already has a boarding record. Contact administration to correct it.'); return; }
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: 'Absent reported' } : s));
    addEvent('Absence reported', `${student.name} · ${student.busId}`);
    setToast(`${student.name} marked not travelling in this demo.`);
  }
  function startTrip(busId) {
    setBuses(prev => prev.map(b => b.id === busId ? { ...b, status: b.status === 'Trip started' ? 'On route' : 'Trip started' } : b));
    addEvent('Trip status updated', busId, 'Success');
    setToast(`${busId} trip status updated.`);
  }
  function navigate(label) { setActivePage(label); setMobileMenu(false); setSearch(''); }

  if (!session) return <Login onLogin={login} />;
  const allowed = menu.some(([label]) => label === activePage);
  const page = allowed ? activePage : defaultPage(session.role);
  const roleIsAdmin = session.role === 'administration';
  const isStaffRole = ['driver', 'conductor', 'teacher'].includes(session.role);

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup"><div className="brand-mark"><Bus size={23}/></div><div><strong>SchoolWay</strong><span>TRANSPORT OPS</span></div><button className="mobile-close icon-btn" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav">{menu.map(([label, Icon]) => <button key={label} className={`nav-link ${page === label ? 'nav-active' : ''}`} onClick={() => navigate(label)}><Icon size={18}/><span>{label}</span>{label === 'Alerts & Events' && alerts.filter(a => a.status === 'Open').length > 0 && <b className="nav-count">{alerts.filter(a => a.status === 'Open').length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><strong>Need a hand?</strong><p>View the quick-start guide for your role.</p><button onClick={() => setToast('Demo guide: use the sidebar to navigate and the blue buttons to perform actions.')}>Open guide <ChevronRight size={14}/></button></div><div className="sidebar-user"><div className="avatar avatar-sidebar">{session.initials}</div><div className="user-label"><strong>{session.name}</strong><span>{ROLE_LABEL[session.role]}</span></div><button className="icon-btn sidebar-logout" title="Sign out" onClick={logout}><LogOut size={17}/></button></div></div>
    </aside>
    {mobileMenu && <div className="mobile-shade" onClick={() => setMobileMenu(false)} />}

    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="menu-toggle icon-btn" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={20}/></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14}/><strong>{page}</strong></div></div><div className="topbar-actions"><div className="system-status"><span className="pulse-dot"/> Demo feed active</div><button className="icon-btn notification-btn" onClick={() => navigate('Alerts & Events')} title="Alerts"><Bell size={18}/>{alerts.some(a => a.status === 'Open') && <i/>}</button><div className="top-divider"/><button className="top-user" onClick={() => setToast(`${session.name} · ${ROLE_LABEL[session.role]}`)}><div className="avatar avatar-small">{session.initials}</div><div><strong>{session.name}</strong><span>{ROLE_LABEL[session.role]}</span></div><ChevronDown size={14}/></button></div></header>

      <div className="page-content">
        <div className="page-heading"><div><div className="date-line"><CalendarDays size={14}/>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div><h1>{page === 'Overview' ? `Good evening, ${session.name.split(' ')[0]}` : page}</h1><p>{pageSubtitle(page, session.role)}</p></div><div className="heading-actions">{roleIsAdmin && page === 'Students' && <button className="button button-primary" onClick={() => setShowAddStudent(true)}><Plus size={17}/> Add student</button>}{page === 'Live Fleet' && <span className="live-label"><span className="pulse-dot"/> Updating every 5 sec</span>}</div></div>

        {page === 'Overview' && <Overview role={session.role} students={students} buses={buses} alerts={alerts} events={events} onNavigate={navigate} onSelectBus={setSelectedBus} selectedBus={selectedBus} />}
        {page === 'Live Fleet' && <FleetPage buses={buses} selectedBus={selectedBus} onSelectBus={setSelectedBus} />}
        {page === 'Students' && <StudentsPage students={filteredStudents} allCount={students.length} role={session.role} query={search} onQuery={setSearch} onAdd={() => setShowAddStudent(true)} />}
        {page === 'My Students' && <StudentsPage students={filteredStudents} allCount={filteredStudents.length} role={session.role} query={search} onQuery={setSearch} onAdd={() => {}} />}
        {page === 'Trip Roster' && <RosterPage students={session.role === 'teacher' ? filteredStudents : students.filter(s => session.role === 'driver' || session.role === 'conductor' ? s.busId === (session.busId || 'BUS-05') : true)} role={session.role} onScan={scanStudent} />}
        {page === 'Attendance' && <AttendancePage students={session.role === 'teacher' ? filteredStudents : students} onScan={scanStudent} role={session.role} />}
        {page === 'Staff & Roles' && <RolesPage />}
        {page === 'Alerts & Events' && <AlertsPage alerts={alerts} events={events} onResolve={(id) => { setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'Resolved' } : a)); setToast('Alert marked as resolved.'); addEvent('Alert resolved', id, 'Success'); }} />}
        {page === 'My Route' && <DriverPage session={session} buses={buses} students={students} onStartTrip={startTrip} onNavigate={navigate} />}
      </div>
      <footer className="footer-note"><ShieldCheck size={15}/><span>SchoolWay demo environment · GPS and login data are simulated. Use test data only.</span><span className="footer-version">Prototype v1.0</span></footer>
    </main>
    {showAddStudent && roleIsAdmin && <AddStudentModal onClose={() => setShowAddStudent(false)} onSave={addStudent} buses={buses} />}
    {toast && <div className="toast" role="status"><CheckCircle2 size={18}/><span>{toast}</span><button onClick={() => setToast('')} aria-label="Dismiss"><X size={15}/></button></div>}
  </div>;
}

function defaultPage(role) { return role === 'driver' ? 'My Route' : role === 'conductor' ? 'Trip Roster' : role === 'teacher' ? 'Overview' : 'Overview'; }
function pageSubtitle(page, role) {
  const dict = {
    Overview: role === 'teacher' ? 'A quick look at your class transport and attendance.' : 'Here’s what is happening across your school transport network.',
    'Live Fleet': 'Track vehicle locations and review the latest route status.', Students: 'Manage student profiles and assigned transport details.',
    'My Students': 'Students assigned to your class and their current transport status.', Attendance: 'Review trip attendance and boarding verification.',
    'Staff & Roles': 'Review demo accounts and access permissions by role.', 'Alerts & Events': 'Review exceptions and the recent transport activity log.',
    'Trip Roster': 'Record boarding and deboarding events for your assigned trip.', 'My Route': 'Your assigned vehicle, route status and student overview.'
  };
  return dict[page] || 'School transport operations.';
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  function submit(e) { e.preventDefault(); setError(''); const known = USERS[username.trim().toLowerCase()]; if (!known || known.password !== password) { setError('We couldn’t match those credentials. Try a demo account below.'); return; } onLogin(username, password); }
  const demos = [['admin','admin123','Administration'],['driver1','driver123','Driver'],['teacher1','teacher123','Teacher'],['conductor1','conductor123','Conductor']];
  return <div className="login-screen"><div className="login-decor decor-one"/><div className="login-decor decor-two"/><div className="login-wrap"><div className="login-brand"><div className="brand-mark"><Bus size={24}/></div><div><strong>SchoolWay</strong><span>SMART SCHOOL TRANSPORT</span></div></div><div className="login-card"><div className="login-icon"><ShieldCheck size={25}/></div><p className="eyebrow">SECURE WORKSPACE</p><h1>Welcome back</h1><p className="login-subtitle">Sign in to your school transport dashboard.</p><form onSubmit={submit}><label htmlFor="username">Username</label><div className="input-with-icon"><UserRound size={17}/><input id="username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter your username" required/></div><label htmlFor="password">Password</label><div className="input-with-icon"><ShieldCheck size={17}/><input id="password" type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" required/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label="Toggle password visibility"><Eye size={16}/></button></div>{error && <div className="login-error"><AlertTriangle size={15}/>{error}</div>}<button className="button button-primary login-submit" type="submit">Sign in <ChevronRight size={17}/></button></form><div className="demo-accounts"><div className="demo-title"><span>DEMO ACCOUNTS</span><span>Click to fill</span></div>{demos.map(([u,p,r])=><button key={u} onClick={()=>{setUsername(u);setPassword(p);setError('')}} className="demo-account"><span className="demo-account-role">{r.slice(0,1)}</span><span><strong>{r}</strong><small>{u}</small></span><ChevronRight size={15}/></button>)}</div><p className="login-disclaimer"><ShieldCheck size={14}/> Prototype login only. Production authentication and server-side authorization are not configured.</p></div><div className="login-foot">Designed for safer, more connected school transport.</div></div></div>;
}

function Overview({ role, students, buses, alerts, events, onNavigate, onSelectBus, selectedBus }) {
  const activeBuses = buses.filter(b => ['On route','On time','Trip started','Needs review'].includes(b.status)).length;
  const boarded = students.filter(s => s.status === 'Boarded').length;
  const unresolved = students.filter(s => ['Not scanned','Absent reported'].includes(s.status)).length;
  const shownStudents = role === 'teacher' ? students.filter(s => s.className === 'Class 5') : students;
  return <>
    <div className="metric-grid">
      <Metric icon={Bus} label={role === 'teacher' ? 'Class bus routes' : 'Active buses'} value={role === 'teacher' ? '2' : activeBuses} change="Live fleet" color="blue" trend="up"/>
      <Metric icon={Users} label={role === 'teacher' ? 'My students' : 'Registered students'} value={role === 'teacher' ? shownStudents.length : students.length} change="Student registry" color="purple"/>
      <Metric icon={CheckCircle2} label="Boarding recorded" value={boarded} change={`${Math.round(boarded / Math.max(students.length,1)*100)}% of demo roster`} color="green" trend="up"/>
      <Metric icon={AlertTriangle} label="Needs verification" value={unresolved} change="Review required" color="amber" trend="down"/>
    </div>
    <div className="dashboard-grid main-dashboard-grid">
      <section className="card map-card"><CardHeading title="Live fleet overview" subtitle="Vehicle locations · Demo GPS feed" right={<button className="text-link" onClick={()=>onNavigate('Live Fleet')}>Full map <ArrowUpRight size={14}/></button>}/><MapView buses={buses} compact/><div className="map-legend"><span><i className="legend-dot dot-blue"/> On route</span><span><i className="legend-dot dot-green"/> On time</span><span><i className="legend-dot dot-amber"/> Needs review</span><span className="map-updated"><span className="pulse-dot"/> Updated just now</span></div></section>
      <section className="card fleet-card"><CardHeading title="Fleet status" subtitle={`${buses.length} vehicles in demo fleet`} right={<button className="icon-btn" onClick={()=>onNavigate('Live Fleet')}><MoreHorizontal size={18}/></button>}/><div className="fleet-list">{buses.map(bus=><button className={`fleet-row ${selectedBus===bus.id?'fleet-row-selected':''}`} key={bus.id} onClick={()=>{onSelectBus(bus.id);onNavigate('Live Fleet')}}><div className={`bus-avatar ${bus.status==='Needs review'?'bus-avatar-amber':''}`}><Bus size={20}/></div><div className="fleet-row-main"><div className="fleet-row-title"><strong>{bus.id}</strong><span className={`status-pill ${statusClass(bus.status)}`}>{bus.status}</span></div><span>{bus.route}</span><small>{bus.driver}</small></div><div className="fleet-row-meta"><strong>{bus.eta}</strong><small>ETA</small><ChevronRight size={14}/></div></button>)}</div><button className="button button-ghost full-button" onClick={()=>onNavigate('Live Fleet')}>View all vehicles <ArrowUpRight size={15}/></button></section>
    </div>
    <div className="dashboard-grid bottom-dashboard-grid"><section className="card"><CardHeading title={role==='teacher'?'My students':'Student attendance'} subtitle="Today's transport status" right={<button className="text-link" onClick={()=>onNavigate(role==='teacher'?'My Students':'Students')}>View roster <ArrowUpRight size={14}/></button>}/><div className="mini-table"><div className="mini-table-head"><span>STUDENT</span><span>BUS</span><span>STATUS</span></div>{shownStudents.slice(0,5).map(s=><div className="mini-table-row" key={s.id}><div className="person-cell"><Avatar name={s.name}/><div><strong>{s.name}</strong><small>{s.className} · {s.section}</small></div></div><span className="bus-cell">{s.busId}</span><StatusBadge status={s.status}/></div>)}</div></section><section className="card alerts-card"><CardHeading title="Attention needed" subtitle="Latest alerts and exceptions" right={<button className="text-link" onClick={()=>onNavigate('Alerts & Events')}>View all <ArrowUpRight size={14}/></button>}/><div className="alert-list">{alerts.filter(a=>a.status==='Open').slice(0,3).map(alert=><AlertItem key={alert.id} alert={alert}/>)}</div>{alerts.filter(a=>a.status==='Open').length===0&&<EmptyState icon={CheckCircle2} title="All caught up" detail="No open alerts right now."/>}</section></div>
  </>;
}

function Metric({ icon: Icon, label, value, change, color, trend }) { return <div className="metric-card"><div className={`metric-icon metric-${color}`}><Icon size={19}/></div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-foot"><span className={`metric-trend ${trend==='down'?'trend-amber':''}`}>{trend==='down'?<ArrowDownRight size={13}/>:<ArrowUpRight size={13}/>} {change}</span></div></div>; }
function CardHeading({ title, subtitle, right }) { return <div className="card-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{right}</div>; }
function Avatar({ name }) { return <div className="avatar">{(name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>; }
function statusClass(status) { return status==='On time'?'status-green':status==='Needs review'?'status-amber':status==='Trip started'?'status-blue':'status-blue'; }
function StatusBadge({ status }) { const cls = status==='Boarded'||status==='Arrived at school'?'status-green':status==='Absent reported'?'status-amber':status==='Not scanned'?'status-grey':'status-blue'; return <span className={`status-pill ${cls}`}><span className="status-dot"/>{status}</span>; }
function AlertItem({ alert }) { return <div className="alert-item"><div className={`alert-icon alert-${alert.severity}`}><AlertTriangle size={17}/></div><div className="alert-copy"><strong>{alert.title}</strong><p>{alert.detail}</p><span>{alert.time}</span></div><ChevronRight size={16} className="alert-chevron"/></div>; }
function EmptyState({ icon: Icon, title, detail }) { return <div className="empty-state"><Icon size={25}/><strong>{title}</strong><span>{detail}</span></div>; }

function MapView({ buses, compact = false, selectedBus, onSelectBus }) {
  const elementRef = useRef(null); const mapRef = useRef(null); const markersRef = useRef({});
  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;
    const map = L.map(elementRef.current, { zoomControl: true, attributionControl: true }).setView([21.260, 81.635], compact ? 12 : 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    L.polyline(ROUTE, { color: '#2e77e5', weight: 4, opacity: .62, dashArray: '7 8' }).addTo(map);
    L.circleMarker([21.277, 81.653], { radius: 7, color: '#ffffff', weight: 3, fillColor: '#142c4d', fillOpacity: 1 }).addTo(map).bindTooltip('School campus');
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 180);
    return () => { map.remove(); mapRef.current = null; markersRef.current = {}; };
  }, [compact]);
  useEffect(() => {
    if (!mapRef.current) return;
    buses.forEach(bus => {
      if (!markersRef.current[bus.id]) {
        const html = `<div class="map-bus-pin" style="--bus-color:${bus.color}">🚌</div>`;
        const icon = L.divIcon({ html, className: 'bus-div-icon', iconSize: [32, 32], iconAnchor: [16, 16] });
        markersRef.current[bus.id] = L.marker([bus.lat, bus.lng], { icon }).addTo(mapRef.current).bindPopup(`<strong>${bus.id}</strong><br/>${bus.route}<br/>${bus.status}<br/><small>Simulated GPS point</small>`);
        if (onSelectBus) markersRef.current[bus.id].on('click', () => onSelectBus(bus.id));
      } else markersRef.current[bus.id].setLatLng([bus.lat, bus.lng]);
    });
  }, [buses, onSelectBus]);
  return <div className={`map-container ${compact?'map-compact':''}`}><div ref={elementRef} className="leaflet-map"/><div className="map-live-chip"><span className="pulse-dot"/> LIVE DEMO FEED</div><div className="map-scale"><Radio size={13}/> GPS simulation</div></div>;
}

function FleetPage({ buses, selectedBus, onSelectBus }) {
  const current = buses.find(b=>b.id===selectedBus)||buses[0];
  return <div className="fleet-page-grid"><section className="card fleet-map-large"><CardHeading title="Live vehicle map" subtitle="Demo GPS route · Marker moves every 5 seconds" right={<span className="live-label"><span className="pulse-dot"/> Live simulation</span>}/><MapView buses={buses} selectedBus={selectedBus} onSelectBus={onSelectBus}/><div className="map-bottom-note"><span><i className="legend-dot dot-blue"/> Active route</span><span><MapPin size={14}/> School campus</span><span><Radio size={14}/> Coordinates are simulated</span></div></section><section className="card fleet-detail-card"><CardHeading title="Vehicles" subtitle="Select a vehicle for details"/><div className="fleet-select-list">{buses.map(bus=><button key={bus.id} className={`fleet-select-row ${bus.id===selectedBus?'selected':''}`} onClick={()=>onSelectBus(bus.id)}><div className="bus-avatar"><Bus size={20}/></div><div className="fleet-row-main"><strong>{bus.id}</strong><span>{bus.route}</span><small>{bus.driver}</small></div><ChevronRight size={15}/></button>)}</div>{current&&<div className="vehicle-details"><div className="vehicle-detail-head"><div><span className="eyebrow">SELECTED VEHICLE</span><h3>{current.id}</h3></div><span className={`status-pill ${statusClass(current.status)}`}>{current.status}</span></div><div className="vehicle-detail-grid"><div><span>Driver</span><strong>{current.driver}</strong></div><div><span>Conductor</span><strong>{current.conductor}</strong></div><div><span>Students expected</span><strong>{current.students}</strong></div><div><span>Boarding recorded</span><strong>{current.boarded}</strong></div><div><span>Next stop ETA</span><strong>{current.eta}</strong></div><div><span>Last GPS update</span><strong>Just now</strong></div></div></div>}</section></div>;
}

function StudentsPage({ students, allCount, role, query, onQuery, onAdd }) {
  const isAdmin = role === 'administration';
  return <section className="card content-card"><div className="list-toolbar"><div className="search-field"><Search size={17}/><input value={query} onChange={e=>onQuery(e.target.value)} placeholder="Search by student, ID, bus or stop..."/></div><div className="toolbar-right"><span className="result-count">{students.length} of {allCount} students</span><button className="button button-ghost" onClick={()=>onQuery('')}><SlidersHorizontal size={16}/> Reset</button>{isAdmin&&<button className="button button-primary" onClick={onAdd}><Plus size={16}/> Add student</button>}</div></div><div className="table-responsive"><table className="data-table"><thead><tr><th>STUDENT</th><th>CLASS</th><th>ASSIGNED BUS</th><th>PICKUP STOP</th><th>PARENT / GUARDIAN</th><th>TRAVEL STATUS</th>{isAdmin&&<th>ID CARD</th>}</tr></thead><tbody>{students.map(s=><tr key={s.id}><td><div className="table-person"><Avatar name={s.name}/><div><strong>{s.name}</strong><span>{s.id}</span></div></div></td><td>{s.className} · {s.section}</td><td><span className="bus-tag"><Bus size={13}/>{s.busId}</span></td><td>{s.stop}</td><td>{s.parentName}</td><td><StatusBadge status={s.status}/></td>{isAdmin&&<td><span className="code-tag">{s.tag}</span></td>}</tr>)}</tbody></table>{students.length===0&&<EmptyState icon={Search} title="No students found" detail="Try a different search term."/>}</div><div className="table-footer"><span>Showing {students.length} records · Demo data</span><span><ShieldCheck size={14}/> Student records are sample data</span></div></section>;
}

function RosterPage({ students, role, onScan }) {
  const [mode, setMode] = useState('Boarding'); const [query, setQuery] = useState('');
  const visible = students.filter(s => `${s.name} ${s.id} ${s.busId}`.toLowerCase().includes(query.toLowerCase()));
  const boarded = students.filter(s=>s.status==='Boarded').length; const absent = students.filter(s=>s.status==='Absent reported').length;
  return <><div className="metric-grid roster-metrics"><Metric icon={Users} label="Assigned students" value={students.length} change="Current trip roster" color="blue"/><Metric icon={CheckCircle2} label="Boarded" value={boarded} change="Accepted events" color="green"/><Metric icon={Clock3} label="Awaiting scan" value={students.filter(s=>s.status==='Not scanned').length} change="Not yet accounted for" color="amber"/><Metric icon={AlertTriangle} label="Absences" value={absent} change="Parent reported" color="purple"/></div><section className="card content-card"><div className="roster-controls"><div><h2>Trip roster</h2><p>Scan a demo card to record a student event.</p></div><div className="mode-toggle"><button className={mode==='Boarding'?'selected':''} onClick={()=>setMode('Boarding')}><ArrowDownRight size={15}/> Boarding</button><button className={mode==='Deboarding'?'selected':''} onClick={()=>setMode('Deboarding')}><ArrowUpRight size={15}/> Deboarding</button></div></div><div className="list-toolbar"><div className="search-field"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a student..."/></div><span className="sim-badge"><Radio size={14}/> Simulation mode</span></div><div className="table-responsive"><table className="data-table"><thead><tr><th>STUDENT</th><th>BUS</th><th>RFID ID</th><th>CURRENT STATUS</th><th>ACTION</th></tr></thead><tbody>{visible.map(s=><tr key={s.id}><td><div className="table-person"><Avatar name={s.name}/><div><strong>{s.name}</strong><span>{s.id} · {s.className}</span></div></div></td><td>{s.busId}</td><td><span className="code-tag">{s.tag}</span></td><td><StatusBadge status={s.status}/></td><td><button className="button button-small button-primary" onClick={()=>onScan(s.id,mode)}><ScanLine size={14}/>{mode==='Boarding'?'Simulate scan':'Record exit'}</button></td></tr>)}</tbody></table>{visible.length===0&&<EmptyState icon={Search} title="No matching students" detail="Try a different name or ID."/>}</div><div className="inline-notice"><AlertTriangle size={16}/><span>Scans for absent students and duplicate boarding events are logged for staff verification. This demo does not read a physical RFID card.</span></div></section></>;
}

function AttendancePage({ students, onScan, role }) {
  const [query,setQuery]=useState('');
  const filtered=students.filter(s=>`${s.name} ${s.id} ${s.busId}`.toLowerCase().includes(query.toLowerCase()));
  const boarded=students.filter(s=>['Boarded','Arrived at school'].includes(s.status)).length;
  const absent=students.filter(s=>s.status==='Absent reported').length;
  const pending=students.filter(s=>s.status==='Not scanned').length;
  return <><div className="metric-grid"><Metric icon={CheckCircle2} label="Recorded arrival / boarding" value={boarded} change="Demo event records" color="green"/><Metric icon={Clock3} label="Pending verification" value={pending} change="No accepted scan" color="amber"/><Metric icon={CalendarDays} label="Absence reports" value={absent} change="Reported not travelling" color="purple"/><Metric icon={Users} label="Roster total" value={students.length} change="Visible students" color="blue"/></div><section className="card content-card"><div className="list-toolbar"><div><h2 className="section-title">Attendance register</h2><p className="section-subtitle">A scan is an event record, not a guarantee of physical identity.</p></div><div className="search-field"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search attendance..."/></div></div><div className="table-responsive"><table className="data-table"><thead><tr><th>STUDENT</th><th>BUS</th><th>STATUS</th><th>VERIFICATION</th>{role==='conductor'&&<th>QUICK ACTION</th>}</tr></thead><tbody>{filtered.map(s=><tr key={s.id}><td><div className="table-person"><Avatar name={s.name}/><div><strong>{s.name}</strong><span>{s.id} · {s.className}</span></div></div></td><td>{s.busId}</td><td><StatusBadge status={s.status}/></td><td>{s.status==='Boarded'||s.status==='Arrived at school'?<span className="verification-ok"><Check size={14}/> Event recorded</span>:s.status==='Absent reported'?<span className="verification-warn"><AlertTriangle size={14}/> Staff awareness</span>:<span className="verification-pending"><Clock3 size={14}/> Awaiting event</span>}</td>{role==='conductor'&&<td><button className="button button-small button-ghost" onClick={()=>onScan(s.id,s.status==='Boarded'?'Deboarding':'Boarding')}><ScanLine size={14}/> Record event</button></td>}</tr>)}</tbody></table></div><div className="table-footer"><span>Last refreshed just now · Simulated demo data</span><button className="text-link" onClick={()=>window.print()}><Download size={14}/> Print / save report</button></div></section></>;
}

function RolesPage() {
  const rows=[['admin','Aarav Mehta','Administration','Full dashboard, student registry, fleet overview, staff roles, alerts'],['driver1','Rakesh Verma','Driver','Assigned route, live fleet, trip roster and trip controls'],['teacher1','Neha Sharma','Teacher','Assigned class, transport attendance and student status'],['conductor1','Sanjay Kumar','Conductor','Assigned trip roster, simulated RFID events and attendance']];
  return <><div className="role-info-banner"><ShieldCheck size={22}/><div><strong>Role-based workspace</strong><p>Each demo account sees only its role's navigation and actions. This is a UI-level demonstration, not production-grade authorization.</p></div></div><section className="card content-card"><CardHeading title="Users & access" subtitle="Demo accounts and their permitted areas" right={<span className="sim-badge">4 demo roles</span>}/><div className="roles-grid">{rows.map(([username,name,role,desc],i)=><div className="role-card" key={username}><div className={`role-icon role-${i}`}><ShieldCheck size={21}/></div><div className="role-card-title"><h3>{role}</h3><span className="status-pill status-green">Enabled</span></div><strong>{name}</strong><span className="role-username">@{username}</span><p>{desc}</p></div>)}</div><div className="inline-notice"><AlertTriangle size={16}/><span>For production, assign roles on a trusted backend and enforce access with Firebase Authentication, server-validated role claims, and Firestore Security Rules.</span></div></section></>;
}

function AlertsPage({ alerts, events, onResolve }) {
  const [filter,setFilter]=useState('All');
  const visible=alerts.filter(a=>filter==='All'||a.status===filter);
  return <div className="dashboard-grid alerts-page-grid"><section className="card content-card"><div className="list-toolbar"><div><h2 className="section-title">Alerts & exceptions</h2><p className="section-subtitle">Review and resolve transport exceptions.</p></div><select className="compact-select" value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Open</option><option>Resolved</option><option>Reviewed</option></select></div><div className="alerts-full-list">{visible.map(a=><div className="alert-full-row" key={a.id}><div className={`alert-icon alert-${a.severity}`}><AlertTriangle size={18}/></div><div className="alert-copy"><strong>{a.title}</strong><p>{a.detail}</p><span>{a.time} · {a.severity} priority</span></div><div className="alert-row-actions"><span className={`status-pill ${a.status==='Open'?'status-amber':'status-green'}`}>{a.status}</span>{a.status==='Open'&&<button className="button button-small button-ghost" onClick={()=>onResolve(a.id)}><Check size={14}/> Resolve</button>}</div></div>)}{visible.length===0&&<EmptyState icon={CheckCircle2} title="No alerts in this view" detail="Try a different filter."/>}</div></section><section className="card content-card"><CardHeading title="Recent event log" subtitle="Latest system activity" right={<span className="sim-badge">{events.length} events</span>}/><div className="event-feed">{events.slice(0,9).map(e=><div className="event-feed-row" key={e.id}><div className="event-feed-dot"/><div><strong>{e.event}</strong><p>{e.item}</p><span>{e.time} · {e.result}</span></div></div>)}</div></section></div>;
}

function DriverPage({ session, buses, students, onStartTrip, onNavigate }) {
  const bus=buses.find(b=>b.id===(session.busId||'BUS-05'))||buses[0]; const roster=students.filter(s=>s.busId===bus.id);
  return <><div className="driver-hero card"><div className="driver-hero-icon"><Bus size={30}/></div><div className="driver-hero-text"><span className="eyebrow">ASSIGNED VEHICLE</span><h2>{bus.id} <span className={`status-pill ${statusClass(bus.status)}`}>{bus.status}</span></h2><p>{bus.route} · Morning pickup</p><div className="driver-hero-meta"><span><UserRound size={14}/>{bus.driver}</span><span><MapPin size={14}/>{bus.eta} to next stop</span></div></div><button className="button button-primary" onClick={()=>onStartTrip(bus.id)}><Zap size={16}/>{bus.status==='Trip started'?'Update trip status':'Start trip'}</button></div><div className="dashboard-grid driver-grid"><section className="card"><CardHeading title="My route" subtitle="Current vehicle location" right={<button className="text-link" onClick={()=>onNavigate('Live Fleet')}>Open map <ArrowUpRight size={14}/></button>}/><MapView buses={[bus]}/><div className="map-bottom-note"><span><Radio size={14}/> Simulated GPS feed</span><span><Clock3 size={14}/> ETA {bus.eta}</span></div></section><section className="card"><CardHeading title="Assigned students" subtitle={`${roster.length} students on this route`}/><div className="student-compact-list">{roster.map(s=><div className="student-compact-row" key={s.id}><Avatar name={s.name}/><div><strong>{s.name}</strong><span>{s.stop}</span></div><StatusBadge status={s.status}/></div>)}</div><button className="button button-ghost full-button" onClick={()=>onNavigate('Trip Roster')}>Open trip roster <ChevronRight size={15}/></button></section></div></>;
}

function AddStudentModal({ onClose, onSave, buses }) {
  const [form,setForm]=useState({id:'',name:'',className:'Class 5',section:'A',busId:buses[0]?.id||'BUS-05',stop:'',parentName:'',tag:''});
  const [error,setError]=useState('');
  function update(key,value){setForm(prev=>({...prev,[key]:value}));}
  function submit(e){e.preventDefault(); if(!form.id.trim()||!form.name.trim()||!form.stop.trim()||!form.parentName.trim()){setError('Please complete Student ID, name, pickup stop and parent/guardian.');return;} const ok=onSave(form); if(!ok)setError('That Student ID is already in use.');}
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-student-title"><div className="modal-heading"><div className="modal-title-icon"><GraduationCap size={21}/></div><div><h2 id="add-student-title">Add new student</h2><p>Register a student and assign school transport.</p></div><button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><X size={18}/></button></div><form onSubmit={submit}><div className="form-grid"><div className="form-field"><label htmlFor="student-id">Student ID <span>*</span></label><input id="student-id" value={form.id} onChange={e=>update('id',e.target.value)} placeholder="e.g. STU011"/></div><div className="form-field"><label htmlFor="student-name">Full name <span>*</span></label><input id="student-name" value={form.name} onChange={e=>update('name',e.target.value)} placeholder="Student full name"/></div><div className="form-field"><label htmlFor="class-name">Class</label><select id="class-name" value={form.className} onChange={e=>update('className',e.target.value)}>{['Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12'].map(c=><option key={c}>{c}</option>)}</select></div><div className="form-field"><label htmlFor="section">Section</label><select id="section" value={form.section} onChange={e=>update('section',e.target.value)}>{['A','B','C','D'].map(s=><option key={s}>{s}</option>)}</select></div><div className="form-field"><label htmlFor="bus-id">Assigned bus</label><select id="bus-id" value={form.busId} onChange={e=>update('busId',e.target.value)}>{buses.map(b=><option key={b.id} value={b.id}>{b.id} · {b.route}</option>)}</select></div><div className="form-field"><label htmlFor="pickup-stop">Pickup stop <span>*</span></label><input id="pickup-stop" value={form.stop} onChange={e=>update('stop',e.target.value)} placeholder="e.g. Shankar Nagar"/></div><div className="form-field form-full"><label htmlFor="parent-name">Parent / guardian name <span>*</span></label><input id="parent-name" value={form.parentName} onChange={e=>update('parentName',e.target.value)} placeholder="Parent or guardian full name"/></div><div className="form-field form-full"><label htmlFor="rfid-tag">RFID card ID <span className="optional-label">Optional for demo</span></label><input id="rfid-tag" value={form.tag} onChange={e=>update('tag',e.target.value)} placeholder="Leave blank to generate a demo ID"/></div></div>{error&&<div className="form-error"><AlertTriangle size={15}/>{error}</div>}<div className="modal-actions"><span><ShieldCheck size={14}/> Demo records are stored in this browser.</span><div><button type="button" className="button button-ghost" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary"><Plus size={16}/> Add student</button></div></div></form></div></div>;
}
