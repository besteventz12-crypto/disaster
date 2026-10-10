# ResQlink

ResQlink is an emergency response and disaster coordination platform focused on fast SOS reporting, map-based incident visibility, and admin operations for matching and shelter management.

## Team Members

- Vaisnavi Nag
- Pradya Shetty
- Ananya

## What It Does

- Submit SOS alerts with location, medical context, and evidence media.
- Upload evidence to Cloudinary when online.
- Queue alerts locally when offline and retry later.
- View incident feed and details from dashboard.
- Run missing/found person matching from dedicated admin pages.
- Manage shelters and search nearby shelters.

## Project Modules

- Landing and navigation pages
- SOS reporting page
- Public response dashboard
- Admin dashboard
- Face Match dedicated page
- Shelter Admin dedicated page
- Map and protocols pages

## Tech Stack

### Frontend

- HTML5
- CSS3 + Tailwind CDN
- Vanilla JavaScript
- Leaflet.js

### Backend

- FastAPI
- PyMongo
- spaCy
- Cloudinary
- JWT auth for admin actions

## Repository Structure

```text
repo-copy-project/
|- backend/
|  |- main.py
|  |- spaCy.py
|- docs/
|  |- README.md
|  |- PRE_INSTALLATION_AFTER_CLONE.md
|  |- FEATURES.md
|  |- TEST_CASES.md
|- frontend/
|  |- *.html
|  |- css/
|  |- js/
|  |- Material/
|- README.md
```

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install fastapi uvicorn spacy pymongo python-dotenv cloudinary pyjwt python-multipart
python -m spacy download en_core_web_sm
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

Backend health:

- http://localhost:5000/health

### 2. Frontend

```bash
cd frontend
python -m http.server 8080
```

Open:

- http://localhost:8080/index.html

## Pre-Installation Guide

For full post-clone setup (backend + frontend), read:

- [PRE_INSTALLATION_AFTER_CLONE.md](./PRE_INSTALLATION_AFTER_CLONE.md)

## Test Cases

For comprehensive scenario-wise test coverage, read:

- [TEST_CASES.md](./TEST_CASES.md)

## Environment Variables (Backend)

Create `.env` in `backend/`:

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

## Current Functional Notes

- SOS with media:
  - Online: media uploads to Cloudinary, then alert is stored via API.
  - Offline/test-offline: alert is queued and retried.
- Dashboard feed:
  - Public dashboard reads incidents from backend API.
  - Admin dashboard shows incident details and media.
- Incident details page:
  - Clicking incident cards opens dedicated details page.

## Team Members

- Vaisnavi Nag
- Pradya Shetty
- Ananya

## Contact

For project queries, use repository issues/discussions.
