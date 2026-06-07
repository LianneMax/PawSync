import { Request, Response } from 'express';
import VaccineType from '../models/VaccineType';
import Vaccination from '../models/Vaccination';
import { checkVaccineBatchExpiriesAndNotify } from '../services/vaccineExpiryService';

/**
 * GET /api/vaccine-types
 * Public — used by frontend dropdowns to list available vaccine types.
 * Optionally filter by species query param.
 */
export const listVaccineTypes = async (req: Request, res: Response) => {
  try {
    const { species, includeInactive } = req.query;

    // Lazily run the expiry check (deactivates expired batches + notifies vets/admins)
    // so the catalog reflects expiry immediately rather than waiting for the
    // nightly scheduler run.
    await checkVaccineBatchExpiriesAndNotify();

    const query: Record<string, unknown> = includeInactive === 'true' ? {} : { isActive: true };
    if (species) {
      query.species = { $in: [species, 'all'] };
    }

    const vaccineTypes = await VaccineType.find(query).sort({ name: 1 });

    return res.status(200).json({
      status: 'SUCCESS',
      data: { vaccineTypes },
    });
  } catch (error) {
    console.error('List vaccine types error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching vaccine types' });
  }
};

/**
 * POST /api/vaccine-types
 * Clinic admin / branch admin only — add a custom vaccine type.
 */
export const createVaccineType = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const {
      name,
      species,
      validityDays,
      isSeries,
      totalSeries,
      seriesIntervalDays,
      boosterValid,
      boosterIntervalDays,
      minAgeMonths,
      minAgeUnit,
      maxAgeMonths,
      maxAgeUnit,
      route,
      doseVolumeMl,
      defaultManufacturer,
      defaultBatchNumber,
      defaultBatchExpirationDate,
    } = req.body;

    if (!name || !species || !validityDays) {
      return res.status(400).json({ status: 'ERROR', message: 'name, species, and validityDays are required' });
    }

    if (defaultBatchExpirationDate) {
      const expiry = new Date(defaultBatchExpirationDate);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (expiry < todayStart) {
        return res.status(400).json({ status: 'ERROR', message: 'Batch expiration date cannot be in the past' });
      }
    }

    const existing = await VaccineType.findOne({
      name: name.trim(),
      species: { $in: species }
    });
    if (existing) {
      return res.status(409).json({ status: 'ERROR', message: 'A vaccine type with this name and species already exists' });
    }

    const vaccineType = await VaccineType.create({
      name: name.trim(),
      species,
      validityDays,
      isSeries: isSeries || false,
      totalSeries: totalSeries || 3,
      seriesIntervalDays: seriesIntervalDays || 21,
      boosterValid: boosterValid || false,
      boosterIntervalDays: boosterIntervalDays ?? null,
      minAgeMonths: minAgeMonths || 0,
      minAgeUnit: minAgeUnit || 'months',
      maxAgeMonths: maxAgeMonths ?? null,
      maxAgeUnit: maxAgeUnit || 'months',
      route: route || null,
      doseVolumeMl: doseVolumeMl ?? null,
      defaultManufacturer: defaultManufacturer || null,
      defaultBatchNumber: defaultBatchNumber || null,
      defaultBatchExpirationDate: defaultBatchExpirationDate || null,
      clinicId: req.user.clinicId || null,
      clinicBranchId: req.user.clinicBranchId || null,
    });

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Vaccine type created successfully',
      data: { vaccineType },
    });
  } catch (error: unknown) {
    console.error('Create vaccine type error:', error);
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: number }).code === 11000) {
      return res.status(409).json({ status: 'ERROR', message: 'A vaccine type with this name and species already exists' });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while creating the vaccine type' });
  }
};

/**
 * DELETE /api/vaccine-types/:id
 * Vet or clinic admin only — permanently delete a vaccine type.
 */
export const deleteVaccineType = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const vaccineType = await VaccineType.findById(req.params.id);
    if (!vaccineType) {
      return res.status(404).json({ status: 'ERROR', message: 'Vaccine type not found' });
    }

    await vaccineType.deleteOne();

    return res.status(200).json({ status: 'SUCCESS', message: 'Vaccine type deleted' });
  } catch (error) {
    console.error('Delete vaccine type error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while deleting the vaccine type' });
  }
};

/**
 * PUT /api/vaccine-types/:id
 * Clinic admin / branch admin only.
 */
export const updateVaccineType = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const vaccineType = await VaccineType.findById(req.params.id);
    if (!vaccineType) {
      return res.status(404).json({ status: 'ERROR', message: 'Vaccine type not found' });
    }

    const previousDoseVolumeMl = vaccineType.doseVolumeMl;

    const {
      name,
      species,
      validityDays,
      isSeries,
      totalSeries,
      seriesIntervalDays,
      boosterValid,
      boosterIntervalDays,
      minAgeMonths,
      minAgeUnit,
      maxAgeMonths,
      maxAgeUnit,
      route,
      doseVolumeMl,
      pricePerDose,
      defaultManufacturer,
      defaultBatchNumber,
      defaultBatchExpirationDate,
      isActive,
    } = req.body;

    const previousBatchNumber = vaccineType.defaultBatchNumber;
    const previousExpirationDate = vaccineType.defaultBatchExpirationDate;
    const batchNumberChanging = defaultBatchNumber !== undefined && (defaultBatchNumber || null) !== (previousBatchNumber || null);

    if (defaultBatchExpirationDate) {
      const expiry = new Date(defaultBatchExpirationDate);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (expiry < todayStart) {
        return res.status(400).json({ status: 'ERROR', message: 'Batch expiration date cannot be in the past' });
      }
    }

    // A batch/lot number has exactly one expiry date — switching to a new batch requires its own expiration date.
    if (batchNumberChanging && defaultBatchNumber && !defaultBatchExpirationDate) {
      return res.status(400).json({ status: 'ERROR', message: 'A new batch/lot number requires its expiration date' });
    }

    // Block reactivating a vaccine whose current (or newly-submitted) batch is already expired —
    // it stays inactive/unusable until the batch number AND expiration date are updated together.
    if (isActive === true) {
      const effectiveExpiry = defaultBatchExpirationDate !== undefined
        ? (defaultBatchExpirationDate ? new Date(defaultBatchExpirationDate) : null)
        : previousExpirationDate;
      if (effectiveExpiry && effectiveExpiry < new Date()) {
        return res.status(400).json({ status: 'ERROR', message: 'Cannot activate this vaccine — its current batch has expired. Update the batch/lot number and expiration date first.' });
      }
    }

    if (name !== undefined) vaccineType.name = name.trim();
    if (species !== undefined) vaccineType.species = species;
    if (validityDays !== undefined) vaccineType.validityDays = validityDays;
    if (isSeries !== undefined) vaccineType.isSeries = isSeries;
    if (totalSeries !== undefined) vaccineType.totalSeries = totalSeries;
    if (seriesIntervalDays !== undefined) vaccineType.seriesIntervalDays = seriesIntervalDays;
    if (boosterValid !== undefined) vaccineType.boosterValid = boosterValid;
    if (boosterIntervalDays !== undefined) vaccineType.boosterIntervalDays = boosterIntervalDays ?? null;
    if (minAgeMonths !== undefined) vaccineType.minAgeMonths = minAgeMonths;
    if (minAgeUnit !== undefined) vaccineType.minAgeUnit = minAgeUnit;
    if (maxAgeMonths !== undefined) vaccineType.maxAgeMonths = maxAgeMonths ?? null;
    if (maxAgeUnit !== undefined) vaccineType.maxAgeUnit = maxAgeUnit;
    if (route !== undefined) vaccineType.route = route;
    if (doseVolumeMl !== undefined) vaccineType.doseVolumeMl = doseVolumeMl ?? null;
    if (pricePerDose !== undefined) vaccineType.pricePerDose = pricePerDose;
    if (defaultManufacturer !== undefined) vaccineType.defaultManufacturer = defaultManufacturer || null;
    if (defaultBatchNumber !== undefined) vaccineType.defaultBatchNumber = defaultBatchNumber || null;
    if (defaultBatchExpirationDate !== undefined) vaccineType.defaultBatchExpirationDate = defaultBatchExpirationDate || null;
    if (isActive !== undefined) vaccineType.isActive = isActive;

    // Updating to a new batch/lot resets the expiry-alert tracking and, if the new
    // batch isn't expired, automatically re-activates a vaccine that the scheduler
    // had auto-deactivated for an expired batch.
    const expirationChanging = defaultBatchExpirationDate !== undefined
      && String(defaultBatchExpirationDate || '') !== String(previousExpirationDate ? previousExpirationDate.toISOString().split('T')[0] : '');
    if (batchNumberChanging || expirationChanging) {
      vaccineType.expiryAlertFlags = { sevenDay: false, threeDay: false, oneDay: false, expired: false };
      const newExpiry = vaccineType.defaultBatchExpirationDate;
      if (isActive === undefined && newExpiry && newExpiry > new Date()) {
        vaccineType.isActive = true;
      }
    }

    await vaccineType.save();

    // Freeze legacy records without a snapshot when dose volume changes.
    // This ensures past vaccinations keep their original dose display.
    if (
      doseVolumeMl !== undefined &&
      previousDoseVolumeMl != null &&
      vaccineType.doseVolumeMl !== previousDoseVolumeMl
    ) {
      await Vaccination.updateMany(
        {
          vaccineTypeId: vaccineType._id,
          administeredDoseMl: null,
        },
        {
          $set: { administeredDoseMl: previousDoseVolumeMl },
        }
      );
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Vaccine type updated successfully',
      data: { vaccineType },
    });
  } catch (error) {
    console.error('Update vaccine type error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while updating the vaccine type' });
  }
};
