# Azure DevOps Dashboard

A dashboard that pulls test plan, test run, and defect data from Azure DevOps and shows it in one place.

This guide assumes **zero coding experience**. Just follow the steps in order.

## 1. Install Node.js

This project needs a program called **Node.js** to run. If you don't have it yet:

1. Go to [nodejs.org](https://nodejs.org).
2. Download the **LTS** version and run the installer.
3. Click "Next" through the installer with the default options.

To check it worked, open a terminal (on Windows: search for "PowerShell" in the Start menu) and type:

```
node --version
npm --version
```

You should see version numbers printed (e.g. `v22.14.0`). If you instead see an error, restart your computer and try again.

## 2. Get the project files

If you received this project as a `.zip` file, extract it anywhere on your computer (e.g. your Desktop).

If you're using Git, clone the repository instead:

```
git clone <repository-url>
```

## 3. Open a terminal in the project folder

1. Open the project folder in File Explorer.
2. In the address bar at the top, type `powershell` and press Enter. This opens a terminal already pointed at the right folder.

## 4. Install the project's dependencies

This downloads all the code libraries the project needs. In the terminal, run:

```
npm install
```

Then do the same inside the `client` folder:

```
cd client
npm install
cd ..
```

This can take a minute or two. You'll see a progress bar - just wait for it to finish.

## 5. Set up your configuration file

The app needs to know which Azure DevOps organization and project to pull data from, and a token to access it.

1. Find the file named `.env.example` in the project folder.
2. Make a copy of it and rename the copy to `.env` (just `.env`, nothing else).
3. Open `.env` in any text editor (Notepad works fine) and fill in your own values:
   - `AZDO_PAT` - your Azure DevOps Personal Access Token (ask whoever manages your Azure DevOps for one, or generate it yourself under Azure DevOps > User Settings > Personal Access Tokens).
   - `AZDO_ORG` - your Azure DevOps organization name.
   - `AZDO_PROJECT` - your Azure DevOps project name.
4. Save the file.

**Never share your `.env` file or your token with anyone** - it works like a password.

## 6. Run the app

Back in the terminal (at the project's root folder, not inside `client`), run:

```
npm run dev:all
```

Wait until you see messages saying the server and the client are running. Then open your web browser and go to:

```
http://localhost:5173
```

You should see the dashboard. To stop the app, go back to the terminal and press `Ctrl + C`.

## Troubleshooting

- **"npm is not recognized"**: Node.js isn't installed correctly. Re-do step 1 and restart your terminal.
- **Blank page or errors about Azure DevOps**: double-check the values in your `.env` file (step 5) - typos in the org/project name or an expired token are the most common causes.
- **Nothing happens after `npm run dev:all`**: make sure you ran `npm install` in both the root folder and the `client` folder (step 4).
