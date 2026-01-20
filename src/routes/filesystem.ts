/**
 * File System API Routes
 * Provides directory browsing capabilities for report destination selection
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { apiLogger } from '@/utils/logger';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { authenticateToken, requirePermission } from '@/middleware/auth';

const router = Router();

// Validation schemas
const browseDirectorySchema = z.object({
  path: z.string().optional().default(''),
});

const createDirectorySchema = z.object({
  path: z.string().min(1),
});

interface DirectoryEntry {
  name: string;
  path: string;
  type: 'directory' | 'file';
  isWritable: boolean;
}

/**
 * Sanitize and validate path to prevent directory traversal
 */
function sanitizePath(userPath: string): string {
  // Remove any .. sequences
  const sanitized = userPath.replace(/\.\./g, '');
  // Remove leading slashes to make it relative
  return sanitized.replace(/^\/+/, '');
}

/**
 * Get the base directory for browsing
 */
function getBaseDirectory(): string {
  // Start from user's home directory for general file browsing
  return process.env.HOME || process.env.USERPROFILE || '/';
}

/**
 * Resolve user path relative to base directory
 */
function resolveUserPath(userPath: string): string {
  const basePath = path.resolve(getBaseDirectory());
  const sanitized = sanitizePath(userPath);
  
  if (!sanitized) {
    return basePath;
  }
  
  const resolved = path.resolve(basePath, sanitized);
  
  // Ensure the resolved path is within the base directory
  if (!resolved.startsWith(basePath)) {
    throw new Error('Invalid path: outside allowed directory');
  }
  
  return resolved;
}

/**
 * Check if a directory is writable
 */
async function isWritable(dirPath: string): Promise<boolean> {
  try {
    await fs.access(dirPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * GET /api/filesystem/browse
 * Browse directories starting from reports directory
 */
router.get('/browse', authenticateToken, requirePermission('schedules', 'read'), asyncHandler(async (req: Request, res: Response) => {
  const { path: userPath } = browseDirectorySchema.parse(req.query);
  // Allow specifying a different base directory via query param
  const baseType = req.query.baseType as string || 'home'; // 'home' or 'reports'
  const baseDirectory = baseType === 'reports' ? process.env.REPORTS_DIR || './reports' : getBaseDirectory();

  apiLogger.info('Browsing directory', { userPath, baseType, baseDirectory });

  try {
    const resolvedPath = path.resolve(baseDirectory, userPath || '');
    const basePath = path.resolve(baseDirectory);

    // Ensure the resolved path is within the base directory
    if (!resolvedPath.startsWith(basePath)) {
      throw createError('Invalid path: outside allowed directory', 403);
    }

    // Check if directory exists
    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        throw createError('Path is not a directory', 400);
      }
    } catch (error) {
      throw createError('Directory not found', 404);
    }

    // Read directory contents
    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

    // Filter to only directories and map to response format
    const directories: DirectoryEntry[] = await Promise.all(
      entries
        .filter(entry => entry.isDirectory())
        .map(async (entry) => {
          const fullPath = path.join(resolvedPath, entry.name);
          let relativePath = path.relative(basePath, fullPath);

          // Sanitize the path to remove any problematic characters
          relativePath = relativePath.replace(/\.\./g, '').replace(/\\/g, '/');

          const writable = await isWritable(fullPath);

          return {
            name: entry.name,
            path: relativePath,
            type: 'directory' as const,
            isWritable: writable
          };
        })
    );

    // Sort directories alphabetically
    directories.sort((a, b) => a.name.localeCompare(b.name));

    // Calculate parent path
    let parentPath: string | null = null;
    if (resolvedPath !== basePath) {
      const parent = path.dirname(resolvedPath);
      let relativeParentPath = path.relative(basePath, parent);

      // Sanitize the parent path to remove any problematic characters
      relativeParentPath = relativeParentPath.replace(/\.\./g, '').replace(/\\/g, '/');

      parentPath = relativeParentPath;
      if (parentPath === '') {
        parentPath = null; // We're at the root
      }
    }

    // Get current path info
    let currentPath = path.relative(basePath, resolvedPath) || '';

    // Sanitize the current path to remove any problematic characters
    currentPath = currentPath.replace(/\.\./g, '').replace(/\\/g, '/');

    const isRoot = resolvedPath === basePath;

    res.json({
      success: true,
      data: {
        currentPath,
        parentPath,
        isRoot,
        directories,
        baseDirectory
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('outside allowed directory')) {
      throw createError('Invalid path: outside allowed directory', 403);
    }
    apiLogger.error('Failed to browse directory', { error, userPath });
    throw createError('Failed to browse directory', 500);
  }
}));

/**
 * POST /api/filesystem/create-directory
 * Create a new directory
 */
router.post('/create-directory', authenticateToken, requirePermission('schedules', 'write'), asyncHandler(async (req: Request, res: Response) => {
  const { path: userPath } = createDirectorySchema.parse(req.body);
  // Allow specifying a different base directory via query param
  const baseType = req.query.baseType as string || 'home'; // 'home' or 'reports'
  const baseDirectory = baseType === 'reports' ? process.env.REPORTS_DIR || './reports' : getBaseDirectory();

  apiLogger.info('Creating directory', { userPath, baseType, baseDirectory });

  try {
    const resolvedPath = path.resolve(baseDirectory, userPath);
    const basePath = path.resolve(baseDirectory);

    // Ensure the resolved path is within the base directory
    if (!resolvedPath.startsWith(basePath)) {
      throw createError('Invalid path: outside allowed directory', 403);
    }

    // Check if directory already exists
    try {
      await fs.access(resolvedPath);
      throw createError('Directory already exists', 409);
    } catch (error: any) {
      // Directory doesn't exist, which is what we want
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Create directory with recursive option
    await fs.mkdir(resolvedPath, { recursive: true });

    // Verify it's writable
    const writable = await isWritable(resolvedPath);

    let relativePath = path.relative(basePath, resolvedPath);

    // Sanitize the path to remove any problematic characters
    relativePath = relativePath.replace(/\.\./g, '').replace(/\\/g, '/');

    res.status(201).json({
      success: true,
      data: {
        path: relativePath,
        isWritable: writable,
        message: 'Directory created successfully'
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('outside allowed directory')) {
      throw createError('Invalid path: outside allowed directory', 403);
    }
    if (error instanceof Error && error.message.includes('already exists')) {
      throw error;
    }
    apiLogger.error('Failed to create directory', { error, userPath });
    throw createError('Failed to create directory', 500);
  }
}));

/**
 * GET /api/filesystem/validate-path
 * Validate if a path is writable
 */
router.get('/validate-path', authenticateToken, requirePermission('schedules', 'read'), asyncHandler(async (req: Request, res: Response) => {
  const { path: userPath } = browseDirectorySchema.parse(req.query);
  // Allow specifying a different base directory via query param
  const baseType = req.query.baseType as string || 'home'; // 'home' or 'reports'
  const baseDirectory = baseType === 'reports' ? process.env.REPORTS_DIR || './reports' : getBaseDirectory();

  if (!userPath) {
    res.json({
      success: true,
      data: {
        valid: true,
        writable: true,
        exists: true,
        message: 'Using default reports directory'
      }
    });
    return;
  }

  apiLogger.info('Validating path', { userPath, baseType, baseDirectory });

  try {
    const resolvedPath = path.resolve(baseDirectory, userPath);
    const basePath = path.resolve(baseDirectory);

    // Ensure the resolved path is within the base directory
    if (!resolvedPath.startsWith(basePath)) {
      res.json({
        success: true,
        data: {
          valid: false,
          exists: false,
          writable: false,
          message: 'Invalid path: outside allowed directory'
        }
      });
      return;
    }

    // Check if path exists
    let exists = false;
    let isDirectory = false;
    let writable = false;

    try {
      const stats = await fs.stat(resolvedPath);
      exists = true;
      isDirectory = stats.isDirectory();

      if (isDirectory) {
        writable = await isWritable(resolvedPath);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Path doesn't exist - check if parent is writable
        const parentPath = path.dirname(resolvedPath);
        try {
          writable = await isWritable(parentPath);
        } catch {
          writable = false;
        }
      }
    }

    res.json({
      success: true,
      data: {
        valid: true,
        exists,
        isDirectory,
        writable,
        message: exists
          ? (isDirectory ? 'Directory exists and is accessible' : 'Path exists but is not a directory')
          : 'Directory will be created on first use'
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('outside allowed directory')) {
      res.json({
        success: true,
        data: {
          valid: false,
          exists: false,
          writable: false,
          message: 'Invalid path: outside allowed directory'
        }
      });
      return;
    }

    apiLogger.error('Failed to validate path', { error, userPath });
    throw createError('Failed to validate path', 500);
  }
}));

export default router;
