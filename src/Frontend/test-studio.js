import http from 'http';

const options = {
  hostname: 'puod-studio-service',
  port: 8080,
  path: '/api/v1/studio/dashboards?scope=Client&clientId=2',
  method: 'GET',
  headers: {
    'Accept': 'application/json'
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();