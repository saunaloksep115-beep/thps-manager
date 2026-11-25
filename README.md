# THPS School Manager Online (v11)

This is the online School Manager for Tom Hoey Primary School. You install it on GitHub Pages, like TDBMS. The data is kept in your Google Sheet, "THPS Marks Online", so the Excel workbook, the marks app and this app all share the same students and marks.

## What is inside
| File | What it is |
|---|---|
| `index.html`, `app.js`, `app.css` | The School Manager app. It has these pages: Dashboard, Students, Assessment, Teachers, Finance, School Reports, Admin Routines, Infrastructure and Other Forms. |
| `marks.html` | The marks entry app (THPS Marks Online). It also has a Students tab and the ID cards. |
| `config.js` | Paste your Google web app link (/exec) here. |
| `sw.js`, `manifest.webmanifest` | These let you install the app and open it without signal. |
| `icons/`, `img/` | The Windows 11 icons (Microsoft Fluent Emoji, MIT licence), plus the school and province logos. |

## Step 1: update the Google Sheet (do this once)
1. Open the **THPS Marks Online** Google Sheet and go to **Extensions › Apps Script**.
2. Replace everything in **Code.gs** with the new `Code.gs`.
3. Click **+ › Script**, name it **Manager**, and paste in `Manager.gs`.
4. Replace **Index.html** with the new `Index.html`. Logos.gs stays the same.
5. Choose **setup** in the function list and click **Run**. This adds the new tabs: Finance, SchoolReports, Inventory, Events, Staff and FormsLog.
6. Go to **Deploy › Manage deployments**, click the pencil icon, set **Version: New version**, and click **Deploy**. The /exec link stays the same.

## Step 2: put the app on GitHub Pages
1. Sign in to GitHub (account `saunaloksep115-beep`) and create a new public repository named **thps-manager**.
2. Click **Add file › Upload files** and drag in **all the files and folders** from this folder. Then click **Commit changes**.
3. Open `config.js`, click the pencil icon, and paste your /exec link between the quotes. Click **Commit changes**.
4. Go to **Settings › Pages**. Under **Branch**, choose **main** and **/ (root)**, then click **Save**.
5. After about a minute, the app opens at **https://saunaloksep115-beep.github.io/thps-manager/**.
6. On a phone, open the link in Chrome and choose **⋮ › Add to Home screen**. On a laptop, click the install icon in the address bar.

## Signing in
- Everyone uses the **same UserName and Password as the Assessment (SARRS)**. These come from the Teachers list that Excel uploads with **Upload Online**.
- **Administrator** (Head Teacher): can open everything.
- **Senior Teacher**: can open their own classes plus the classes they supervise, the school reports, Admin Routines and Teachers.
- **Teacher**: can open their own class, enter marks, add or correct students in their class, write reports and record forms.
- The first sign-in on each device needs the internet. After that, the app opens without signal. Any changes made offline wait in an outbox and upload when the network comes back.

## How Excel and the online system stay together
- **Students**: Excel's **Upload Online** sends the class lists. Students added or corrected online show at once for the teachers. They also come into Excel when you click **Download Online** in the Assessment homepage.
- **Marks**: teachers type marks online, and **Download Online** brings them into Excel.
- **Finance, reports, events, inventory, staff and forms** typed online stay in the Google Sheet. Each page has an **Export (CSV)** button, and the file opens in Excel.
