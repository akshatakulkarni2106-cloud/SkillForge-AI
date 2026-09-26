# SkillForge AI — Test. Improve. Grow.
Stage 1 of 6: auth, dashboard, MongoDB, app shell. AI service is a stub until Stage 2.

## Run
1. MongoDB running locally (or set `MONGO_URI` to Atlas).
2. `cd backend && cp .env.example .env && npm i && npm run seed && npm run dev`
3. `cd frontend && npm i && npm run dev` → http://localhost:5173
4. Login: `demo@skillforge.ai` / `Demo@1234` (admin: `admin@skillforge.ai` / `Admin@1234`)
5. (Optional now, needed Stage 2) `cd ai-service && pip install -r requirements.txt && uvicorn app.main:app --port 8000`

## Score definitions
Defined in `backend/controllers/dashboardController.js` — every dashboard number is computed from stored data; nothing is hard-coded.
