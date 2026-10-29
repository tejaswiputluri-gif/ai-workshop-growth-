# NxtWave Growth Challenge — growth plan

**Simulation only.** No students were contacted, no registrations were acquired, and no budget was spent. All funnel figures are projections. The challenge target is 500 registrations, not a guarantee.

## 1. Student and strategy

**Primary persona:** Final-year B.Tech CSE (AI & ML) student at a tier-2 or tier-3 engineering college, balancing placements, coursework and project work. Interested in AI, but not yet confident building a complete, explainable project. Likely discovery points: college technical clubs, peer groups and permitted WhatsApp/Telegram communities. The tier and channel habits are planning assumptions to validate, not researched claims.

**Student tension:** “I’ve studied AI, but I’m not sure I can build a working project from scratch.” A free, guided, one-hour build feels practical if the student can see the exact scope, prerequisites and time before registering.

**Value proposition:** Build a small AI project with a guided walkthrough and starter code; leave with a project you can explain. This is not a promise of AI mastery, a placement outcome or a production-ready app.

**Message:** “Final year and still want a hands-on AI project you can actually explain? Build a simple AI chatbot or classifier in 60 minutes, with starter code and a step-by-step walkthrough. Free workshop, Saturday at 7 PM IST. Check the tools and session details before registering.”

**Three insights:** (1) “Free” alone is not a reason to attend; name the project and show its scope. (2) A trusted peer or club share can add context that a generic promotion cannot. (3) A one-hour promise only sounds credible when the project stays small.

**Strategy:** Prioritise club/community distribution and voluntary peer referrals, with permitted group posts and placement communities as support. Four focused channels are easier to track and execute in seven days than a broad campaign. This is a hypothesis, not a result.

**Tempting but risky — evaluated and deliberately rejected:**
- Paid ads: With a ₹2,000 cap over 7 days (~₹285/day), Meta/Google ad algorithms would exhaust the entire budget in the exploratory learning phase without achieving statistical significance. At typical B.Tech student click costs (CPC ₹8–₹15) and 15–20% landing page conversion, ₹2,000 would buy at best 25–40 low-intent registrants. I rejected paid ads because peer/club community distribution delivers higher-intent students at near-zero CAC.
- Bulk cold DMs: Unsolicited LinkedIn or Instagram DMs trigger platform anti-spam blocks, erode student trust, and create brand fatigue. I rejected cold DMs in favor of voluntary peer-to-peer sharing with transparent referral tracking, where students invite peers with whom they actually collaborate.
- Scraped email lists: Scraping college faculty portals or student directories violates privacy expectations, triggers severe email deliverability/domain reputation penalties, and yields high bounce rates. I rejected scraped lists, restricting email outreach strictly to permission-based placement committee and departmental lists.
- A 10-channel plan: Spreading 21 hours of execution over 10 channels leaves ~2 hours per channel—diluting focus, muddying attribution data, and preventing any channel from building critical mass. I rejected channel proliferation to focus exclusively on 4 high-density, measurable student channels.

## 2. Channels and projected funnel

| Channel | Audience/action | Reach | Visits | Visit→registration | Projected registrations | Hours | Budget |
|---|---|---:|---:|---:|---:|---:|---:|
| College technical clubs | Final-year club members; share one specific, approved club post | 5,000 | 600 | 25% | 150 | 5 | ₹350 |
| Student ambassadors/peer referrals | Voluntary student sharing with unique referral links | 3,500 | 525 | 30.1% | 158 | 7 | ₹450 |
| Permitted WhatsApp/Telegram groups | One admin-approved post in relevant groups | 5,000 | 500 | 20% | 100 | 4 | ₹300 |
| Placement communities / appropriate email | Relevant communities and permission-based email only | 7,500 | 600 | 15.3% | 92 | 5 | ₹250 |
| **Total** |  | **21,000** | **2,225** | **22.5% blended** | **500** | **21** | **₹1,350** |

Funnel arithmetic: 2,225 visits ÷ 21,000 projected reach = 10.6% reach-to-visit; 500 ÷ 2,225 visits = 22.5% visit-to-registration. Channel registrations add to **150 + 158 + 100 + 92 = 500**. Reach may overlap, so 21,000 is a planning sum—not verified unique people. Count a unique, valid email once. Attribute it to the first tracked UTM source; store referral attribution separately. Keep unattributed registrations visible as “direct.”

Measurement: one UTM link per club, ambassador, approved group and placement/email community; referral codes identify inviter separately from acquisition source. Track visits and accepted registrations by source; never add one person to multiple channels.

## 3. Seven-day runbook

| Day | Action | Check |
|---|---|---|
| 1 | Finalise assumptions, landing-page copy, QR and source links. | Test every link and form. |
| 2 | Request permission from clubs/group admins; invite volunteers. | Record approvals; do not post without permission. |
| 3 | Begin approved club and community sharing. | Check link visits and broken links. |
| 4 | Start voluntary ambassador/referral sharing. | Check referral code attribution and reward clarity. |
| 5 | Share in relevant placement communities; email only suitable, permission-based lists. | Compare actual counts with projections, if run. |
| 6 | One welcome reminder where permitted; improve unclear copy or form friction. | Reallocate time toward channels converting better. |
| 7 | One factual final reminder where permitted; prepare attendee details. | Report actuals separately from target/projection. |

## 4. Budget, risks and adjustment

| Line | Planned amount |
|---|---:|
| Permission-based club posters and QR material | ₹350 |
| Volunteer coordination/local travel | ₹450 |
| Community coordination/data | ₹300 |
| Email/material preparation | ₹250 |
| Free design/link tracking tools | ₹0 |
| **Planned** | **₹1,350** |
| **Unallocated buffer** | **₹650** |
| **Maximum** | **₹2,000** |

No campaign spend has occurred. Keep the ₹650 buffer unspent unless a permitted activity needs it.

**Risks and response:** If club posts are not approved, do not post—shift effort to approved channels. If visits are low, check link and message clarity before adding channels. If visits do not convert, clarify the exact build, duration and form fields. If the midpoint is below plan, move time toward the best measured channel; do not present 500 as guaranteed. Referral rewards (3 successful referrals for a template pack; 10 for recognition) are proposed assumptions requiring organiser approval.

## 5. Asset and assumptions

**Prototype:** React registration page + FastAPI API + local SQLite, including validation, case-insensitive duplicate-email blocking, referral attribution, public aggregate counts/leaderboard, WhatsApp share link, private token-protected admin metrics/search/CSV and labelled demo records. It is a runnable local prototype, not a live campaign or durable cloud deployment. Do not collect real student data until persistent hosting, access control, consent and retention are reviewed.

**Assumptions to confirm with organiser:** Saturday at 7 PM IST, 60 minutes; Zoom/Google Meet; recording shared with registrants; example chatbot/classifier with AI tool/API and starter code; proposed referral rewards. The student-facing copy and docs mark these as assumptions.
