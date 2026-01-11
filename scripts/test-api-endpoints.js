const http = require('http');

async function testApiEndpoints() {
  console.log('Testing API endpoints...');

  // Test health endpoint
  console.log('\n=== Testing /api/health ===');
  try {
    const healthResponse = await makeRequest('GET', 'localhost', 3000, '/api/health');
    console.log('✅ Health endpoint response:', healthResponse);
  } catch (error) {
    console.log('❌ Health endpoint failed:', error.message);
  }

  // Test tags endpoint
  console.log('\n=== Testing /api/data/tags ===');
  try {
    const tagsResponse = await makeRequest('GET', 'localhost', 3000, '/api/data/tags');
    console.log('✅ Tags endpoint response:', tagsResponse);
  } catch (error) {
    console.log('❌ Tags endpoint failed:', error.message);
  }

  console.log('\n✅ API endpoint tests completed');
}

function makeRequest(method, hostname, port, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (error) {
          resolve(data);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

testApiEndpoints();