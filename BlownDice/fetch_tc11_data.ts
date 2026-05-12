import sql from 'mssql';
import fs from 'fs';
import path from 'path';

const historianHost = '192.168.235.17';
const outputPath = path.join(__dirname, 'tc11_data.csv');

const config = {
  user: 'historian',
  password: '8&(@Zb7RETf2fw8O21*!Ok^1@%GaI2jy',
  server: historianHost,
  database: 'Runtime',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  requestTimeout: 600000 // 10 minutes per chunk
};

async function fetchDataInChunks() {
  const writeStream = fs.createWriteStream(outputPath);
  writeStream.write('TagName,DateTime,Value,Quality\n');

  try {
    console.log('Connecting to Historian...');
    const pool = await sql.connect(config);
    console.log('Connected!');

    const startDate = new Date('2026-02-01T00:00:00Z');
    const endDate = new Date('2026-02-21T00:00:00Z');
    const chunkSizeDays = 2;

    let currentStart = new Date(startDate);
    let totalRows = 0;

    while (currentStart < endDate) {
      let currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + chunkSizeDays);
      if (currentEnd > endDate) currentEnd = endDate;

      console.log(`Fetching chunk: ${currentStart.toISOString()} to ${currentEnd.toISOString()}...`);

      const query = `
        SELECT
            TagName,
            DateTime,
            Value,
            Quality
        FROM History
        WHERE TagName LIKE 'Kagome_AU.TC11_%'
        AND DateTime >= '${currentStart.toISOString().replace('T', ' ').replace('Z', '')}'
        AND DateTime < '${currentEnd.toISOString().replace('T', ' ').replace('Z', '')}'
        AND wwRetrievalMode = 'Cyclic'
        AND wwResolution = 60000
        ORDER BY DateTime, TagName;
      `;

      await new Promise<void>((resolve, reject) => {
        const request = new sql.Request(pool);
        request.stream = true;
        request.query(query);

        let chunkRows = 0;
        request.on('row', (row) => {
          chunkRows++;
          totalRows++;
          const csvRow = `${row.TagName},${row.DateTime.toISOString()},${row.Value},${row.Quality}\n`;
          writeStream.write(csvRow);
        });

        request.on('error', (err) => {
          console.error('Error in chunk:', err);
          reject(err);
        });

        request.on('done', () => {
          console.log(`Chunk completed: ${chunkRows} rows. Total: ${totalRows}`);
          resolve();
        });
      });

      currentStart = currentEnd;
    }

    console.log('All chunks completed successfully!');
    writeStream.end();
    await sql.close();

  } catch (err) {
    console.error('Fatal error:', err);
    writeStream.end();
    process.exit(1);
  }
}

fetchDataInChunks();
