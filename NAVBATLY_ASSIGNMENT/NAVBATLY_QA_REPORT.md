# Testing the Navbatly Web Application with the Model Context Protocol (MCP) and Playwright MCP

**Quality Assurance Report — Academic Assignment**

|                       |                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------- |
| **Student**           | _[name]_                                                                                 |
| **Course / group**    | _[course, group]_                                                                        |
| **Instructor**        | _[instructor]_                                                                           |
| **Submission date**   | _[date]_                                                                                 |
| **System under test** | Navbatly — online booking for barbershops and beauty salons, https://navbatly.vercel.app |
| **Tested build**      | Production deployment of Git branch `main`, commit `1353bec` (deployed 2026-11-14)       |
| **Test tool**         | Official Microsoft Playwright MCP server, `@playwright/mcp@0.0.84`                       |
| **Final test run**    | 2026-11-22, 10:06:43–10:08:51 UTC — 25 test cases, 213 MCP tool calls                    |

---

## Abstract

This report explains the Model Context Protocol (MCP), configures the official Playwright MCP
server, and uses it to test the production version of Navbatly, a barbershop booking web
application. Twenty-five test cases covered the homepage, navigation, the salon page, the
four-step booking workflow (including empty and invalid input), responsive layouts at four
screen sizes, and browser console and network errors. **20 test cases passed, 2 failed, none
were blocked and 3 were not tested** for documented reasons. Both failures come from one
defect: on screens between 600 and 1024 pixels wide the homepage is 8–27 pixels wider than the
screen and can be scrolled sideways. No real customer data was created: the only complete
booking was intercepted inside the browser and answered with a simulated response. All
results, screenshots and scripts are included so the work can be checked and repeated.

---

## Contents

1. [Introduction and system under test](#1-introduction-and-system-under-test)
2. [The Model Context Protocol (MCP)](#2-the-model-context-protocol-mcp)
3. [Playwright MCP and its configuration](#3-playwright-mcp-and-its-configuration)
4. [Testing methodology](#4-testing-methodology)
5. [Testing environment](#5-testing-environment)
6. [Results](#6-results)
7. [Defects and observations](#7-defects-and-observations)
8. [Limitations: verified results versus assumptions](#8-limitations-verified-results-versus-assumptions)
9. [Conclusion](#9-conclusion)
10. [O'zbek tilida: MCP va Playwright MCP](#10-ozbek-tilida-mcp-va-playwright-mcp)
11. [References](#11-references)

- [Appendix A — Figures (21 screenshots)](#appendix-a--figures)
- [Appendix B — Submission contents and how to reproduce](#appendix-b--submission-contents-and-how-to-reproduce)

---

## 1. Introduction and system under test

### 1.1 Purpose

The assignment has three goals: to explain what MCP is and how it works; to configure the
official Playwright MCP server; and to use it to test a real web application through a real
browser, recording evidence for every result.

### 1.2 Navbatly

Navbatly lets a customer book a haircut in under a minute from a salon's own link (shared on
Instagram or Telegram) without creating an account. The salon owner manages services, barbers,
working hours, days off, photos and bookings in an admin panel and receives a Telegram message
for every new booking. The user interface is in Uzbek (Latin script).

| Part                | Technology (from `package.json`, `README.md`, `vite.config.ts`)                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Frontend            | React 19, TypeScript, Vite 8, React Router, TanStack Query, react-hook-form + zod, Tailwind CSS 4, shadcn/ui, i18next |
| Backend             | Supabase: PostgreSQL with Row Level Security, Auth, Storage, Edge Functions (Deno)                                    |
| Integrations        | Telegram Bot API and Telegram Mini App; Cloudflare Turnstile captcha (built in, currently switched off)               |
| Hosting             | Vercel (frontend), Supabase cloud (database, functions, storage)                                                      |
| Project's own tests | 173 frontend tests (Vitest), 218 database tests (pgTAP), a live-site smoke check                                      |

**Routes** (from `src/app/router.tsx`):

| Route                                                                  | Purpose                                                               | Login   |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------- | ------- |
| `/`                                                                    | Landing page for salon owners                                         | no      |
| `/b/:slug`                                                             | A salon's page with the 4-step booking wizard (demo salon: `/b/demo`) | no      |
| `/privacy`                                                             | Privacy policy                                                        | no      |
| `/admin/login`, `/admin/forgot-password`, `/admin/reset-password`      | Sign-in pages                                                         | no      |
| `/admin/appointments`, `/calendar`, `/services`, `/staff`, `/settings` | Admin panel                                                           | **yes** |
| any other address                                                      | "Sahifa topilmadi" (page not found)                                   | no      |

**Main workflow — booking:** choose a service → choose a barber → choose a day and a free time →
enter name and phone and give consent → press "Band qilish" (Book) → confirmation screen. Free
times are calculated by the database; the booking request is sent to the `create-booking` Edge
Function, which checks every rule again on the server.

**Local start:** `npm install`, copy `.env.example` to `.env.local` and add the Supabase URL
and publishable key, then `npm run dev` (http://localhost:5173). This report tests the
**deployed production site** instead: it is what real users and the assessor see, and it needs
no local secrets.

---

## 2. The Model Context Protocol (MCP)

### 2.1 Definition

The **Model Context Protocol (MCP)** is an open standard, introduced by Anthropic in November
2024, that defines one common way for AI applications to connect to external tools and data
sources — for example a web browser, a database, GitHub or a design tool. It is often compared
to a "USB-C port for AI": any MCP-compatible assistant can use any MCP server without custom
integration code.

### 2.2 Why MCP was developed

Before MCP, every AI assistant needed a custom integration for every tool. With _N_ assistants
and _M_ tools that means _N × M_ separate integrations, each with its own data format, error
handling and security rules. MCP reduces this to _N + M_: each assistant implements the client
side of the protocol once, each tool implements the server side once, and any pair can work
together. It also gives one consistent place for permissions and user consent.

### 2.3 Architecture: host, client and server

```mermaid
flowchart LR
  U[User] --> H
  subgraph H[MCP host — e.g. Claude Code in VS Code]
    LLM[AI model]
    C1[MCP client 1]
    C2[MCP client 2]
  end
  C1 -- JSON-RPC over stdio --> S1[Playwright MCP server] --> B[Chrome browser] --> W[navbatly.vercel.app]
  C2 -- JSON-RPC over HTTP --> S2[Another MCP server, e.g. a database]
```

| Role       | What it is                                                                                                              | In this assignment                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Host**   | The AI application the user works in. It runs the model, decides which tools may be used and asks the user for consent. | Claude Code (VS Code extension)                         |
| **Client** | A connector inside the host. Each client keeps **one** session with **one** server.                                     | One client for the `playwright` server                  |
| **Server** | A program that offers capabilities through MCP.                                                                         | `@playwright/mcp`, which controls a real Chrome browser |

### 2.4 How communication works

- **Message format:** JSON-RPC 2.0 — requests (with an `id`), responses, and one-way notifications.
- **Transports:** _stdio_ — the host starts the server as a local process and exchanges
  newline-separated JSON messages through its standard input and output (used here); or
  _Streamable HTTP_ for remote servers.
- **Lifecycle:**
  1. `initialize` — client and server agree on a protocol version and announce their capabilities;
  2. `notifications/initialized` — the client confirms that the session is ready;
  3. discovery — for example `tools/list` returns every tool with a name, a description and a JSON Schema for its inputs;
  4. use — `tools/call` runs a tool and returns the result as content (text or images);
  5. shutdown — the client closes the connection or the process.

Messages exchanged in this assignment (shortened; real names and versions):

```json
→ {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"navbatly-qa-client","version":"1.0.0"}}}
← {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{…}},"serverInfo":{"name":"Playwright","version":"1.65.0-alpha-2026-10-30"}}}
→ {"jsonrpc":"2.0","method":"notifications/initialized"}
→ {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"browser_navigate","arguments":{"url":"https://navbatly.vercel.app/"}}}
← {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"### Page\n- Page URL: https://navbatly.vercel.app/\n- Page Title: Navbatly …"}]}}
```

### 2.5 Server primitives: tools, resources and prompts

| Primitive     | Controlled by                                                                | What it is                                        | Protocol methods                   | Example                             |
| ------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------- | ----------------------------------- |
| **Tools**     | the **model** decides when to call them; the host asks the user for approval | Actions with typed inputs; they may change things | `tools/list`, `tools/call`         | `browser_click`, `browser_navigate` |
| **Resources** | the **application** decides what to attach                                   | Read-only context data identified by a URI        | `resources/list`, `resources/read` | a file, a database schema, a log    |
| **Prompts**   | the **user** chooses them (for example as slash commands)                    | Reusable message templates with arguments         | `prompts/list`, `prompts/get`      | "review this pull request"          |

Clients can also offer features to servers: _roots_ (which folders a server may use),
_sampling_ (a server asks the host's model to generate text) and _elicitation_ (a server asks
the user a question). Playwright MCP 0.0.84 offers **tools only** — its `initialize` answer
lists just the `tools` capability.

### 2.6 How an AI assistant uses an external application through MCP

1. The user asks, for example: "check that the booking form shows an error for an empty phone".
2. The host has already called `tools/list`, so the model knows the browser tools and their inputs.
3. The model chooses a tool — for example `browser_navigate` with `{"url": "…/b/demo"}`. The host
   asks the user for permission (unless already granted) and sends `tools/call` through the client.
4. The server performs the action in Chrome and returns a text result. Playwright MCP returns an
   **accessibility snapshot**: a structured outline of the page with roles, names and element
   references such as `[ref=e23]`, instead of pixels, so the model can act precisely.
5. The model reads the result and chooses the next step (click `ref=e23`, type into a field,
   take a screenshot) until the task is finished, then reports to the user.

### 2.7 Real-world applications

- **Browser automation and testing** — Playwright MCP (this assignment): end-to-end checks,
  form testing, screenshots, debugging of web pages.
- **Databases** — querying data, inspecting schemas, running security checks (the Navbatly
  developer used the Supabase MCP server during development).
- **Hosting and deployment** — reading deployment status and logs (for example the Vercel MCP server).
- **Code and collaboration** — GitHub (issues, pull requests), Slack, Jira, Google Drive.
- **Design** — reading designs from Figma and turning them into code.
- **Business systems** — CRM systems, payment dashboards, internal company APIs.

---

## 3. Playwright MCP and its configuration

### 3.1 What Playwright MCP is

Playwright MCP is Microsoft's official MCP server for browser automation (npm package
`@playwright/mcp`, repository `github.com/microsoft/playwright-mcp`). It is built on the
Playwright testing library and gives an AI host 25 browser tools in the version used here —
for example `browser_navigate`, `browser_click`, `browser_type`, `browser_fill_form`,
`browser_take_screenshot`, `browser_resize`, `browser_console_messages` and
`browser_network_requests`.

### 3.2 Checks before configuration

| Check                              | Result (verified)                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js installed                  | `v24.22.2` (npm `11.19.1`); Playwright MCP needs Node.js 18 or newer                                                                           |
| Playwright MCP already configured? | **No** — there was no `.mcp.json` in the project and no `playwright` entry in the user's Claude Code settings                                  |
| Official package                   | `@playwright/mcp` on npm; repository `github.com/microsoft/playwright-mcp`                                                                     |
| Version                            | `0.0.84` (released 2026-10-31), pinned so that every run uses the same server. The newest release, 0.0.86, was only 4 days old on the test day |
| Browser                            | Google Chrome (already installed)                                                                                                              |

### 3.3 Configuration

One file was added to the project root: **`.mcp.json`**, the project-level MCP configuration
read by Claude Code (included in this submission as `mcp-config/.mcp.json`). It contains no
secrets:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@playwright/mcp@0.0.84", "--browser", "chrome", "--isolated"]
    }
  }
}
```

| Setting                  | Reason                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `cmd /c npx …`           | On Windows, MCP servers started with `npx` must be launched through `cmd`.                                                                |
| `@playwright/mcp@0.0.84` | A fixed version gives repeatable results.                                                                                                 |
| `--browser chrome`       | Uses the installed Google Chrome.                                                                                                         |
| `--isolated`             | A fresh in-memory browser profile for every session, so no saved logins or cookies from the developer's own browser can affect the tests. |

For automated runs two options were added on the command line: `--headless` (no visible
window) and `--output-dir` pointing to the system temporary folder, so the server's internal
working files are not written into the project. No application code, dependency or
environment file was changed.

### 3.4 Verification

The script `scripts/mcp-handshake.mjs` starts the server **exactly as defined in
`.mcp.json`** and performs the MCP handshake. Saved output
(`test-results/mcp-handshake-output.txt`, tool list shortened here):

```
server: {"name":"Playwright","version":"1.65.0-alpha-2026-10-30"} | protocol: 2025-06-18
server capabilities: tools
tools (25): browser_close, browser_resize, browser_console_messages, browser_handle_dialog,
  browser_emulate_media, browser_evaluate, browser_file_upload, browser_drop, browser_find,
  browser_fill_form, browser_press_key, browser_type, browser_navigate, browser_navigate_back,
  browser_network_requests, browser_network_request, browser_run_code_unsafe,
  browser_take_screenshot, browser_snapshot, browser_click, browser_drag, browser_hover,
  browser_select_option, browser_tabs, browser_wait_for
```

**To use the tools interactively in Claude Code:** reload the VS Code window (or restart Claude
Code) in the project folder, approve the `playwright` server when asked, and run `/mcp`; the
server should be listed as connected. The assistant can then call the browser tools directly in
conversation.

---

## 4. Testing methodology

### 4.1 Approach

The testing is **black-box and requirement-based**: the application is used only through its
public web pages, the way a customer or salon owner would use it. Each test case has an ID, a
goal, steps and an expected result written as an automatic check (an _assertion_). Test design
combined:

- **positive tests** — the normal path works (navigation, booking steps, confirmation);
- **negative tests** — wrong use is rejected (empty form, one-letter name, short phone, letters
  in the phone field, invalid e-mail, unknown pages, admin pages without login);
- **boundary and compatibility tests** — four screen sizes, from a phone to a desktop;
- **non-functional checks** — browser console errors and failed network requests.

### 4.2 Tool chain and the separate MCP client — a limitation

In normal use the **host** (Claude Code) starts the MCP server, and the AI model decides which
tool to call next. Claude Code loads project MCP servers **when a session starts** and asks the
user once to approve a new project server. The configuration in §3.3 was created during an
already running session, so the Playwright tools were **not** in the assistant's own tool list
in that session.

To still test through the official server, and not through a different tool, a small MCP client
was written: `scripts/mcp-client.mjs` (about 100 lines, no extra libraries). It does exactly what
a host does at the protocol level:

1. starts the `playwright` server with the command from `.mcp.json`;
2. sends `initialize` and `notifications/initialized`;
3. sends **one `tools/call` for every browser action** — navigate, click, type, fill a form, take
   a screenshot, read the console, read the network requests.

The test cases themselves are in `scripts/run-qa.mjs`.

**What this means for the results:**

| Aspect                                 | Same as using the host? | Explanation                                                                                                                                      |
| -------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| MCP server, version, browser and tools | **Yes**                 | The same `.mcp.json` command starts the same server; all actions are standard `tools/call` requests (213 in the final run).                      |
| Protocol messages                      | **Yes**                 | Standard JSON-RPC 2.0 over stdio, protocol version `2025-06-18`.                                                                                 |
| Who decides the next step              | **No**                  | The order of steps was fixed in a script, not chosen by the AI model during a conversation. This makes the run repeatable but not _exploratory_. |
| Host consent dialogs                   | **Not exercised**       | The host's "allow this tool?" prompts are part of the host, not of the protocol, and were not shown.                                             |

So the results show that the application works when driven through Playwright MCP. They do not
show the interactive experience of an assistant choosing actions by itself. The next step to
cover that is described at the end of §3.4.

### 4.3 How results are decided and recorded

- Each test case runs its steps and checks. If every check holds, it is **PASS**; if a check
  fails, it is **FAIL** with the failing value recorded. If a test cannot run because something
  it depends on is missing, it is **BLOCKED**. **NOT TESTED** is used only for cases deliberately
  not run, always with the reason.
- Evidence comes from the MCP tools themselves: page text and values (`browser_evaluate`), the
  accessibility snapshot (`browser_snapshot`), console messages (`browser_console_messages`),
  network requests (`browser_network_requests`) and screenshots (`browser_take_screenshot`).
- All results are written to `test-results/qa-results.json`. All 21 screenshots were also
  **checked visually** to make sure they show what the report says.
- Service names, durations and prices on the page were compared with the server's own data,
  captured from the API response while the page was loading (TC-11).

### 4.4 Protecting real data

- No login credentials were used anywhere.
- The only complete booking (TC-16) was **intercepted inside the browser** with Playwright's
  `page.route` (through the `browser_run_code_unsafe` tool). The request to `create-booking` was
  answered with a simulated "success" response and **never reached the server**.
- After the runs, the database was checked read-only: **0** appointments named "QA Test" or with
  the test phone `+998900000099`, and **0** appointments of any kind created in the 3 hours
  before the check (a window that covers all test runs).
- All other requests only read public data (salon details, free times).

### 4.5 Iterations and corrections

The final results come from the **third** run of the test script. The first two runs exposed
mistakes in the _test script_, not in the application, and these were corrected:

- some elements were searched for before the page had finished loading;
- element names that contain a colon (for example "Eng yaqin: ertaga 10:00") appear in quotes
  in the accessibility snapshot, and the search did not allow for that;
- a number-formatting check was written incorrectly (the page showed the correct prices);
- **one false PASS:** the link check passed while the list of links it checked was empty,
  because the page had not loaded yet. It was fixed to wait for the page and to fail if no links
  are found; in the final run it checked 4 internal pages, 3 in-page anchors and 2 external links.

After BUG-01 was found, a separate diagnostic run (`scripts/diagnose-overflow.mjs`, also through
Playwright MCP) measured the homepage at 11 screen widths to find the affected range and the
exact element causing it (§7.1).

---

## 5. Testing environment

| Item                  | Value                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operating system      | Windows 11 Pro (10.0.26100)                                                                                                                                            |
| Runtime               | Node.js 24.22.2, npm 11.19.1                                                                                                                                           |
| MCP server            | `@playwright/mcp@0.0.84` (reports Playwright `1.65.0-alpha-2026-10-30`); MCP protocol `2025-06-18`; stdio transport                                                    |
| Browser               | Google Chrome, headless, isolated profile                                                                                                                              |
| System under test     | https://navbatly.vercel.app — production build of `main` @ `1353bec`                                                                                                   |
| Screen sizes          | Desktop 1440×900 · Tablet 768×1024 · Tablet landscape 1024×768 · Mobile 390×844                                                                                        |
| Test data             | Public demo salon `/b/demo` ("Madara Barbershop", fictional data). Test customer "QA Test", phone `+998 90 000 00 99`, used only against the simulated server response |
| Date of the final run | 2026-11-22 (a Sunday — the demo salon is closed on Sundays, so the first free times were on Monday)                                                                    |

---

## 6. Results

### 6.1 Summary

| Status         |  Count | Test cases                                                                                                                                                 |
| -------------- | -----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PASS**       |     20 | TC-01, TC-02, TC-02b, TC-03, TC-04, TC-05, TC-06, TC-07, TC-08, TC-10, TC-11, TC-12, TC-13, TC-14, TC-15, TC-16, TC-17 desktop, TC-17 mobile, TC-18, TC-19 |
| **FAIL**       |      2 | TC-17 tablet, TC-17 tablet landscape (both caused by BUG-01)                                                                                               |
| **BLOCKED**    |      0 | —                                                                                                                                                          |
| **NOT TESTED** |      3 | TC-09, TC-20, TC-21                                                                                                                                        |
| **Total**      | **25** |                                                                                                                                                            |

### 6.2 Test cases

| ID     | Area           | Test case                                                                                                     | Status         | Evidence (final run)                                                                                                                                                                                                                                                                                 | Figures |
| ------ | -------------- | ------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| TC-01  | Homepage       | Homepage loads with title, headline, navigation and buttons                                                   | **PASS**       | Title "Navbatly"; h1 "Mijozlar o'zi yozilsin — siz ishingizga e'tibor bering."; 6 sections; header links Qanday ishlaydi · Imkoniyatlar · Boshqaruv paneli · Demoni ko'rish                                                                                                                          | 1, 2    |
| TC-02  | Navigation     | Header menu links scroll to their sections                                                                    | **PASS**       | Each link set `#qanday`, `#imkoniyatlar`, `#panel`; the section moved to the top of the window (0 px)                                                                                                                                                                                                | —       |
| TC-02b | Navigation     | After a menu jump the section label is not hidden behind the sticky header                                    | **PASS**       | Labels at 72–73 px, header ends at 69 px; at that point the label, not the header, is the visible element                                                                                                                                                                                            | 3       |
| TC-03  | Navigation     | All internal links open real pages; external links are well formed                                            | **PASS**       | Links collected from `/` and `/privacy`: internal `/`, `/b/demo`, `/privacy`, `/admin/login` all opened without a "not found" page; anchors `#qanday`, `#imkoniyatlar`, `#panel`; external `https://t.me/navbatly_uz_bot?start=demo` and `https://t.me/navbatly_uz_bot` (format checked, not opened) | —       |
| TC-04  | Navigation     | Button "Demo salonni ochish" opens the demo salon                                                             | **PASS**       | Click → `/b/demo`; step 1 "Xizmatni tanlang" shown                                                                                                                                                                                                                                                   | —       |
| TC-05  | Navigation     | Privacy page shows all sections and links back home                                                           | **PASS**       | h1 "Maxfiylik siyosati", 6 sections; "Bosh sahifa" link → `/`                                                                                                                                                                                                                                        | —       |
| TC-06  | Navigation     | Unknown page and unknown salon show friendly "not found" pages                                                | **PASS**       | `/this-page-does-not-exist` → "Sahifa topilmadi"; `/b/no-such-salon-qa` → "Salon topilmadi"                                                                                                                                                                                                          | 4       |
| TC-07  | Security       | Admin pages require login                                                                                     | **PASS**       | Visiting `/admin/appointments` without login redirects to `/admin/login`                                                                                                                                                                                                                             | —       |
| TC-08  | Forms          | Admin login rejects an empty form and an invalid e-mail before sending anything                               | **PASS**       | Empty → "Emailni kiriting." and "Parolni kiriting."; `not-an-email` → "Email noto'g'ri ko'rinishda"; no request to `/auth/v1/token`                                                                                                                                                                  | 5       |
| TC-09  | Salons         | Barbershop listing page                                                                                       | **NOT TESTED** | The feature does not exist: each salon shares its own link `/b/<slug>`, and the router has no listing route. A public catalogue is planned for a later phase (`docs/ARCHITECTURE.md`). The salon page was tested instead (TC-10)                                                                     | —       |
| TC-10  | Salons         | Salon page (desktop): name, address, opening hours, barbers, gallery                                          | **PASS**       | "Madara Barbershop"; Monday–Saturday 09:00–20:00, Sunday "Dam olish kuni" (marked "Bugun", i.e. today); barbers Jasur, Bobur, Akmal; 8 gallery photos; call link present                                                                                                                             | 6, 7    |
| TC-11  | Salons         | Services show name, duration and price that match the server data                                             | **PASS**       | All 5 services match the API response: Soch olish 80 000 so'm / 30 daq; Soqol olish 50 000 / 20; Soch + soqol 120 000 / 50; Bolalar soch turmagi 60 000 / 30; Ukladka 40 000 / 20                                                                                                                    | 6       |
| TC-12  | Booking        | Step 1 → 2: "Davom etish" (Continue) is disabled until a service is chosen; only suitable barbers are offered | **PASS**       | Button disabled before the choice; "Soch olish" → 3 barbers, each with the nearest free time ("Eng yaqin")                                                                                                                                                                                           | 8       |
| TC-13  | Booking        | Steps 2 → 3 → 4: barber, day and free time                                                                    | **PASS**       | Barber Jasur → 26 free times shown → 10:00 chosen → contact form "Ma'lumotlaringiz"                                                                                                                                                                                                                  | 9, 10   |
| TC-14  | Booking        | Submitting the empty form                                                                                     | **PASS**       | Errors for name, phone and consent shown; no request sent to `create-booking`                                                                                                                                                                                                                        | 11      |
| TC-15  | Booking        | Invalid input: one-letter name, short phone, letters in the phone field                                       | **PASS**       | Name "A" rejected; typing `abc12345` into the phone field kept only the digits ("12 345"), which were rejected as too short                                                                                                                                                                          | 12      |
| TC-16  | Booking        | Valid booking → confirmation screen (**simulated server response**)                                           | **PASS**       | "So'rovingiz yuborildi!" and "Tasdiqlash kutilmoqda" shown. The intercepted request contained the chosen service, barber, time `2026-11-23T05:00:00+00:00` (10:00 in Tashkent), name "QA Test", phone `+998900000099` and an empty anti-spam field; nothing was saved                                | 13      |
| TC-17  | Responsive     | Desktop 1440×900                                                                                              | **PASS**       | No sideways scrolling (0 px); salon page in two columns (information + booking card)                                                                                                                                                                                                                 | 14, 15  |
| TC-17  | Responsive     | Tablet 768×1024                                                                                               | **FAIL**       | Homepage scrolls sideways by **16 px** (salon page 0 px, one column as designed) — BUG-01                                                                                                                                                                                                            | 16, 17  |
| TC-17  | Responsive     | Tablet landscape 1024×768                                                                                     | **FAIL**       | Homepage scrolls sideways by **27 px** (salon page 0 px, two columns) — BUG-01                                                                                                                                                                                                                       | 18, 19  |
| TC-17  | Responsive     | Mobile 390×844                                                                                                | **PASS**       | 0 px on both pages; salon page in one column with a fixed bottom bar                                                                                                                                                                                                                                 | 20, 21  |
| TC-18  | Browser errors | No console errors during the whole session                                                                    | **PASS**       | `browser_console_messages` (level "error", whole session): "Total messages: 0 (Errors: 0, Warnings: 0)"                                                                                                                                                                                              | —       |
| TC-19  | Browser errors | No failed network requests on clean page loads                                                                | **PASS**       | `/` 11, `/b/demo` 26, `/privacy` 7, `/admin/login` 7 requests — none with status 4xx/5xx or a network error (see note)                                                                                                                                                                               | —       |
| TC-20  | Admin          | Admin panel after login                                                                                       | **NOT TESTED** | Requires owner credentials; the assignment rules did not allow using them. Supporting evidence below                                                                                                                                                                                                 | —       |
| TC-21  | Telegram       | Telegram bot and Mini App booking                                                                             | **NOT TESTED** | Requires the Telegram app and a real account, which Playwright cannot control. The bot link format was checked in TC-03                                                                                                                                                                              | —       |

**Note on TC-19.** Over the whole scripted session the browser listed 2 requests as
`net::ERR_ABORTED`. The browser cancels such requests itself when the test moves to the next
page while they are still loading; they are not server or application errors. For this reason
TC-19 loads each page separately, waits, and checks only that page's requests.

**Supporting evidence (not part of the MCP run).** The project's own automated tests were run
on the same day (`test-results/vitest-summary.txt`): **29 files, 173 tests passed**, including
37 tests in the admin-screen test files (bookings list, calendar, manual booking, services,
settings, Telegram settings card).

---

## 7. Defects and observations

### 7.1 BUG-01 — The homepage scrolls sideways on tablets and small laptops

|                        |                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**           | Low–medium: cosmetic, but noticeable on tablets, where the whole page moves sideways when swiped                                                                                                                                                                                                                                                                                               |
| **Location**           | `/` — section "Boshqaruv paneli" (the laptop picture of the admin panel)                                                                                                                                                                                                                                                                                                                       |
| **Found by**           | TC-17 tablet and TC-17 tablet landscape                                                                                                                                                                                                                                                                                                                                                        |
| **Cause (verified)**   | The base of the laptop picture, a `div` with the class `-mx-[5%]` in `Laptop()` (`src/pages/public/LandingPage.tsx`, line 49), is intentionally 5 % wider than the laptop on each side. When the laptop is as wide as the page content, this extra width sticks out past the right edge of the screen. At every affected width the diagnostic script found this element and only this element. |
| **Steps to reproduce** | Open https://navbatly.vercel.app on a screen 600–1024 px wide (for example an iPad), scroll to "Kunni bir qarashda ko'ring", swipe left                                                                                                                                                                                                                                                        |
| **Recommendation**     | Hide horizontal overflow in that section (for example Tailwind `overflow-x-clip` on `<section id="panel">`), or keep the base inside the laptop's width on narrower screens; then run TC-17 again. _Not fixed here: the assignment did not allow changes to the application._                                                                                                                  |

Measured extra width of the homepage (`test-results/overflow-diagnosis.json`, diagnostic run
through Playwright MCP on 2026-11-22):

| Screen width (px) | 390 | 600 | 700 | 768 | 820 | 900 | 1024 | 1100 | 1180 | 1280 | 1440 |
| ----------------- | --- | --- | --- | --- | --- | --- | ---- | ---- | ---- | ---- | ---- |
| Extra width (px)  | 0   | 8   | 13  | 16  | 19  | 23  | 27   | 0    | 0    | 0    | 0    |

A headless browser shows no scrollbar, so the overflow is not visible in Figures 16 and 18; it
is proven by these measurements.

### 7.2 Observations (not defects)

| #      | Observation                                                                                                                                                                                                                                              | Recommendation                                                                         |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| OBS-01 | After a menu jump the section label is only 3–4 px below the sticky header (TC-02b): visible, but tight.                                                                                                                                                 | Add a small `scroll-margin-top` (for example Tailwind `scroll-mt-20`) to the sections. |
| OBS-02 | The captcha (Cloudflare Turnstile) is built in but switched off in production, so an automated script can submit the booking form. Spam protection currently relies on a hidden anti-spam field (verified empty in TC-16) and on limits in the database. | Switch the captcha on, as the project already plans.                                   |
| OBS-03 | There is no public list of barbershops (TC-09).                                                                                                                                                                                                          | Expected for the current scope; the planned catalogue would add it.                    |

---

## 8. Limitations: verified results versus assumptions

**Verified in this assignment, with evidence:** every PASS and FAIL in §6; the MCP handshake and
tool list (§3.4); that no test booking reached the database (§4.4); the cause and the affected
range of BUG-01 (§7.1).

**Not verified here, or assumptions:**

- Creating a real booking on the server was **not** tested, by design, to avoid real
  appointments. The server rules are covered by the project's 218 database tests; these were not
  re-run for this report and are mentioned only as context.
- The admin panel (TC-20) and Telegram (TC-21) were not tested in the browser. The 173 frontend
  tests are supporting evidence only.
- Steps were chosen by a script, not by an AI model in conversation (§4.2).
- Only headless Google Chrome on Windows was used. Safari (iOS), Firefox and real touch devices
  were not tested; mobile and tablet sizes were simulated by resizing the browser window.
- Free times depend on the day and on existing bookings. On a day with no free time in the next
  seven days, TC-13 to TC-16 would be reported as BLOCKED (the script handles this).

---

## 9. Conclusion

Playwright MCP was configured from the official Microsoft package, verified through a real MCP
handshake (25 browser tools), and used to run 25 test cases against the production Navbatly
site with 213 MCP tool calls.

The main customer journey works from start to finish: the landing page, navigation, the salon
page with correct services and prices, all four booking steps, validation of empty and invalid
input, and the confirmation screen. **No console errors and no failed network requests** were
found, the admin panel is closed to visitors who are not logged in, and the desktop and mobile
layouts are correct.

One real defect was found — **BUG-01**: the homepage scrolls sideways by 8–27 px on screens
600–1024 px wide. Its exact cause was located and a simple fix is recommended. Three areas were
not tested in the browser, each for a documented reason (no listing feature, no credentials
allowed, Telegram app required).

The assignment also showed a practical point about MCP: a server added during a running host
session only becomes available to the AI after the session restarts. A minimal MCP client,
about 100 lines long, was enough to use the same server through the standard protocol.

---

## 10. O'zbek tilida: MCP va Playwright MCP

### 10.1 MCP nima?

**Model Context Protocol (MCP)** — sun'iy intellekt (SI) ilovalarini tashqi vositalar va
ma'lumot manbalari (brauzer, ma'lumotlar bazasi, GitHub, dizayn dasturlari) bilan bog'laydigan
ochiq standart. Uni Anthropic kompaniyasi 2024-yil noyabr oyida e'lon qilgan. Oddiy qilib
aytganda, MCP — SI uchun "universal ulagich": har bir SI yordamchisi har bir vosita uchun alohida
integratsiya yozishi shart emas.

### 10.2 Nima uchun yaratilgan?

MCP'dan oldin _N_ ta SI yordamchisi va _M_ ta vosita uchun _N × M_ ta alohida integratsiya kerak
edi. MCP bilan har bir yordamchi protokolning klient qismini, har bir vosita esa server qismini
bir marta yozadi — jami _N + M_. Ruxsat berish va foydalanuvchi roziligi ham yagona qoidaga
bo'ysunadi.

### 10.3 Qanday ishlaydi?

- Xabarlar **JSON-RPC 2.0** formatida almashinadi.
- Uzatish usuli: mahalliy serverlar uchun **stdio** (dasturning standart kirish va chiqish
  oqimlari), masofaviy serverlar uchun **Streamable HTTP**.
- Ish tartibi: `initialize` (protokol versiyasi va imkoniyatlar kelishiladi) →
  `notifications/initialized` → `tools/list` (vositalar ro'yxati) → `tools/call` (vositani
  chaqirish) → ulanishni yopish.

| Rol                 | Vazifasi                                                                                               | Ushbu ishda                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| **Xost (host)**     | Foydalanuvchi ishlaydigan SI ilovasi: modelni ishga tushiradi, vositadan foydalanishga ruxsat so'raydi | Claude Code (VS Code kengaytmasi)                |
| **Klient (client)** | Xost ichidagi ulagich; har bir server bilan bitta seans ochadi                                         | `playwright` serveri uchun klient                |
| **Server**          | O'z imkoniyatlarini MCP orqali taqdim etuvchi dastur                                                   | `@playwright/mcp` — Chrome brauzerini boshqaradi |

Server taqdim etadigan uch turdagi imkoniyat:

- **Vositalar (tools)** — model chaqiradigan amallar, masalan `browser_click` (tugmani bosish).
- **Resurslar (resources)** — faqat o'qiladigan kontekst ma'lumotlari, masalan fayl yoki jadval tuzilmasi.
- **Promptlar (prompts)** — foydalanuvchi tanlaydigan tayyor so'rov shablonlari.

### 10.4 Playwright MCP

Playwright MCP — Microsoft ishlab chiqqan rasmiy MCP serveri. U haqiqiy brauzerni (bu ishda
Google Chrome) boshqaradi: sahifani ochadi, tugmalarni bosadi, formani to'ldiradi, skrinshot
oladi, konsol xatolari va tarmoq so'rovlarini o'qiydi. Sahifani rasm ko'rinishida emas,
**accessibility snapshot** — elementlar daraxti (har bir elementning roli, nomi va `[ref=e23]`
kabi havolasi) ko'rinishida qaytaradi. Shu sababli SI aynan kerakli element bilan ishlay oladi.

Ushbu ishda `@playwright/mcp@0.0.84` versiyasi loyiha ildizidagi `.mcp.json` fayli orqali
sozlandi va 25 ta brauzer vositasi mavjudligi tekshirildi.

### 10.5 Test qanday o'tkazildi va qanday cheklov bor?

Claude Code loyiha MCP serverlarini seans boshlanganda yuklaydi. Sozlama allaqachon ishlab
turgan seans davomida qo'shilgani uchun Playwright vositalari o'sha seansda SI yordamchisining
o'z vositalari ro'yxatida paydo bo'lmadi.

Shu sababli kichik MCP klient skripti (`mcp-client.mjs`, taxminan 100 qator) yozildi. U xost
protokol darajasida bajaradigan ishni takrorlaydi: `.mcp.json` dagi aynan o'sha serverni ishga
tushiradi va har bir brauzer amalini `tools/call` so'rovi orqali yuboradi. Demak, test boshqa
vosita bilan emas, aynan rasmiy Playwright MCP serveri orqali o'tkazildi (yakuniy ishga
tushirishda 213 ta chaqiruv).

Farqi bitta: qadamlar ketma-ketligini suhbatdagi SI emas, oldindan yozilgan skript belgilaydi.
Bu natijalarni takrorlanadigan qiladi, lekin SI o'zi mustaqil qaror qabul qiladigan
"izlanuvchan" testni almashtirmaydi. Vositalardan bevosita foydalanish uchun VS Code oynasini
qayta yuklash, `playwright` serverini tasdiqlash va `/mcp` buyrug'i bilan ulanganini tekshirish
kifoya.

Haqiqiy ma'lumotlar himoyasi: login va parol ishlatilmadi. Yagona to'liq bron so'rovi brauzer
ichida to'xtatilib, soxta "muvaffaqiyatli" javob bilan qaytarildi va serverga yetib bormadi.
Keyin ma'lumotlar bazasida test bronlari yo'qligi (0 ta) tekshirildi.

### 10.6 Natijalar

| Holat                          |   Soni |
| ------------------------------ | -----: |
| PASS (muvaffaqiyatli)          |     20 |
| FAIL (xato topildi)            |      2 |
| BLOCKED (bloklangan)           |      0 |
| NOT TESTED (sinab ko'rilmagan) |      3 |
| **Jami**                       | **25** |

Asosiy bron qilish jarayoni boshidan oxirigacha ishlaydi. Konsol xatolari ham, muvaffaqiyatsiz
tarmoq so'rovlari ham aniqlanmadi. Ikkala FAIL bitta xato bilan bog'liq (BUG-01): bosh sahifa
600–1024 px kenglikdagi ekranlarda (planshetlar va kichik noutbuklar) yon tomonga 8–27 px
suriladi. Sababi — noutbuk rasmining tagligi sahifadan chiqib turadi. Uchta holat sinab
ko'rilmadi: salonlar ro'yxati ilovada yo'q, admin paneli uchun parol ishlatish taqiqlangan,
Telegram Mini App esa Telegram ilovasini talab qiladi.

---

## 11. References

1. Model Context Protocol — official documentation and specification (version 2025-06-18).
   https://modelcontextprotocol.io
2. Microsoft. _Playwright MCP_ — source code and documentation. https://github.com/microsoft/playwright-mcp
3. Playwright — MCP installation guide. https://playwright.dev/mcp/installation
4. npm package `@playwright/mcp`, version 0.0.84. https://www.npmjs.com/package/@playwright/mcp
5. JSON-RPC 2.0 Specification. https://www.jsonrpc.org/specification
6. Navbatly project documentation: `README.md` and `docs/ARCHITECTURE.md` (project repository).

---

## Appendix A — Figures

All 21 screenshots were captured by the `browser_take_screenshot` tool during the final run
(2026-11-22) and are in the `screenshots/` folder. The file names are the ones produced by the
test script; the figures are ordered as the tests were carried out. No screenshot was edited,
and none shows a state that was not tested (there is no "barbershop list" screenshot because
that page does not exist).

| Figure | File                                   | Shows                                                             | Test         |
| -----: | -------------------------------------- | ----------------------------------------------------------------- | ------------ |
|      1 | `01-homepage.png`                      | Homepage, first screen, desktop                                   | TC-01        |
|      2 | `01b-homepage-full-page.png`           | Whole homepage, desktop                                           | TC-01        |
|      3 | `02-menu-jump-boshqaruv-paneli.png`    | Window after clicking "Boshqaruv paneli" in the header            | TC-02b       |
|      4 | `10-not-found-page.png`                | "Sahifa topilmadi" page                                           | TC-06        |
|      5 | `09-admin-login-validation.png`        | Admin login with validation errors                                | TC-08        |
|      6 | `03-barbershop-details.png`            | Demo salon page, desktop: cover, hours, barbers, services         | TC-10, TC-11 |
|      7 | `03b-barbershop-details-full-page.png` | Whole demo salon page, including the gallery                      | TC-10        |
|      8 | `04a-booking-barber-step.png`          | Step 2: choosing a barber, with the nearest free times            | TC-12        |
|      9 | `04b-booking-time-step.png`            | Step 3: day and free times, 10:00 selected                        | TC-13        |
|     10 | `04-booking-form.png`                  | Step 4: contact form with the booking summary                     | TC-13        |
|     11 | `05-form-validation.png`               | Empty form submitted: required-field errors                       | TC-14        |
|     12 | `05b-form-invalid-input.png`           | Invalid name and phone: errors                                    | TC-15        |
|     13 | `06-booking-confirmation.png`          | Confirmation "So'rovingiz yuborildi!" (simulated server response) | TC-16        |
|     14 | `07-desktop-homepage.png`              | Homepage, 1440×900                                                | TC-17        |
|     15 | `07-desktop-salon-page.png`            | Salon page, 1440×900                                              | TC-17        |
|     16 | `07-tablet-homepage.png`               | Homepage, 768×1024                                                | TC-17        |
|     17 | `07-tablet-salon-page.png`             | Salon page, 768×1024                                              | TC-17        |
|     18 | `07-tablet-landscape-homepage.png`     | Homepage, 1024×768                                                | TC-17        |
|     19 | `07-tablet-landscape-salon-page.png`   | Salon page, 1024×768                                              | TC-17        |
|     20 | `07-mobile-homepage.png`               | Homepage, 390×844                                                 | TC-17        |
|     21 | `07-mobile-salon-page.png`             | Salon page, 390×844                                               | TC-17        |

### Homepage and navigation

**Figure 1.** Homepage, first screen (TC-01)
![Figure 1 — homepage](screenshots/01-homepage.png)

**Figure 2.** Whole homepage (TC-01)
![Figure 2 — whole homepage](screenshots/01b-homepage-full-page.png)

**Figure 3.** After clicking "Boshqaruv paneli" in the header (TC-02b)
![Figure 3 — menu jump](screenshots/02-menu-jump-boshqaruv-paneli.png)

**Figure 4.** "Page not found" (TC-06)
![Figure 4 — not found page](screenshots/10-not-found-page.png)

**Figure 5.** Admin login with validation errors (TC-08)
![Figure 5 — admin login validation](screenshots/09-admin-login-validation.png)

### Salon page

**Figure 6.** Demo salon page, desktop (TC-10, TC-11)
![Figure 6 — salon page](screenshots/03-barbershop-details.png)

**Figure 7.** Whole demo salon page (TC-10)
![Figure 7 — whole salon page](screenshots/03b-barbershop-details-full-page.png)

### Booking workflow

**Figure 8.** Step 2 — choosing a barber (TC-12)
![Figure 8 — barber step](screenshots/04a-booking-barber-step.png)

**Figure 9.** Step 3 — choosing a day and time (TC-13)
![Figure 9 — time step](screenshots/04b-booking-time-step.png)

**Figure 10.** Step 4 — contact form (TC-13)
![Figure 10 — booking form](screenshots/04-booking-form.png)

**Figure 11.** Empty form submitted (TC-14)
![Figure 11 — form validation](screenshots/05-form-validation.png)

**Figure 12.** Invalid input (TC-15)
![Figure 12 — invalid input](screenshots/05b-form-invalid-input.png)

**Figure 13.** Confirmation screen, simulated server response (TC-16)
![Figure 13 — booking confirmation](screenshots/06-booking-confirmation.png)

### Responsive design (TC-17)

**Figure 14.** Desktop 1440×900 — homepage
![Figure 14](screenshots/07-desktop-homepage.png)

**Figure 15.** Desktop 1440×900 — salon page
![Figure 15](screenshots/07-desktop-salon-page.png)

**Figure 16.** Tablet 768×1024 — homepage (BUG-01: 16 px overflow, not visible without a scrollbar)
![Figure 16](screenshots/07-tablet-homepage.png)

**Figure 17.** Tablet 768×1024 — salon page
![Figure 17](screenshots/07-tablet-salon-page.png)

**Figure 18.** Tablet landscape 1024×768 — homepage (BUG-01: 27 px overflow)
![Figure 18](screenshots/07-tablet-landscape-homepage.png)

**Figure 19.** Tablet landscape 1024×768 — salon page
![Figure 19](screenshots/07-tablet-landscape-salon-page.png)

**Figure 20.** Mobile 390×844 — homepage
![Figure 20](screenshots/07-mobile-homepage.png)

**Figure 21.** Mobile 390×844 — salon page
![Figure 21](screenshots/07-mobile-salon-page.png)

---

## Appendix B — Submission contents and how to reproduce

```
NAVBATLY_ASSIGNMENT/
├── README.md                        overview of the submission
├── NAVBATLY_QA_REPORT.md            this report
├── screenshots/                     21 screenshots (Appendix A)
├── mcp-config/.mcp.json             Playwright MCP configuration (copy of the project file)
├── test-results/
│   ├── qa-results.json              raw results of the final run (25 test cases)
│   ├── overflow-diagnosis.json      BUG-01 measurements at 11 screen widths
│   ├── mcp-handshake-output.txt     MCP handshake and the list of 25 tools
│   └── vitest-summary.txt           project's own test suite summary (supporting evidence)
└── scripts/
    ├── mcp-client.mjs               minimal MCP client (stdio, JSON-RPC 2.0)
    ├── mcp-handshake.mjs            configuration check
    ├── run-qa.mjs                   the 25 test cases
    └── diagnose-overflow.mjs        BUG-01 diagnosis
```

The scripts are designed to run inside the project repository, where they live in
`test-results/` next to `.mcp.json`. From the project root, with Node.js 18+ and Google Chrome
installed:

```
node test-results/mcp-handshake.mjs      # configuration check (≈10 s)
node test-results/run-qa.mjs             # full run, ≈2 min; writes qa-results.json and screenshots
node test-results/diagnose-overflow.mjs  # BUG-01 measurements
```

`QA_BASE=http://localhost:5173` runs the same tests against a local development server.
