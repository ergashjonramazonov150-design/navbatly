# Navbatly — MCP and Playwright MCP Testing Assignment

**Start here: [`NAVBATLY_QA_REPORT.md`](NAVBATLY_QA_REPORT.md)** — the full report (English,
with a section in Uzbek, §10).

|                   |                                                                           |
| ----------------- | ------------------------------------------------------------------------- |
| System under test | Navbatly booking web app — https://navbatly.vercel.app                    |
| Test tool         | Official Microsoft Playwright MCP server `@playwright/mcp@0.0.84`         |
| Final run         | 2026-11-22 — 25 test cases, 213 MCP tool calls                            |
| Result            | **20 PASS · 2 FAIL · 0 BLOCKED · 3 NOT TESTED** — 1 defect found (BUG-01) |

## Contents

| Path                                    | What it is                                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `NAVBATLY_QA_REPORT.md`                 | The report: MCP explanation, configuration, methodology, results, defects, Uzbek section, figures              |
| `screenshots/`                          | 21 screenshots from the final run (listed as Figures 1–21 in Appendix A of the report)                         |
| `mcp-config/.mcp.json`                  | Playwright MCP configuration used (copy of the project's `.mcp.json`)                                          |
| `test-results/qa-results.json`          | Raw results of the final run: status and evidence for every test case                                          |
| `test-results/overflow-diagnosis.json`  | BUG-01 measurements at 11 screen widths                                                                        |
| `test-results/mcp-handshake-output.txt` | MCP handshake output and the list of 25 browser tools                                                          |
| `test-results/vitest-summary.txt`       | Summary of the project's own test suite (supporting evidence)                                                  |
| `scripts/`                              | The MCP client and test scripts (`mcp-client.mjs`, `mcp-handshake.mjs`, `run-qa.mjs`, `diagnose-overflow.mjs`) |

## Viewing the report

Open `NAVBATLY_QA_REPORT.md` in any Markdown viewer (for example VS Code: right-click →
"Open Preview", or GitHub). The screenshots are embedded in Appendix A and load from the
`screenshots/` folder, so keep the folder structure unchanged.

## Notes

- `.mcp.json` begins with a dot. On some systems such files are hidden; it is in `mcp-config/`.
- No passwords, API keys or other secrets are included in any file.
- No real customer appointment was created during testing (see report §4.4).
