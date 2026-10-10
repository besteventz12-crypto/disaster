# Pre-Installation Guide (After Cloning)

This document explains what to do immediately after cloning the repository, before regular development.

## 1. Clone Repository

```bash
git clone <your-repo-url>
cd repo-copy-project
```

## 2. Common System Prerequisites

Install these first on your machine:

- Python 3.10+ (recommended 3.11)
- Node.js 18+ (for optional frontend tooling)
- Git
- MongoDB access (local or Atlas connection string)
- Internet access (first-time dependency installation)

Optional but recommended:

- VS Code
- Postman or Thunder Client

## 3. Backend Pre-Installation (FastAPI)

### 3.1 Open backend folder

```powershell
cd backend
```

### 3.2 Create virtual environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If activation is blocked, run once:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### 3.3 Install Python packages

If `requirements.txt` exists:

```powershell
pip install -r requirements.txt
```

If not, install manually:

```powershell
pip install fastapi uvicorn spacy pymongo python-dotenv cloudinary pyjwt python-multipart
python -m spacy download en_core_web_sm
```

### 3.4 Environment variables setup

Create `.env` inside `backend/` with:

```env
MONGODB_URI=your_mongodb_uri
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=disaster-management
JWT_SECRET=replace_with_long_random_secret
JWT_EXPIRES_HOURS=12
ADMIN_EMAIL=admin@resqlink.com
ADMIN_PASSWORD=ResQlink@2026
```

### 3.5 Start backend

```powershell
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

Health check:

- `http://localhost:5000/health`

## 4. Frontend Pre-Installation

### 4.1 Open frontend folder

From project root:

```powershell
cd frontend
```

### 4.2 Serve static files

Python server:

```powershell
python -m http.server 8080
```

Open:

- `http://localhost:8080/index.html`

## 5. First-Run Validation Checklist

- Backend health endpoint returns OK
- Frontend loads without blank page
- Admin login works
- SOS submission reaches backend API
- Dashboard shows submitted incidents

## 6. Troubleshooting

### Port already in use

- Backend: change `--port 5000` to another port
- Frontend: change `8080` to another port

### Virtual environment activation not allowed

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### spaCy model missing

```powershell
python -m spacy download en_core_web_sm
```

### Cloudinary upload fails

- Re-check `.env` Cloudinary values
- Confirm network connectivity

### MongoDB connection error

- Verify `MONGODB_URI`
- Confirm IP/network access and credentials
