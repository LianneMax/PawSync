Archived maintenance and one-time scripts

These scripts were moved here from `backend/scripts/` on May 25, 2026 to keep the active deployment scripts directory tidy.

Files archived:
- checkPreventiveCareServices.ts
- checkServiceById.ts
- dropOldIndex.ts
- fixVaccineSchema.ts
- clearVaccineTypes.ts
- fixDuplicatesAndIntervals.ts
- testAPI.ts

Notes:
- These scripts are one-time maintenance/migration or debugging helpers. Before re-running any archived script against production data, review and test in a staging environment.
- If any archived script is still required by an automated deployment step, move it back to `backend/scripts/` and document the dependency in your deployment docs.
