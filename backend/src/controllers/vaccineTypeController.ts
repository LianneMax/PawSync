import { Request, Response } from 'express';
import VaccineType from '../models/VaccineType';

/**
 * GET /api/vaccine-types
 * Public — used by frontend dropdowns to list available vaccine types.
 * Optionally filter by species query param.
 */
export const listVaccineTypes = async (req: Request, res: Response) => {
  try {
    const { species } = req.query;

    const query: any = { isActive: true };
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
      requiresBooster,
      boosterIntervalDays,
      minAgeMonths,
      route,
    } = req.body;

    if (!name || !species || !validityDays) {
      return res.status(400).json({ status: 'ERROR', message: 'name, species, and validityDays are required' });
    }

    const existing = await VaccineType.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ status: 'ERROR', message: 'A vaccine type with this name already exists' });
    }

    const vaccineType = await VaccineType.create({
      name: name.trim(),
      species,
      validityDays,
      requiresBooster: requiresBooster || false,
      boosterIntervalDays: boosterIntervalDays || null,
      minAgeMonths: minAgeMonths || 0,
      route: route || null,
    });

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Vaccine type created successfully',
      data: { vaccineType },
    });
  } catch (error: any) {
    console.error('Create vaccine type error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ status: 'ERROR', message: 'A vaccine type with this name already exists' });
    }
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while creating the vaccine type' });
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

    const {
      name,
      species,
      validityDays,
      requiresBooster,
      boosterIntervalDays,
      minAgeMonths,
      route,
      isActive,
    } = req.body;

    if (name !== undefined) vaccineType.name = name.trim();
    if (species !== undefined) vaccineType.species = species;
    if (validityDays !== undefined) vaccineType.validityDays = validityDays;
    if (requiresBooster !== undefined) vaccineType.requiresBooster = requiresBooster;
    if (boosterIntervalDays !== undefined) vaccineType.boosterIntervalDays = boosterIntervalDays;
    if (minAgeMonths !== undefined) vaccineType.minAgeMonths = minAgeMonths;
    if (route !== undefined) vaccineType.route = route;
    if (isActive !== undefined) vaccineType.isActive = isActive;

    await vaccineType.save();

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
