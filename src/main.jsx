import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL || '';
const TARGET = 500;
const GRADUATION_YEARS = Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - 1 + index);

function getTracking() {
  const query = new URLSearchParams(location.search);
  const saved = JSON.parse(sessionStorage.getItem('growth-attribution') || '{}');
  const referral = query.get('ref') || saved.referral || '';
  const utmSource = saved.utm_source || query.get('utm_source') || '';
  const utmMedium = saved.utm_medium || query.get('utm_medium') || '';
  const utmCampaign = saved.utm_campaign || query.get('utm_campaign') || '';
  const source = saved.source || utmSource || query.get('src') || (referral ? 'referral' : 'direct');
  const visitorId = sessionStorage.getItem('growth-visitor-id') || crypto.randomUUID();
  sessionStorage.setItem('growth-visitor-id', visitorId);
  const tracking = {
    source,
    referral: referral.toUpperCase(),
    visitor_id: visitorId,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
  };
  sessionStorage.setItem('growth-attribution', JSON.stringify(tracking));
  return tracking;
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail;
    throw new Error(detail || 'Something went wrong. Please try again.');
  }
  return data;
}

function App() {
  const tracking = useMemo(getTracking, []);
  const isRegisterPage = location.pathname === '/register';
  const [stats, setStats] = useState({ total: 0, leaderboard: [] });
  const [apiError, setApiError] = useState('');
  const [storageNotice, setStorageNotice] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', phone: '', college: '', branch: '', year: String(new Date().getFullYear() + 1),
    referral_code: tracking.referral, consent: false, website: '',
  });
  const [registered, setRegistered] = useState(null);
  const [referrals, setReferrals] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadStats() {
    try {
      setStats(await api('/api/stats'));
      setApiError('');
    } catch (issue) {
      setApiError(`Live registration data is unavailable: ${issue.message}`);
    }
  }

  useEffect(() => {
    loadStats();
    api('/api/health')
      .then(data => {
        if (data.persistence === 'ephemeral') {
          setStorageNotice('Free demo storage is temporary. Registrations may be lost when Render sleeps, restarts or redeploys this service.');
          } else if (data.persistence === 'unverified') {
            setStorageNotice('Persistent storage is configured but its disk mount could not be verified. Do not rely on registration retention until hosting storage is confirmed.');
          }
      })
      .catch(() => setApiError('Could not verify database health.'));
    api('/api/visit', { method: 'POST', body: JSON.stringify(tracking) })
      .catch(issue => setApiError(`Visit attribution is unavailable: ${issue.message}`));
  }, []);

  useEffect(() => {
    if (!registered) return undefined;
    const refresh = () => api(`/api/me/${encodeURIComponent(registered.code)}`)
      .then(data => setReferrals(data.referrals)).catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 12000);
    return () => window.clearInterval(timer);
  }, [registered]);

  function update(event) {
    const { name, value, checked, type } = event.target;
    setForm(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await api('/api/register', {
        method: 'POST',
        body: JSON.stringify({ ...form, ...tracking, referral_code: form.referral_code }),
      });
      setRegistered(result);
      sessionStorage.setItem('growth-student-code', result.code);
      await loadStats();
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  }

  const shareUrl = registered ? `${location.origin}/?ref=${encodeURIComponent(registered.code)}` : '';
  const progress = Math.min(100, (stats.total / TARGET) * 100);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setError('Referral link copied.');
    } catch {
      setError('Clipboard access was blocked. Select and copy the referral link above.');
    }
  }

  return (
    <main className={isRegisterPage ? 'register-route' : ''}>
      <SiteHeader currentPath={isRegisterPage ? '/register' : '/'} />

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> FREE ONLINE WORKSHOP <span className="eyebrow-divider">·</span> FINAL-YEAR ENGINEERS</div>
          <h1>Build Your First<br />AI Project in<br /><span>60 Minutes.</span></h1>
          <p className="hero-text">Go from “I’ve studied AI” to “I built this.” Follow a beginner-friendly walkthrough and leave with a small project you can explain.</p>
          <div className="hero-actions"><a className="button button-dark" href="/register">Register for free <span>↗</span></a><span className="no-card">No fee. No experience required.</span></div>
          <div className="hero-proof"><div className="avatar-stack"><i>AI</i><i>ML</i><i>60</i></div><span>Made for students who want to <strong>learn by building.</strong></span></div>
        </div>
        <div className="project-card" aria-label="Example project preview">
          <div className="window-head"><div className="window-dots"><i /><i /><i /></div><span>your-first-ai-project.py</span><span className="window-menu">···</span></div>
          <div className="code-body"><div className="code-line"><span className="line-no">01</span><span><b>from</b> <em>your_idea</em> <b>import</b> curiosity</span></div><div className="code-line"><span className="line-no">02</span><span><b>def</b> <em>build_something</em>():</span></div><div className="code-line"><span className="line-no">03</span><span className="indent"><b>project</b> = <strong>"your first AI app"</strong></span></div><div className="code-line"><span className="line-no">04</span><span className="indent"><b>with</b> <em>starter_code</em>:</span></div><div className="code-line"><span className="line-no">05</span><span className="indent indent2"><b>return</b> <strong>"it works!"</strong> <i className="cursor" /></span></div></div>
          <div className="project-foot"><span className="project-icon">✳</span><span><strong>A small AI chatbot or classifier</strong><small>Assumed AI tool/API + starter code</small></span><span className="project-arrow">↗</span></div>
          <div className="float-note"><span>60</span><small>MINUTES<br />TO BUILD</small></div>
        </div>
        <div className="hero-bottom"><span>SCROLL TO EXPLORE <span className="down">↓</span></span><span className="hero-bottom-right">BUILD IT. BREAK IT. UNDERSTAND IT.</span></div>
      </section>

      <section className="details-strip">
        <div><span className="detail-icon">◷</span><span><small>WHEN</small><strong>Date and time to be announced.</strong></span></div>
        <div><span className="detail-icon">◎</span><span><small>WHERE</small><strong>Online · platform to be announced</strong></span></div>
        <div><span className="detail-icon">↗</span><span><small>WHO IT'S FOR</small><strong>Final-year engineering students</strong></span></div>
        <div className="detail-assumption">EVENT DETAILS PENDING ORGANIZER CONFIRMATION</div>
      </section>
      {storageNotice && <div className="storage-warning" role="status"><strong>{storageNotice.startsWith('Free demo') ? 'Temporary demo storage:' : 'Storage warning:'}</strong> {storageNotice}</div>}

      <section className={isRegisterPage ? 'content-grid standalone-register' : 'content-grid'}>
        {isRegisterPage && <div className="register-page-title"><p className="section-kicker">TAKE THE FIRST STEP</p><h1>Register for free<span>.</span></h1><p>Save your seat for the 60-minute AI project workshop.</p></div>}
        <div className="learn-panel">
          <p className="section-kicker">LESS TALK. MORE BUILDING.</p>
          <h2>AI feels less intimidating<br />when you <span>make something.</span></h2>
          <p className="section-copy">A guided, small-scope build helps connect classroom concepts to a working example—without pretending one hour makes anyone an AI expert.</p>
          <div className="steps">
            <div className="step"><span>01</span><div><strong>Start with the idea</strong><p>See what the project does and how its pieces fit together.</p></div><b>↗</b></div>
            <div className="step"><span>02</span><div><strong>Build along</strong><p>Use the assumed starter code and follow each step.</p></div><b>↗</b></div>
            <div className="step"><span>03</span><div><strong>Make it yours</strong><p>Try one change, then learn how to explain what you built.</p></div><b>↗</b></div>
          </div>
          <p className="fine-print">Exact project, tools and recording availability are assumptions until confirmed by the organiser.</p>
        </div>

        <aside className="register-panel" id="register">
          {!registered ? <>
            <div className="register-heading"><div><p className="section-kicker">YOUR NEXT HOUR, WELL SPENT</p><h2>Get your free seat.</h2></div><span className="free-stamp">FREE<br />100%</span></div>
            <p className="form-subtitle">A few details so we can send workshop updates.</p>
            <form onSubmit={submit} className="registration-form">
              <label>Full name<input name="name" autoComplete="name" minLength="2" maxLength="100" required value={form.name} onChange={update} placeholder="e.g. Ananya Rao" /></label>
              <div className="field-row"><label>Email address<input name="email" type="email" autoComplete="email" maxLength="254" required value={form.email} onChange={update} placeholder="you@college.edu" /></label><label>WhatsApp number<input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength="18" pattern="[0-9+()\\s-]{10,18}" required value={form.phone} onChange={update} placeholder="10-digit mobile" /></label></div>
              <label>College<input name="college" autoComplete="organization" maxLength="120" required value={form.college} onChange={update} placeholder="Your college name" /></label>
              <div className="field-row"><label>Branch<select name="branch" required value={form.branch} onChange={update}><option value="">Choose branch</option>{['CSE','CSE (AI/ML)','IT','ECE','EEE','Mechanical','Civil','Other'].map(branch => <option key={branch}>{branch}</option>)}</select></label><label>Graduation year<select name="year" required value={form.year} onChange={update}>{GRADUATION_YEARS.map(year => <option key={year}>{year}</option>)}</select></label></div>
              <label>Referral code <span className="optional">(optional)</span><input name="referral_code" maxLength="24" value={form.referral_code} onChange={update} placeholder="Add a friend's code" /></label>
              <input className="honeypot" name="website" tabIndex="-1" autoComplete="off" value={form.website} onChange={update} aria-hidden="true" />
              <label className="consent"><input type="checkbox" name="consent" required checked={form.consent} onChange={update} /><span>I consent to being contacted by email and WhatsApp about this workshop. My details will only be used for registration and workshop-related updates; I can withdraw consent at any time.</span></label>
              {error && <p className={error.includes('copied') ? 'inline-success' : 'error-message'} role={error.includes('copied') ? 'status' : 'alert'}>{error}</p>}
              <button className="button button-dark submit-button" disabled={busy}>{busy ? 'Saving your seat…' : <>Register for free <span>↗</span></>}</button>
              <p className="privacy-note"><span>⌑</span> Your details are not shown publicly. Consent wording is a prototype, not legal advice.</p>
            </form>
          </> : <div className="success-panel" role="status"><span className="success-icon">✓</span><p className="section-kicker">REGISTRATION CONFIRMED</p><h2>Nice one, {registered.first_name}.</h2><p>Your registration for the free, beginner-friendly 60-minute workshop is confirmed. Date and time to be announced.</p><p>Your unique referral code is <strong className="code-pill">{registered.code}</strong></p><p className="ref-progress"><strong>{Math.min(3, referrals)}/3 referrals</strong> to unlock the assumed project template reward <span>·</span> <strong>{Math.min(10, referrals)}/10</strong> for the assumed recognition certificate <small>({Math.max(0, 3 - referrals)} more for the template)</small></p><p className="fine-print">Referral counts update only when a new student completes registration with your valid code. No invitee details are shown.</p><label>Your personal referral link<input readOnly value={shareUrl} onFocus={event => event.target.select()} /></label><div className="share-actions"><button className="button button-dark" onClick={copyLink}>Copy link</button><a className="button button-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(`I'm joining a free 60-minute AI project workshop for final-year students. Want to build along? ${shareUrl}`)}`} target="_blank" rel="noreferrer">Share on WhatsApp ↗</a></div><div className="page-cta"><a className="text-button" href="/referrals">Open your referral dashboard ↗</a></div>{error && <p className="inline-success" role="status">{error}</p>}<p className="fine-print">Referral rewards are proposed assumptions and need organiser confirmation.</p><button className="text-button" onClick={() => setRegistered(null)}>Back to workshop details</button></div>}
        </aside>
      </section>

      <section className="community">
        <div className="community-copy"><p className="section-kicker">A STUDENT-LED GOAL, NOT A CLAIM</p><h2>Help us reach<br /><span>500 seats.</span></h2><p>Share with a friend who wants a practical first AI build. After registering, get a unique referral link, track successful invites and follow proposed milestones. Rewards are assumptions pending organiser approval.</p><p>Public numbers show aggregate registrations only—not personal details.</p></div>
        <div className="community-stats"><div className="stats-number">{stats.total}<span> / {TARGET}</span></div><div className="progress-track"><div style={{ width: `${progress}%` }} /></div><div className="stats-caption"><span>{Math.round(progress)}% of target</span><span>Registration count · prototype data</span></div>{apiError && <p className="api-status-error" role="status">{apiError}</p>}<div className="leaderboard"><div className="leaderboard-head"><strong>FRIENDS WHO SHARED</strong><span>TOP REFERRERS</span></div>{stats.leaderboard.length ? stats.leaderboard.slice(0, 5).map((person, index) => <div className="leader-row" key={person.code}><span className="leader-rank">0{index + 1}</span><strong>{person.first_name || person.code}</strong><span className="leader-code">{person.code}</span><span className="leader-count">{person.referrals} <small>invites</small></span></div>) : <div className="empty-board">Leaderboard will appear as real referrals arrive. No sample registrations are shown.</div>}</div><p className="projection-note">500 is a planning target, not a confirmed result. No campaign registrations are represented as real.</p><div className="page-cta"><a className="text-button" href="/leaderboard">See top referrers ↗</a><a className="text-button" href="/referrals">Referral dashboard ↗</a></div></div>
      </section>

      <SiteFooter />
    </main>
  );
}

function SiteHeader({ currentPath }) {
  const links = [
    ['Home', '/'],
    ['Workshop Agenda', '/agenda'],
    ['Register', '/register'],
    ['Referral Dashboard', '/referrals'],
    ['Leaderboard', '/leaderboard'],
    ['Admin', '/admin'],
  ];

  return <header className="topbar">
    <a className="brand" href="/" aria-label="NxtWave workshop home"><span className="brand-mark">N</span> NxtWave <span className="brand-label">STUDENT WORKSHOP</span></a>
    <nav className="site-nav" aria-label="Main navigation">
      {links.map(([label, href]) => <a key={href} href={href} aria-current={currentPath === href ? 'page' : undefined}>{label}</a>)}
    </nav>
  </header>;
}

function SiteFooter() {
  return <footer><a className="brand" href="/"><span className="brand-mark">N</span> NxtWave</a><span>Built for students who learn by shipping. <b>✳</b></span><a href="/admin" className="admin-link">Admin dashboard ↗</a></footer>;
}

function AgendaPage() {
  const agenda = [
    ['00–05', 'Welcome and setup', 'Get oriented, check the project scope and make sure the starter materials are ready.'],
    ['05–12', 'Understand the AI project', 'See what the small chatbot or classifier will do and how the main pieces fit together.'],
    ['12–22', 'Follow the guided walkthrough', 'Explore the example, the AI tool/API assumption and the key concepts behind the flow.'],
    ['22–45', 'Build the working version', 'Work through the starter code step by step and verify the core interaction.'],
    ['45–55', 'Try one change', 'Adjust an example, test it and notice how the result changes.'],
    ['55–60', 'Share and wrap up', 'Review what you built, ask a final question and find the next learning step.'],
  ];

  return <main className="page-shell">
    <SiteHeader currentPath="/agenda" />
    <section className="page-content">
      <p className="section-kicker">60 MINUTES · HANDS-ON</p>
      <h1>Workshop agenda<span>.</span></h1>
      <p className="page-lede">A focused, beginner-friendly session designed to help you build and explain one small AI project—not master AI in an hour.</p>
      <div className="agenda-layout">
        <div className="agenda-list">{agenda.map(([time, title, description]) => <article className="agenda-item" key={time}>
          <span className="agenda-time">{time}</span><div><h2>{title}</h2><p>{description}</p></div>
        </article>)}</div>
        <aside className="agenda-aside">
          <p className="section-kicker">GOOD TO KNOW</p>
          <h2>Come curious.<br />Leave with a build.</h2>
          <ul><li>For final-year engineering students.</li><li>No prior AI experience is required.</li><li>A laptop and internet connection are recommended.</li><li>The example project and AI tool/API are assumptions pending organiser confirmation.</li></ul>
          <p className="agenda-assumption">Date and time to be announced. The online platform and recording availability are pending organizer confirmation.</p>
          <a className="button button-dark" href="/register">Register for free <span>↗</span></a>
        </aside>
      </div>
    </section>
    <SiteFooter />
  </main>;
}

function ReferralDashboard() {
  const [code, setCode] = useState(sessionStorage.getItem('growth-student-code') || '');
  const [input, setInput] = useState(sessionStorage.getItem('growth-student-code') || '');
  const [referrals, setReferrals] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const shareUrl = code ? `${location.origin}/?ref=${encodeURIComponent(code)}` : '';

  async function loadReferrals(value) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api(`/api/me/${encodeURIComponent(value.trim())}`);
      const normalizedCode = value.trim().toUpperCase();
      setCode(normalizedCode);
      setInput(normalizedCode);
      setReferrals(result.referrals);
      sessionStorage.setItem('growth-student-code', normalizedCode);
    } catch (issue) {
      setReferrals(null);
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const savedCode = sessionStorage.getItem('growth-student-code');
    if (savedCode) loadReferrals(savedCode);
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage('Referral link copied.');
      setError('');
    } catch {
      setError('Clipboard access was blocked. Select and copy the referral link above.');
    }
  }

  const progressToTemplate = Math.min(100, ((referrals || 0) / 3) * 100);
  const progressToRecognition = Math.min(100, ((referrals || 0) / 10) * 100);

  return <main className="page-shell">
    <SiteHeader currentPath="/referrals" />
    <section className="page-content referral-page">
      <p className="section-kicker">YOUR PEER-SHARING PROGRESS</p>
      <h1>Referral dashboard<span>.</span></h1>
      <p className="page-lede">Share your unique link with friends. Only aggregate referral counts are shown here; registration details stay private.</p>
      {!code && <form className="code-entry" onSubmit={event => { event.preventDefault(); loadReferrals(input); }}>
        <label htmlFor="referral-code">Your referral code</label>
        <div><input id="referral-code" value={input} onChange={event => setInput(event.target.value)} required maxLength="24" placeholder="Enter the code from your registration" /><button className="button button-dark" disabled={busy}>{busy ? 'Loading…' : 'View dashboard'}</button></div>
      </form>}
      {error && <p className="error-message page-message" role="alert">{error}</p>}
      {message && <p className="inline-success page-message" role="status">{message}</p>}
      {code && referrals !== null && <div className="referral-dashboard-grid">
        <article className="referral-card referral-code-card"><p className="section-kicker">YOUR CODE</p><strong className="code-pill">{code}</strong><label htmlFor="personal-referral-link">Personal referral link</label><input id="personal-referral-link" readOnly value={shareUrl} onFocus={event => event.target.select()} /><div className="share-actions"><button className="button button-dark" onClick={copyLink}>Copy link</button><a className="button button-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(`I'm joining a free 60-minute AI project workshop for final-year students. Want to build along? ${shareUrl}`)}`} target="_blank" rel="noreferrer">Share on WhatsApp ↗</a></div></article>
        <article className="referral-card referral-count-card"><p className="section-kicker">SUCCESSFUL REFERRALS</p><strong className="referral-total">{referrals}</strong><p>Friends who completed registration with your code.</p><div className="milestone"><div><strong>Project template pack</strong><span>{Math.min(referrals, 3)} / 3 referrals</span></div><div className="milestone-track"><i style={{ width: `${progressToTemplate}%` }} /></div></div><div className="milestone"><div><strong>Recognition</strong><span>{Math.min(referrals, 10)} / 10 referrals</span></div><div className="milestone-track"><i style={{ width: `${progressToRecognition}%` }} /></div></div><p className="agenda-assumption">Proposed rewards are assumptions and require organiser confirmation.</p></article>
        <article className="referral-card referral-activity"><p className="section-kicker">RECENT ACTIVITY</p><h2>Referral activity is private</h2><p>This prototype does not expose invitee names or a recent-activity feed. Your count updates from completed registrations.</p></article>
      </div>}
      {code && referrals === null && busy && <p className="dashboard-loading" role="status">Loading your referral progress…</p>}
      {code && referrals === null && !busy && <button className="text-button" onClick={() => { setCode(''); setReferrals(null); }}>Enter a different code</button>}
      {!code && <p className="page-footnote">Register first to get a unique code, or enter the code issued to you after registration.</p>}
      <div className="page-cta"><a className="text-button" href="/leaderboard">See the public leaderboard ↗</a><a className="text-button" href="/register">Register for free ↗</a></div>
    </section>
    <SiteFooter />
  </main>;
}

function LeaderboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/stats').then(setStats).catch(issue => setError(`Leaderboard is unavailable: ${issue.message}`));
  }, []);

  return <main className="page-shell">
    <SiteHeader currentPath="/leaderboard" />
    <section className="page-content leaderboard-page">
      <p className="section-kicker">CELEBRATING STUDENT AMBASSADORS</p>
      <h1>Referral leaderboard<span>.</span></h1>
      <p className="page-lede">A privacy-conscious view of successful referrals. Only first names, referral codes and counts are shown; colleges are not included in the public data.</p>
      {error && <p className="error-message page-message" role="alert">{error}</p>}
      {!stats && !error && <p className="dashboard-loading" role="status">Loading the leaderboard…</p>}
      {stats && (stats.leaderboard.length ? <div className="public-leaderboard">
        <div className="public-leaderboard-head"><span>RANK</span><span>STUDENT</span><span>REFERRAL CODE</span><span>SUCCESSFUL REFERRALS</span></div>
        {stats.leaderboard.map((person, index) => <div className="public-leader-row" key={person.code}><span className="public-rank">{String(index + 1).padStart(2, '0')}</span><strong>{person.first_name || 'Student ambassador'}</strong><span className="leader-code">{person.code}</span><strong>{person.referrals}</strong></div>)}
      </div> : <div className="empty-board public-empty">No successful referrals yet. The public leaderboard will appear when students invite friends.</div>)}
      <p className="page-footnote">Demo registrations are excluded. This prototype reports actual records stored locally; it does not represent simulated campaign projections.</p>
      <div className="page-cta"><a className="button button-dark" href="/register">Register for free <span>↗</span></a><a className="text-button" href="/referrals">Open referral dashboard ↗</a></div>
    </section>
    <SiteFooter />
  </main>;
}

function AdminDashboard() {
  const [token, setToken] = useState(sessionStorage.getItem('growth-admin-token') || '');
  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setMessage('');
    try {
      const result = await api('/api/admin/data', { headers: { 'X-Admin-Token': token } });
      setData(result);
      sessionStorage.setItem('growth-admin-token', token);
    } catch (issue) {
      setMessage(issue.message);
      setData(null);
    } finally { setBusy(false); }
  }

  async function demo(method) {
    setBusy(true);
    setMessage('');
    try {
      await api('/api/admin/demo', { method, headers: { 'X-Admin-Token': token } });
      await load();
      setMessage(method === 'POST' ? '40 labelled DEMO records loaded.' : 'DEMO records removed.');
    } catch (issue) { setMessage(issue.message); }
    finally { setBusy(false); }
  }

  async function exportCsv() {
    try {
      const response = await fetch(`${API}/api/admin/export.csv`, { headers: { 'X-Admin-Token': token } });
      if (!response.ok) throw new Error('CSV export failed. Re-authenticate and try again.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'registrations.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (issue) { setMessage(issue.message); }
  }

  const filtered = (data?.registrations || []).filter(row =>
    [row.name, row.email, row.college, row.branch, row.source, row.code,
      row.utm_source, row.utm_medium, row.utm_campaign]
      .join(' ').toLowerCase().includes(query.toLowerCase()));
  const maxDaily = Math.max(1, ...Object.values(data?.daily || {}));
  const maxSource = Math.max(1, ...Object.values(data?.by_source || {}));

  return <main className="admin-page"><header className="topbar"><a className="brand" href="/"><span className="brand-mark">N</span> NxtWave <span className="brand-label">PRIVATE ADMIN</span></a><a href="/" className="top-link">← Public page</a></header>
    <section className="admin-content"><div className="admin-heading"><div><p className="section-kicker">PRIVATE WORKSPACE · NO PERSONAL DATA IS PUBLIC</p><h1>Growth dashboard<span>.</span></h1><p>Registration metrics, attribution and daily trend. Records are stored in the configured SQLite database.</p></div><div className="assumption-badge">TARGET<br /><strong>500</strong></div></div>
      <form className="admin-login" onSubmit={event => { event.preventDefault(); load(); }}><label>Admin token<input type="password" autoComplete="current-password" value={token} onChange={event => setToken(event.target.value)} placeholder="Set ADMIN_TOKEN in backend environment" /></label><button className="button button-dark" disabled={busy}>{busy ? 'Loading…' : 'Load dashboard'}</button>{data && <button className="text-button" type="button" onClick={() => { sessionStorage.removeItem('growth-admin-token'); setToken(''); setData(null); }}>Sign out</button>}</form>
      {message && <p className="admin-message" role={data ? 'status' : 'alert'}>{message}</p>}
      {!data ? <div className="admin-empty">Enter the configured admin token to view personal registration data. The prototype does not ship with a default admin password.</div> : <>
        <div className="metric-grid"><article className="metric-card"><span>ALL REGISTRATIONS</span><strong>{data.total}</strong><small>{data.demo} clearly labelled demo records</small></article><article className="metric-card"><span>REAL REGISTRATIONS</span><strong>{data.real_total}</strong><small>Counted toward the challenge target</small></article><article className="metric-card"><span>PROGRESS TO 500</span><strong>{Math.min(100, Math.round(data.real_total / data.target * 100))}%</strong><small>{data.real_total} / {data.target} projected goal</small></article><article className="metric-card"><span>TRACKED VISITOR CONVERSION</span><strong>{data.conversion_percent === null ? '—' : `${data.conversion_percent}%`}</strong><small>{data.converted_visitors} registered visitors / {data.visits} unique tracked visitors</small></article></div>
        <p className="admin-note">Channel totals use one first-touch source per registration. Referral codes are reported separately and do not add another channel count. Conversion is based on unique tracked visitors who registered.</p>
        <div className="admin-columns"><article className="admin-card"><div className="admin-card-head"><div><p className="section-kicker">ACQUISITION</p><h2>Registrations by channel</h2></div><span className="admin-note">One first-touch channel per registration</span></div>{Object.keys(data.by_source).length ? Object.entries(data.by_source).sort((a,b) => b[1]-a[1]).map(([source, count]) => <div className="bar-row" key={source}><span>{source}</span><div className="mini-track"><i style={{width:`${count/maxSource*100}%`}} /></div><strong>{count}</strong></div>) : <p className="empty-admin">No registrations yet.</p>}</article>
          <article className="admin-card"><div className="admin-card-head"><div><p className="section-kicker">DAILY TREND</p><h2>Registrations per day</h2></div></div>{Object.keys(data.daily).length ? Object.entries(data.daily).map(([day,count]) => <div className="bar-row" key={day}><span>{day.slice(5)}</span><div className="mini-track"><i style={{width:`${count/maxDaily*100}%`}} /></div><strong>{count}</strong></div>) : <p className="empty-admin">No registrations yet.</p>}</article></div>
        <article className="admin-card"><div className="admin-card-head"><div><p className="section-kicker">CAMPAIGN TRACKING</p><h2>UTM attribution</h2></div></div><p>Sources: {Object.entries(data.by_utm_source).map(([key, count]) => `${key} (${count})`).join(' · ') || 'No UTM source tags yet'}</p><p>Mediums: {Object.entries(data.by_utm_medium).map(([key, count]) => `${key} (${count})`).join(' · ') || 'No UTM medium tags yet'}</p><p>Campaigns: {Object.entries(data.by_utm_campaign).map(([key, count]) => `${key} (${count})`).join(' · ') || 'No UTM campaign tags yet'}</p></article>
        <article className="admin-card referrals-card"><div className="admin-card-head"><div><p className="section-kicker">PEER SHARING</p><h2>Registrations attributed by referral code</h2></div></div>{Object.keys(data.by_referral_code).length ? Object.entries(data.by_referral_code).sort((a,b) => b[1]-a[1]).map(([code,count]) => <span className="ref-chip" key={code}>{code} <b>{count}</b></span>) : <p className="empty-admin">No attributed referrals yet.</p>}</article>
        <article className="admin-card"><div className="admin-card-head"><div><p className="section-kicker">REGISTRANT RECORDS · ADMIN ONLY</p><h2>Registrations <span className="record-count">{filtered.length}</span></h2></div><div className="admin-actions"><button className="button button-light" onClick={exportCsv}>Export CSV ↓</button><button className="button button-light" onClick={() => demo('POST')}>Load DEMO data</button><button className="button button-light" onClick={() => demo('DELETE')}>Clear DEMO</button></div></div><input className="search-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, email, college, source, campaign or code…" /><div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>College / branch</th><th>Source / campaign</th><th>Referrer</th><th>Record</th></tr></thead><tbody>{filtered.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.email}</td><td>{row.phone}</td><td>{row.college} · {row.branch}</td><td>{row.source}{row.utm_campaign ? ` · ${row.utm_campaign}` : ''}</td><td>{row.referral_code || '—'}</td><td>{row.is_demo ? <span className="demo-label">DEMO</span> : 'Real'}</td></tr>)}</tbody></table>{filtered.length === 0 && <p className="empty-admin">No matching registrations.</p>}</div></article>
      </>}
      <p className="admin-footnote">SQLite persistence depends on your hosting configuration. Never use demo data as campaign results; review database backups and security before collecting real student data.</p>
    </section>
  </main>;
}

const route = location.pathname.replace(/\/+$/, '') || '/';
const page = route === '/admin' ? <AdminDashboard />
  : route === '/agenda' ? <AgendaPage />
    : route === '/referrals' ? <ReferralDashboard />
      : route === '/leaderboard' ? <LeaderboardPage />
        : <App />;

createRoot(document.getElementById('root')).render(page);
