# Authentication Intake Policy

## Core Principle

Authentication is a critical architectural decision. **Never simplify, fold, or skip authentication questions during INTAKE.** Always present the full set of options explicitly, even when the answer seems obvious from existing documentation.

---

## Mandatory Rules

1. **Always ask the explicit authentication question** with all three options:
   - "Backend For Frontend (BFF)" — with description of what it means
   - "Frontend-only (next-auth)" — with description and trade-off warning
   - "Custom" — with open-ended follow-up

2. **Never infer the auth method** from API specs, documentation, or other context. The user must explicitly choose.

3. **Never fold auth into a simpler question.** Do not combine it with other questions or rephrase it as "How will authentication work?" — use the exact options above.

4. **If BFF is selected**, always ask the three follow-up sub-questions (login URL, userinfo URL, logout URL) and display the backend requirements note.

5. **If frontend-only is selected**, always display the trade-off warning about backend API calls not carrying session context.

6. **If Custom is selected**, always ask the open-ended follow-up for full details.

## Rationale

Authentication architecture affects every layer of the application — routing, middleware, API client configuration, session management, and security. Skimming over it leads to incorrect assumptions that are expensive to fix later. Even when documentation hints at an answer, the user must confirm explicitly.
