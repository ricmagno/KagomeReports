/**
 * Version Management API Routes
 * Provides endpoints for retrieving version and build information
 */

import { Router, Request, Response } from 'express';
import { versionManager } from '@/services/versionManager';
import { dbLogger } from '@/utils/logger';

const router = Router();
const versionLogger = dbLogger.child({ route: 'version' });

/**
 * GET /api/version
 * Returns current version and build information
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const versionInfo = versionManager.getCurrentVersion();
    
    versionLogger.info('Version info requested', {
      version: versionInfo.version
    });

    res.json({
      success: true,
      data: versionInfo
    });
  } catch (error) {
    versionLogger.error('Failed to get version info', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve version information'
    });
  }
});

/**
 * GET /api/version/validate/:version
 * Validates a version string against SemVer format
 */
router.get('/validate/:version', (req: Request, res: Response): void => {
  try {
    const version = req.params.version || '';
    const isValid = versionManager.validateVersion(version);

    versionLogger.debug('Version validation requested', {
      version,
      isValid
    });

    res.json({
      success: true,
      data: {
        version,
        isValid
      }
    });
  } catch (error) {
    versionLogger.error('Failed to validate version', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate version'
    });
  }
});

/**
 * GET /api/version/compare/:v1/:v2
 * Compares two versions using SemVer rules
 * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
 */
router.get('/compare/:v1/:v2', (req: Request, res: Response): void => {
  try {
    const v1 = req.params.v1 || '';
    const v2 = req.params.v2 || '';
    
    if (!versionManager.validateVersion(v1) || !versionManager.validateVersion(v2)) {
      res.status(400).json({
        success: false,
        error: 'Invalid version format'
      });
      return;
    }

    const comparison = versionManager.compareVersions(v1, v2);

    versionLogger.debug('Version comparison requested', {
      v1,
      v2,
      result: comparison
    });

    res.json({
      success: true,
      data: {
        v1,
        v2,
        comparison,
        meaning: comparison === -1 ? 'v1 < v2' : comparison === 0 ? 'v1 == v2' : 'v1 > v2'
      }
    });
  } catch (error) {
    versionLogger.error('Failed to compare versions', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare versions'
    });
  }
});

export default router;
