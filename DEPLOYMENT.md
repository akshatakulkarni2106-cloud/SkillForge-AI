# SkillForge AI Deployment Guide (Vercel + Render)

This project consists of three services:
1. **Frontend**: React (Vite SPA) ➔ **Deploy on Vercel**
2. **Backend**: Express.js REST API (Node.js) ➔ **Deploy on Render**
3. **AI Service**: FastAPI / Python (Groq LLM) ➔ **Deploy on Render**
4. **Database**: MongoDB ➔ **MongoDB Atlas (Free Tier)**

---

## Part 1: Database (MongoDB Atlas)
If you don't already have a cloud MongoDB database:
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in.
2. Create a free **M0 cluster**.
3. Under **Database Access**, create a database user (e.g., `skillforge_user` and password).
4. Under **Network Access**, click **Add IP Address** ➔ Select **Allow Access From Anywhere** (`0.0.0.0/0`).
5. Click **Connect** ➔ **Drivers (Node.js)** ➔ Copy the connection string:
   `mongodb+srv://<username>:<password>@cluster0.mongodb.net/skillforge?retryWrites=true&w=majority`

---

## Part 2: Backend & AI Service (Deploy on Render)

### Option A: 1-Click Blueprint (Recommended)
Because this repository contains `render.yaml`:
1. Log in to [Render](https://dashboard.render.com/).
2. Click **Blueprints** in the top navigation.
3. Click **New Blueprint Instance**.
4. Connect your GitHub repository: `akshatakulkarni2106-cloud/SkillForge-AI`.
5. Render will automatically detect both `skillforge-backend` and `skillforge-ai-service`.
6. Fill in the required environment variables:
   - For `skillforge-backend`:
     - `MONGO_URI`: Your MongoDB Atlas connection string.
     - `CLIENT_ORIGIN`: Your Vercel frontend URL (or leave empty initially, our CORS allows `.vercel.app`).
   - For `skillforge-ai-service`:
     - `GROQ_API_KEY`: Your Groq API key from [Groq Console](https://console.groq.com/keys).
7. Click **Apply**. Both services will build and deploy automatically!
8. Copy your backend service URL (e.g. `https://skillforge-backend.onrender.com`).

---

## Part 3: Frontend (Deploy on Vercel)

1. Log in to [Vercel](https://vercel.com/).
2. Click **Add New...** ➔ **Project**.
3. Import your GitHub repository: `akshatakulkarni2106-cloud/SkillForge-AI`.
4. Configure the Project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click `Edit` and select `frontend`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   - `VITE_API_URL`: Your Render backend URL + `/api` (e.g., `https://skillforge-backend.onrender.com/api`).
6. Click **Deploy**.
7. In ~1 minute, your site will be live at `https://your-project.vercel.app`!
