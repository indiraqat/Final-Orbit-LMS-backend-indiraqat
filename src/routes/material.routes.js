const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const materialController = require('../controllers/material.controller');
const progressController = require('../controllers/progress.controller');

const router = express.Router();

const materialUpdateSchema = {
  title: { required: false, type: 'string', minLength: 1, maxLength: 200 },
  type: { required: false, type: 'string', enum: ['DOCUMENT', 'VIDEO_UPLOAD', 'VIDEO_LINK'] },
  url: { required: false, type: 'string', maxLength: 1000 },
};

router.get('/:id', asyncHandler(materialController.getMaterial));
router.put('/:id', requireAuth, requireRole('ADMIN'), validateBody(materialUpdateSchema), asyncHandler(materialController.updateMaterial));
router.delete('/:id', requireAuth, requireRole('ADMIN'), asyncHandler(materialController.deleteMaterial));

// Progress: an intern marking a material as complete for themselves
router.post('/:materialId/complete', requireAuth, asyncHandler(progressController.completeMaterial));

module.exports = router;
