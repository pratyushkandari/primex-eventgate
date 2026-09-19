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

## 2. Core Workflow & 6-View Information Architecture

The UI is structured as an integrated release-control platform with six primary views accessible via the global header navigation and Command Palette (`⌘K`):

```text
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │ HEADER: EventGate • [Review] [Contracts] [History] [DevTools] [Policies] [Settings]   │
 │         ap-south-1 • production • API ONLINE • ⌘K Search                              │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 The Six Core Platform Workspaces

1. **Review (`ReviewWorkspaceShell`):**
   * The primary product experience for reviewing proposed contract changes and gated publishing.
   * Features a 3-column workstation:
     * **Column 1 (Contract Change):** Event and version selectors, environment selector (`production`, `staging`, `development`), and line-numbered JSON payload code editor with syntax diagnostics. Manual payload modifications automatically unselect preset chips and clear stale analysis.
     * **Column 2 (Release Decision):** Authoritative policy decision hero (`ALLOW`, `REVIEW`, `BLOCK`), impact breakdown, severity badge, and single-click gated publish button.
     * **Column 3 (Downstream Consumers):** Consumer impact matrix with status badges (`SAFE`, `BREAK`, `RISK`), segmented filter tabs, and click-to-open drawer deep dive.
   * **Interactive Dependency Topology:** Node graph connecting Producer $\to$ EventGate $\to$ Consumers with visual muting for unaffected consumers on breaking changes.
   * **Schema Diff & Compatibility Findings:** PR-style diff highlighting added, removed, and type changes with bidirectional cross-linking to affected consumers.
   * **Correlated Publication Evidence:** Real event IDs, EventBridge IDs, and CloudWatch request correlation.

2. **Contracts (`ContractRegistryView`):**
   * Real event contract catalog and consumer explorer.
   * Inspect all registered event types (`OrderPlaced`, `PaymentCompleted`, `UserCreated`).
   * Version Explorer: browse field definitions, types, requiredness, and consumer dependencies.
   * Consumer Explorer: inspect declared consumer dependencies and expectations.

3. **History (`ReleaseHistoryView`):**
   * Authoritative audit trail of evaluated and published changes.
   * Correlated 1-to-1: an analysis request produces a release record; publishing updates that exact record.
   * Explicit Metric Semantics:
     * **Evaluations:** All recorded decisions.
     * **Published:** Successful transport.
     * **Blocked:** Publication prevented.
     * **Review:** Publication held.
   * Multi-dimensional filtering: dedicated Event Type, Environment (`development`, `staging`, `production`), and Decision (`ALLOW`, `REVIEW`, `BLOCK`) dropdown filters, generic text search, and single-click "Clear filters" action.
   * Transport Status Distinction in Audit Drawer: explicitly distinguishes `Published to EventBridge` from `Evaluation only — not published` or `Prevented before EventBridge`.
   * Report Export: Copy Markdown summary or download complete Markdown / JSON audit reports for compliance.

4. **Developer Tools (`DeveloperToolsView`):**
   * **Authoritative State Synchronization:** Selecting a scenario preset (`v1 → v2 SAFE`, `v1 → v3 BREAK`, `v1 → v4 RISK`) atomically synchronizes event type, versions, and suggested decision while immediately clearing any stale execution results.
   * **Execution Snapshot Trace:** Outcome banner displays a compact execution trace (`Executed: OrderPlaced · v1 → v3 · production`) derived directly from the exact request snapshot sent at execution time.
   * **Manual Expectation Controls:** Supports manual expected decision override and single-click reset to suggested scenario expectation.
   * **CLI Command Generator:** Generates exact `eventgate check` commands with copy-to-clipboard affordance.
   * **CI Integration Guide:** Ready-to-copy GitHub Actions release gate configuration.

5. **Policies (`PoliciesView`):**
   * Interactive 3x3 Environment Release Policy Matrix table across `production`, `staging`, and `development`.
   * Decision Pipeline Architecture: Stage 1 Compatibility $\to$ Stage 2 Severity $\to$ Stage 3 Release Policy $\to$ Final Decision.
   * Live Cedar policy language code viewer displaying active Cedar policy statements with syntax-highlighted monospace styling.

6. **Settings (`SettingsView`):**
   * Explicitly labeled **RUNTIME CONFIGURATION** (zero fake telemetry).
   * Grouped into logical sections:
     * **RELEASE CONTEXT:** Target Environment (`production` / `staging` / `development`).
     * **RUNTIME:** Runtime Infrastructure Stack (`primex-eventgate-dev`) and AWS Region (`ap-south-1`).
     * **STORAGE:** Storage Backend (`Amazon DynamoDB`) and backend type (`dynamodb`).
     * **TRANSPORT:** Event Publisher (`Amazon EventBridge`) and Bus Name (`primex-eventgate-dev-bus`).
     * **POLICY:** Release Policy Engine (`Standard Deterministic Engine`).
     * **DEVELOPER:** Resolved Contracts Repository Directory.
   * Preserves the deliberate distinction between Target Environment and Runtime Infrastructure Stack.

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
* **Product Identity:** Displays custom geometric EventGate SVG brand mark and authoritative purpose *"Event compatibility and release gating"* (no redundant version badges).
* **Command Bar Affordance:** Center trigger button with `⌘K` badge for keyboard users.
* **Technical Badges:** Real AWS runtime context: region (`ap-south-1`), interactive environment selector (`production` / `staging` / `development`).
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
* **Two-Tier Authoritative Decision Structure:**
  * **Tier 1 (Schema Compatibility Evaluation):** Displays raw contract compatibility result (`SAFE`, `RISK`, `BREAK`) along with calculated change severity (`LOW`, `MEDIUM`, `HIGH`).
  * **Tier 2 (Release Policy Evaluation):** Authoritative policy gate outcome (`ALLOW`, `REVIEW`, `BLOCK`) evaluated against the active environment (`development`, `staging`, `production`) with explicit policy engine reasoning.
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

### 8. Interactive Dependency Topology Graph (`DependencyTopology`)
* Production graph engine built on `@xyflow/react` rendering an interactive node canvas:
  `Producer Contract (OrderPlaced)` $\to$ `Release Gate (EventGate)` $\to$ `Downstream Consumers (Billing, Inventory, Analytics)`.
* **Custom Node Architecture:**
  * `ProducerNode`: Contract metadata, version transition (`v1 → v3`).
  * `GateNode`: Central release gate with decision indicator and status icon.
  * `ConsumerNode`: Fan-out cards with status badges (`SAFE`, `BREAK`, `RISK`) and inline field diagnostics.
* **Decision-Aware Edges:**
  * `ALLOW`: Emerald animated flow indicating unimpeded event transmission.
  * `BLOCK`: Rose dashed interrupted paths indicating halted transmission.
  * `REVIEW`: Amber dotted held paths indicating manual review required.
* **Canvas Controls:** Interactive pan, scroll zoom, fit-to-view, and slate dot matrix background.
* **Accessibility Fallback (`TopologyFallback`):** Hidden accessible semantic list hierarchy ensuring 100% screen reader compatibility and keyboard activation.

### 9. PR-Style Schema Diff & Findings (`SchemaDiff` & `FindingsPanel`)
* **`SchemaDiff`:** Pull-request code review interface highlighting:
  * Green additions (`+ field added`)
  * Red deletions (`- field removed`)
  * Amber type changes (`~ field: string → object`)
  * Blue requiredness shifts (`⇄ requiredness modified`)
* **Click-to-Crosslink:** Clicking any diff field selects it, immediately highlighting dependent downstream consumers in the matrix and focusing the topology node.
* **`FindingsPanel`:** Diagnostic breakdown of every violated compatibility rule with expandable metadata.

### 10. Operational Pipeline (`EventPath`)
* Visual pipeline tracing: `API Gateway` $\to$ `EventGate` $\to$ `DynamoDB` $\to$ `EventBridge` $\to$ `Consumers`.
* Strictly displays real custom bus name: `primex-eventgate-dev-bus`.
* Differentiates **registered target**, **traffic halted before broker**, and **verified CloudWatch delivery**.

### 11. Toast Notification System (`ToastContainer`)
* Transient floating toasts providing immediate user feedback for:
  * Clipboard copy actions (`Copied Event ID`, `Copied payload`)
  * Editor actions (`Formatted JSON payload`, `Reset payload`)
  * Evaluation results (`Analysis Complete: ALLOW / BLOCK / REVIEW`)
  * Ingestion confirmations (`Event Ingested: ID ...`)

### 12. Runtime API Response Validation (Zod)
* Structural runtime validation enforcing API contracts across all network boundaries without duplicating domain business rules:
  * Enforces `AnalysisResponse`, `PublishResponse`, `ReleaseRecord`, `EventCatalog`, `ConsumerDetail`, `PolicyInspection`, and `RuntimeConfig` schemas.
  * Rejects malformed server responses before they can corrupt UI state or introduce silent undefined bugs.
  * Formats Zod structural violations into actionable diagnostic errors preserving request correlation.

### 13. Accessible Topology Fallback (`TopologyFallback`)
* Semantic text representation and keyboard-accessible control panel paired with the `@xyflow/react` node graph:
  * Enables screen-reader users to navigate the release blast radius hierarchy from Producer $\to$ EventGate $\to$ Consumers.
  * Provides keyboard-interactive consumer cards displaying status badges (`SAFE`, `BREAK`, `RISK`), severity levels, and deep-dive drawer activation.
  * Ensures compliance with WCAG AA accessibility standards even in non-canvas assistive reading environments.

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
| In `⌘K`: type "Review" | Switch to Release Review Workspace | Global |
| In `⌘K`: type "Contracts" | Open Contract Registry & Consumer Explorer | Global |
| In `⌘K`: type "History" | Open Release History Audit Trail | Global |
| In `⌘K`: type "Dev" | Open Developer Tools & Assertion Runner | Global |
| In `⌘K`: type "Policy" | Open Environment Policies & Cedar Viewer | Global |
| In `⌘K`: type "Settings"| Open Authoritative Runtime Configuration | Global |

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
