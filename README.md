# ATLAS Installation Guide

ATLAS (**ATS Ready Talent Language Analysis System**) runs on a custom n8n Docker setup with Playwright, OpenAI, Serper, Google Drive, Google Docs, Google Sheets, and Gmail integrations.

This guide walks you through installing Docker, preparing Google Drive folders, building the custom n8n container, creating Google API credentials, and running the ATLAS workflow.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [1. Prepare Google Drive](#1-prepare-google-drive)
- [2. Create an OpenAI API Key](#2-create-an-openai-api-key)
- [3. Create a Serper API Key](#3-create-a-serper-api-key)
- [4. Build and Run n8n](#4-build-and-run-n8n)
- [5. Import the ATLAS Workflow](#5-import-the-atlas-workflow)
- [6. Configure Google APIs](#6-configure-google-apis)
- [7. Connect Google Credentials in n8n](#7-connect-google-credentials-in-n8n)
- [8. Connect OpenAI Credentials in n8n](#8-connect-openai-credentials-in-n8n)
- [9. Add Serper API Key to HTTP Request for Job Boards](#9-add-serper-api-key-to-http-request-for-job-boards)
- [10. Configure Google Sheets, Docs, Drive, and Email Workflow Nodes](#10-configure-google-sheets-docs-drive-and-email-workflow-nodes)
- [11. Add Job URLs Manually to the Tracker](#11-add-job-urls-manually-to-the-tracker)
- [12. Run noVNC Before Using ATLAS](#12-run-novnc-before-using-atlas)
- [13. Start Applying with ATLAS](#13-start-applying-with-atlas)
- [Important Security Notes](#important-security-notes)

---

## Prerequisites

Before starting, install Docker Desktop:

[Download Docker Desktop](https://www.docker.com/products/docker-desktop/)

You also need the following ATLAS files in the same local setup folder:

- `Dockerfile`
- `apply.js`
- `fetch.js`
- `builtin.js`
- `ATLAS (ATS ready Talent Language Analysis System).json`

---

## 1. Prepare Google Drive

1. Open Google Drive.
2. Create a folder named:

```text
JOB SEARCH
```

3. Inside the `JOB SEARCH` folder, create two folders:

```text
TEMPLATES
RESUME AND COVER LETTERS
```

4. Change the sharing permission for the `RESUME AND COVER LETTERS` folder to:

```text
Anyone with the link
```

5. Save these files inside the `TEMPLATES` folder by making a copy of each original file:

- [Cover_Letter_Template](https://docs.google.com/document/d/15y8emTlMNDY_XizlWB7rQmn8kRb1DzXCPaiYf_Vm5Sg/edit?usp=drive_link)
- [Resume_Template](https://docs.google.com/document/d/1LbQ561cdQ_fKOa95jC5lvwQCTJ_gko8gIReN9gia3c4/edit?usp=drive_link)

6. Save this file inside the main `JOB SEARCH` folder by making a copy of each original file:

- [JOB SEARCH TRACKER](https://docs.google.com/spreadsheets/d/1lwNEtrcWFTpRRsEr5TEjxLWb4dl0LPU7RwYaz8TW-aE/edit?usp=drive_link)

---

## 2. Create an OpenAI API Key

1. Go to the OpenAI API keys page:
   [Create an OpenAI API key](https://platform.openai.com/api-keys)
2. Create a new key.
3. Copy the key.
4. Keep it somewhere safe temporarily.

You will use it in the `docker run` command by replacing:

```text
OPENAI KEY
```

with your actual OpenAI API key.

---

## 3. Create a Serper API Key

1. Go to Serper:
   [Create a Serper API key](https://serper.dev/)
2. Sign up or sign in.
3. Open your Serper dashboard.
4. Copy your API key.
5. Keep it somewhere safe temporarily.

You will add this key inside the `HTTP Request for Job Boards` node in n8n.

---

## 4. Build and Run n8n

Open PowerShell and move into the folder where you saved:

- `Dockerfile`
- `apply.js`
- `fetch.js`
- `builtin.js`

Run the commands below.

### Build the custom n8n image

```powershell
docker build --pull --no-cache -t n8n-custom .
```

### Create the n8n Docker volume

```powershell
docker volume create n8n_data
```

### Run the n8n container

Replace `OPENAI KEY` with your real OpenAI API key before running this command.

```powershell
docker run -it --name n8n --user root -p 5678:5678 --shm-size=2gb -p 8080:8080 -e GENERIC_TIMEZONE="America/New_York" -e TZ="America/New_York" -e N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=false -e N8N_RUNNERS_ENABLED=true -e N8N_BASIC_AUTH_ACTIVE=true -e N8N_BASIC_AUTH_USER="admin" -e NODES_EXCLUDE="[]" -e N8N_COMMAND_MAX_BUFFER=113246208 -e NODE_FUNCTION_ALLOW_BUILTIN=fs -e N8N_BASIC_AUTH_PASSWORD="strongpassword" -e OPENAI_API_KEY="OPENAI KEY" -e N8N_BLOCK_FS_WRITE_ACCESS=false -e N8N_RESTRICT_FILE_ACCESS_TO=/home/node/scripts/ -v n8n_data:/home/node n8n-custom
```

When the command finishes loading, Open n8n in your browser:

[http://localhost:5678](http://localhost:5678)

---

## 5. Import the ATLAS Workflow

1. Create your n8n account.
2. Click **Start from scratch**.
3. Click the **three dots** in the top-right corner.
4. Click **Import from file**.
5. Upload:

```text
 ATLAS (ATS ready Talent Language Analysis System).json
```

---

## 6. Configure Google APIs

### Create a Google Cloud project

1. Go to Google Cloud project creation:
   [Create a Google Cloud project](https://console.cloud.google.com/projectcreate)
2. Create a new project for ATLAS.

### Open APIs & Services

Go to the APIs dashboard:

[Google Cloud APIs Dashboard](https://console.cloud.google.com/apis/dashboard)

Make sure your new project is selected:

Click **Library** on the left side:

Search for and enable these APIs:

- `Google Docs API`
- `Google Sheets API`
- `Gmail API`
- `Google Drive API`

### Configure the OAuth consent screen

1. Click **OAuth consent screen**.
2. Click **Get started**.
3. Fill out the form.
4. Click **Create**.

### Create an OAuth client

After creating the OAuth consent screen:

1. Click **Create OAuth client**.
2. Set **Application type** to:

```text
Web application
```

3. Set **Authorized JavaScript origins** to:

```text
http://localhost:5678
```

4. Set **Authorized redirect URIs** to:

```text
http://localhost:5678/rest/oauth2-credential/callback
```

5. Click **Create**.
6. Click **OK**.
7. Click **Clients** on the left side.
8. Open the client you just created.
9. Save the following values:

- `Client ID`
- `Client secret`

### Publish the OAuth app

1. Click **Audience** on the left side.
2. Click **Publish app**.
3. Click **Confirm**.

---

## 7. Connect Google Credentials in n8n

In your imported ATLAS workflow, find the Google-related nodes:

- `Google Docs node`
- `Google Sheets node`
- `Gmail node`
- `Google Drive node`

For each Google node:

1. Click the node.
2. Click **Set up credential**.
3. Paste your Google Cloud `Client ID` and `Client secret`.
4. Click **Sign in with Google**.
5. Choose your Google account.
6. Click **Advanced**.
7. Click **Go to ATLAS (unsafe)**.
8. Check all permission boxes requested by Google.
9. Click **Continue**.

---

## 8. Connect OpenAI Credentials in n8n

1. Click the OpenAI node.
   **OpenAI node**
2. Click **Set up credential**.
3. Paste your OpenAI API key.
4. Click **Save**.

---

## 9. Add Serper API Key to HTTP Request for Job Boards

In your imported ATLAS workflow, find the node named:

```text
HTTP Request for Job Boards
```

Open the node and add your Serper API key to the request headers.

Use this header:

```text
X-API-KEY
```

Set the value to your actual Serper API key.

Also make sure the request includes this content-type header if it is not already present:

```text
Content-Type: application/json
```

The node should send requests to the Serper API endpoint used by the workflow. For Google Search results, the endpoint is usually:

```text
https://google.serper.dev/search
```

Do not paste the Serper API key into code files or upload it to GitHub. Keep it only in n8n credentials, node headers, or local environment variables.

---

## 10. Configure Google Sheets, Docs, Drive, and Email Workflow Nodes

After configuring the Serper API key, open the following nodes in the imported ATLAS workflow and update them with the settings below.

> Use your real Google Sheet, Google Docs templates, Drive folders, and node credentials. The examples below assume your tracker document is named `job search tracker` and the sheet tab is named `sheet1`.

### Get Rows to check jobs

Set this Google Sheets node to check whether today's jobs already exist in the tracker.

```text
Document: job search tracker
Sheet: sheet1
```

Filters:

```text
Column: JOB POSTING DATE
Value: {{ $now.toFormat('MM/dd/yyyy') }}
```

### Add New Jobs

Set this Google Sheets node to add new jobs to the tracker.

```text
Document: job search tracker
Sheet: sheet1
Mapping Column Mode: Map Each Column Manually
```

Values to send:

```text
JOB BOARD: {{ $json.source }}
JOB POSTING DATE: {{ $now.toFormat('MM/dd/yyyy') }}
JOB POSTING TIME: {{ $now.toFormat('HH:mm') }}
JOB URL: {{ $json.job_url }}
VISA STATUS: {{ $json.visa_status }}
```

### New Jobs

Set this Google Sheets node to pull jobs that still need ATLAS processing.

```text
Document: job search tracker
Sheet: sheet1
```

Filters:

```text
Column: ATLAS STATUS
Value: {{ "" }}

Column: JOB POSTING DATE
Value: {{ $now.toFormat('MM/dd/yyyy') }}

Combine Filters: AND
```

### Cover Letter Template

Set this Google Docs/Drive template node to use the cover letter template and generate a company-specific file name.

```text
File: Cover_Letter_Template
Parent Drive: My Drive
Parent Folder: Templates
File Name: YOUR NAME COVER LETTER {{ $('Big Six Skills Map').item.json['Company Name'] }} {{ $('Big Six Skills Map').item.json['Job Title'] }}
```

### Resume Template

Set this Google Docs/Drive template node to use the resume template and generate a company-specific file name.

```text
File: Resume_Template
Parent Drive: My Drive
Parent Folder: Templates
File Name: YOUR NAME RESUME {{ $('Big Six Skills Map').item.json['Company Name'] }} {{ $('Big Six Skills Map').item.json['Job Title'] }}
```

### Upload Cover Letter.pdf

Set this Google Drive node to upload the generated cover letter PDF.

```text
Parent Drive: My Drive
Parent Folder: Resumes and Cover Letters
File Name: YOUR NAME COVER LETTER {{ $('Big Six Skills Map').item.json['Company Name'] }} {{ $('Big Six Skills Map').item.json['Job Title'] }}
```

### Upload Resume.pdf

Set this Google Drive node to upload the generated resume PDF.

```text
Parent Drive: My Drive
Parent Folder: Resumes and Cover Letters
File Name: YOUR NAME RESUME {{ $('Big Six Skills Map').item.json['Company Name'] }} {{ $('Big Six Skills Map').item.json['Job Title'] }}
```

### Update Row

Set this Google Sheets node to update the original job row after ATLAS creates the resume, cover letter, and score data.

```text
Document: job search tracker
Sheet: sheet1
Mapping Column Mode: Map Each Column Manually
Column to match on: JOB URL
```

Values to update:

```text
JOB URL: {{ $('New Jobs').item.json['JOB URL'] }}
JOB TITLE: {{ $('Big Six Skills Map').item.json['Job Title'] }}
COMPANY NAME: {{ $('Big Six Skills Map').item.json['Company Name'] }}
INDUSTRY: {{ $('Big Six Skills Map').item.json.Industry }}
BIG SIX SKILL 1: {{ $('Big Six Skills Map').item.json['Big Six Skill 1'] }}
BIG SIX SKILL 2: {{ $('Big Six Skills Map').item.json['Big Six Skill 2'] }}
BIG SIX SKILL 3: {{ $('Big Six Skills Map').item.json['Big Six Skill 3'] }}
BIG SIX SKILL 4: {{ $('Big Six Skills Map').item.json['Big Six Skill 4'] }}
BIG SIX SKILL 5: {{ $('Big Six Skills Map').item.json['Big Six Skill 5'] }}
BIG SIX SKILL 6: {{ $('Big Six Skills Map').item.json['Big Six Skill 6'] }}
RESUME: {{ $('Upload Resume.pdf').item.json.webViewLink }}
COVER LETTER: {{ $('Upload Cover Letter.pdf').item.json.webViewLink }}
ALIGNMENT SCORE (100 POINTS): {{ $('Score Map').item.json.alignment_score }}
VELOCITY SCORE (25 POINTS): {{ $('Score Map').item.json.velocity_score }}
RIGOR SCORE (25 POINTS): {{ $('Score Map').item.json.rigor_score }}
DEPTH SCORE (20 POINTS): {{ $('Score Map').item.json.depth_score }}
BASE SCORE (15 POINTS): {{ $('Score Map').item.json.base_score }}
DNA SCORE (15 POINTS): {{ $('Score Map').item.json.dna_score }}
ATLAS STATUS: Complete
RESUME AND COVER LETTER CREATED: {{ $now.toFormat('MM/dd/yyyy HH:mm') }}
ALIGNMENT SCORE REASONING: {{ $('Score Map').item.json.alignment_why }}
VELOCITY SCORE REASONING: {{ $('Score Map').item.json.velocity_why }}
RIGOR SCORE REASONING: {{ $('Score Map').item.json.rigor_why }}
DEPTH SCORE REASONING: {{ $('Score Map').item.json.depth_why }}
BASE SCORE REASONING: {{ $('Score Map').item.json.base_why }}
DNA SCORE REASONING: {{ $('Score Map').item.json.dna_why }}
```

### Get Rows For Emails

Set this Google Sheets node to find completed jobs where recruiter and hiring manager emails have not been sent yet.

```text
Document: job search tracker
Sheet: sheet1
```

Filters:

```text
Column: ATLAS STATUS
Value: Complete
```

### Get Rows For Emails With Email Status Check

Set this Google Sheets node to find completed ATLAS jobs for email status checking.

```text
Document: job search tracker
Sheet: sheet1
```

Filter:

```text
Column: RECRUITER EMAIL STATUS
Value: {{ "" }}

Column: HIRING MANAGER EMAIL STATUS
Value: {{ "" }}

Combine Filters: OR
```

### Update Recruiter Email Status

Set this Google Sheets node to mark the recruiter email as sent.

```text
Document: job search tracker
Sheet: sheet1
Mapping Column Mode: Map Each Column Manually
Column to match on: JOB URL
```

Values to update:

```text
JOB URL: {{ $('Loop Over Emails').item.json['JOB URL'] }}
RECRUITER EMAIL STATUS: Sent
```

### Update Hiring Manager Email Status

Set this Google Sheets node to mark the hiring manager email as sent.

```text
Document: job search tracker
Sheet: sheet1
Mapping Column Mode: Map Each Column Manually
Column to match on: JOB URL
```

Values to update:

```text
JOB URL: {{ $('Loop Over Emails').item.json['JOB URL'] }}
HIRING MANAGER EMAIL STATUS: Sent
```

### Get Row For Job Application

Set this Google Sheets node to find completed jobs that have not been applied to yet.

```text
Document: job search tracker
Sheet: sheet1
```

Filters:

```text
Column: ATLAS STATUS
Value: Complete

Column: JOB STATUS
Value: {{ "" }}

Combine Filters: AND
```

### Update Job Status

Set this Google Sheets node to update the application status after the application automation runs.

```text
Document: job search tracker
Sheet: sheet1
Mapping Column Mode: Map Each Column Manually
Column to match on: JOB URL
```

Values to update:

```text
JOB URL: {{ $('Loop Over JOB URLs To Apply').item.json['JOB URL'] }}
JOB STATUS: {{ $json.application_status }}
JOB APPLIED TIME: {{ $now.toFormat('MM/dd/yyyy HH:mm') }}
```

### If the PDF conversion nodes show an error

At the end of this setup section, open these two nodes once and then close them:

```text
Converting to PDF Cover Letter
Converting to PDF Resume
```

If either node shows an error during setup or when running the workflow, do not change anything first. Simply open the node, let n8n refresh the node settings, and close it. This usually clears the PDF conversion node error.

---

## 11. Add Job URLs Manually to the Tracker

### Manual Job URL Entry in Google Sheets

If you already have job URLs that you want ATLAS to process, you can manually paste them into the `JOB URL` column of the Google Sheet tracker.

Paste the job URL into:

```text
Column F: JOB URL
```

The Google Apps Script attached to the tracker will automatically fill:

```text
JOB BOARD
JOB POSTING DATE
JOB POSTING TIME
```

The script detects the job board from the URL and fills the `JOB BOARD` column using the matching dropdown value from the tracker.

After pasting a job URL, always check that the `JOB BOARD` value is correct. This is important because `apply.js` uses the `JOB BOARD` value to decide which application flow to run.

If the detected job board is wrong, manually change it using one of the dropdown options in the Google Sheet before running the ATLAS application workflow.

Supported job board values include:

```text
Lever
Greenhouse
Ashby
Wellfound
Workable
Workday
Smartrecruiters
Rippling
Breezy
Jazzhr
BuiltIn
YC
LinkedIn Jobs
Indeed
Others
```

Use `Others` only when the job URL does not match one of the supported job boards. Choosing the correct job board helps ATLAS use the right browser automation behavior during the application step.

This manual entry method is useful when you find job links yourself and want ATLAS to generate the resume, cover letter, score, and application tracking data for those jobs.

---

## 12. Run noVNC Before Using ATLAS

Before executing the ATLAS job application workflow, run noVNC in PowerShell.

Run these commands:

```powershell
docker exec -u root n8n pkill -f Xvfb
docker exec -u root n8n pkill -f x11vnc
docker exec -u root n8n pkill -f websockify
docker exec -d -u root n8n sh -c "Xvfb :99 -screen 0 1280x1024x24 -ac"
docker exec -d -u root n8n sh -c "x11vnc -display :99 -forever -nopw -rfbport 5900 -shared"
docker exec -d -u root n8n sh -c "websockify --web /usr/share/novnc 0.0.0.0:8080 127.0.0.1:5900"
```

Then open noVNC in your browser:

[http://localhost:8080/vnc.html](http://localhost:8080/vnc.html)

---

## 13. Start Applying with ATLAS

Before running the workflow, open the following nodes in n8n:

```text
Job Boards (CHANGE JOB SITES AS NEEDED)

BuiltIn (CHANGE URLs AS NEEDED)

YC (CHANGE URLs AS NEEDED)

Job Boards Map (CHANGE CODE AS NEEDED)

BuiltIn Map (CHANGE CODE AS NEEDED)

YC Map (CHANGE CODE AS NEEDED)

HTTP Request for Job Boards (CHANGE JSON IF NEEDED)

BuiltIn Job Extraction

Big Six Skills (CHANGE PROMPTS IF NEEDED)

Resume (CHANGE PROMPTS IF NEEDED)

Cover Letter (CHANGE PROMPTS IF NEEDED)

Score (CHANGE PROMPTS IF NEEDED)

Email (CHANGE PROMPTS IF NEEDED)

Recruiter Email

Hiring Manager Email

Write Resume to scripts

Write Cover Letter to scripts

Prepare Application Data Map
```

Add the required passwords and values inside those nodes. For `HTTP Request for Job Boards`, make sure the Serper `X-API-KEY` header is set before running the workflow.

### How `apply.js` works

```
`apply.js` uses a **human-in-the-loop approach**: it helps with repetitive application steps, but you stay in control through noVNC and finish/review the application manually.

`apply.js` opens the job application in Chromium and helps with the repetitive parts of applying. Be patient while it fills forms — it intentionally **waits before typing**, waits between actions, and types slowly like a human to reduce bot-detection issues.

- **Workday:** it clicks Apply, logs in or creates a new account when possible, then stops once the application form is ready so you can continue in noVNC.
- **SPA job boards** like Greenhouse, Lever, Ashby, SmartRecruiters, Breezy, and similar sites: it uploads the resume and cover letter, fills basic profile values, then adds an **Auto-Fill with AI** button beside custom text fields.
- **Other sites:** it looks for the apply/login flow, enters email/password when available, then hands control back to you.

The floating **Resume** and **Cover Letter** buttons stay on the page. Click them to view your generated resume or cover letter inside the browser, then copy details while applying.

The **Auto-Fill with AI** button reads the question label, uses your resume/profile to generate an answer, and fills the field. After it fills, it changes to **Done / Retry with details**. You can type extra instructions in the retry box, such as `make it shorter`, `mention my React project`, or `sound more natural`, then click again to regenerate the answer.

After you finish applying to a job in noVNC, **close the application tab**. This tells `apply.js` that the current job is done, so the workflow can move on and open the next job URL.
```

After noVNC is running, execute the ATLAS workflow and use the browser window at:

[http://localhost:8080/vnc.html](http://localhost:8080/vnc.html)

---

## Important Security Notes

Do **not** commit secrets to GitHub. Keep these values private:

- OpenAI API key
- Serper API key
- Google Client ID
- Google Client secret
- n8n password
- Any job portal passwords

The repository includes a `.gitignore` file to prevent local secrets, environment files, n8n data, Playwright artifacts, logs, and generated resume/cover-letter files from being committed.

Before pushing changes, make sure files such as `.env`, API keys, Google credentials, browser auth state, generated PDFs, and local n8n data are not included in your commit.
