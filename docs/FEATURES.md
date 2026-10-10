# ResQlink Feature Documentation (College Presentation Edition)

This document is a complete, presentation-ready feature summary of the current ResQlink implementation.

## 1. Project Overview

ResQlink is an emergency response web platform designed for rapid SOS reporting, incident visibility, and admin coordination.

Primary goals:

- Fast incident reporting for civilians
- Reliable operation in unstable network conditions
- Admin-level visibility with actionable details
- Clear workflows for person matching and shelter management

## 2. Core Product Highlights

- Real-time-like emergency workflow with backend persistence
- Cloudinary-based evidence upload when online
- Offline queue and retry support for SOS
- Public dashboard for awareness
- Admin dashboard for deeper operational control
- Dedicated incident details page
- Dedicated face-match workflow page
- Dedicated shelter management page

## 3. Platform-Wide Features

### 3.1 Responsive Experience

- Mobile + desktop compatible layouts across key pages
- Sticky desktop headers and mobile navigation where needed
- Utility-driven styling with Tailwind CDN + custom CSS modules

### 3.2 Shared UI System

- Feather icons for consistency
- Reusable cards, panels, and status badges
- In-app notification patterns for success/error/info feedback

### 3.3 Emergency Banner Pattern

- High-visibility emergency strip across major pages
- Quick link to protocols for immediate guidance

### 3.4 Language Support

- Language switcher integration across key pages
- Language preference persisted via localStorage

## 4. Routing and Page Architecture

### 4.1 Public User Pages

- Landing page
- SOS page
- Public dashboard
- Map page
- Protocols page
- Helpline page

### 4.2 Admin Workflow Pages

- Admin login page
- Dedicated admin dashboard
- Dedicated face-match console
- Dedicated shelter admin page

### 4.3 Detail Pages

- Dedicated SOS alert detail page for full incident review

## 5. SOS Module (User Side)

## 5.1 Incident Data Capture

SOS captures:

- Name
- Location
- Emergency type
- Additional details
- People affected
- Medical information:
  - injury severity
  - conditions
  - allergies

## 5.2 Location Handling

- Browser geolocation support
- Manual location path via map selection
- Return-to-SOS flow via session storage bridge

## 5.3 Emergency Quick Actions

One-tap emergency calls:

- 112 (Emergency)
- 102 (Ambulance)
- 101 (Fire)
- 100 (Police)

Also supports quick location sharing via SMS.

## 5.4 Personal Emergency Contacts

- Add/remove contacts
- Local persistence in browser storage
- Send SOS message to all contacts with location context

## 5.5 Safety Assistance Layer

- Dynamic safety checklist based on emergency type
- Expand/collapse interactions for quick readability during stress

## 5.6 Voice and Evidence

- Voice recording via MediaRecorder
- Image/video evidence upload UI with previews
- Drag-drop upload interaction support

## 5.7 Online vs Offline Submission

When online:

- Evidence files upload to Cloudinary through backend upload API
- Cloudinary URLs are attached to SOS payload
- SOS payload is stored via backend API

When offline (or offline test mode):

- SOS payload is queued in local storage
- Retry happens manually or on reconnect

## 6. Incident Feed and Visibility

## 6.1 Public Dashboard Feed

- Fetches persisted SOS incidents from backend
- Shows incident summary cards (name, type, location, details, time)
- Active alert count reflects backend incident records + queued local items

## 6.2 Admin Dashboard Feed

- Fetches SOS incidents through admin-authenticated endpoint
- Displays richer incident context and operational details

## 6.3 Dedicated Incident Detail Page

Clicking an incident card opens a separate page that shows:

- Full SOS metadata
- Medical context
- Detailed notes
- Attached media
  - images previewed
  - videos playable
  - other files as links

## 7. Admin Security and Access Control

### 7.1 JWT-Based Admin Auth

- Admin login endpoint returns JWT token
- Admin session verification endpoint validates role and token validity

### 7.2 Guarded Backend Operations

Admin-only backend operations include:

- Warning updates
- Match run actions
- Shelter creation
- Admin SOS feed endpoint

### 7.3 Admin-Only UI Visibility

- Admin elements are hidden by default
- Visibility is enabled only after session verification
- Non-admin access to admin pages is redirected to admin login

## 8. Missing/Found Person Matching

## 8.1 Dedicated Face Match Console

- Separate page for matching workflow
- Missing person dropdown for targeted matching
- Match Faces button for selected-person run
- Run Match (All) option for full matching pass

## 8.2 Match Results

- Match confidence score display
- Missing vs found person comparison cards
- Contact details surfaced for actionability

## 8.3 Match Broadcast

- Recent high-confidence match summary shown in a highlighted panel

## 9. Shelter Management and Discovery

## 9.1 Shelter Admin Page

- Admin-only page to add and manage shelters
- Coordinate support through current location / map selection

## 9.2 Public/General Shelter Discovery

- Nearby shelter retrieval through map flow
- Radius-based search support

## 10. Map and Situational Awareness

- Leaflet map integration using OpenStreetMap tiles
- Incident marker rendering
- Contextual use in SOS location flow

## 11. Backend API Capability Summary

Current backend includes:

- Health endpoint
- Admin auth/session endpoints
- SOS create/list/detail endpoints
- Upload endpoint (Cloudinary)
- Warning read/update endpoints
- Missing person and found person endpoints
- Matching list and run endpoints
- Shelter list/create endpoints

## 12. Data Persistence Layers

## 12.1 Backend Persistence

- MongoDB stores SOS, matching, shelters, warnings, and related entities

## 12.2 Client-Side Persistence

Used for resilience and UX continuity:

- language preference
- offline SOS queue
- emergency contacts
- selected-location bridge values
- other UI state keys

## 13. Integrations

- Cloudinary for evidence media storage
- Leaflet + OSM for mapping
- Tailwind CDN for utility styling
- Feather icons for UI consistency

## 14. Reliability and UX Enhancements

- Offline test mode in SOS workflow
- Queue status and retry visibility
- Battery awareness and power saver UI on SOS page
- Structured notifications for user guidance

## 15. Key Improvements from Earlier Iterations

- Replaced local-only feed dependency with backend-driven incident feeds
- Added dedicated SOS detail page for full incident inspection
- Added Cloudinary upload integration into SOS online path
- Split admin and public dashboard workflows
- Added dedicated face-match and shelter-admin pages

## 16. Team Members

- Vaisnavi Nag
- Pradya Shetty
- Ananya

## 17. Presentation Closing Summary

ResQlink now delivers a practical emergency-response workflow with:

- Incident capture
- Cloud-backed evidence handling
- Offline resilience
- Admin-grade operational visibility
- Dedicated modules for matching and shelters

This makes it suitable as both a disaster-tech prototype and a strong systems-design presentation project.
