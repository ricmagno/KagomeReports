/**
 * File System Types
 * Interfaces for directory browsing and file operations
 */

export interface DirectoryEntry {
    name: string;
    path: string;
    type: 'directory';
    isWritable: boolean;
}

export interface DirectoryBrowserData {
    currentPath: string;
    parentPath: string | null;
    isRoot: boolean;
    directories: DirectoryEntry[];
    baseDirectory: string;
    isWritable?: boolean;
}

export interface CreateDirectoryResponse {
    path: string;
    isWritable: boolean;
    message: string;
}

export interface ValidatePathResponse {
    valid: boolean;
    exists: boolean;
    isDirectory: boolean;
    writable: boolean;
    message: string;
}
