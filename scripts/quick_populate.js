const http = require('http');

async function main() {
  const loginData = JSON.stringify({
    email: 'admin@aqcompanies.com',
    password: 'AQCompanies@2026'
  });

  const loginReq = http.request('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      const parsed = JSON.parse(body);
      const token = parsed.accessToken;
      console.log('✅ Authenticated as Admin successfully.');

      const commitReq = http.request('http://localhost:4000/api/import/commit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, (cRes) => {
        let cBody = '';
        cRes.on('data', chunk => cBody += chunk);
        cRes.on('end', () => {
          console.log('✅ Migration Commit Response:', cBody);
        });
      });
      commitReq.end();
    });
  });

  loginReq.write(loginData);
  loginReq.end();
}

main().catch(console.error);
