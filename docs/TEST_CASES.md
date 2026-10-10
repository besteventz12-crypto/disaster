# ResQlink Comprehensive Test Cases

This document contains a broad end-to-end test suite for college demo, QA validation, and regression testing.

## 1. Test Scope

Covered areas:

- Landing and navigation
- User SOS flow (online/offline)
- Cloudinary evidence upload
- Dashboard public feed and detail view
- Admin authentication and guarded routes
- Admin dashboard incident visibility
- Face Match workflow
- Shelter admin workflow
- Map and geolocation
- Protocols/helplines/language persistence
- Backend API happy paths and failure paths

## 2. Test Environment

- Frontend: `http://localhost:8080/index.html`
- Backend: `http://localhost:5000`
- Browser: Chrome latest
- Backend running: `uvicorn main:app --host 0.0.0.0 --port 5000 --reload`
- Network: online and offline simulation

## 3. Preconditions

- MongoDB connected
- Cloudinary credentials configured in backend `.env`
- Admin credentials valid:
  - `admin@resqlink.com`
  - `ResQlink@2026`
- At least one missing person and one found person report for matching tests

## 4. Severity Legend

- P0: Critical flow blocker
- P1: Major business flow
- P2: Secondary/UX flow

## 5. Functional Test Cases

## 5.1 Landing and Navigation

| ID | Priority | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| NAV-001 | P1 | Landing page loads | Open index URL | Page renders without JS errors |
| NAV-002 | P1 | Hero CTA to SOS | Click `Send SOS` | Opens SOS page |
| NAV-003 | P1 | Hero CTA to Dashboard | Click `Dashboard` | Opens public dashboard |
| NAV-004 | P1 | Admin login CTA | Click `Admin Login` | Opens admin login page |
| NAV-005 | P2 | Mobile nav rendering | Emulate mobile width | Bottom nav visible and usable |
| NAV-006 | P2 | Protocol link from banner | Click `VIEW PROTOCOLS` | Opens protocols page |

## 5.2 Admin Authentication

| ID | Priority | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| AUTH-001 | P0 | Admin login success | Enter valid admin creds and submit | Redirect to admin dashboard |
| AUTH-002 | P0 | Invalid admin login | Enter wrong password | Error message shown |
| AUTH-003 | P1 | Session validation | Refresh admin page after login | Stays logged in if token valid |
| AUTH-004 | P1 | Guarded admin pages without login | Open admin dashboard URL directly | Redirect to admin login |
| AUTH-005 | P1 | Expired/invalid token behavior | Corrupt token in localStorage and open admin page | Session cleared and redirected/login prompt |

## 5.3 SOS Submission (Online)

| ID | Priority | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| SOS-001 | P0 | Submit minimum valid SOS | Fill required fields, submit | API success notification |
| SOS-002 | P0 | Submit SOS with medical details | Add injury/conditions/allergies and submit | Medical info saved in backend |
| SOS-003 | P0 | Submit SOS with one image | Attach image and submit online | Image uploads to Cloudinary and URL saved |
| SOS-004 | P0 | Submit SOS with multiple files | Attach multiple image/video files and submit | Each file uploaded, URLs stored in SOS payload |
| SOS-005 | P1 | Evidence upload failure handling | Break Cloudinary creds then submit with file | Alert queued/failure handled gracefully |
| SOS-006 | P1 | Location auto-detect | Click detect location | Coordinates fill location field |
| SOS-007 | P1 | SOS validation - missing type | Keep type empty and submit | Validation error shown |
| SOS-008 | P1 | SOS validation - location not resolved | Leave location as detecting state and submit | Validation error shown |

## 5.4 SOS Offline and Queue

| ID | Priority | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| OFF-001 | P0 | Offline test mode queue | Enable offline test, submit SOS | SOS stored in `sosOfflineQueue` |
| OFF-002 | P0 | Manual retry sends queue | Click `Retry Now` in online mode | Queued alerts sent to API |
| OFF-003 | P1 | Auto-retry on reconnect | Submit queued item while offline, then reconnect | Queue processed automatically |
| OFF-004 | P1 | Queue counter UI | Add queued items | Pending counter and queue status visible |
| OFF-005 | P1 | Disable offline test mode processing | Disable test mode after queued submissions | Queue processing starts |

## 5.5 Emergency Contacts and SMS

| ID | Priority | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| CON-001 | P1 | Add emergency contact | Add name/phone and save | Contact appears in list |
| CON-002 | P1 | Remove emergency contact | Remove an added contact | Contact removed and storage updated |
| CON-003 | P1 | Send SOS to all contacts | Add contacts, click send to all | SMS URL opens with prefilled message |
| CON-004 | P2 | Block send without contacts | Click send without contacts | Error shown |

## 5.6 Dashboard Public Incident Feed

| ID | Priority | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| PUB-001 | P0 | Feed loads incidents from backend | Submit SOS, open dashboard | New incident card appears |
| PUB-002 | P1 | Active alert count updates | Submit multiple SOS | Count reflects backend incident total (+ queue) |
| PUB-003 | P0 | Card opens details page | Click incident card | Opens `sos-alert.html?id=...` |
| PUB-004 | P1 | No incidents state | Empty DB and open dashboard | `No incidents yet` state shown |

## 5.7 Incident Details Page

| ID | Priority | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| DET-001 | P0 | Details page loads by id | Open details page with valid id | Full SOS details rendered |
| DET-002 | P0 | Shows media thumbnails | SOS has image evidence | Image previews visible and clickable |
| DET-003 | P1 | Shows video media | SOS has video evidence | Video player appears |
| DET-004 | P1 | Invalid id handling | Open with malformed id | Graceful error state shown |
| DET-005 | P1 | Missing id handling | Open page without id | Graceful error state shown |

## 5.8 Admin Dashboard Feed

| ID | Priority | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| ADM-001 | P0 | Admin feed shows SOS incidents | Login admin and open admin dashboard | Incident list visible |
| ADM-002 | P0 | Admin card opens detail page | Click incident card in admin feed | Opens dedicated SOS detail page |
| ADM-003 | P1 | Admin refresh reloads incidents | Click refresh/master refresh control | Feed and stats update |
| ADM-004 | P1 | Admin feed includes medical/evidence summary | View cards for SOS with details | Summary fields shown on card |

## 5.9 Face Match Console

| ID | Priority | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| MAT-001 | P0 | Face Match page access control | Open page without admin session | Redirect/login required |
| MAT-002 | P1 | Missing person dropdown population | Open as admin with missing records | Dropdown populated |
| MAT-003 | P0 | Run Match All | Click `Run Match (All)` | Matches returned and rendered |
| MAT-004 | P0 | Run Match For Selected | Select person and click `Match Faces` | Selected matching completes |
| MAT-005 | P1 | Match broadcast panel | Run successful match | Broadcast section updates |
| MAT-006 | P1 | Validation when no selection | Click selected match with none selected | Error shown |

## 5.10 Shelter Admin

| ID | Priority | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| SHL-001 | P0 | Shelter admin access control | Open without admin session | Redirect/login required |
| SHL-002 | P0 | Add shelter with valid fields | Fill form and submit | Shelter saved via API |
| SHL-003 | P1 | Use current location for shelter | Click current location | Lat/lng fields autofilled |
| SHL-004 | P1 | Select location on map | Enable map pick and click map | Lat/lng updated |
| SHL-005 | P1 | Shelter list refresh | Save shelter then refresh list | New shelter appears |

## 5.11 Map Module

| ID | Priority | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| MAP-001 | P1 | Map tiles load | Open map page | OSM map renders |
| MAP-002 | P1 | Marker creation | Click map and add marker details | Marker appears and persists |
| MAP-003 | P1 | Marker clear action | Click clear markers | Marker dataset removed |
| MAP-004 | P1 | SOS return location flow | Open map from SOS selector and choose point | Returns to SOS with selected location |

## 5.12 Warnings and Banner

| ID | Priority | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| WRN-001 | P1 | Warning fetch and render | Open page with warning ticker | Warning text loaded |
| WRN-002 | P1 | Admin warning update | Add/remove warning as admin | Backend warning list updated |
| WRN-003 | P2 | Fallback warnings on API error | Stop backend warning endpoint and reload | Local fallback warning shown |

## 5.13 Chat Widget Theme

| ID | Priority | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| AI-001 | P2 | Chat widget appears | Open any page with embed | Widget visible |
| AI-002 | P2 | Restyled Ask AI input | Inspect widget input/button | Custom styling applied |
| AI-003 | P2 | Avatar replacement | Inspect widget avatar | Uses local project avatar override |

## 6. API Test Cases

## 6.1 Health and Auth

| ID | Priority | Endpoint | Scenario | Expected |
|---|---|---|---|---|
| API-001 | P0 | GET /health | Service up | `ok: true` |
| API-002 | P0 | POST /admin/login | Valid creds | Token returned |
| API-003 | P0 | POST /admin/login | Invalid creds | 401 |
| API-004 | P1 | GET /admin/session | Valid token | `ok: true` and role admin |
| API-005 | P1 | GET /admin/session | Missing token | 401 |

## 6.2 SOS Endpoints

| ID | Priority | Endpoint | Scenario | Expected |
|---|---|---|---|---|
| API-006 | P0 | POST /sos-alerts | Valid payload | Record inserted |
| API-007 | P1 | POST /sos-alerts | Missing required field | 422 validation |
| API-008 | P0 | GET /sos-alerts | Public list | Items returned newest first |
| API-009 | P0 | GET /sos-alerts/{id} | Valid id | Full item returned |
| API-010 | P1 | GET /sos-alerts/{id} | Invalid id | 400 |
| API-011 | P1 | GET /sos-alerts/{id} | Nonexistent id | 404 |
| API-012 | P0 | GET /sos-alerts/admin | Valid admin token | Items returned |
| API-013 | P1 | GET /sos-alerts/admin | Missing token | 401 |

## 6.3 Upload and Media

| ID | Priority | Endpoint | Scenario | Expected |
|---|---|---|---|---|
| API-014 | P0 | POST /upload | Valid image file | Cloudinary URL returned |
| API-015 | P1 | POST /upload | Valid video file | Cloudinary URL returned |
| API-016 | P1 | POST /upload | Missing file param | 422 |

## 6.4 Matching and Shelter APIs

| ID | Priority | Endpoint | Scenario | Expected |
|---|---|---|---|---|
| API-017 | P0 | POST /matches/run | Admin token + threshold | Match list returned |
| API-018 | P0 | POST /matches/run/missing/{id} | Admin token + valid id | Targeted matches returned |
| API-019 | P1 | GET /matches | List existing matches | Items returned |
| API-020 | P0 | POST /shelters | Admin token + valid payload | Shelter created |
| API-021 | P1 | GET /shelters | List all shelters | Items returned |
| API-022 | P1 | GET /shelters?latitude=..&longitude=..&radiusKm=5 | Nearby search | Nearby shelters sorted by distance |

## 7. Negative and Edge Case Suite

| ID | Priority | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| NEG-001 | P0 | Backend down during SOS submit | Stop backend, submit SOS | Graceful queue/failure handling |
| NEG-002 | P1 | Corrupt localStorage queue | Manually corrupt queue JSON | App avoids crash, fallback behavior |
| NEG-003 | P1 | Large details text | Paste very large details payload | App handles input and submission |
| NEG-004 | P1 | Unsupported media type | Attach unknown file type | Upload gracefully succeeds or errors clearly |
| NEG-005 | P1 | Simultaneous multiple submits | Double click submit quickly | Prevent duplicate accidental submission where possible |
| NEG-006 | P2 | Browser geolocation blocked | Deny permission | Manual location route still possible |

## 8. Security/Access Control Test Cases

| ID | Priority | Scenario | Steps | Expected Result |
|---|---|---|---|---|
| SEC-001 | P0 | Access admin endpoints with no token | Call guarded API | 401 response |
| SEC-002 | P0 | Access admin endpoints with user token/invalid role | Call guarded API | 403 response |
| SEC-003 | P1 | Token tampering | Modify token string | Session rejected |
| SEC-004 | P1 | Admin UI visibility for non-admin | Open pages as non-admin | Admin-only controls hidden/blocked |

## 9. Regression Pack (Run Before Demo)

Execute these 12 smoke tests before final presentation:

- NAV-001
- AUTH-001
- SOS-001
- SOS-003
- OFF-001
- OFF-002
- PUB-001
- PUB-003
- DET-001
- ADM-001
- MAT-004
- SHL-002

## 10. Suggested Test Execution Sheet

Track in spreadsheet columns:

- Test ID
- Build/Commit
- Tester Name
- Date/Time
- Result (Pass/Fail/Blocked)
- Evidence (screenshot/video/log)
- Defect ID (if fail)
- Notes

## 11. Team Members

- Vaisnavi Nag
- Pradya Shetty
- Ananya
