# /api-go-live

Run this command when your backend API is fully implemented and you're ready to switch from mock data to the live API.

## What this does

- Switches the app from MSW mock mode to the real backend
- Scans for any stray mock patterns that may have crept into the codebase
- Generates a manual testing checklist from the FRS to guide your verification

The switchover is a single env-var change. No application code needs to change — all API calls already go through `web/src/lib/api/client.ts`, which always calls the real fetch. Removing the mock env var is all it takes.

---

## Steps

### Step 1 — Ask for the Live API URL

Use `AskUserQuestion`:
- "What is the base URL for your live API?"
- Options: provide a text input (or common values like "http://localhost:8042" if the default is still correct)

Also ask:
- "Do you want to keep the mock files for reference, or remove them?"
- Options: "Keep web/src/mocks/ (recommended)" / "Remove web/src/mocks/"

### Step 2 — Update `web/.env.local`

Read the current `web/.env.local`. Make two changes:
1. Set `NEXT_PUBLIC_API_BASE_URL` to the live URL the user provided
2. Remove the `NEXT_PUBLIC_USE_MOCK_API=true` line entirely

Write the updated file back. The app will now call the real backend on next restart.

### Step 3 — Scan for Stray Mock Patterns

Scan `web/src/` (excluding `web/src/mocks/` and `**/__tests__/**`) for patterns that suggest inline or ad-hoc mocking. Run all three searches in parallel using the Grep tool:

1. `Grep` pattern `NEXT_PUBLIC_USE_MOCK_API` in `web/src/` with glob `*.{ts,tsx}` (exclude mocks dir manually from results)
2. `Grep` pattern `\b(mockData|fakeData|hardcodedData|dummyData)\b` in `web/src/` with glob `*.{ts,tsx}`
3. `Grep` pattern `\bif\b.*\b(useMock|mockApi|MOCK_API|USE_MOCK)\b` in `web/src/` with glob `*.{ts,tsx}`

Filter out results from `web/src/mocks/` and `**/__tests__/**` directories before reporting.

If anything is found, report it clearly:

```
Stray mock patterns found — please review before going live:

  web/src/components/UserList.tsx:42
    const data = process.env.NEXT_PUBLIC_USE_MOCK_API ? hardcodedUsers : ...

  [etc]
```

If nothing is found, confirm: "No stray mock patterns found — the codebase is clean."

### Step 4 — Handle Mock Files (per user choice)

**If "Keep web/src/mocks/":** Leave all mock files in place. Confirm: "Mock files kept at `web/src/mocks/`. They won't be active without `NEXT_PUBLIC_USE_MOCK_API=true`, but they're available if you ever need to revert."

**If "Remove web/src/mocks/":** Delete the directory and remove the `MockProvider` import and wrapping from `web/src/app/layout.tsx`. Also delete `web/src/components/MockProvider.tsx`. Confirm what was removed.

### Step 5 — Generate Manual Testing Checklist

Read `generated-docs/specs/feature-requirements.md` (FRS) and `generated-docs/specs/api-spec.yaml`.

Generate a checklist of key workflows to manually verify against the live API. Write it to `generated-docs/context/go-live-checklist.md`:

```markdown
# Go-Live Testing Checklist

Generated: [ISO date]
Live API URL: [url]

## How to use
Work through each item in the browser with the dev server pointing at the live API.
Check each box as you verify it.

---

## [Workflow Name — from FRS]

**Endpoints involved:** `GET /v1/resource`, `POST /v1/resource`

- [ ] Happy path: [describe what success looks like]
- [ ] Loading state: spinner/skeleton visible while request is in flight
- [ ] Error state: appropriate error message shown when API returns 4xx/5xx
- [ ] [Any edge cases from FRS acceptance criteria]

---

[repeat for each key workflow]

---

## General Checks

- [ ] No console errors in the browser developer tools
- [ ] Network tab shows requests going to [live URL], not localhost mock
- [ ] Authentication (if applicable) working end-to-end
- [ ] No CORS errors in the browser console
```

After writing the file, display the checklist to the user in the conversation.

### Step 6 — Final Summary

Output a clear summary:

```
Ready for live testing.

Changes made:
  [x] NEXT_PUBLIC_API_BASE_URL set to [url]
  [x] NEXT_PUBLIC_USE_MOCK_API removed
  [x] web/src/mocks/ removed  — if chosen

Next steps:
  1. Restart the dev server: cd web && npm run dev
  2. Work through the checklist at generated-docs/context/go-live-checklist.md
  3. Check the browser console for any errors or unexpected mock warnings
```

---

## Notes

- To revert to mock mode at any time, add `NEXT_PUBLIC_USE_MOCK_API=true` back to `web/.env.local` and restart the dev server (mock files must still be present)
- The checklist at `generated-docs/context/go-live-checklist.md` persists across sessions — you can track progress there over multiple sessions
