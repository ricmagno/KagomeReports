/**
 * GitHub Release Service
 * Integrates with GitHub Releases API to fetch release information
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import https from 'https';
import crypto from 'crypto';
import { GitHubRelease, ReleaseCache } from '@/types/versionManagement';
import { versionManager } from './versionManager';
import { dbLogger } from '@/utils/logger';

const githubLogger = dbLogger.child({ service: 'GitHubReleaseService' });

/**
 * GitHubReleaseService handles GitHub API integration for releases
 */
export class GitHubReleaseService {
  private releaseCache: Map<string, ReleaseCache> = new Map();
  private readonly CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour
  private readonly GITHUB_API_BASE = 'api.github.com';
  private readonly GITHUB_OWNER = process.env.GITHUB_OWNER || 'ricmagno';
  private readonly GITHUB_REPO = process.env.GITHUB_REPO || 'historian-reports';
  private readonly GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  private readonly RATE_LIMIT_REMAINING = 60;
  private readonly RATE_LIMIT_RESET = 3600;

  /**
   * Fetch latest release from GitHub
   */
  async fetchLatestRelease(): Promise<GitHubRelease | null> {
    try {
      const cacheKey = 'latest';
      
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        githubLogger.debug('Returning cached latest release');
        return this.cacheToRelease(cached);
      }

      const response = await this.makeGitHubRequest(
        `/repos/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/releases/latest`
      );

      if (!response) {
        return null;
      }

      const release = this.parseGitHubResponse(response);
      
      // Cache the result
      this.cacheRelease(cacheKey, release);

      githubLogger.info('Latest release fetched', {
        version: release.version
      });

      return release;
    } catch (error) {
      githubLogger.error('Failed to fetch latest release', error);
      throw error;
    }
  }

  /**
   * Fetch release by version from GitHub
   */
  async fetchReleaseByVersion(version: string): Promise<GitHubRelease | null> {
    try {
      if (!versionManager.validateVersion(version)) {
        throw new Error(`Invalid version format: ${version}`);
      }

      const cacheKey = `version-${version}`;
      
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        githubLogger.debug('Returning cached release for version', { version });
        return this.cacheToRelease(cached);
      }

      const response = await this.makeGitHubRequest(
        `/repos/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/releases/tags/v${version}`
      );

      if (!response) {
        return null;
      }

      const release = this.parseGitHubResponse(response);
      
      // Cache the result
      this.cacheRelease(cacheKey, release);

      githubLogger.info('Release fetched by version', {
        version: release.version
      });

      return release;
    } catch (error) {
      githubLogger.error('Failed to fetch release by version', { version, error });
      throw error;
    }
  }

  /**
   * Download release artifact from GitHub
   */
  async downloadRelease(downloadUrl: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        githubLogger.debug('Downloading release', { url: downloadUrl });

        https.get(downloadUrl, (response) => {
          if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
            // Handle redirects
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              this.downloadRelease(redirectUrl).then(resolve).catch(reject);
              return;
            }
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download release: ${response.statusCode}`));
            return;
          }

          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });

          response.on('end', () => {
            const buffer = Buffer.concat(chunks);
            githubLogger.debug('Release downloaded', {
              size: buffer.length
            });
            resolve(buffer);
          });
        }).on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Verify checksum of downloaded file
   */
  verifyChecksum(data: Buffer, checksum: string, algorithm: 'sha256' | 'sha512' = 'sha256'): boolean {
    try {
      const hash = crypto.createHash(algorithm);
      hash.update(data);
      const computed = hash.digest('hex');
      const isValid = computed === checksum.toLowerCase();

      if (!isValid) {
        githubLogger.warn('Checksum verification failed', {
          expected: checksum,
          computed,
          algorithm
        });
      }

      return isValid;
    } catch (error) {
      githubLogger.error('Checksum verification error', error);
      return false;
    }
  }

  /**
   * Parse release notes from GitHub response
   */
  parseReleaseNotes(releaseBody: string): string {
    // Remove markdown formatting for plain text
    let notes = releaseBody;
    
    // Remove markdown headers
    notes = notes.replace(/^#+\s+/gm, '');
    
    // Remove markdown bold/italic
    notes = notes.replace(/\*\*(.+?)\*\*/g, '$1');
    notes = notes.replace(/\*(.+?)\*/g, '$1');
    notes = notes.replace(/__(.+?)__/g, '$1');
    notes = notes.replace(/_(.+?)_/g, '$1');
    
    // Remove markdown links but keep text
    notes = notes.replace(/\[(.+?)\]\(.+?\)/g, '$1');
    
    // Remove markdown code blocks
    notes = notes.replace(/```[\s\S]*?```/g, '');
    notes = notes.replace(/`(.+?)`/g, '$1');
    
    // Clean up extra whitespace
    notes = notes.replace(/\n\n+/g, '\n\n').trim();
    
    return notes;
  }

  /**
   * Clear release cache
   */
  clearCache(): void {
    this.releaseCache.clear();
    githubLogger.debug('Release cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.releaseCache.size,
      entries: Array.from(this.releaseCache.keys())
    };
  }

  /**
   * Private method to make GitHub API request
   */
  private async makeGitHubRequest(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const headers: Record<string, string> = {
          'User-Agent': 'Historian-Reports',
          'Accept': 'application/vnd.github.v3+json'
        };

        // Add authentication if token is available
        if (this.GITHUB_TOKEN) {
          headers['Authorization'] = `token ${this.GITHUB_TOKEN}`;
        }

        const options: https.RequestOptions = {
          hostname: this.GITHUB_API_BASE,
          path,
          method: 'GET',
          headers
        };

        const request = https.request(options, (response) => {
          let data = '';

          response.on('data', (chunk) => {
            data += chunk;
          });

          response.on('end', () => {
            if (response.statusCode === 404) {
              resolve(null);
              return;
            }

            if (response.statusCode && response.statusCode >= 400) {
              reject(new Error(`GitHub API error: ${response.statusCode}`));
              return;
            }

            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (error) {
              reject(new Error('Failed to parse GitHub API response'));
            }
          });
        });

        request.on('error', reject);
        request.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Private method to parse GitHub API response
   */
  private parseGitHubResponse(response: any): GitHubRelease {
    const tagName = response.tag_name || '';
    const version = tagName.startsWith('v') ? tagName.substring(1) : tagName;

    if (!versionManager.validateVersion(version)) {
      throw new Error(`Invalid version in GitHub release: ${version}`);
    }

    return {
      version,
      releaseDate: response.published_at || new Date().toISOString(),
      changelog: this.parseReleaseNotes(response.body || ''),
      downloadUrl: response.zipball_url || '',
      checksum: response.checksum || '',
      checksumAlgorithm: response.checksum_algorithm || 'sha256',
      prerelease: response.prerelease || false,
      draft: response.draft || false
    };
  }

  /**
   * Private method to get from cache
   */
  private getFromCache(key: string): ReleaseCache | null {
    const cached = this.releaseCache.get(key);
    
    if (!cached) {
      return null;
    }

    const expiresAt = new Date(cached.expiresAt);
    if (new Date() > expiresAt) {
      this.releaseCache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Private method to cache release
   */
  private cacheRelease(key: string, release: GitHubRelease): void {
    const cached: ReleaseCache = {
      version: release.version,
      releaseDate: release.releaseDate,
      changelog: release.changelog,
      downloadUrl: release.downloadUrl,
      checksum: release.checksum,
      checksumAlgorithm: release.checksumAlgorithm,
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.CACHE_DURATION_MS).toISOString()
    };

    this.releaseCache.set(key, cached);
  }

  /**
   * Private method to convert cache to release
   */
  private cacheToRelease(cached: ReleaseCache): GitHubRelease {
    return {
      version: cached.version,
      releaseDate: cached.releaseDate,
      changelog: cached.changelog,
      downloadUrl: cached.downloadUrl,
      checksum: cached.checksum,
      checksumAlgorithm: cached.checksumAlgorithm as 'sha256' | 'sha512',
      prerelease: false,
      draft: false
    };
  }
}

// Export singleton instance
export const githubReleaseService = new GitHubReleaseService();
