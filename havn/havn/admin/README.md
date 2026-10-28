# Havn Admin

A standalone console for platform moderation, separate from the main Havn app.
It signs in with a normal Havn account that has admin rights and drives the
existing `/api/admin/*` endpoints — search users, ban/unban, grant/remove the
verified badge, delete accounts, and see headline stats.

The backend is unchanged: every action here maps to a route that already
existed (`admin.controller.js`), and the server enforces `requireAdmin` on all
of them regardless of what this UI allows.

## Run it

```bash
cd admin
npm install
npm run dev
```

It starts on http://localhost:5174 (the main frontend uses 5173, so both can
run at once).

## Two setup steps

1. **Make an account an admin.** Admins are bootstrapped by email: set
   `ADMIN_EMAILS` in the backend `.env` to a comma-separated list, then sign up
   (or already have) an account with one of those emails. That account gets
   `isAdmin: true` and can sign in here.

2. **Allow this origin on the backend.** The admin app is a different origin
   from the API, so it must be in the backend's allowed-origins list or CORS and
   cookies will be rejected. Set `ADMIN_URL` in the backend `.env`:

   ```
   ADMIN_URL=http://localhost:5174
   ```

   `ADMIN_URL` is dedicated to this console and is added on top of the frontend
   origins (`CLIENT_URL`/`CLIENT_URLS`). For a deployed admin app, set it to the
   production URL instead. (Adding the origin to `CLIENT_URLS` also works, but
   `ADMIN_URL` keeps the two concerns separate.)

## Configuration

Copy `.env.example` to `.env` and set `VITE_BACKEND_URL` if the backend isn't at
`http://localhost:3000`. In production point it at the Render backend URL.
