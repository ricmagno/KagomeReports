import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import iconv from 'iconv-lite';
import { getHistorianConnection } from './historianConnection';
import { progressTracker } from '@/middleware/progressTracker';
import { logger } from '@/utils/logger';
import { createError } from '@/middleware/errorHandler';

const dmLogger = logger.child({ service: 'DataManagementService' });

export interface DataPoint {
  tagName: string;
  dateTime: Date;
  value: number;
  quality: number;
}

export interface InspectionResult {
  tagName: string;
  rowCount: number;
  startTime: Date;
  endTime: Date;
  sampleData: DataPoint[];
  allDataPoints: DataPoint[];
  sqlPreview: string;
}

export class DataManagementService {
  /**
   * Inspect a file and return summary information
   */
  async inspectFile(files: Express.Multer.File[], type: string): Promise<InspectionResult> {
    let dataPoints: DataPoint[] = [];

    if (!files || files.length === 0) {
      throw createError('No files uploaded', 400);
    }

    const firstFile = files[0];
    if (!firstFile) {
      throw createError('No files uploaded', 400);
    }

    switch (type.toLowerCase()) {
      case 'csv':
      case 'xls':
      case 'xlsx':
        dataPoints = await this.parseExcelOrCsv(firstFile.buffer, firstFile.originalname);
        break;
      case 'txt':
        dataPoints = await this.parseTxt(firstFile.buffer);
        break;
      case 'trend':
        dataPoints = await this.parseTrend(files);
        break;
      default:
        throw createError(`Unsupported file type: ${type}`, 400);
    }

    if (dataPoints.length === 0) {
      throw createError('No valid data points found in file', 400);
    }

    const sorted = [...dataPoints].sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

    // Generate a small preview
    const previewCount = Math.min(sorted.length, 5);
    const sqlPreview = this.generateSql(sorted.slice(0, previewCount)) + (sorted.length > previewCount ? '\n...' : '');

    return {
      tagName: dataPoints[0]?.tagName || 'Unknown',
      rowCount: dataPoints.length,
      startTime: sorted[0]?.dateTime || new Date(),
      endTime: sorted[sorted.length - 1]?.dateTime || new Date(),
      sampleData: sorted.slice(0, 100),
      allDataPoints: sorted,
      sqlPreview
    };
  }

  /**
   * Parse CSV or Excel files supporting FastLoad format, separate Date/Time columns, and raw outputs
   */
  private async parseExcelOrCsv(buffer: Buffer, filename: string): Promise<DataPoint[]> {
    const dataPoints: DataPoint[] = [];
    const fallbackTagName = path.basename(filename, path.extname(filename));

    // Try parsing as FastLoad format first (common for .csv exported by PlantScada utilities)
    const contentUtf8 = buffer.toString('utf8');
    const lines = contentUtf8.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

    const isFastLoad = lines.some(l => l.startsWith('ASCII') || l.includes('FASTLOAD'));
    if (isFastLoad) {
      for (const line of lines) {
        if (line.startsWith('ASCII') || line === '|' || line.includes('FASTLOAD')) continue;
        const parts = line.split('|');
        if (parts.length >= 6) {
          const tName = parts[0]?.trim() || '';
          const dPart = parts[2]?.trim() || '';
          const tPart = parts[3]?.trim() || '';
          const vPart = parts[5]?.trim() || '';
          const qPart = parts[6] ? parts[6]?.trim() : '192';

          const dtObj = this.parseCustomDateString(dPart, tPart);
          const val = parseFloat(vPart.replace(/,/g, ''));
          if (!isNaN(dtObj.getTime()) && !isNaN(val)) {
            dataPoints.push({
              tagName: tName,
              dateTime: dtObj,
              value: val,
              quality: parseInt(qPart || '192') || 192
            });
          }
        }
      }
      if (dataPoints.length > 0) return dataPoints;
    }

    // Try parsing using SheetJS
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (sheetName) {
        const worksheet = workbook.Sheets[sheetName];
        if (worksheet) {
          const data = XLSX.utils.sheet_to_json<any>(worksheet);

          for (const row of data) {
            const keys = Object.keys(row);
            const getVal = (possibleNames: string[]) => {
              const foundKey = keys.find(k => possibleNames.includes(k.toLowerCase()));
              return foundKey ? row[foundKey] : undefined;
            };

            const tagNameVal = getVal(['tagname', 'tag', 'tag_name', 'name']);
            const tagName = tagNameVal ? String(tagNameVal) : fallbackTagName;

            const rawDate = getVal(['datetime', 'date_time', 'timestamp']);
            let parsedDate: Date | null = null;

            if (rawDate !== undefined) {
              parsedDate = this.parseExcelDate(rawDate);
            } else {
              const dateVal = getVal(['date']);
              const timeVal = getVal(['time']);
              if (dateVal !== undefined) {
                const dateStrStr = typeof dateVal === 'string' ? dateVal : (dateVal instanceof Date ? dateVal.toISOString().split('T')[0] || '' : String(dateVal));
                let timeStrStr = '';
                if (timeVal !== undefined) {
                  if (typeof timeVal === 'string') timeStrStr = timeVal;
                  else if (timeVal instanceof Date) timeStrStr = timeVal.toTimeString().split(' ')[0] || '';
                  else if (typeof timeVal === 'number') {
                    const h = Math.floor(timeVal * 24);
                    const m = Math.floor((timeVal * 24 - h) * 60);
                    const s = Math.floor(((timeVal * 24 - h) * 60 - m) * 60);
                    timeStrStr = `${h}:${m}:${s}`;
                  }
                }
                parsedDate = this.parseCustomDateString(dateStrStr || '', timeStrStr);
              } else if (timeVal !== undefined) {
                parsedDate = this.parseExcelDate(timeVal);
              }
            }

            let rawValue = getVal(['value', 'val', 'valueraw']);
            if (rawValue === undefined) {
              const tagColKey = keys.find(k => k.toLowerCase() === fallbackTagName.toLowerCase() || (tagName && k.toLowerCase() === tagName.toLowerCase()));
              if (tagColKey) {
                rawValue = row[tagColKey];
              } else {
                const otherKey = keys.find(k => !['date', 'time', 'datetime', 'timestamp', 'tagname', 'tag'].includes(k.toLowerCase()));
                if (otherKey) rawValue = row[otherKey];
              }
            }

            const qualityVal = getVal(['quality', 'opcquality']);
            const quality = parseInt(qualityVal !== undefined ? String(qualityVal) : '192') || 192;

            const value = typeof rawValue === 'string' ? parseFloat(rawValue.replace(/,/g, '')) : parseFloat(rawValue);

            if (tagName && parsedDate && !isNaN(parsedDate.getTime()) && !isNaN(value)) {
              dataPoints.push({
                tagName: String(tagName),
                dateTime: parsedDate,
                value,
                quality
              });
            }
          }
        }
      }
    } catch (err) {
      dmLogger.warn('XLSX parsing failed or encountered error', { err });
    }

    // Direct manual fallback parsing for raw/custom CSVs if SheetJS returned 0 points
    if (dataPoints.length === 0) {
      let startIdx = 0;
      const firstLineLower = lines[0]?.toLowerCase() || '';
      if (firstLineLower.includes('date') || firstLineLower.includes('time') || firstLineLower.includes('tag') || firstLineLower.includes('value')) {
        startIdx = 1;
      }

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 2) continue;

        // Try format: Date, Time, Value
        if (parts.length >= 3) {
          const dPart = parts[0] || '';
          const tPart = parts[1] || '';
          const vPart = parts[2] || '';

          const dtObj = this.parseCustomDateString(dPart, tPart);
          const val = parseFloat(vPart.replace(/,/g, ''));

          if (!isNaN(dtObj.getTime()) && !isNaN(val)) {
            dataPoints.push({
              tagName: fallbackTagName,
              dateTime: dtObj,
              value: val,
              quality: 192
            });
            continue;
          }
        }

        // Try format: Timestamp, Value
        const dtPart = parts[0] || '';
        const vPart = parts[1] || '';
        const dtObj = this.parseCustomDateString(dtPart, '');
        const val = parseFloat(vPart.replace(/,/g, ''));
        if (!isNaN(dtObj.getTime()) && !isNaN(val)) {
          dataPoints.push({
            tagName: fallbackTagName,
            dateTime: dtObj,
            value: val,
            quality: 192
          });
        }
      }
    }

    return dataPoints;
  }

  /**
   * Parse TXT files (specifically UTF-16LE with serial dates)
   */
  private async parseTxt(buffer: Buffer): Promise<DataPoint[]> {
    // Try UTF-16LE first as it's common for Trend exports
    let text = iconv.decode(buffer, 'utf16le');
    
    // Fallback to UTF-8 if it doesn't look like UTF-16
    if (!text.includes('\t') && !text.includes('\n')) {
      text = iconv.decode(buffer, 'utf8');
    }

    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const dataPoints: DataPoint[] = [];
    
    // Find the header line that contains the tag name (starts with Trends-)
    const headerLine = lines.find(l => l.includes('\t') && l.includes('Trends-'));
    if (!headerLine) {
      dmLogger.warn('TXT Parser: No header line found with "Trends-"');
      return [];
    }

    const headers = headerLine.split('\t');
    const tagHeader = headers.find(h => h.startsWith('Trends-'));
    if (!tagHeader) return [];

    // Map Trend name to Historian Tag Name if needed (Kagome convention)
    const tagName = tagHeader.replace('Trends-', 'Kagome_AU.');

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 3) continue;

      const serialStr = parts[0]?.trim();
      const valueStr = parts[2]?.trim();
      
      if (!serialStr || !valueStr) continue;

      // Skip header rows
      if (serialStr === 'Time' || isNaN(Number(serialStr))) continue;

      const serialDate = parseFloat(serialStr);
      const cleanValueStr = valueStr.replace(/,/g, '');
      const value = parseFloat(cleanValueStr);

      if (!isNaN(serialDate) && !isNaN(value)) {
        dataPoints.push({
          tagName,
          dateTime: this.excelSerialToDate(serialDate),
          value,
          quality: 192
        });
      }
    }

    return dataPoints;
  }

  /**
   * Parse Trend files
   */
  private async parseTrend(files: Express.Multer.File[]): Promise<DataPoint[]> {
    const hstFile = files.find(f => f.originalname.toLowerCase().endsWith('.hst'));
    if (!hstFile) throw createError('Missing .HST file', 400);

    const hstBuffer = hstFile.buffer;
    
    // Master Header
    const title = iconv.decode(hstBuffer.slice(0, 128), 'latin1').split('\r\n')[3]?.trim() || '';
    const masterVersion = hstBuffer.readUInt16LE(128 + 8 + 2); // ID(8) + Type(2)
    const filesCreated = hstBuffer.readUInt16LE(128 + 8 + 2 + 2 + 8 + 2); // ID(8)+Type(2)+Ver(2)+Align(8)+Max(2)

    let offset = 176; // Start of first entry
    const dataFileHeaders: any[] = [];

    for (let i = 0; i < filesCreated; i++) {
      if (masterVersion === 6) {
        const rawFileName = iconv.decode(hstBuffer.slice(offset, offset + 272), 'latin1').replace(/\0/g, '');
        const fileName = rawFileName.split(/[/\\]/).pop() || '';
        const headerOffset = offset + 272;
        
        const samplePeriod = hstBuffer.readUInt32LE(headerOffset + 122);
        const fileTime = hstBuffer.readBigUInt64LE(headerOffset + 138);
        const startTime = new Date(Number((fileTime / BigInt(10000)) - BigInt(11644473600000)));
        const dataLength = hstBuffer.readUInt32LE(headerOffset + 154);

        dataFileHeaders.push({ fileName, startTime, samplePeriod, dataLength, version: 6 });
        offset += 272 + 176; // Entry size for V6
      } else {
        const rawFileName = iconv.decode(hstBuffer.slice(offset, offset + 144), 'latin1').replace(/\0/g, '');
        const fileName = rawFileName.split(/[/\\]/).pop() || '';
        const headerOffset = offset + 144;
        
        const samplePeriod = hstBuffer.readUInt32LE(headerOffset + 104);
        const startTime = new Date(hstBuffer.readUInt32LE(headerOffset + 120) * 1000);
        const dataLength = hstBuffer.readUInt32LE(headerOffset + 128);

        dataFileHeaders.push({ fileName, startTime, samplePeriod, dataLength, version: 5 });
        offset += 144 + 144; // Entry size for V5
      }
    }

    const dataPoints: DataPoint[] = [];

    for (const header of dataFileHeaders) {
      const dataFile = files.find(f => (f.originalname.split(/[/\\]/).pop() || '').toLowerCase() === header.fileName.toLowerCase());
      if (!dataFile) continue;

      const buffer = dataFile.buffer;
      const sampleByteSize = header.version === 5 ? 2 : 8;
      const expectedDataBytes = header.dataLength * sampleByteSize;
      let dataOffset = buffer.length - expectedDataBytes;
      
      if (dataOffset < 0 || dataOffset > buffer.length) {
        dmLogger.warn(`Data buffer length mismatch for file ${header.fileName}`);
        continue;
      }

      for (let j = 0; j < header.dataLength; j++) {
        let value: number;
        if (header.version === 5) {
          const raw = buffer.readInt16LE(dataOffset);
          dataOffset += 2;
          if (raw === -32001 || raw === -32002) continue;
          value = raw;
        } else {
          value = buffer.readDoubleLE(dataOffset);
          dataOffset += 8;
          if (isNaN(value)) continue;
        }

        const timestamp = new Date(header.startTime.getTime() + (header.samplePeriod * j));
        dataPoints.push({
          tagName: `Kagome_AU.${title}`,
          dateTime: timestamp,
          value,
          quality: 192
        });
      }
    }

    return dataPoints;
  }

  private parseCustomDateString(dateStr: string, timeStr: string): Date {
    if (!dateStr) return new Date(NaN);

    const cleanDate = dateStr.replace(/['"]/g, '').trim();
    const cleanTime = timeStr ? timeStr.replace(/['"]/g, '').trim() : '';

    if (cleanDate.includes('/')) {
      const parts = cleanDate.split('/');
      if (parts.length === 3) {
        const part0 = parts[0] || '';
        const part1 = parts[1] || '';
        const part2 = parts[2] || '';

        let p0 = part0.padStart(2, '0');
        let p1 = part1.padStart(2, '0');
        let p2 = part2.split(' ')[0] || '';

        if (part0.length === 4) {
          p2 = part0;
          p1 = part1.padStart(2, '0');
          p0 = (part2.split(' ')[0] || '').padStart(2, '0');
        }

        const fullIsoStr = `${p2}-${p1}-${p0}${cleanTime ? 'T' + cleanTime : ''}`;
        const res = new Date(fullIsoStr);
        if (!isNaN(res.getTime())) return res;

        const res2 = new Date(`${p2}/${p1}/${p0} ${cleanTime}`);
        if (!isNaN(res2.getTime())) return res2;
      }
    }

    const combinedStr = cleanDate + (cleanTime ? (cleanDate.includes('T') || cleanDate.includes(' ') ? ' ' + cleanTime : 'T' + cleanTime) : '');
    const d = new Date(combinedStr);
    if (!isNaN(d.getTime())) return d;

    return new Date(`${cleanDate} ${cleanTime}`.trim());
  }

  private excelSerialToDate(serial: number): Date {
    const epoch = 25569;
    const msPerDay = 86400000;
    return new Date(Math.round((serial - epoch) * msPerDay));
  }

  private parseExcelDate(val: any): Date {
    if (val instanceof Date) return val;
    if (typeof val === 'number') return this.excelSerialToDate(val);
    if (typeof val === 'string') {
      return this.parseCustomDateString(val, '');
    }
    return new Date();
  }

  generateSql(dataPoints: DataPoint[]): string {
    if (dataPoints.length === 0) return '';
    
    return dataPoints.map(dp => {
      // SQL Server expects 'YYYY-MM-DD HH:mm:ss.mmm'
      const d = dp.dateTime instanceof Date ? dp.dateTime : new Date(dp.dateTime);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      const milliseconds = String(d.getMilliseconds()).padStart(3, '0');
      
      const dateStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
      return `INSERT INTO History (TagName, DateTime, Value, OPCQuality) VALUES ('${dp.tagName}', '${dateStr}', ${dp.value}, ${dp.quality});`;
    }).join('\n');
  }

  /**
   * Generate a full SQL file content for the user to download
   */
  generateFullSqlFile(dataPoints: DataPoint[], filename: string): string {
    const header = `-- Historian Data Import SQL\n-- Generated on: ${new Date().toISOString()}\n-- Source File: ${filename}\n-- Total Rows: ${dataPoints.length}\n\n`;
    const body = this.generateSql(dataPoints);
    return header + body;
  }

  async executeSql(dataPoints: any[], operationId: string): Promise<void> {
    const connection = getHistorianConnection();
    const total = dataPoints.length;
    let successCount = 0;
    let errorCount = 0;

    // The operation is already started in the route via progressTracker.startOperation
    // but progressTracker.startOperation returns a NEW ID.
    // To adapt to the existing system, we'll just update progress.

    const batchSize = 100;
    for (let i = 0; i < total; i += batchSize) {
      const batch = dataPoints.slice(i, i + batchSize);
      const sqlBatch = this.generateSql(batch);

      try {
        await connection.executeQuery(sqlBatch);
        successCount += batch.length;
      } catch (error) {
        dmLogger.error('Batch insert failed', { error });
        errorCount += batch.length;
      }

      const currentProgress = Math.min(i + batchSize, total);
      const percent = Math.round((currentProgress / total) * 100);
      progressTracker.updateProgress(operationId, 'processing', percent, `Processed ${currentProgress}/${total} rows...`);
    }

    if (errorCount > 0) {
      progressTracker.completeOperation(operationId, `Completed with ${errorCount} errors and ${successCount} successes.`);
    } else {
      progressTracker.completeOperation(operationId, `Successfully inserted ${successCount} rows.`);
    }
  }
}

export const dataManagementService = new DataManagementService();
