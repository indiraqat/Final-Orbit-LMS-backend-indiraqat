const prisma = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');

// GET /api/modules/:moduleId/materials  (public)
async function listMaterials(req, res) {
  const materials = await prisma.material.findMany({
    where: { moduleId: req.params.moduleId },
    orderBy: { order: 'asc' },
  });

  res.json({ data: materials });
}

// GET /api/materials/:id  (public)
async function getMaterial(req, res) {
  const material = await prisma.material.findUnique({ where: { id: req.params.id } });
  if (!material) throw new ApiError(404, 'Material not found.');

  res.json({ data: material });
}

// POST /api/modules/:moduleId/materials  (ADMIN only)
async function createMaterial(req, res) {
  const { title, type, url, order } = req.body;

  const module = await prisma.module.findUnique({ where: { id: req.params.moduleId } });
  if (!module) throw new ApiError(404, 'Module not found.');

  const material = await prisma.material.create({
    data: {
      moduleId: req.params.moduleId,
      title: title.trim(),
      type,
      url: url?.trim() || null,
      order: Number.isInteger(order) ? order : 0,
    },
  });

  res.status(201).json({ data: material });
}

// PUT /api/materials/:id  (ADMIN only)
async function updateMaterial(req, res) {
  const { title, type, url, order } = req.body;

  const material = await prisma.material.update({
    where: { id: req.params.id },
    data: {
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(type !== undefined ? { type } : {}),
      ...(url !== undefined ? { url: url?.trim() || null } : {}),
      ...(order !== undefined ? { order: Number(order) } : {}),
    },
  });

  res.json({ data: material });
}

// DELETE /api/materials/:id  (ADMIN only)
async function deleteMaterial(req, res) {
  await prisma.material.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { listMaterials, getMaterial, createMaterial, updateMaterial, deleteMaterial };
