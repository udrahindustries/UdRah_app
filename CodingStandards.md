# Antigravity Agent Coding Standards & Architecture Guidelines

> **Mandatory Rule For All AI Agents Working On The Abhivyakti Platform**
> Every Automated Agent, Pair Programmer, Subagent, And Developer Contributing To This Repository Must Strictly Adhere To The Case Conventions, Styling Rules, And Architectural Patterns Defined Below.

---

## 1. File & Directory Casing Conventions

### **PascalCase For All Files & Folders**

All Newly Created Or Renamed Files And Folders Must Use **PascalCase**.

- **Folder Structure Examples:**

  - `Frontend/`
  - `Frontend/Src/`
  - `Frontend/Src/Components/`
  - `Frontend/Src/Components/Leaderboard/`
  - `Frontend/Src/Components/Admin/`
  - `Frontend/Src/Components/Ui/`
  - `Backend/`
  - `Backend/App/`
  - `Backend/App/Routers/`
  - `Backend/App/Models/`
  - `Backend/App/Schemas/`
- **File Name Examples:**

  - `App.tsx`
  - `LeaderboardTable.tsx`
  - `Podium.tsx`
  - `RulebookPdfModal.tsx`
  - `CompetitionRouter.py`
  - `Database.py`
  - `CodingStandards.md`
- **Permitted Ecosystem Exceptions:**
  Only Standard Tooling Configuration Files That Mandate Exact Lowercase Names By Their Respective Compilers, Bundlers, Or Runtimes Are Exempt:

  - `.gitignore`, `.dockerignore`, `.env`, `.env.example`
  - `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.node.json`
  - `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`
  - `docker-compose.yml`, `Dockerfile`
  - `requirements.txt`

---

## 2. Text, Comments, Logs & Error Formatting

### **Title Case Everywhere In Code & Interfaces**

To Maintain Executive Polish And Uniformity Across All User Interfaces, Developer Consoles, And Codebase Documentation, **Title Case** Formatting Is Mandatory For:

#### **A. User-Visible UI Text (Including All Public & Admin Pages)**

- **Headings, Subheadings & Subtitles (All Admin & Public Pages):**
  - `Celebrating Cultural Majesty & Excellence`
  - `Colleges & Contingents Management`
  - `Abhivyakti 2026 Official Festival Rulebook`
  - `Admin-Only Registration Portal: Register Colleges & Institutions, Enroll Student Performers, Assign Competitions, And Manage Delegations.`
  - `Configure The Official Festival Starting Date, Countdown Timer Target, Display Ribbons, And Event Venue.`
  - `When You Add Or Edit Competitions In The Competitions Manager With Date And Time, The Homepage Countdown Automatically Detects And Counts Down To The Earliest Upcoming Competition!`
- **Buttons & Action Triggers (No Screaming All-Caps / No Forced CSS `uppercase`):**
  - `Explore Competitions`
  - `View Leaderboard`
  - `View Full Rulebook (PDF)`
  - `+ Add College`
  - `+ Register Student`
  - `+ Allot Score To Participant`
  - `Excel Bulk Upload`
  - `Authenticate & Access Deck`
- **Form Labels, Placeholders & Input Helper Text:**
  - `Search College Or Code...`
  - `Search College By Name, Short Code, Or City...`
  - `Search Student By Name, Roll No, College, Or Role...`
  - `Search Participant Name, Roll No, College...`
  - `Target Date For The Grand Festival Countdown On The Homepage.`
  - `Valedictory Award Ceremony And Closing Celebration Datetime.`
  - `Human-Friendly Date String Displayed Across The Homepage Hero Banner.`
- **Empty States & Guidance Messages:**
  - `No Gallery Photos Match Your Filters`
  - `Upload A New Photo Or Clear Search Query.`
  - `No Scored Marks Found For The Selected Criteria.`
  - `Click "Allot Score To Participant" To Select A College, Choose A Participant, And Allot Official Jury Marks.`
  - `No Student Performers Enrolled Yet For This Institution. Click Below To Add The First Student.`
- **Table Column Headers:**
  - `Rank` | `Institute & Faculty` | `Gold 🥇` | `Silver 🥈` | `Bronze 🥉` | `Events` | `Championship Points`
  - `Participant / Student` | `College / Contingent` | `Competition Arena` | `Points Allotted` | `Judge Remarks` | `Actions`
- **Toast Notifications & Alerts:**
  - `Score Updated Successfully`
  - `Rulebook Download Initialized`
  - `Authentication Failed: Invalid Credentials Provided`

#### **B. Backend Python Files (Models, Commands, Serializers, Views & Services)**

Every Single String In Backend Python Files Must Strictly Adhere To **Title Case**:

- **Django Management Commands Output & Help Messages:**
  - `help = 'Bootstrap Initial Super Admin User If Not Exists'`
  - `help = 'Seeds Initial Database With 24 Indian Universities, Competitions, Event Settings, And 2025 Gallery Photos.'`
  - `self.stdout.write(self.style.SUCCESS(f'Successfully Created Superuser "{username}" With Email "{email}".'))`
  - `self.stdout.write(self.style.WARNING(f'Superuser "{username}" Already Exists.'))`
  - `self.stdout.write("Seeding Abhivyakti 2026 Data...")`
  - `self.stdout.write(self.style.SUCCESS(f"Configured Event Setting: Starts On {setting.start_date}"))`
  - `self.stdout.write(self.style.SUCCESS(f"Seeded {gallery_count} Photos From Last Year's Event In The Gallery."))`
  - `self.stdout.write(self.style.SUCCESS("[Success] Abhivyakti Database Seeding Complete!"))`
- **Model Field `help_text` Attribute Across All Apps:**
  - `help_text="Full Institution Name, E.g. NIMS University Rajasthan"`
  - `help_text="Short Code / Abbreviation, E.g. NIMS, MUJ, BITS"`
  - `help_text="Contingent Leader Or Faculty Coordinator"`
  - `help_text="Grand Festival Starting Datetime (Used For Countdown)"`
  - `help_text="Championship Points Awarded Toward Overall Institutional Trophy"`
- **Serializer Validation Errors & Field Messages:**
  - `raise serializers.ValidationError("An Administrator Or Operator With This Username Already Exists.")`
  - `raise serializers.ValidationError({"password": "Password Is Required And Must Be At Least 6 Characters Long."})`
  - `help_text="Password For The User Account (Leave Blank On Update To Keep Unchanged)."`
- **Exceptions, Handlers & Service Error Responses:**
  - `raise ImportError("Couldn't Import Django. Are You Sure It Is Installed And Available On Your PYTHONPATH Environment Variable? Did You Forget To Activate A Virtual Environment?")`
  - `"message": f"Row {r_idx}: Institution '{raw_college}' Could Not Be Matched. Please Select A College Or Use An Official College Name/Code."`

#### **C. Code Comments & Python Docstrings (Single-Line, Multi-Line & Triple-Quotes)**

All Comments Written Inside TypeScript, JavaScript, Python, CSS, And HTML Files—As Well As **All Python Docstrings** (`"""..."""` Or `'''...'''`) Across Functions, Methods, Test Suites, Classes, And Modules—Must Strictly Be Formatted In **Title Case**.

- **TypeScript / JavaScript Comments:**

  - **Correct:**

    ```typescript
    // Harmonious Search Header Bar With Obsidian Velvet Gradient
    // Calculate Cumulative Championship Points Across All Arenas
    ```

    ```typescript
    /**
     * Harmonious Jewel-Tone Avatar Palettes Matching The Royal Festival Aesthetic.
     * Maps College Codes And Ranks To Deep Velvet Colors.
     */
    ```
  - **Incorrect:**

    ```typescript
    // calculate points
    /* table search filter function */
    ```
- **Python Comments & Docstrings (Functions, Classes & Unit Tests):**

  - **Correct (Title Case Docstrings & Inline Comments):**
    ```python
    def test_non_staff_forbidden_from_users_viewset(self):
        """Unauthenticated And Non-Staff Users Cannot Access /api/accounts/users/."""
        # Unauthenticated
        res = self.client.get('/api/accounts/users/')
        self.assertEqual(res.status_code, 401)

        # Authenticated Non-Staff
        self.client.force_authenticate(user=self.regular_user)
        res = self.client.get('/api/accounts/users/')
        self.assertEqual(res.status_code, 403)

    def test_staff_cannot_delete_other_accounts(self):
        """Staff Members Who Are Not Superusers Cannot Delete User Accounts."""
        self.client.force_authenticate(user=self.staff_user)
        res = self.client.delete(f'/api/accounts/users/{self.regular_user.id}/')
    ```
  - **Incorrect (Lower / Sentence Case Docstrings & Comments):**
    ```python
    def test_non_staff_forbidden_from_users_viewset(self):
        """Unauthenticated and non-staff users cannot access /api/accounts/users/."""
        # Authenticated non-staff

    def test_staff_cannot_delete_other_accounts(self):
        """Staff members who are not superusers cannot delete user accounts."""
    ```

#### **C. Console Logs & Debug Statements**

Every `console.log`, `console.info`, `console.warn`, And `console.error` Message Must Be Written In **Title Case**:

- **Examples:**
  ```typescript
  console.log("Festival Schedule Loaded Successfully");
  console.info("Realtime WebSocket Connection Established");
  console.error("Failed To Stream Master Rulebook PDF: Network Timeout");
  ```

#### **D. Thrown Exceptions & Error Messages**

All Error Descriptions, Exceptions, And API Error Responses Must Use **Title Case**:

- **TypeScript / JavaScript:**
  ```typescript
  throw new Error("Unable To Locate Specified College Standing In Leaderboard");
  ```
- **Python / FastAPI:**
  ```python
  raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Competition Record Not Found In Directorate Registry"
  )
  ```

#### **E. Git Commit Messages**

Every Git Commit Message Must Be Formatted In **Title Case** With Clear, Descriptive Terminology:

- **Correct:**
  - `Harmonize Leaderboard Table Colors And Add Antigravity Coding Standards`
  - `Refactor Rulebook PDF Modal With Ambient Fallback And Direct Download Actions`
  - `Update Competition Roster Seed Data To Match Master Rulebook Schedule`
- **Incorrect:**
  - `fix table colors and add rules`
  - `updated rulebook modal`

---

## 4. Layout & Mobile Responsiveness (280Px Minimum)

- **Universal Responsiveness:**
  Every Component, Modal, Table, And Grid Must Gracefully Render On Viewports Down To **280Px** Width (E.G., Galaxy Fold Collapsed) Up To Ultra-Wide 4K Screens.
- **Zero Horizontal Overflow:**
  No Component May Introduce Unexpected Horizontal Scrollbars (`overflow-x: hidden` On Page Roots, Responsive Wrapping With `flex-wrap` And `grid-cols-1`).
- **Component Breathing Room:**
  Ensure Ample Vertical Spacing (`space-y-6 sm:space-y-8`) So Floating Decorative Elements (Diyas, Sparks, Floating Cards) Never Collide Or Obscure Critical Text Or Countdown Timers.

---

## 5. Coolify Docker Compose Deployment Standards

All Production Deployments For The Abhivyakti Platform Follow Standardized Docker Compose Orchestration Managed Through Coolify. Every Container Definition, Dockerfile, And Network Policy Must Comply With The Following Mandatory Architectural Rules:

### **A. Ingress Port Exposure & Host Conflict Prevention**
- **Internal Port Exposure Only:**
  The Edge Reverse Proxy Gateway (`nginx`) Must Expose Port `80` Using Docker's `expose:` Directive, Never Binding Hardcoded Host Ports (`ports: - "80:80"`).
- **Coolify Reverse Proxy Integration:**
  Coolify Uses Host Traefik/Caddy Reverse Proxies Binding Port 80/443. Exposing Port 80 Internally Allows Coolify's Ingress Engine To Connect Cleanly Without Host Port Collisions.
- **Local Development Overrides:**
  Developers Requiring Local Host Port Publishing Must Utilize A Git-Ignored `docker-compose.override.yml` (E.G., Mapping `"8080:80"`).

### **B. Service Healthchecks & Dependency Graph Ordering**
- **Strict Dependency Conditions:**
  To Eliminate Intermittent 502 Bad Gateway Errors During Cold Boot Or High-Load Restarts, Multi-Tier Services Must Strictly Enforce Healthcheck Preconditions:
  - `nginx` Must Require `backend: condition: service_healthy`
  - `backend` Must Require `db: condition: service_healthy`
- **Native Healthcheck Directives:**
  - `nginx`: `test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://127.0.0.1/healthz"]`
  - `backend`: `test: ["CMD", "curl", "-f", "http://127.0.0.1:8000/api/festival/overview/"]`
  - `db`: `test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]`

### **C. SSL Termination, Proxy Headers & Origin Trust**
- **Forwarded Protocol Resolution:**
  Coolify Terminates TLS At Its Ingress Proxy. The Backend Django Application Must Honor The Forwarded Protocol Headers:
  ```python
  SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
  USE_X_FORWARDED_HOST = True
  USE_X_FORWARDED_PORT = True
  ```
- **Dynamic CSRF & CORS Origin Trust:**
  All Associated Production Domains (E.G., `https://*.nsiif.in`, `https://*.nimsuniversity.org`) And Dynamic Review Subdomains Must Be Authorized In `CSRF_TRUSTED_ORIGINS` And `CORS_ALLOWED_ORIGIN_REGEXES`.

### **D. Zero-Touch Container Bootstrapping & Self-Healing**
- **Automated Lifecycle Hooks:**
  The Backend Entrypoint Script (`Backend/entrypoint.sh`) Must Automatically Execute Migrations And Asset Pipelines On Startup Without Manual SSH Or CLI Intervention:
  ```sh
  python Manage.py migrate --noinput
  python Manage.py collectstatic --noinput
  ```
- **Database-Vendor Aware Migrations:**
  All Custom SQL Migrations (Such As PostgreSQL Views Like `0012_create_leaderboard_view.py`) Must Detect The Active Database Engine Dynamically, Providing Native PostgreSQL Syntax In Production And Clean ANSI SQL / SQLite Syntax For Test Runners And Emergency Fallbacks.
- **Idempotent Superuser Credential Verification:**
  Directorate Administrative Accounts (Configured Securely Via Environment Variables, E.G., `ADMIN_USERNAME`) Must Be Automatically Verified Or Provisioned Upon Boot, Ensuring Management Access Remains 100% Reliable Even On Fresh Cloud Volumes.

### **E. Edge Nginx Reverse Proxy Architecture**
- **Dedicated Route Segregation:**
  The Unified Production Nginx Server Must Clearly Segregate Upstream Locations:
  - `/api/` -> Upstream Django WSGI Directorate (`backend:8000`)
  - `/django-admin/` -> Native Django ORM Administration (`backend:8000`)
  - `/static/` -> Django Static Assets Served Via WhiteNoise (`backend:8000`)
  - `/media/` -> Uploaded Festival Media, Photos, And Rulebook PDFs (`backend:8000`)
  - `/` -> Upstream React Single Page Application (`frontend:5173`) With Client-Side Route Support

---

## 6. Summary Quick-Reference Card

| Category                    | Standard   | Example                                                                           |
| :-------------------------- | :--------- | :-------------------------------------------------------------------------------- |
| **Folder Names**      | PascalCase | `Frontend/Src/Components/Leaderboard/`                                          |
| **File Names**        | PascalCase | `LeaderboardTable.tsx`, `RulebookPdfModal.tsx`                                |
| **UI Headings**       | Title Case | `Colleges & Contingents Management`                                             |
| **Button Text**       | Title Case | `View Full Rulebook (PDF)`                                                      |
| **Table Headers**     | Title Case | `Championship Points`                                                           |
| **Code Comments**     | Title Case | `// Calculate Total Points Across All Categories`                               |
| **Python Docstrings** | Title Case | `"""Unauthenticated And Non-Staff Users Cannot Access /api/accounts/users/."""` |
| **Test Descriptions** | Title Case | `"""Staff Members Who Are Not Superusers Cannot Delete User Accounts."""`       |
| **Console Logs**      | Title Case | `console.log("Festival Schedule Loaded Successfully")`                          |
| **Error Messages**    | Title Case | `throw new Error("Unable To Connect To Server")`                                |
| **Git Commits**       | Title Case | `git commit -m "Harmonize Table Colors And Modal Themes"`                       |
| **Docker Ports**      | Coolify    | `expose: ["80"]` (No Hardcoded Host Port 80 Bindings)                           |
| **Healthchecks**      | Mandatory  | `condition: service_healthy` On Upstream Dependencies                          |

---

*This Document Is Automatically Referenced By Antigravity Agents During Code Generation, Editing, Refactoring, And Code Review.*
