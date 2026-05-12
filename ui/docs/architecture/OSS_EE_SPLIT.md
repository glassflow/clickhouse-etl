**GlassFlow Enterprise UI Architecture**

_Draft proposal for separating OSS and Enterprise frontend capabilities_

Status: Draft v1
Date: 2026-05-12
Audience: GlassFlow engineering / product / leadership
Authoring assumption: current UI is a single Next.js/React application maintained by one frontend engineer

**Executive recommendation**

Do not start with microfrontends. Do not rely only on client-side runtime feature flags. Use an open-core frontend architecture with: (1) a public OSS UI app/core, (2) enterprise-only UI modules kept in clearly licensed private or separately licensed directories/packages, (3) build-time composition for OSS vs EE distributions, and (4) backend-provided license capabilities for runtime UX gating. Backend remains the security and entitlement source of truth.

# 1\. Decision summary

The UI should mirror the backend open-core model, but not copy backend package structure mechanically. Frontend separation is harder because UI features cross routes, navigation, forms, configuration schemas, empty states, documentation links, analytics, and upgrade prompts. Therefore the split must be product-feature based, not merely folder based.

- Best viable direction: single product shell with build-time edition composition and runtime capability gating.
- Keep the OSS experience clean and complete. Do not ship a broken dashboard full of locked controls.
- Keep Enterprise business enforcement on the backend. The frontend is only a presentation and routing layer.
- Keep Enterprise source code out of the OSS distribution unless the company deliberately chooses a source-available model.
- Avoid microfrontends unless GlassFlow later has multiple frontend teams, independently deployed UI domains, or a real plugin marketplace.

**Blunt assessment**

For a one-person frontend team, microfrontends are architectural cosplay. They will create more release, routing, styling, state, dependency, and QA problems than they solve. A modular monolith with explicit edition boundaries is the correct maturity level.

# 2\. Options compared

```markdown
| Option                                                    | Description                                                                                                              | Legal clarity | Engineering complexity |  UX quality | Recommendation                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------: | ---------------------: | ----------: | ----------------------------------------------------------------------------------- |
| **A. One codebase + runtime gates only**                  | All UI code ships together. Backend returns feature map/license capabilities. UI hides or locks enterprise surfaces.     |   Weak–medium |                    Low |      Medium | Useful as a gating layer, but not sufficient as the full split.                     |
| **B. Single repo / monorepo with differential licensing** | OSS core plus enterprise directories/packages with clear license boundaries. OSS and EE builds are composed differently. | Medium–strong |                 Medium |        High | **Best default** if proprietary code can live in the same repo or private monorepo. |
| **C. Public OSS repo + private EE overlay repo**          | EE app imports OSS UI as a package/module and registers enterprise modules from a private repo.                          |        Strong |            Medium–high |        High | **Best option** if the OSS repo must remain clean and fully public.                 |
| **D. Microfrontends / plugin apps**                       | Core shell loads separate enterprise apps/modules at runtime or deploy time.                                             |        Strong |                   High | Medium–risk | Future architecture. Not for MVP.                                                   |
| **E. Fully separate OSS and EE apps**                     | Two independently maintained UI apps with shared components copied or packaged.                                          |        Strong |              Very high |  Low–medium | Avoid. Drift and duplicated work compound quickly.                                  |
```

# 3\. Recommended architecture

Use a modular open-core UI with explicit edition boundaries. The architecture should support two distributions:

- OSS UI distribution: only Apache/MIT-compatible OSS code and features.
- Enterprise UI distribution: OSS UI plus enterprise-only modules, routes, panels, settings, schema registry flows, observability UI, DLQ reprocessing, pipeline versioning, multi-environment workflows, advanced sinks, RBAC/audit views, and commercial upgrade surfaces.

## 3.1 Core principle: build-time inclusion, runtime authorization

Do both. Build-time inclusion controls what code is present in a distribution. Runtime authorization controls what the logged-in user or installed instance is allowed to use.

- Build-time inclusion answers: is this enterprise source code part of this binary/container/static bundle?
- Runtime authorization answers: does this particular instance/user/license have access to this capability right now?
- Backend enforcement answers: can this action actually be executed? This is mandatory and cannot be delegated to the UI.

**Why both layers matter**

A pure runtime-gated UI still exposes enterprise implementation code to every OSS user. A pure build-time split still needs runtime capability checks because Enterprise customers may have different plans, expired licenses, disabled modules, roles, or partial entitlements.

## 3.2 Proposed package/module structure

The exact names can change, but the boundary should be deliberate and boring:

apps/
ui-oss/ # OSS app entry point / build target
ui-ee/ # EE app entry point / build target, private or separately licensed
packages/
ui-core/ # app shell, layout, routing contracts, common providers
ui-components/ # shared design system, shadcn wrappers, tokens
ui-pipeline-core/ # OSS pipeline creation, Kafka/ClickHouse basics, config review
ui-capabilities/ # capability types, feature registry, guards, license client
ui-enterprise-modules/ # EE-only feature modules; private or commercial license
ui-enterprise-components/ # EE-only UI components if needed

If GlassFlow wants the public OSS repository to contain no proprietary code, then keep \`ui-enterprise-modules\` and \`apps/ui-ee\` in a private repo. If GlassFlow is comfortable with source-available enterprise code, keep it in a separate top-level directory with explicit license files. Do not blur this boundary.

## 3.3 Feature registry

Introduce a central registry where modules declare routes, navigation items, dashboard cards, settings panels, pipeline steps, validation enrichments, and empty-state CTAs. The app shell should not import random enterprise components directly.

type CapabilityKey =
| 'pipeline.create.basic'
| 'pipeline.schemaRegistry'
| 'pipeline.dlq.reprocess'
| 'pipeline.versioning'
| 'observability.internal'
| 'admin.auditLog'
| 'sink.advanced';
<br/>type GlassFlowModule = {
id: string;
edition: 'oss' | 'enterprise';
requiredCapabilities?: CapabilityKey\[\];
routes?: RouteContribution\[\];
navItems?: NavigationContribution\[\];
pipelineSteps?: PipelineStepContribution\[\];
settingsPanels?: SettingsContribution\[\];
};

OSS build registers OSS modules only. EE build registers OSS modules plus enterprise modules. Runtime capability checks determine whether a registered enterprise contribution is visible, locked, or usable.

## 3.4 Capability service contract

The backend should expose a stable entitlement/capabilities endpoint. Keep it boring and explicit.

GET /api/v1/license/capabilities
{
"edition": "oss" | "enterprise",
"licenseStatus": "active" | "expired" | "missing" | "invalid",
"plan": "community" | "team" | "enterprise",
"capabilities": {
"pipeline.create.basic": true,
"pipeline.schemaRegistry": true,
"pipeline.dlq.reprocess": false,
"observability.internal": true,
"admin.auditLog": true
},
"limits": {
"pipelines": 25,
"environments": 3
**GlassFlow Enterprise UI Architecture**

_Draft proposal for separating OSS and Enterprise frontend capabilities_

Status: Draft v1
Date: 2026-05-12
Audience: GlassFlow engineering / product / leadership
Authoring assumption: current UI is a single Next.js/React application maintained by one frontend engineer

**Executive recommendation**

Do not start with microfrontends. Do not rely only on client-side runtime feature flags. Use an open-core frontend architecture with: (1) a public OSS UI app/core, (2) enterprise-only UI modules kept in clearly licensed private or separately licensed directories/packages, (3) build-time composition for OSS vs EE distributions, and (4) backend-provided license capabilities for runtime UX gating. Backend remains the security and entitlement source of truth.

# 1\. Decision summary

The UI should mirror the backend open-core model, but not copy backend package structure mechanically. Frontend separation is harder because UI features cross routes, navigation, forms, configuration schemas, empty states, documentation links, analytics, and upgrade prompts. Therefore the split must be product-feature based, not merely folder based.

- Best viable direction: single product shell with build-time edition composition and runtime capability gating.
- Keep the OSS experience clean and complete. Do not ship a broken dashboard full of locked controls.
- Keep Enterprise business enforcement on the backend. The frontend is only a presentation and routing layer.
- Keep Enterprise source code out of the OSS distribution unless the company deliberately chooses a source-available model.
- Avoid microfrontends unless GlassFlow later has multiple frontend teams, independently deployed UI domains, or a real plugin marketplace.

**Blunt assessment**

For a one-person frontend team, microfrontends are architectural cosplay. They will create more release, routing, styling, state, dependency, and QA problems than they solve. A modular monolith with explicit edition boundaries is the correct maturity level.

# 2\. Options compared

| **Option**                                              | **Description**                                                                                                      | **Legal clarity** | **Eng. complexity** | **UX quality** | **Recommendation**                                                                  |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------- | -------------- | ----------------------------------------------------------------------------------- |
| **A.** One codebase + runtime gates only                | All UI code ships together; backend returns feature map/license capabilities; UI hides/locks enterprise surfaces.    | Weak–medium       | Low                 | Medium         | Useful as a gating layer, not sufficient as the full split.                         |
| **B.** Single repo/monorepo with differential licensing | OSS core plus enterprise directories/packages with clear license boundaries; OSS and EE builds composed differently. | Medium–strong     | Medium              | High           | **Best default** if proprietary code can live in the same repo or private monorepo. |
| **C.** Public OSS repo + private EE overlay repo        | EE app imports OSS UI as a package/module and registers enterprise modules from a private repo.                      | Strong            | Medium–high         | High           | **Best** if the OSS repo must remain clean and fully public.                        |
| **D.** Microfrontends / plugin apps                     | Core shell loads separate enterprise apps/modules at runtime or deploy time.                                         | Strong            | High                | Medium–risk    | Future architecture. Not for MVP.                                                   |
| **E.** Fully separate OSS and EE apps                   | Two independently maintained UI apps with shared components copied or packaged.                                      | Strong            | Very high           | Low–medium     | Avoid. Drift and duplicated work compound quickly.                                  |

# 3\. Recommended architecture

Use a modular open-core UI with explicit edition boundaries. The architecture should support two distributions:

- OSS UI distribution: only Apache/MIT-compatible OSS code and features.
- Enterprise UI distribution: OSS UI plus enterprise-only modules, routes, panels, settings, schema registry flows, observability UI, DLQ reprocessing, pipeline versioning, multi-environment workflows, advanced sinks, RBAC/audit views, and commercial upgrade surfaces.

## 3.1 Core principle: build-time inclusion, runtime authorization

Do both. Build-time inclusion controls what code is present in a distribution. Runtime authorization controls what the logged-in user or installed instance is allowed to use.

- Build-time inclusion answers: is this enterprise source code part of this binary/container/static bundle?
- Runtime authorization answers: does this particular instance/user/license have access to this capability right now?
- Backend enforcement answers: can this action actually be executed? This is mandatory and cannot be delegated to the UI.

**Why both layers matter**

A pure runtime-gated UI still exposes enterprise implementation code to every OSS user. A pure build-time split still needs runtime capability checks because Enterprise customers may have different plans, expired licenses, disabled modules, roles, or partial entitlements.

## 3.2 Proposed package/module structure

The exact names can change, but the boundary should be deliberate and boring:

apps/
ui-oss/ # OSS app entry point / build target
ui-ee/ # EE app entry point / build target, private or separately licensed
packages/
ui-core/ # app shell, layout, routing contracts, common providers
ui-components/ # shared design system, shadcn wrappers, tokens
ui-pipeline-core/ # OSS pipeline creation, Kafka/ClickHouse basics, config review
ui-capabilities/ # capability types, feature registry, guards, license client
ui-enterprise-modules/ # EE-only feature modules; private or commercial license
ui-enterprise-components/ # EE-only UI components if needed

If GlassFlow wants the public OSS repository to contain no proprietary code, then keep \`ui-enterprise-modules\` and \`apps/ui-ee\` in a private repo. If GlassFlow is comfortable with source-available enterprise code, keep it in a separate top-level directory with explicit license files. Do not blur this boundary.

## 3.3 Feature registry

Introduce a central registry where modules declare routes, navigation items, dashboard cards, settings panels, pipeline steps, validation enrichments, and empty-state CTAs. The app shell should not import random enterprise components directly.

type CapabilityKey =
| 'pipeline.create.basic'
| 'pipeline.schemaRegistry'
| 'pipeline.dlq.reprocess'
| 'pipeline.versioning'
| 'observability.internal'
| 'admin.auditLog'
| 'sink.advanced';
<br/>type GlassFlowModule = {
id: string;
edition: 'oss' | 'enterprise';
requiredCapabilities?: CapabilityKey\[\];
routes?: RouteContribution\[\];
navItems?: NavigationContribution\[\];
pipelineSteps?: PipelineStepContribution\[\];
settingsPanels?: SettingsContribution\[\];
};

OSS build registers OSS modules only. EE build registers OSS modules plus enterprise modules. Runtime capability checks determine whether a registered enterprise contribution is visible, locked, or usable.

## 3.4 Capability service contract

The backend should expose a stable entitlement/capabilities endpoint. Keep it boring and explicit.

GET /api/v1/license/capabilities
{
"edition": "oss" | "enterprise",
"licenseStatus": "active" | "expired" | "missing" | "invalid",
"plan": "community" | "team" | "enterprise",
"capabilities": {
"pipeline.create.basic": true,
"pipeline.schemaRegistry": true,
"pipeline.dlq.reprocess": false,
"observability.internal": true,
"admin.auditLog": true
},
"limits": {
"pipelines": 25,
"environments": 3
}
}

The UI should cache this response carefully, refresh it after license changes, and degrade safely. A missing or failed capability response should not accidentally unlock enterprise functionality.

# 4\. Approach A: one codebase with runtime gates only

This is the fastest implementation but the weakest as a product packaging strategy.

### Pros

- Very simple developer workflow.
- No build matrix at the beginning.
- Easy to show upgrade prompts and locked states.
- Works well if the company chooses source-available distribution for all UI code.
- Backend remains the real security boundary.

### Cons

- Enterprise UI implementation code is shipped to OSS users.
- May create confusion if the OSS repo appears to contain commercial features but users cannot use them.
- Can weaken perceived open-source trust if not documented transparently.
- Tree-shaking and route splitting will not solve legal/source distribution concerns.
- Harder to claim a clean OSS artifact if commercial surfaces are bundled into the same UI.

### Use it when

- You need a very fast prototype and legal/product leadership accepts source-available enterprise UI code.
- You are not yet publicly distributing separate OSS and EE UI artifacts.

### Do not use it when

- You need the public OSS distribution to contain only OSS-licensed source and artifacts.
- Enterprise customers or procurement teams will inspect the repo/artifact and expect clean license boundaries.

# 5\. Approach B: single repo/monorepo with differential licensing

This is the best engineering compromise if GlassFlow can keep OSS and EE source in one repository or one internal monorepo. It matches how many open-core products evolve: one product, one architecture, explicit license boundaries, different distributions.

### Pros

- One coherent product architecture.
- No duplicated UI app logic.
- Shared design system and shared feature contracts remain consistent.
- Build-time separation prevents EE source from entering OSS bundles.
- Runtime gating remains available for plan/user/license differences.
- Low enough complexity for a one-person frontend team if the module contract is disciplined.

### Cons

- Requires strict import boundaries and CI checks.
- Requires explicit license files per enterprise directory/package.
- Potential discomfort from OSS contributors if proprietary directories are visible in the same repository.
- Requires release discipline: OSS and EE builds must be tested separately.

### Implementation notes

- Use path aliases that make boundaries obvious: \`@gf/core/\*\`, \`@gf/oss/\*\`, \`@gf/ee/\*\`.
- Create an \`edition\` build variable, but do not scatter \`if (edition === 'enterprise')\` everywhere. Centralize edition logic in module registration.
- OSS modules must not import EE modules. Enforce this with ESLint boundaries, TypeScript project references, or package-level dependency rules.
- The OSS build should fail if EE files enter the dependency graph.
- The EE build should be the OSS build plus registered EE modules, not a forked app.

# 6\. Approach C: public OSS repo + private EE overlay

This is the cleanest legal/source distribution model if the public repo must remain truly OSS-only. The EE repo imports the OSS UI as a dependency or submodule/workspace and contributes enterprise modules through the same registry contracts.

### Pros

- Strong public/private boundary.
- OSS users do not receive enterprise source code.
- Enterprise repo can have its own license, release process, and customer artifacts.
- Good story for procurement and compliance: OSS artifact is clean, EE artifact is commercial.

### Cons

- More setup overhead than a single monorepo.
- Cross-repo changes become slower, especially for shared contracts.
- Version compatibility must be managed carefully between OSS package and EE overlay.
- Local development can become annoying if not scripted well.

### Implementation notes

- Keep shared extension contracts in OSS: feature registry, route contribution types, pipeline step interfaces, design tokens, capability types.
- Keep enterprise implementations private: DLQ reprocessing screens, schema registry flow, audit log screens, advanced sinks, environment/versioning UI.
- Use changesets or strict versioning so EE always declares which OSS UI version it supports.
- Invest early in one command for local EE development, e.g. \`pnpm dev:ee\`, otherwise the overlay model will feel painful.

# 7\. Approach D: microfrontends or runtime plugins

This sounds attractive because enterprise features become separately deployable or pluggable. In practice, it is overkill unless the organization has multiple independent frontend teams or third-party extension requirements.

### Pros

- Strong module isolation.
- Potentially independent deployment/versioning of enterprise surfaces.
- Can support a future plugin marketplace or customer-specific modules.
- Can keep proprietary functionality physically separate from the OSS shell.

### Cons

- High operational complexity for routing, auth, shared state, styling, dependency versions, error boundaries, observability, and testing.
- Worse local development experience.
- More ways to create an inconsistent product experience.
- Runtime loading creates failure modes that a data infrastructure product does not need early.
- One frontend engineer will spend too much time maintaining infrastructure instead of shipping customer value.

### Use it later if

- GlassFlow has multiple frontend teams or separately deployed enterprise domains.
- Customers require installable plugins developed outside the core team.
- The UI becomes a platform with stable public extension APIs.

# 8\. Concrete recommendation for GlassFlow

- Phase 1: Introduce a capability model and UI feature registry inside the current app. Do not split apps yet.
- Phase 2: Move enterprise candidate UI features behind module boundaries, not scattered flags.
- Phase 3: Add build-time edition composition: OSS build registers only OSS modules; EE build registers OSS + EE modules.
- Phase 4: Decide legal repository shape: same repo with differential licensing, or public OSS repo plus private EE overlay.
- Phase 5: Add CI enforcement: import boundaries, license scanning, OSS artifact inspection, EE artifact inspection, capability contract tests.
- Phase 6: Only revisit microfrontends if the plugin/platform need becomes real, not imagined.

**Recommended target architecture**

Public OSS app/core + private or separately licensed Enterprise modules. Build-time composition controls source/artifact separation. Backend capability endpoint controls runtime UX. Backend API enforces all actual permissions and license checks.

# 9\. What belongs in OSS vs Enterprise

Do not split by implementation difficulty. Split by buyer value and persona. Keep core developer adoption strong; monetize operational, governance, scale, compliance, and team workflows.

| **Area**          | **OSS candidate**                                                          | **Enterprise candidate**                                                                          |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Pipeline creation | Basic Kafka to ClickHouse pipeline wizard; config review; basic validation | Advanced guided flows, reusable templates, AI-assisted creation, multi-environment promotion      |
| Connectors        | Basic Kafka and ClickHouse connection setup                                | Saved shared connections, secrets integration, advanced sinks, enterprise auth modes              |
| Schemas           | Sample-event inference and manual JSON schema input                        | Schema Registry integration, Avro/Protobuf flows, schema version selection, schema evolution UI   |
| Operations        | Pipeline list, status, start/stop, basic logs                              | DLQ stats and reprocessing, replay workflows, internal observability UI, advanced troubleshooting |
| Governance        | Single-user/simple project usage                                           | RBAC, audit logs, approvals, environment separation, versioning                                   |
| Supportability    | Basic documentation links                                                  | Diagnostics bundle, support export, health reports, SLA-oriented views                            |

# 10\. UX rules for locked or unavailable features

- Do not show locked enterprise controls inside critical OSS workflows if they block completion.
- Use upgrade prompts only where the user has intent: empty states, advanced tabs, settings, admin areas, and contextual explanations.
- Never let users fill a long form and only then discover that the final action is enterprise-only.
- For missing license, show clear reason: not included, expired, invalid, role not allowed, backend unavailable.
- For OSS users, preserve dignity. The product should feel useful, not like a crippled demo.
- Use capability-aware route guards. Deep links to enterprise routes should show an explanatory access page, not crash or redirect mysteriously.

# 11\. CI/CD and release requirements

- Run separate \`build:oss\` and \`build:ee\` jobs.
- Run bundle/source inspection to ensure EE modules are absent from OSS build artifacts.
- Run import-boundary checks: OSS packages cannot import EE packages.
- Run license scanning for npm dependencies and manually verify vendored CSS/JS/assets.
- Run capability contract tests against mocked backend responses: active, missing, expired, invalid, partial capabilities.
- Run visual smoke tests for both editions: navigation, route guards, wizard path, enterprise locked state, enterprise unlocked state.
- Generate clear SBOM/license notices per distribution.

# 12\. Common pitfalls

- Scattering feature checks across components. This turns licensing into spaghetti.
- Treating frontend gating as security. It is not. The API must enforce everything.
- Building the OSS UI as an afterthought. OSS adoption is the top of the enterprise funnel.
- Creating separate apps too early. Product drift will appear immediately.
- Letting enterprise modules mutate shared state contracts without versioning.
- Using environment variables as the only edition boundary. They are useful but insufficient without import/build checks.
- Making every feature configurable before product boundaries are known. Start with explicit modules, not an abstract plugin platform.
- Shipping enterprise code in OSS artifacts accidentally through shared barrel exports.
- Hiding features entirely when upgrade education would help, or showing too many locked features when it damages OSS trust.

# 13\. Anti-patterns to avoid at any cost

- Microfrontends as a licensing solution for a one-person frontend team.
- Two long-lived frontend forks: \`ui-oss\` and \`ui-enterprise\` with copied components and divergent workflows.
- Backend says feature is disabled, but UI still enables the route/action because of stale local flags.
- Enterprise route imports from OSS core through circular dependencies.
- A public OSS repo containing enterprise implementation code without explicit licensing and product explanation.
- A license check sprinkled inside every button, form, and table row.
- A design system fork for EE. Enterprise features should look native, not like another product.
- An OSS product that is basically a teaser page for Enterprise. Developers will smell that immediately.

# 14\. Decision matrix

| **Criterion**                       | **Runtime gates only** | **Monorepo differential licensing** | **Private EE overlay**             | **Microfrontends** |
| ----------------------------------- | ---------------------- | ----------------------------------- | ---------------------------------- | ------------------ |
| Speed to start                      | Excellent              | Good                                | Medium                             | Poor               |
| Legal/source clarity                | Weak                   | Good                                | Excellent                          | Excellent          |
| One-person frontend maintainability | Excellent              | Good                                | Medium                             | Poor               |
| OSS artifact cleanliness            | Weak                   | Good if enforced                    | Excellent                          | Excellent          |
| Product consistency                 | Good                   | Excellent                           | Good                               | Medium-risk        |
| Long-term extensibility             | Medium                 | High                                | High                               | High but expensive |
| Recommended now                     | Partial only           | Yes                                 | Yes if public/private split needed | No                 |

# 15\. First implementation backlog

## Epic 1: Capability model

- Define \`CapabilityKey\` enum/type shared with backend contract.
- Create \`useCapabilities()\` hook and provider.
- Create backend mock fixtures for OSS, EE active, EE expired, partial license.
- Add route guard and component-level capability helper.

## Epic 2: Feature registry

- Create module contribution interface.
- Move navigation and route contributions into registry.
- Convert at least one existing pipeline step into a registered contribution.
- Add tests to ensure missing capabilities hide/lock registered contributions predictably.

## Epic 3: Edition builds

- Add \`build:oss\` and \`build:ee\` scripts.
- Create OSS module registry and EE module registry.
- Add CI check that OSS build contains no \`@gf/ee\` imports or chunks.
- Generate per-edition license/notice files.

## Epic 4: First enterprise module

- Pick one narrow feature, not the whole enterprise program. Recommended: Schema Registry UI or DLQ reprocessing UI.
- Build it as an EE module contribution.
- Verify OSS build has clean absence or intentional locked/upgrade surface.
- Verify API rejects access without valid license even if UI route is forced manually.

# 16\. Open questions for legal/product/engineering

- Will the public repository contain any enterprise source-available code, or must it remain OSS-only?
- Will GlassFlow ship separate Docker images/artifacts for OSS and EE, or one artifact with license activation?
- Which exact license will apply to enterprise UI code: ELv2, proprietary commercial license, or another source-available license?
- Which features are paid because of customer value, not because they were easy to isolate technically?
- What is the expected procurement story for self-hosted enterprise customers inspecting frontend artifacts?
- Should OSS users see upgrade prompts at all, or should Enterprise surfaces be absent from OSS builds?
- How will backend capability keys be versioned and documented?

# 17\. Suggested final decision

Adopt Approach B or C, depending on the repository/legal decision:

- If enterprise source can live next to OSS source with explicit licenses: choose Approach B.
- If the public OSS repository must stay clean: choose Approach C.
- In both cases, implement the same frontend architecture: module registry, build-time edition composition, runtime capability gating, backend enforcement.
- Do not choose microfrontends now. Revisit only when there is a real multi-team or plugin-platform requirement.

# 18\. References and industry signals

- GitLab documents two distributions: Community Edition and Enterprise Edition, and states that it now operates under a single codebase.
- GitLab licensing documentation distinguishes CE under MIT terms and EE under a more restrictive EE license, and highlights automated dependency license checks.
- GrowthBook describes itself as open core, with most code under MIT and several directories governed by a separate commercial enterprise license.
- Elastic's ELv2 FAQ explains a source-available model with free use, modification, redistribution, and three limitations including not circumventing license key functionality.
- Open Core Ventures argues that open-core splits should be feature/persona based rather than mechanically split by codebase; it also recommends explicit license files for different directories when differential licensing is used.

Note: this document is an architecture draft, not legal advice. Final licensing and distribution decisions should be reviewed by counsel.}
}

The UI should cache this response carefully, refresh it after license changes, and degrade safely. A missing or failed capability response should not accidentally unlock enterprise functionality.

# 4\. Approach A: one codebase with runtime gates only

This is the fastest implementation but the weakest as a product packaging strategy.

### Pros

- Very simple developer workflow.
- No build matrix at the beginning.
- Easy to show upgrade prompts and locked states.
- Works well if the company chooses source-available distribution for all UI code.
- Backend remains the real security boundary.

### Cons

- Enterprise UI implementation code is shipped to OSS users.
- May create confusion if the OSS repo appears to contain commercial features but users cannot use them.
- Can weaken perceived open-source trust if not documented transparently.
- Tree-shaking and route splitting will not solve legal/source distribution concerns.
- Harder to claim a clean OSS artifact if commercial surfaces are bundled into the same UI.

### Use it when

- You need a very fast prototype and legal/product leadership accepts source-available enterprise UI code.
- You are not yet publicly distributing separate OSS and EE UI artifacts.

### Do not use it when

- You need the public OSS distribution to contain only OSS-licensed source and artifacts.
- Enterprise customers or procurement teams will inspect the repo/artifact and expect clean license boundaries.

# 5\. Approach B: single repo/monorepo with differential licensing

This is the best engineering compromise if GlassFlow can keep OSS and EE source in one repository or one internal monorepo. It matches how many open-core products evolve: one product, one architecture, explicit license boundaries, different distributions.

### Pros

- One coherent product architecture.
- No duplicated UI app logic.
- Shared design system and shared feature contracts remain consistent.
- Build-time separation prevents EE source from entering OSS bundles.
- Runtime gating remains available for plan/user/license differences.
- Low enough complexity for a one-person frontend team if the module contract is disciplined.

### Cons

- Requires strict import boundaries and CI checks.
- Requires explicit license files per enterprise directory/package.
- Potential discomfort from OSS contributors if proprietary directories are visible in the same repository.
- Requires release discipline: OSS and EE builds must be tested separately.

### Implementation notes

- Use path aliases that make boundaries obvious: \`@gf/core/\*\`, \`@gf/oss/\*\`, \`@gf/ee/\*\`.
- Create an \`edition\` build variable, but do not scatter \`if (edition === 'enterprise')\` everywhere. Centralize edition logic in module registration.
- OSS modules must not import EE modules. Enforce this with ESLint boundaries, TypeScript project references, or package-level dependency rules.
- The OSS build should fail if EE files enter the dependency graph.
- The EE build should be the OSS build plus registered EE modules, not a forked app.

# 6\. Approach C: public OSS repo + private EE overlay

This is the cleanest legal/source distribution model if the public repo must remain truly OSS-only. The EE repo imports the OSS UI as a dependency or submodule/workspace and contributes enterprise modules through the same registry contracts.

### Pros

- Strong public/private boundary.
- OSS users do not receive enterprise source code.
- Enterprise repo can have its own license, release process, and customer artifacts.
- Good story for procurement and compliance: OSS artifact is clean, EE artifact is commercial.

### Cons

- More setup overhead than a single monorepo.
- Cross-repo changes become slower, especially for shared contracts.
- Version compatibility must be managed carefully between OSS package and EE overlay.
- Local development can become annoying if not scripted well.

### Implementation notes

- Keep shared extension contracts in OSS: feature registry, route contribution types, pipeline step interfaces, design tokens, capability types.
- Keep enterprise implementations private: DLQ reprocessing screens, schema registry flow, audit log screens, advanced sinks, environment/versioning UI.
- Use changesets or strict versioning so EE always declares which OSS UI version it supports.
- Invest early in one command for local EE development, e.g. \`pnpm dev:ee\`, otherwise the overlay model will feel painful.

# 7\. Approach D: microfrontends or runtime plugins

This sounds attractive because enterprise features become separately deployable or pluggable. In practice, it is overkill unless the organization has multiple independent frontend teams or third-party extension requirements.

### Pros

- Strong module isolation.
- Potentially independent deployment/versioning of enterprise surfaces.
- Can support a future plugin marketplace or customer-specific modules.
- Can keep proprietary functionality physically separate from the OSS shell.

### Cons

- High operational complexity for routing, auth, shared state, styling, dependency versions, error boundaries, observability, and testing.
- Worse local development experience.
- More ways to create an inconsistent product experience.
- Runtime loading creates failure modes that a data infrastructure product does not need early.
- One frontend engineer will spend too much time maintaining infrastructure instead of shipping customer value.

### Use it later if

- GlassFlow has multiple frontend teams or separately deployed enterprise domains.
- Customers require installable plugins developed outside the core team.
- The UI becomes a platform with stable public extension APIs.

# 8\. Concrete recommendation for GlassFlow

- Phase 1: Introduce a capability model and UI feature registry inside the current app. Do not split apps yet.
- Phase 2: Move enterprise candidate UI features behind module boundaries, not scattered flags.
- Phase 3: Add build-time edition composition: OSS build registers only OSS modules; EE build registers OSS + EE modules.
- Phase 4: Decide legal repository shape: same repo with differential licensing, or public OSS repo plus private EE overlay.
- Phase 5: Add CI enforcement: import boundaries, license scanning, OSS artifact inspection, EE artifact inspection, capability contract tests.
- Phase 6: Only revisit microfrontends if the plugin/platform need becomes real, not imagined.

**Recommended target architecture**

Public OSS app/core + private or separately licensed Enterprise modules. Build-time composition controls source/artifact separation. Backend capability endpoint controls runtime UX. Backend API enforces all actual permissions and license checks.

# 9\. What belongs in OSS vs Enterprise

Do not split by implementation difficulty. Split by buyer value and persona. Keep core developer adoption strong; monetize operational, governance, scale, compliance, and team workflows.

| **Area**          | **OSS candidate**                                                          | **Enterprise candidate**                                                                          |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Pipeline creation | Basic Kafka to ClickHouse pipeline wizard; config review; basic validation | Advanced guided flows, reusable templates, AI-assisted creation, multi-environment promotion      |
| Connectors        | Basic Kafka and ClickHouse connection setup                                | Saved shared connections, secrets integration, advanced sinks, enterprise auth modes              |
| Schemas           | Sample-event inference and manual JSON schema input                        | Schema Registry integration, Avro/Protobuf flows, schema version selection, schema evolution UI   |
| Operations        | Pipeline list, status, start/stop, basic logs                              | DLQ stats and reprocessing, replay workflows, internal observability UI, advanced troubleshooting |
| Governance        | Single-user/simple project usage                                           | RBAC, audit logs, approvals, environment separation, versioning                                   |
| Supportability    | Basic documentation links                                                  | Diagnostics bundle, support export, health reports, SLA-oriented views                            |

# 10\. UX rules for locked or unavailable features

- Do not show locked enterprise controls inside critical OSS workflows if they block completion.
- Use upgrade prompts only where the user has intent: empty states, advanced tabs, settings, admin areas, and contextual explanations.
- Never let users fill a long form and only then discover that the final action is enterprise-only.
- For missing license, show clear reason: not included, expired, invalid, role not allowed, backend unavailable.
- For OSS users, preserve dignity. The product should feel useful, not like a crippled demo.
- Use capability-aware route guards. Deep links to enterprise routes should show an explanatory access page, not crash or redirect mysteriously.

# 11\. CI/CD and release requirements

- Run separate \`build:oss\` and \`build:ee\` jobs.
- Run bundle/source inspection to ensure EE modules are absent from OSS build artifacts.
- Run import-boundary checks: OSS packages cannot import EE packages.
- Run license scanning for npm dependencies and manually verify vendored CSS/JS/assets.
- Run capability contract tests against mocked backend responses: active, missing, expired, invalid, partial capabilities.
- Run visual smoke tests for both editions: navigation, route guards, wizard path, enterprise locked state, enterprise unlocked state.
- Generate clear SBOM/license notices per distribution.

# 12\. Common pitfalls

- Scattering feature checks across components. This turns licensing into spaghetti.
- Treating frontend gating as security. It is not. The API must enforce everything.
- Building the OSS UI as an afterthought. OSS adoption is the top of the enterprise funnel.
- Creating separate apps too early. Product drift will appear immediately.
- Letting enterprise modules mutate shared state contracts without versioning.
- Using environment variables as the only edition boundary. They are useful but insufficient without import/build checks.
- Making every feature configurable before product boundaries are known. Start with explicit modules, not an abstract plugin platform.
- Shipping enterprise code in OSS artifacts accidentally through shared barrel exports.
- Hiding features entirely when upgrade education would help, or showing too many locked features when it damages OSS trust.

# 13\. Anti-patterns to avoid at any cost

- Microfrontends as a licensing solution for a one-person frontend team.
- Two long-lived frontend forks: \`ui-oss\` and \`ui-enterprise\` with copied components and divergent workflows.
- Backend says feature is disabled, but UI still enables the route/action because of stale local flags.
- Enterprise route imports from OSS core through circular dependencies.
- A public OSS repo containing enterprise implementation code without explicit licensing and product explanation.
- A license check sprinkled inside every button, form, and table row.
- A design system fork for EE. Enterprise features should look native, not like another product.
- An OSS product that is basically a teaser page for Enterprise. Developers will smell that immediately.

# 14\. Decision matrix

| **Criterion**                       | **Runtime gates only** | **Monorepo differential licensing** | **Private EE overlay**             | **Microfrontends** |
| ----------------------------------- | ---------------------- | ----------------------------------- | ---------------------------------- | ------------------ |
| Speed to start                      | Excellent              | Good                                | Medium                             | Poor               |
| Legal/source clarity                | Weak                   | Good                                | Excellent                          | Excellent          |
| One-person frontend maintainability | Excellent              | Good                                | Medium                             | Poor               |
| OSS artifact cleanliness            | Weak                   | Good if enforced                    | Excellent                          | Excellent          |
| Product consistency                 | Good                   | Excellent                           | Good                               | Medium-risk        |
| Long-term extensibility             | Medium                 | High                                | High                               | High but expensive |
| Recommended now                     | Partial only           | Yes                                 | Yes if public/private split needed | No                 |

# 15\. First implementation backlog

## Epic 1: Capability model

- Define \`CapabilityKey\` enum/type shared with backend contract.
- Create \`useCapabilities()\` hook and provider.
- Create backend mock fixtures for OSS, EE active, EE expired, partial license.
- Add route guard and component-level capability helper.

## Epic 2: Feature registry

- Create module contribution interface.
- Move navigation and route contributions into registry.
- Convert at least one existing pipeline step into a registered contribution.
- Add tests to ensure missing capabilities hide/lock registered contributions predictably.

## Epic 3: Edition builds

- Add \`build:oss\` and \`build:ee\` scripts.
- Create OSS module registry and EE module registry.
- Add CI check that OSS build contains no \`@gf/ee\` imports or chunks.
- Generate per-edition license/notice files.

## Epic 4: First enterprise module

- Pick one narrow feature, not the whole enterprise program. Recommended: Schema Registry UI or DLQ reprocessing UI.
- Build it as an EE module contribution.
- Verify OSS build has clean absence or intentional locked/upgrade surface.
- Verify API rejects access without valid license even if UI route is forced manually.

# 16\. Open questions for legal/product/engineering

- Will the public repository contain any enterprise source-available code, or must it remain OSS-only?
- Will GlassFlow ship separate Docker images/artifacts for OSS and EE, or one artifact with license activation?
- Which exact license will apply to enterprise UI code: ELv2, proprietary commercial license, or another source-available license?
- Which features are paid because of customer value, not because they were easy to isolate technically?
- What is the expected procurement story for self-hosted enterprise customers inspecting frontend artifacts?
- Should OSS users see upgrade prompts at all, or should Enterprise surfaces be absent from OSS builds?
- How will backend capability keys be versioned and documented?

# 17\. Suggested final decision

Adopt Approach B or C, depending on the repository/legal decision:

- If enterprise source can live next to OSS source with explicit licenses: choose Approach B.
- If the public OSS repository must stay clean: choose Approach C.
- In both cases, implement the same frontend architecture: module registry, build-time edition composition, runtime capability gating, backend enforcement.
- Do not choose microfrontends now. Revisit only when there is a real multi-team or plugin-platform requirement.

# 18\. References and industry signals

- GitLab documents two distributions: Community Edition and Enterprise Edition, and states that it now operates under a single codebase.
- GitLab licensing documentation distinguishes CE under MIT terms and EE under a more restrictive EE license, and highlights automated dependency license checks.
- GrowthBook describes itself as open core, with most code under MIT and several directories governed by a separate commercial enterprise license.
- Elastic's ELv2 FAQ explains a source-available model with free use, modification, redistribution, and three limitations including not circumventing license key functionality.
- Open Core Ventures argues that open-core splits should be feature/persona based rather than mechanically split by codebase; it also recommends explicit license files for different directories when differential licensing is used.

Note: this document is an architecture draft, not legal advice. Final licensing and distribution decisions should be reviewed by counsel.
