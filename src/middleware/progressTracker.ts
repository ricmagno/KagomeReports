/**
 * Progress Tracking Middleware for Long-Running Operations
 * Provides real-time progress updates for data retrieval and report generation
 */

import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { dbLogger } from '@/utils/logger';

export interface ProgressUpdate {
  operationId: string;
  stage: string;
  progress: number; // 0-100
  message: string;
  timestamp: Date;
  estimatedTimeRemaining?: number;
  metadata?: Record<string, any>;
}

export interface ProgressOptions {
  operationType: 'data-retrieval' | 'report-generation' | 'bulk-export';
  estimatedDuration?: number;
  stages?: string[];
}

class ProgressTracker extends EventEmitter {
  private operations: Map<string, ProgressUpdate> = new Map();
  private stageWeights: Map<string, Record<string, number>> = new Map();

  constructor() {
    super();
    this.initializeStageWeights();
  }

  private initializeStageWeights(): void {
    // Define stage weights for different operation types
    this.stageWeights.set('data-retrieval', {
      'connecting': 5,
      'querying': 60,
      'processing': 25,
      'caching': 10
    });

    this.stageWeights.set('report-generation', {
      'data-collection': 30,
      'analysis': 20,
      'chart-generation': 25,
      'pdf-creation': 20,
      'finalization': 5
    });

    this.stageWeights.set('bulk-export', {
      'preparation': 10,
      'data-extraction': 70,
      'formatting': 15,
      'compression': 5
    });
  }

  /**
   * Start tracking a new operation
   */
  startOperation(options: ProgressOptions): string {
    const operationId = uuidv4();
    const initialUpdate: ProgressUpdate = {
      operationId,
      stage: 'initializing',
      progress: 0,
      message: `Starting ${options.operationType} operation`,
      timestamp: new Date(),
      metadata: { operationType: options.operationType }
    };

    if (options.estimatedDuration) {
      initialUpdate.estimatedTimeRemaining = options.estimatedDuration;
    }

    this.operations.set(operationId, initialUpdate);
    this.emit('progress', initialUpdate);
    
    dbLogger.info('Started progress tracking', { operationId, operationType: options.operationType });
    return operationId;
  }

  /**
   * Update progress for an operation
   */
  updateProgress(
    operationId: string, 
    stage: string, 
    progress: number, 
    message: string,
    metadata?: Record<string, any>
  ): void {
    const existingOperation = this.operations.get(operationId);
    if (!existingOperation) {
      dbLogger.warn('Attempted to update non-existent operation', { operationId });
      return;
    }

    const operationType = existingOperation.metadata?.operationType;
    const stageWeights = this.stageWeights.get(operationType) || {};
    
    // Calculate weighted progress based on stage
    const weightedProgress = this.calculateWeightedProgress(stage, progress, stageWeights);
    
    // Estimate time remaining
    const estimatedTimeRemaining = this.estimateTimeRemaining(
      existingOperation,
      weightedProgress
    );

    const update: ProgressUpdate = {
      operationId,
      stage,
      progress: Math.min(100, Math.max(0, weightedProgress)),
      message,
      timestamp: new Date(),
      metadata: { ...existingOperation.metadata, ...metadata }
    };

    if (estimatedTimeRemaining !== undefined) {
      update.estimatedTimeRemaining = estimatedTimeRemaining;
    }

    this.operations.set(operationId, update);
    this.emit('progress', update);
    
    dbLogger.debug('Progress updated', { operationId, stage, progress: update.progress });
  }

  /**
   * Complete an operation
   */
  completeOperation(operationId: string, message: string = 'Operation completed'): void {
    const existingOperation = this.operations.get(operationId);
    if (!existingOperation) {
      return;
    }

    const finalUpdate: ProgressUpdate = {
      ...existingOperation,
      stage: 'completed',
      progress: 100,
      message,
      timestamp: new Date(),
      estimatedTimeRemaining: 0
    };

    this.operations.set(operationId, finalUpdate);
    this.emit('progress', finalUpdate);
    this.emit('completed', finalUpdate);
    
    dbLogger.info('Operation completed', { operationId });
    
    // Clean up after 5 minutes
    setTimeout(() => {
      this.operations.delete(operationId);
    }, 5 * 60 * 1000);
  }

  /**
   * Mark operation as failed
   */
  failOperation(operationId: string, error: string): void {
    const existingOperation = this.operations.get(operationId);
    if (!existingOperation) {
      return;
    }

    const failedUpdate: ProgressUpdate = {
      ...existingOperation,
      stage: 'failed',
      message: `Operation failed: ${error}`,
      timestamp: new Date(),
      estimatedTimeRemaining: 0,
      metadata: { ...existingOperation.metadata, error }
    };

    this.operations.set(operationId, failedUpdate);
    this.emit('progress', failedUpdate);
    this.emit('failed', failedUpdate);
    
    dbLogger.error('Operation failed', { operationId, error });
    
    // Clean up after 1 minute for failed operations
    setTimeout(() => {
      this.operations.delete(operationId);
    }, 60 * 1000);
  }

  /**
   * Get current progress for an operation
   */
  getProgress(operationId: string): ProgressUpdate | undefined {
    return this.operations.get(operationId);
  }

  /**
   * Get all active operations
   */
  getActiveOperations(): ProgressUpdate[] {
    return Array.from(this.operations.values()).filter(
      op => op.stage !== 'completed' && op.stage !== 'failed'
    );
  }

  /**
   * Calculate weighted progress based on stage
   */
  private calculateWeightedProgress(
    currentStage: string, 
    stageProgress: number, 
    stageWeights: Record<string, number>
  ): number {
    const stages = Object.keys(stageWeights);
    const currentStageIndex = stages.indexOf(currentStage);
    
    if (currentStageIndex === -1) {
      return stageProgress;
    }

    // Calculate progress from completed stages
    let completedWeight = 0;
    for (let i = 0; i < currentStageIndex; i++) {
      completedWeight += stageWeights[stages[i]!] || 0;
    }

    // Add progress from current stage
    const currentStageWeight = stageWeights[currentStage] || 0;
    const currentStageProgress = (currentStageWeight * stageProgress) / 100;

    return completedWeight + currentStageProgress;
  }

  /**
   * Estimate time remaining based on current progress
   */
  private estimateTimeRemaining(
    existingOperation: ProgressUpdate,
    currentProgress: number
  ): number | undefined {
    if (!existingOperation.metadata?.startTime || currentProgress <= 0) {
      return existingOperation.estimatedTimeRemaining;
    }

    const startTime = new Date(existingOperation.metadata.startTime).getTime();
    const currentTime = Date.now();
    const elapsedTime = currentTime - startTime;
    
    // Estimate based on current progress rate
    const progressRate = currentProgress / elapsedTime; // progress per millisecond
    const remainingProgress = 100 - currentProgress;
    
    if (progressRate <= 0) {
      return existingOperation.estimatedTimeRemaining;
    }

    return Math.round(remainingProgress / progressRate);
  }
}

// Singleton instance
export const progressTracker = new ProgressTracker();

/**
 * Express middleware to add progress tracking to requests
 */
export function progressMiddleware(options: ProgressOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const operationId = progressTracker.startOperation({
      ...options,
      estimatedDuration: options.estimatedDuration || 30000 // Default 30 seconds
    });

    // Add progress tracking methods to request
    (req as any).progressTracker = {
      operationId,
      updateProgress: (stage: string, progress: number, message: string, metadata?: Record<string, any>) => {
        progressTracker.updateProgress(operationId, stage, progress, message, metadata);
      },
      completeOperation: (message?: string) => {
        progressTracker.completeOperation(operationId, message);
      },
      failOperation: (error: string) => {
        progressTracker.failOperation(operationId, error);
      }
    };

    // Set operation start time
    progressTracker.updateProgress(operationId, 'initializing', 0, 'Operation started', {
      startTime: new Date().toISOString(),
      requestPath: req.path,
      requestMethod: req.method
    });

    next();
  };
}

/**
 * Server-Sent Events endpoint for real-time progress updates
 */
export function createProgressSSEHandler() {
  return (req: Request, res: Response): void => {
    const operationId = req.params.operationId;
    
    if (!operationId) {
      res.status(400).json({ error: 'Operation ID is required' });
      return;
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial progress if available
    const currentProgress = progressTracker.getProgress(operationId);
    if (currentProgress) {
      res.write(`data: ${JSON.stringify(currentProgress)}\n\n`);
    }

    // Listen for progress updates
    const progressHandler = (update: ProgressUpdate) => {
      if (update.operationId === operationId) {
        res.write(`data: ${JSON.stringify(update)}\n\n`);
        
        // Close connection when operation is complete or failed
        if (update.stage === 'completed' || update.stage === 'failed') {
          res.end();
        }
      }
    };

    progressTracker.on('progress', progressHandler);

    // Clean up on client disconnect
    req.on('close', () => {
      progressTracker.removeListener('progress', progressHandler);
    });

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
    });
  };
}