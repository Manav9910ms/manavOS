# manavOS

Public cloud workspace for manavos.vercel.app with an EC2 backbone.

## Experience

- Public guest mode remains available with no forced login.
- **Sign in / Sign up** is available from the landing page.
- Email/password and Google sign-in use Firebase Authentication.
- The EC2 backend exchanges and verifies Firebase ID tokens through Firebase Authentication's HTTPS REST API.
- A signed-in Firebase UID is linked to a persistent manavOS workspace in SQLite.
- Files, Terminal and MS-OS Desktop use that same workspace.

## Firebase setup

The browser uses the Firebase web configuration for project `manav-os`. The values can be supplied through `NEXT_PUBLIC_FIREBASE_*` environment variables; the current client config also contains the project's public web configuration as a fallback.

The EC2 server verifies ID tokens with the Firebase Auth REST `accounts:lookup` endpoint. Set `FIREBASE_WEB_API_KEY` to the project's Web API key when deploying outside this repository's current fallback configuration.

Enable Email/Password and Google in Firebase Authentication. For web sign-in, add the production web hostname (for example `manavos.vercel.app`) to Firebase Authentication's authorized domains.

## EC2

`npm install`
`npm run build`
`npm run check`
`pm2 restart manavOS --update-env`
`pm2 save`

The public HTTP API is proxied from Vercel to the EC2 backbone through `MANAVOS_BACKEND_URL`.

## Security

Firebase ID tokens are verified server-side before an account is attached to a manavOS workspace. No Firebase private key is required for this integration.

The terminal is sandboxed with Bubblewrap and only the user's workspace is writable. Do not expose the EC2 host filesystem or SSH directly to the browser.