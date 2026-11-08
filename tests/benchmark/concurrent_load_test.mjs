import http from 'http';

const TOTAL_REQUESTS = 50;
const ENDPOINT = 'http://127.0.0.1:8000/api/health';

console.log(`[CONCURRENT LOAD TEST] Starting ${TOTAL_REQUESTS} parallel requests to ${ENDPOINT}...`);

const startTotal = Date.now();
let completed = 0;
let successCount = 0;
let failCount = 0;
const durations = [];

function makeRequest(index) {
  return new Promise((resolve) => {
    const startReq = Date.now();
    const req = http.get(ENDPOINT, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const duration = Date.now() - startReq;
        durations.push(duration);
        completed++;
        if (res.statusCode >= 200 && res.statusCode < 400) {
          successCount++;
        } else {
          failCount++;
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      const duration = Date.now() - startReq;
      durations.push(duration);
      completed++;
      failCount++;
      resolve();
    });

    req.setTimeout(10000, () => {
      req.destroy();
    });
  });
}

const promises = [];
for (let i = 0; i < TOTAL_REQUESTS; i++) {
  promises.push(makeRequest(i));
}

await Promise.all(promises);

const totalTimeMs = Date.now() - startTotal;
durations.sort((a, b) => a - b);
const avg = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2);
const min = durations[0];
const max = durations[durations.length - 1];
const p95 = durations[Math.floor(durations.length * 0.95)];
const rps = ((TOTAL_REQUESTS / totalTimeMs) * 1000).toFixed(2);

console.log(`\n--- HASIL BENCHMARK 50 KONKUREN ---`);
console.log(`Total Permintaan  : ${TOTAL_REQUESTS}`);
console.log(`Berhasil (2xx/3xx): ${successCount}`);
console.log(`Gagal             : ${failCount}`);
console.log(`Durasi Total      : ${totalTimeMs} ms`);
console.log(`Throughput (RPS)  : ${rps} req/sec`);
console.log(`Latency Min       : ${min} ms`);
console.log(`Latency Avg       : ${avg} ms`);
console.log(`Latency p95       : ${p95} ms`);
console.log(`Latency Max       : ${max} ms`);

if (failCount === 0 && totalTimeMs < 8000) {
  console.log(`\n>> STATUS GATE: LULUS (Konkurensi 50 paralel berhasil tanpa error/timeout) <<`);
  process.exit(0);
} else {
  console.log(`\n>> STATUS GATE: PERINGATAN (Ada kegagalan atau timeout) <<`);
  process.exit(1);
}
