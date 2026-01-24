/**
 * Update Management API Routes
 * Provides endpoints for checking, installing, and managing updates
 */

import { Router, Request, Response } from 'express';
import { updateChecker } from '@/services/updateChecker';
import { updateHistoryService } from '@/services/updateHistoryService';
import { updateInstaller } from '@/services/updateInstaller';
import { rollbackManager } from '@/services/rollbackManager';
import { githubReleaseService } from '@/services/githubReleaseService';
import { dbLogger } from '@/utils/logger';
import { z } from 'zod';

const router = Router();
const updateLogger = dbLogger.child({ route: 'updates' });

/**
 * GET /api/updates/check
 * Checks for available updates
 */
router.get('/check', async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true';
    const result = await updateChecker.checkForUpdates(force);

    updateLogger.info('Update check requested', {
      isUpdateAvailable: result.isUpdateAvailable,
      currentVersion: result.currentVersion
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    updateLogger.error('Failed to check for updates', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check for updates'
    });
  }
});

/**
 * GET /api/updates/status
 * Returns current update status
 */
router.get('/status', (_req: Request, res: Response) => {
  try {
    const status = updateChecker.getUpdateStatus();
    const lastCheckTime = updateChecker.getLastCheckTime();

    updateLogger.debug('Update status requested', {
      isUpdateAvailable: status.isUpdateAvailable
    });

    res.json({
      success: true,
      data: {
        ...status,
        lastCheckTime: lastCheckTime || status.lastCheckTime,
        isChecking: false
      }
    });
  } catch (error) {
    updateLogger.error('Failed to get update status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get update status'
    });
  }
});

/**
 * GET /api/updates/last-check-time
 * Returns the timestamp of the last update check
 */
router.get('/last-check-time', (_req: Request, res: Response) => {
  try {
    const lastCheckTime = updateChecker.getLastCheckTime();

    res.json({
      success: true,
      data: {
        lastCheckTime
      }
    });
  } catch (error) {
    updateLogger.error('Failed to get last check time', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get last check time'
    });
  }
});

/**
 * GET /api/updates/history
 * Returns update history
 */
router.get('/history', async (_req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(_req.query.limit as string) || 50, 100);
    const records = await updateHistoryService.getHistory(limit);

    updateLogger.debug('Update history requested', {
      recordCount: records.length
    });

    res.json({
      success: true,
      data: {
        records,
        total: records.length
      }
    });
  } catch (error) {
    updateLogger.error('Failed to get update history', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get update history'
    });
  }
});

/**
 * POST /api/updates/install
 * Initiates update installation
 */
router.post('/install', async (req: Request, res: Response): Promise<void> => {
  try {
    const { version } = req.body;

    if (!version) {
      res.status(400).json({
        success: false,
        error: 'Version is required'
      });
      return;
    }

    updateLogger.info('Update installation requested', { version });

    // Fetch release information
    const release = await githubReleaseService.fetchReleaseByVersion(version);
    if (!release) {
      res.status(404).json({
        success: false,
        error: `Release not found for version ${version}`
      });
      return;
    }

    // Start installation in background
    updateInstaller.installUpdate(release).catch((error) => {
      updateLogger.error('Background update installation failed', { version, error });
    });

    res.status(202).json({
      success: true,
      message: 'Update installation started',
      version,
      estimatedTime: 300 // seconds
    });
  } catch (error) {
    updateLogger.error('Failed to initiate update installation', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate update installation'
    });
  }
});

/**
 * GET /api/updates/install-status
 * Returns current installation status
 */
router.get('/install-status', (_req: Request, res: Response): void => {
  try {
    const installation = updateInstaller.getCurrentInstallation();

    if (!installation) {
      res.json({
        success: true,
        data: {
          isInstalling: false
        }
      });
      return;
    }

    const elapsedTime = Date.now() - installation.startTime;

    res.json({
      success: true,
      data: {
        isInstalling: true,
        version: installation.release.version,
        downloadedSize: installation.downloadedSize,
        elapsedTime
      }
    });
  } catch (error) {
    updateLogger.error('Failed to get installation status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get installation status'
    });
  }
});

/**
 * POST /api/updates/rollback
 * Initiates rollback to previous version
 */
router.post('/rollback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { backupPath } = req.body;

    if (!backupPath) {
      res.status(400).json({
        success: false,
        error: 'Backup path is required'
      });
      return;
    }

    updateLogger.info('Rollback requested', { backupPath });

    // Verify backup before attempting rollback
    if (!rollbackManager.verifyBackup(backupPath)) {
      res.status(400).json({
        success: false,
        error: 'Backup verification failed: backup is corrupted or invalid'
      });
      return;
    }

    // Perform rollback
    await rollbackManager.rollback(backupPath);

    res.json({
      success: true,
      message: 'Rollback completed successfully',
      backupPath
    });
  } catch (error) {
    updateLogger.error('Failed to perform rollback', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to perform rollback'
    });
  }
});

/**
 * POST /api/updates/cancel
 * Cancels current installation
 */
router.post('/cancel', (_req: Request, res: Response) => {
  try {
    updateInstaller.cancelInstallation();

    updateLogger.info('Update installation cancelled');

    res.json({
      success: true,
      message: 'Update installation cancelled'
    });
  } catch (error) {
    updateLogger.error('Failed to cancel update installation', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel update installation'
    });
  }
});

export default router;
