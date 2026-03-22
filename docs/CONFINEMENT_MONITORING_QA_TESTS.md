# Confinement Monitoring QA Test Plan

## Scope
Validate the new confinement monitoring workflow for active confinement records, including:
- Daily vitals entry
- Spot monitoring entry
- Timeline and trend visibility
- Critical alert handling
- Non-billable monitoring behavior

## Preconditions
- Backend running with latest changes.
- Frontend running with latest changes.
- At least one pet currently in admitted confinement with linked medical record and billing.
- Test users:
  - Veterinarian assigned to confinement
  - Clinic admin in same clinic

## Automated Tests (Implemented)
Run:

```bash
cd backend
npm test -- --runInBand confinementMonitoring.test.ts
```

Covered by automated suite:
1. Veterinarian can create daily monitoring entries.
2. Clinic admin cannot create daily entries but can create spot entries.
3. Out-of-range values require override reason (`editReason`).
4. Monitoring list endpoint returns timeline entries.
5. Monitoring creation does not change billing totals.
6. Veterinarian can resolve critical alerts.

## Manual QA Scenarios

### 1) Daily Monitoring Entry (Vet)
1. Open patient records and view a current record with active confinement (`confinementAction=confined`).
2. In the **Confinement Monitoring** section, choose **Daily Vitals**.
3. Fill required fields and save.
4. Verify success toast appears.
5. Verify new entry appears in timeline with `Daily Vitals` label.

Expected:
- Entry saved and visible in timeline.
- Recorder name and role are shown.
- No billing amount change.

### 2) Spot Monitoring Entry (Clinic Admin)
1. Log in as clinic admin.
2. Open same confinement record and create entry as **Spot Monitoring**.
3. Attempt to create **Daily Vitals** entry.

Expected:
- Spot entry succeeds.
- Daily entry is rejected by API with access/permission message.

### 3) Critical Entry + Alert Flow
1. Create monitoring entry with `clinicalFlag=critical` and `requiresImmediateReview=true`.
2. Verify entry is marked critical in timeline.
3. As assigned vet, click **Mark Alert Resolved**.

Expected:
- Critical marker is visible before resolution.
- Resolve action succeeds for assigned vet.
- Entry updates with resolved state.

### 4) Validation Rules
1. Try saving entry with missing required core fields.
2. Try out-of-range temperature (e.g., 45) without override reason.
3. Try `followUpAction=recheck` without follow-up hours.

Expected:
- API rejects invalid payloads.
- Error messages indicate missing/invalid requirements.

### 5) Billing Non-Impact (Core Business Rule)
1. Note invoice subtotal and total for an unpaid confinement billing.
2. Add multiple daily/spot monitoring entries.
3. Refresh billing/invoice views.

Expected:
- Billing subtotal and total remain unchanged.
- No new billing line items for monitoring entries.

### 6) Billing Positive Control
1. Add medication/service/procedure to the medical/confinement workflow while still admitted.
2. Trigger normal billing refresh path.

Expected:
- Billing increases only from billable medication/service/procedure or confinement day count.
- Monitoring entries remain non-billable.

## Acceptance Checklist
- [ ] Monitoring works only for active confinement records.
- [ ] Vet can create daily and spot entries.
- [ ] Clinic admin can create spot only.
- [ ] Timeline shows new entries with type labels and recorder metadata.
- [ ] Critical entries can be resolved by assigned vet.
- [ ] Monitoring never changes billing totals.
- [ ] Existing billing behavior (daily confinement + billable meds/services/procedures) remains intact.
