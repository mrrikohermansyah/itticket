## Approach
- Use the Live Server extension if available; otherwise launch a lightweight static server on port 5500 via Node or Python.

## Steps (Live Server)
1. Open Settings (Ctrl+,) and search "Live Server".
2. Set `Live Server › Settings: Port` to `5500`.
3. If Settings doesn’t show Live Server, add a workspace setting after approval:
   - Create `.vscode/settings.json` with:
     ```json
     { "liveServer.settings.port": 5500 }
     ```
4. Stop and restart Live Server, then navigate to:
   - `http://localhost:5500/pages/admin/index.html`
   - `http://localhost:5500/pages/user/dashboard.html`
   - `http://localhost:5500/pages/auth/login.html`

## Steps (No Live Server)
1. From the project root `d:\PC20024MEB\RIko\WEB Testing\it-ticket`, run one of:
   - Node: `npx http-server -p 5500 .`
   - Node (serve): `npx serve -l 5500 .`
   - Python: `python -m http.server 5500`
2. Click the printed `http://localhost:5500/` URL to open the in-app Preview and navigate to your pages.

## Validation
- Confirm the preview loads from `http://localhost:5500/` and pages respond.
- If "port in use" occurs, I will scan for the conflicting process and switch to 5501, then retry.