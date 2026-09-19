# PrimeX EventGate — Best UI Track: Design System & UX Rationale

## 1. Design Philosophy: Enterprise Production Developer Console

The official criteria for the **Best UI** track are design, usability, interaction quality, and visual hierarchy.

EventGate was intentionally designed as an **internal platform developer console for event-contract release gating**. It combines the code-review clarity of GitHub Pull Requests, the keyboard ergonomics of Linear, and the operational precision of Datadog:
* ❌ **No generic AI landing pages:** No marketing fluff, hero hype, or boilerplate illustrations.
* ❌ **No decorative gimmicks:** No cyberpunk neon gradients, particle canvases, or unreadable glowing text.
* ❌ **No synthetic telemetry:** Every status badge, rule ID, and distribution count is computed authoritatively by the backend.
* ❌ **No card sprawl:** Dense, ergonomic workstation layout prioritizing immediate comprehension on 1440px and 1280px displays.

Instead, it embodies the design language of high-caliber engineering systems:
* ✅ **Information Density & Alignment:** 3-column workstation layout paired with a PR review context strip and interactive dependency topology.
* ✅ **Keyboard Ergonomics:** Global Command Palette (`⌘K` / `Ctrl+K`), quick evaluation (`⌘↵` / `Ctrl+Enter`), escape dismissal (`Esc`), and 2-space tab indentation.
* ✅ **Authoritative Semantic States:** Restrained color coding (Emerald for `ALLOW`, Rose for `BLOCK`, Amber for `REVIEW`, Blue for active controls).
* ✅ **Monospace Engineering Precision:** JetBrains Mono typography, 2-space indentation, explicit rule IDs (`EVT001_FIELD_TYPE_CHANGED`), and verbatim backend values.
* ✅ **Bidirectional Cross-Linking:** Clicking a schema diff row cross-highlights downstream consumers depending on that field; clicking a consumer opens the deep inspector drawer.
* ✅ **Subtle Micro-Interactions:** Hover states, focus rings, single-click copy feedback, inline syntax warnings, and responsive transitions.

---

## 2. Core Workflow & Information Architecture

The UI is structured around a single unmistakable question:
> **"We are reviewing a proposed event contract change and deciding whether it can be released to Amazon EventBridge."**

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ HEADER: EventGate • v0.1.0 • ap-south-1 • dev • API Healthy • ⌘K Search│
 ├────────────────────────────────────────────────────────────────────────┤
 │ TRY A CHANGE: [ Safe: v1 → v2 ] [ Breaking: v1 → v3 ] [ Risk: v1 → v4 ]│
 ├────────────────────────────────────────────────────────────────────────┤
 │ PULL REQUEST REVIEW STRIP: OrderPlaced v1 → v3 • Segmented Bar • BLOCK │
 ├──────────────────────────┬──────────────────────────┬──────────────────┤
 │ COLUMN 1                 │ COLUMN 2                 │ COLUMN 3         │
 │ CONTRACT CHANGE          │ RELEASE DECISION         │ CONSUMERS        │
 │ • Event: OrderPlaced     │ • Decision: BLOCK        │ • billing-service│
 │ • Current: v1 (Baseline) │ • Safe / Blocked state   │   SAFE           │
 │ • Proposed: v3 (Breaking)│ • Severity badge         │ • inventory-svc  │
 │ • Payload Code Editor    │ • Action button          │   BREAK (Click)  │
 │   - Line numbers         │   [Publish to Bus /      │ • analytics-svc  │
 │   - Format & Reset       │    Publication Blocked]  │   SAFE           │
 │   - Inline syntax badge  │                          │ • Filter Tabs    │
 ├──────────────────────────┴──────────────────────────┴──────────────────┤
 │ DEPENDENCY TOPOLOGY: Producer (OrderPlaced) ──► Gate ──► 3 Consumers  │
 ├────────────────────────────────────────────────────────────────────────┤
 │ PUBLICATION EVIDENCE: INGESTED • Event ID • EventBridge ID • Request ID│
 ├────────────────────────────────────────────────────────────────────────┤
 │ COMPATIBILITY FINDINGS & SCHEMA DIFF: Diff filters (All/Types/Add/Rem) │
 ├────────────────────────────────────────────────────────────────────────┤
 │ OPERATIONAL EVENT PATH: Producer ──► Gate ──► Broker ──► Consumers     │
 ├────────────────────────────────────────────────────────────────────────┤
 │ RECENT REVIEWS: Browser session history (tab local)                    │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Design System Tokens & Primitives

### Color Palette
* **Canvas Background:** `#090d16` (Deep slate blue; high contrast without harsh pure black).
* **Header Background:** `#0b0f19` (Anchored navigation layer with sticky positioning).
* **Card Surface:** `#0c121e` / `rgba(12, 18, 32, 0.8)` with border `rgba(51, 65, 85, 0.7)` (`border-slate-800`).
* **Code Editor Canvas:** `#0a0e17` with line gutter `#070a10`.
* **Semantic Accents:**
  * **Safe (`ALLOW`):** Emerald (`text-emerald-400`, `bg-emerald-950/20`, `border-emerald-500/30`).
  * **Breaking (`BLOCK`):** Rose (`text-rose-400`, `bg-rose-950/20`, `border-rose-500/30`).
  * **Risky (`REVIEW`):** Amber (`text-amber-400`, `bg-amber-950/20`, `border-amber-500/30`).
  * **Active / Engineering:** Blue (`text-blue-400`, `border-blue-500/40`).

### Typography
* **Primary Sans:** Inter / modern system sans (`font-sans`) for headings, labels, and role descriptions.
* **Technical Monospace:** JetBrains Mono / Fira Code / monospace (`font-mono`) for:
  * Event names (`OrderPlaced`)
  * Version transitions (`v1 → v2`)
  * Field names (`shippingMethod`, `couponCode`)
  * Type representations (`string → object`)
  * Rule identifiers (`EVT001_FIELD_TYPE_CHANGED`, `EVT006_OPTIONAL_FIELD_REMOVED`)
  * Event IDs, EventBridge IDs, Request IDs

---

## 4. Key Component Deep Dives

### 1. Header with Command Palette & Status (`Header`)
* **Product Identity:** Displays version `v0.1.0` and purpose *"Event compatibility and release gating"*.
* **Command Bar Affordance:** Center trigger button with `⌘K` badge for keyboard users.
* **Technical Badges:** Real AWS runtime context: region (`ap-south-1`), environment (`dev`).
* **Live Health Pulse:** Live backend health indicator with pulse, last verified timestamp, and retry button on connection failure.
* **Reference & Shortcuts Trigger:** Help modal toggle with full rule matrix and shortcut cheatsheet.

### 2. Command Palette (`CommandPalette`)
* **Trigger:** Press `⌘K` or `Ctrl+K`, or click the header search bar.
* **Features:**
  * Fuzzy search filtering across actions, scenario presets, editor actions, clipboard tools, and consumer filters.
  * Full keyboard navigation (`↑`/`↓` arrows, `Enter` to execute, `Escape` to dismiss).
  * Direct action execution: Run Analysis, Publish Event, Switch Scenarios, Format JSON, Reset Payload, Inspect Consumers, Copy Event ID.

### 3. Review Context Bar (`ReviewContextBar`)
* Pull Request-style summary strip positioned above the workstation.
* **Visual Segmented Distribution Bar:** Dynamic color-coded bar displaying the proportion of Safe (green), Breaking (rose), and Risky (amber) consumers.
* **Quick Impact Summary:** Shows total affected consumers with single-click filtering.

### 4. Payload Code Editor (`EventInputPanel`)
* Lightweight, high-performance editor without heavy Monaco dependencies.
* **Real-time Validation:** Live syntax badge (`Valid JSON` vs `Syntax Error`).
* **Line Gutter:** Synchronized line numbers with 1-to-1 vertical alignment.
* **Keyboard Ergonomics:** 2-space `Tab` indentation and `Ctrl+Enter` trigger hint.
* **Action Toolbar:** **Copy** (with 1.5s visual feedback), **Format** (beautifies JSON), and **Reset** (restores scenario default).
* **Safety Enforcement:** When syntax errors exist, stale analysis is immediately cleared, and both Analyze and Publish buttons are disabled.

### 5. Release Decision Gate (`DecisionHero`)
* Completely authoritative from the server; never client-recomputed.
* Restrained border highlight (2px left border matching decision severity).
* Distinctive states:
  * **Idle:** *"Ready to Analyze"* with pre-flight check guidance.
  * **Evaluating:** Animated spinner with contract comparison note.
  * **ALLOW:** Green badge, *"Safe to Publish"*, active green publish button.
  * **BLOCK:** Red badge, *"Breaking Change Intercepted"*, impacted consumer and field highlight, disabled button (*"Publication Prevented by Gate"*).
  * **REVIEW:** Amber badge, *"Review Required"*, dependency diagnosis, disabled button.
  * **Invalid JSON:** Clear amber warning preventing submission.

### 6. Downstream Consumers Matrix (`ConsumerImpactPanel`)
* EventGate's signature differentiation: **consumer-aware gating**.
* **Segmented Filter Tabs:** Filter consumers by `ALL (3)`, `AFFECTED (X)`, or `SAFE (Y)`.
* **Interactive Rows:** Clicking any consumer opens the slide-over **Consumer Inspector Drawer**.
* **Bidirectional Cross-Linking:** Highlights consumers when their dependent field is clicked in the schema diff.

### 7. Consumer Inspector Drawer (`ConsumerDrawer`)
* Slide-over modal providing a comprehensive deep dive into a selected consumer:
  * Registered service identifier, role, and registry backend (`Amazon DynamoDB`).
  * Evaluated deterministic rule (`EVT001`, `EVT006`, `EVT008`).
  * Expected vs proposed type transformation preview.
  * Release gate enforcement action breakdown (e.g. *HTTP 409 halted before PutEvents*).

### 8. Dependency Topology Graph (`DependencyTopology`)
* Interactive node diagram tracing:
  `Producer Contract (OrderPlaced)` $\to$ `Release Gate (EventGate)` $\to$ `Downstream Consumers (Billing, Inventory, Analytics)`.
* Nodes display live status badges (`SAFE`, `BREAK`, `RISK`).
* Direct click interaction: Clicking any consumer node opens the Consumer Inspector Drawer.

### 9. Schema Diff & Findings (`FindingsPanel`)
* Styled like a pull-request code review interface.
* **Category Filter Tabs:** Filter modifications by `All`, `Types`, `Added`, `Removed`.
* **Click-to-Crosslink:** Clicking any diff field selects it, immediately highlighting dependent downstream consumers in the matrix.
* **Expandable Diagnostics:** Rule cards with expandable policy enforcement metadata.

### 10. Operational Pipeline (`EventPath`)
* Visual pipeline tracing: `API Gateway` $\to$ `EventGate` $\to$ `EventBridge` $\to$ `Consumers`.
* Strictly displays real custom bus name: `primex-eventgate-dev-bus`.
* Differentiates **registered target**, **traffic halted before broker**, and **verified CloudWatch delivery**.

### 11. Toast Notification System (`ToastContainer`)
* Transient floating toasts providing immediate user feedback for:
  * Clipboard copy actions (`Copied Event ID`, `Copied payload`)
  * Editor actions (`Formatted JSON payload`, `Reset payload`)
  * Evaluation results (`Analysis Complete: ALLOW / BLOCK / REVIEW`)
  * Ingestion confirmations (`Event Ingested: ID ...`)

---

## 5. Accessibility & Keyboard Shortcuts

### Keyboard Shortcuts Cheatsheet
| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| `⌘K` / `Ctrl+K` | Open / Close Command Palette | Global |
| `⌘↵` / `Ctrl+Enter` | Run Compatibility Analysis | Global |
| `Escape` | Dismiss modal, drawer, or command palette | Global |
| `Tab` | Indent 2 spaces in JSON payload editor | Editor |
| `↑` / `↓` | Navigate command palette items | Command Palette |
| `Enter` | Select active command palette item | Command Palette |

### Accessibility (a11y)
* Semantic HTML5 elements (`<header>`, `<main>`, `<section>`, `<textarea>`, `<button>`).
* Visible focus rings on all interactive elements (`focus-visible:ring-2 focus-visible:ring-blue-500`).
* ARIA roles: `dialog` with `aria-modal="true"` for Command Palette, Consumer Drawer, and Shortcuts Modal.
* ARIA labels for icon-only buttons, status indicators, and screen reader announcements.
* High-contrast text adhering to WCAG AA guidelines (slate-100 on dark slate canvas).

---

## 6. Responsive Layout Breakdown

* **1440px+ (Workstation):** 3-column layout (4-col / 4-col / 4-col) maximizing horizontal density and keeping all critical review data above the fold.
* **1280px (Standard Laptop):** Compact density preserving the 3-column structure without horizontal scroll.
* **Tablet (768px - 1024px):** 2-column stacked layout (Editor + Decision top, Consumers + Findings bottom).
* **Mobile (<768px):** Single-column vertical stack with full touch targets and overflow protection.

---

## 7. 3-Minute Demo Video Script & Story Arc

The UI is optimized to tell the complete product story in **under 3 minutes** without hunting through menus:

| Time | Story Phase | UI Focus | Key Action |
| :---: | :--- | :--- | :--- |
| **0:00** | **The Problem** | Header + Workspace | Explain independent schema mutation and consumer breakage. |
| **0:20** | **Safe Change** | Scenario `v1 → v2` | Click "Safe (v1 → v2)". Press `⌘↵` to Analyze. Show `ALLOW` & distribution bar. |
| **0:50** | **Gated Publish** | Decision Hero + Event Path | Click "Publish Event to EventBridge". Show `INGESTED` & EventBridge ID. |
| **1:05** | **Breaking Change** | Scenario `v1 → v3` | Click "Breaking (v1 → v3)". Click "Analyze Compatibility". |
| **1:20** | **Interactive Topology** | Dependency Topology | Point out red branch to `inventory-service`. Click node to open Consumer Drawer. |
| **1:40** | **Cross-Linking** | Findings & Matrix | Click `shippingMethod` in Diff. Show consumer highlight and rule `EVT001`. |
| **1:55** | **Command Palette** | Command Palette | Press `⌘K`. Type "Risk" and press `Enter` to load Scenario v4. |
| **2:15** | **Consumer Drawer** | Consumer Drawer | Open `analytics-service` drawer. Show rule `EVT006` and REVIEW policy. |
| **2:30** | **Payload Safety** | Payload Editor | Delete a bracket. Show inline syntax badge and disabled buttons. |
| **2:45** | **AWS Pipeline** | Event Path + Console | Trace API Gateway $\to$ Lambda $\to$ EventBridge bus `primex-eventgate-dev-bus`. |
| **3:00** | **Conclusion** | Overall Workbench | Summarize: Consumer-aware compatibility prevents production event outages. |
