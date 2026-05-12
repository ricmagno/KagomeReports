import { Router, Request, Response } from 'express';
import multer from 'multer';
import { dataManagementService } from '@/services/dataManagementService';
import { asyncHandler } from '@/middleware/errorHandler';
import { progressTracker } from '@/middleware/progressTracker';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
// Use memory storage for smaller files as in the examples
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

/**
 * Inspect uploaded files and return data summary
 * POST /api/configuration/data-management/inspect
 */
router.post('/inspect', upload.array('files'), asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  const { type } = req.body;

  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, error: 'No files uploaded' });
  }

  try {
    const result = await dataManagementService.inspectFile(files, type);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
}));

/**
 * Execute data insertion
 * POST /api/configuration/data-management/execute
 */
router.post('/execute', asyncHandler(async (req: Request, res: Response) => {
  const { dataPoints } = req.body;
  
  if (!dataPoints || !Array.isArray(dataPoints)) {
    return res.status(400).json({ success: false, error: 'Invalid data points' });
  }

  const operationId = progressTracker.startOperation({ 
    operationType: 'bulk-export',
    estimatedDuration: dataPoints.length * 50 // 50ms per row estimate
  });

  // Start background processing
  dataManagementService.executeSql(dataPoints, operationId);

  return res.json({ 
    success: true, 
    data: { 
      operationId,
      message: 'Data insertion started in background' 
    } 
  });
}));

/**
 * Generate SQL file content for download
 * POST /api/configuration/data-management/generate-sql
 */
router.post('/generate-sql', asyncHandler(async (req: Request, res: Response) => {
  const { dataPoints, filename } = req.body;
  
  if (!dataPoints || !Array.isArray(dataPoints)) {
    return res.status(400).json({ success: false, error: 'Invalid data points' });
  }

  const sqlContent = dataManagementService.generateFullSqlFile(dataPoints, filename || 'import.sql');
  
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename=${filename || 'import.sql'}`);
  return res.send(sqlContent);
}));

export default router;
