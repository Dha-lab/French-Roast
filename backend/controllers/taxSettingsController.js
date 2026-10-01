import mongoose from 'mongoose';
import TaxSettings from '../models/TaxSettings.js';
import { dataStore } from '../config/dataStore.js';
import { logAuditEvent } from '../utils/auditLogger.js';

const useMemoryStore = () => !process.env.MONGODB_URI || mongoose.connection.readyState === 0;

const roundCurrency = (val) => Math.round((Number(val) || 0) * 100) / 100;

// Helper to get active tax settings from MongoDB or in-memory store
export const fetchActiveTaxSettings = async () => {
  if (useMemoryStore()) {
    return dataStore.getTaxSettings();
  }

  let doc = await TaxSettings.findOne({ key: 'default_tax_settings' });
  if (!doc) {
    doc = await TaxSettings.create({
      key: 'default_tax_settings',
      gstRate: 5,
      cgstRate: 2.5,
      sgstRate: 2.5,
      currency: 'INR'
    });
  }

  return {
    gstRate: doc.gstRate,
    cgstRate: doc.cgstRate,
    sgstRate: doc.sgstRate,
    currency: doc.currency || 'INR'
  };
};

// @desc    Get current tax settings
// @route   GET /api/admin/tax-settings and GET /api/tax-settings
// @access  Public (Read) / Private Admin
export const getTaxSettings = async (req, res, next) => {
  try {
    const settings = await fetchActiveTaxSettings();
    return res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update tax settings (Admin only)
// @route   POST /api/admin/tax-settings or PUT /api/admin/tax-settings
// @access  Private/Admin
export const updateTaxSettings = async (req, res, next) => {
  try {
    const { gstRate, cgstRate } = req.body;

    const rawGst = Number(gstRate);
    const rawCgst = Number(cgstRate);

    if (gstRate === undefined || gstRate === null || isNaN(rawGst)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tax settings: GST rate must be a valid number.'
      });
    }

    if (cgstRate === undefined || cgstRate === null || isNaN(rawCgst)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tax settings: CGST rate must be a valid number.'
      });
    }

    if (rawGst < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tax settings: GST rate cannot be negative.'
      });
    }

    if (rawCgst < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tax settings: CGST rate cannot be negative.'
      });
    }

    if (rawCgst > rawGst) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tax settings: CGST rate cannot exceed total GST rate.'
      });
    }

    const parsedGst = roundCurrency(rawGst);
    const parsedCgst = roundCurrency(rawCgst);
    const parsedSgst = roundCurrency(parsedGst - parsedCgst);

    let updatedSettings;

    if (useMemoryStore()) {
      updatedSettings = await dataStore.updateTaxSettings(parsedGst, parsedCgst);
    } else {
      updatedSettings = await TaxSettings.findOneAndUpdate(
        { key: 'default_tax_settings' },
        {
          gstRate: parsedGst,
          cgstRate: parsedCgst,
          sgstRate: parsedSgst,
          currency: 'INR'
        },
        { upsert: true, new: true, runValidators: true }
      );
    }

    if (req.admin) {
      await logAuditEvent({
        adminId: req.admin._id,
        username: req.admin.username,
        action: 'UPDATE_TAX_SETTINGS',
        req,
        targetId: 'default_tax_settings',
        details: { gstRate: parsedGst, cgstRate: parsedCgst, sgstRate: parsedSgst }
      });
    }

    return res.json({
      success: true,
      message: 'Tax settings updated successfully.',
      data: {
        gstRate: updatedSettings.gstRate,
        cgstRate: updatedSettings.cgstRate,
        sgstRate: updatedSettings.sgstRate,
        currency: updatedSettings.currency || 'INR'
      }
    });
  } catch (error) {
    next(error);
  }
};
