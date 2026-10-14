# Prepare ui-harness for a standalone public release

Status: ready-for-agent

## Problem Statement

Developers checking responsive layouts often switch between Chrome tabs or device sizes. The effort of switching, and remembering which sizes to inspect, means some viewports get skipped. The user has already used the UI harness in work projects and found that several simultaneously visible panes solve this problem.

The existing tool works, but its documentation starts with dotcom setup and its browser tests depend on dotcom assets. A new developer should be able to use it against an existing development server without adopting dotcom's environment or adding the tool to the target project's dependencies.

## Solution

Prepare the existing UI harness for independent distribution while preserving its live, interactive, side-by-side workflow. Make first use understandable, make the package and its tests independent of dotcom, and verify the packaged CLI from a clean target-project directory.

This is local release preparation. Keep the existing provisional package identity until a public name and repository are chosen. Do not publish a package or create a public repository as part of this specification.

No specific visual redesign has been agreed. Polish means removing dotcom-specific setup requirements, explaining the existing controls and limitations, and fixing reproducible failures of the acceptance behaviors below. Preserve the working interface unless such a failure requires a change.

## User Stories

1. As a developer, I want several viewports visible together, so that I can compare layouts without repeatedly switching browser tabs or device sizes.
2. As a developer, I want useful starting viewports, so that I can begin inspecting a page without choosing every size manually.
3. As a developer, I want to inspect my existing development URL, so that I do not need framework-specific integration.
4. As a developer, I want to run the tool without adding a target-project dependency, so that inspection does not change my application's dependency graph.
5. As a new user, I want a generic quick start, so that I do not need to understand or install dotcom.
6. As a developer, I want to select catalog sizes, so that I can check additional layouts without entering dimensions manually.
7. As a developer, I want custom viewport dimensions, so that I can inspect sizes relevant to my application.
8. As a developer, I want to remove unnecessary previews, so that the workspace contains only the sizes I am checking.
9. As a developer, I want each preview's dimensions and display scale to be clear, so that I understand the layout I am inspecting.
10. As a developer, I want fit scaling and actual-size viewing, so that I can compare several previews and inspect details when needed.
11. As a developer, I want scaling to preserve each preview's state, so that changing the workspace display does not interrupt inspection.
12. As a developer, I want to scroll, type, click, and navigate independently in each preview, so that I can compare real page interactions.
13. As a developer, I want to open a shared target URL, so that all previews can start at the page I am checking.
14. As a developer, I want Reset all to return every preview to the shared URL, so that I can restart a comparison after navigating independently.
15. As a returning user, I want to save and restore my URL, selected dimensions, and scale, so that I can reuse my setup.
16. As a developer, I want saving to be explicit, so that temporary inspection changes do not silently replace my saved setup.
17. As a keyboard user, I want to select viewport sizes without losing focus, so that I can operate the workspace without a mouse.
18. As a developer using a narrow browser window, I want the workspace controls to remain usable, so that I can manage previews on my available screen.
19. As a developer whose target forbids embedding, I want troubleshooting and a direct-opening link, so that I can understand a blank preview and inspect the target separately.
20. As a developer, I want clear limits on device emulation and shared browser storage, so that I do not mistake a viewport comparison for isolated device testing.
21. As a developer, I want optional local HTTPS support without mandatory proxy setup, so that I can use my existing development environment.
22. As a developer running from a terminal, I want a printed workspace URL and a no-open option, so that I can choose how to open the workspace.
23. As a maintainer, I want tests and package checks that work outside dotcom, so that the tool can move to its own repository.
24. As a maintainer, I want release instructions to distinguish verified behavior from untested compatibility, so that public documentation makes accurate claims.

## Implementation Decisions

- Retain the existing CLI, HTTP server, settings boundary, browser workspace, and pinned viewport catalog. Do not introduce a framework, runtime dependency, or browser-automation rendering layer.
- Preserve native iframes and the accepted embedding requirement. Only selected previews should be mounted. Display scaling must not remount existing previews or change their layout dimensions.
- Preserve the four starting dimensions: 390 × 664, 768 × 1024, 1280 × 720, and 1440 × 900. These are chosen defaults, not a universal testing standard.
- Preserve independently interactive previews, catalog/custom selection, shared target URL, Reset all, and explicit Save settings behavior.
- Preserve the current settings format and validation. Invalid settings or foreign-origin writes must not replace a saved project configuration.
- Replace dotcom-dependent browser fixtures with package-owned test pages. Exercise actual page interaction and navigation rather than dotcom-specific headings or audio assets. Test artifacts must stay inside temporary or package-owned output locations.
- Keep the runtime package self-contained and MIT-licensed, including the pinned catalog's attribution. Test-only browser automation remains a development dependency.
- Preserve the current Node requirement and provisional package name for local preparation. Do not invent repository metadata or claim a public package exists.
- Lead documentation and CLI examples with a generic target project. Document package-local development and local tarball execution separately from future registry commands.
- Keep Portless optional. Basic HTTP use must not require certificates, privileged ports, or a proxy. Preserve explicit public-origin handling for users with an existing HTTPS proxy.
- State native-frame limits: embedding policies apply, the host browser supplies rendering behavior, dimensions do not emulate device hardware, and previews do not provide separate cookie/storage sessions.
- Keep the package in its existing repository location during this work. Demonstrate portability through an isolated copy and packed artifact. Actual repository extraction and dotcom's future consumption of a published package remain later release actions.
- Document verified environments and runner results explicitly. Do not broaden support promises to operating systems or browsers that were not checked.

## Testing Decisions

The user confirmed the verification boundaries: the existing browser workspace and HTTP interface, plus a process-level check of the packed CLI from a clean target-project directory.

- Test external behavior with literal expected results. Prefer existing integration tests over adding internal test hooks or tests that mirror implementation details.
- Use the existing browser tests as prior art for actual viewport dimensions, scale/state preservation, independent navigation and scrolling, catalog selection, keyboard focus, narrow workspace usability, saved settings, and blocked-target fallback.
- Use the existing server tests as prior art for settings persistence, validation, rejected cross-origin writes, and explicitly configured proxy origins. Preserve these boundary checks.
- Use package-owned fixtures with readable content, an input, navigable pages, and scrollable content. Include an embedding-blocked response. Do not require dotcom's assets or a running dotcom server for package tests.
- Verify selected dimensions as rendered inside the frames at fit and actual-size scale. Verify input and scroll state survive display-only changes and adding/removing another preview.
- Verify explicit Save persists the URL, selected dimensions, and scale; restart and confirm the visible workspace restores all three. Verify temporary changes do not silently overwrite the saved configuration.
- Verify the troubleshooting link opens the blocked target directly. An iframe load event alone is not evidence that a target rendered successfully.
- Pack the tool and launch the packaged binary from a temporary target-project directory. Verify workspace assets load, settings resolve relative to that project, saving/restarting works, and shutdown cleans up the process. The target project must not gain a package dependency.
- Verify at least the local npm/npx tarball launch path. Record pnpm and nubx results when available; distinguish the known local-tarball limitations from unverified future registry behavior.
- Run package tests from an isolated copy containing no dotcom files or ancestor dependencies. Install development dependencies there as needed. This is the evidence that extraction is possible.
- Run the repository's existing test command as a regression gate alongside the harness tests. The root suite alone does not verify the harness.
- Inspect the browser workspace and the documented quick-start flow. Record observed defects and fix only those within this specification's acceptance behaviors.
- Historical test results in the original specification do not count as verification of this work. Record commands, environments, results, and any unavailable optional checks anew.

## Out of Scope

- Publishing to npm, creating or pushing a standalone repository, choosing the final public identity, or switching dotcom to an unpublished dependency.
- A visual redesign or new workflow features without a demonstrated failure of the agreed behavior.
- Checked-state tracking, reminders, or viewport-completion badges. The user described skipped checks when switching Chrome views, not overlooked panes inside the UI harness.
- Agent integrations or claims of proven agent productivity benefits.
- Target-page screenshot capture/comparison and automated target-page checks as product features. Tests of the UI harness itself remain in scope.
- Device hardware emulation, separate login sessions per pane, or a cross-browser testing service.
- Installing system certificates or configuring a user's development proxy as part of ordinary first use.
- New platform-support commitments or release infrastructure tied to an undecided hosting destination.

## Further Notes

### Execution tasks

These are implementation tasks for the local release-preparation scope. Work on one at a time. Their status is independent of the wayfinder decision tickets; do not change those tickets to implementation triage labels or claim they were resolved by the user.

1. **Make package verification independent of dotcom.** Status: ready-for-agent. Completion: complete. Replace external fixtures and output paths, preserve meaningful browser behavior coverage, and demonstrate the package suite runs from an isolated copy. Complete when no package test requires dotcom assets or an ancestor dependency installation. Verified on 2026-10-15: the revised browser test failed against the dotcom fixture, then all 7 package tests passed locally and in an isolated copy with its own fresh dependency installation. The repository gate passed all 4 tests. See the task 1 completion entry in `ralph-progress.md` for commands and environment.
2. **Verify the packaged CLI in a clean target project.** Status: ready-for-agent. Completion: complete. Depends on task 1. Add or extend a process-level package smoke check, verify configuration location and restart behavior, and correct package omissions or reproducible launch failures. Complete when the packed tool serves a usable workspace without adding a target-project dependency. Verified on 2026-10-15: the new `test:package` command passes through npm/npx with a fresh tarball, cache, and target project. Browser assertions cover rendering, interaction, explicit saving, unsaved changes, and restoration after process restart. Both launches shut down and close their listeners. The target manifest stays unchanged and no dependency installation appears in the project. All 8 package tests pass locally and in an isolated copy; the repository gate passes all 4 tests. Nubx 0.9.3 rejects a local tarball; pnpm is unavailable. See the task 2 completion entry in `ralph-progress.md`.
3. **Polish standalone onboarding and document limits.** Status: ready-for-agent. Depends on task 2. Rewrite the quick start and CLI examples around a generic project, retain an optional HTTPS guide, distinguish local from future published commands, and document verified compatibility. Complete when following the local quick start requires no dotcom-specific setup.
4. **Record local release-preparation acceptance.** Status: ready-for-agent. Depends on tasks 1–3. Run the relevant suites, inspect the workspace, fix any remaining in-scope behavioral defects, inspect package contents and attribution, and write a concise verification record and remaining publication checklist. Complete when all required checks pass and unresolved external release actions are explicitly listed without claiming publication readiness beyond the evidence.

For Ralph, select the earliest incomplete task whose dependencies are complete and whose status is ready-for-agent. Mark completed tasks with `Completion: complete` and attach verification evidence; keep overall triage status separate from task completion. Do not treat finishing this specification as completing the broader public-release map.

### Execution blockers

No current blocker for the next task. The earlier environment failure below was resolved on 2026-10-15: loopback listeners work, the root suite resolves Playwright, and both suites pass.

- Previous attempt, 2026-10-15: task 1 remained incomplete. The current execution sandbox rejects local HTTP listeners with `listen EPERM: operation not permitted 127.0.0.1`. All three package server tests fail at this boundary, preventing browser verification and the required TDD evidence. The repository gate `nub run test` also fails because `tests/homepage.test.cjs` cannot resolve `playwright`. Resume task 1 in an environment that permits loopback listeners and provides the root suite's browser dependency. No implementation changes or commit were retained from this attempt. See `ralph-progress.md` for commands and results.

This file is the implementation input for a later Ralph run. Creating this specification does not itself restart the loop. The script has its own push/draft-PR completion behavior; that behavior is separate from npm publication or standalone repository creation.

### Related planning records

- [Public-release decision map](map.md) retains the unresolved broader release decisions.
- [Original implementation specification](../ui-harness/spec.md) records the accepted baseline and historical verification.
- [Native-frame ADR](../../docs/adr/0001-native-frames-for-ui-harness.md) remains the rendering constraint.

The user's latest request is to capture a local spec. No product code changes or publication actions are part of writing this document.
