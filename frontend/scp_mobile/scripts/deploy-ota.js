import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');
const outputDir = path.resolve(rootDir, 'ota-output');

// 1. Tentukan Versi Target
const args = process.argv.slice(2);
const targetVersion = args[0] || '1.0.1';
const releaseNotes = args[1] || 'Pembaruan antarmuka dan stabilitas performa sistem.';
const isCritical = args.includes('--critical');

console.log('\n==================================================');
console.log(`🚀 MEMULAI PROSES BUILD & PACKAGING OTA BUNDLE`);
console.log(`   Target Bundle Version : v${targetVersion}`);
console.log(`   Catatan Rilis         : "${releaseNotes}"`);
console.log(`   Status Kritis         : ${isCritical ? 'YA' : 'TIDAK (Normal)'}`);
console.log('==================================================\n');

try {
  // 2. Jalankan Build Vite
  console.log('📦 1/4 Menjalankan proses kompilasi web bundle (npm run build)...');
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

  if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('Direktori dist/ atau file dist/index.html tidak ditemukan!');
  }

  // 3. Buat Folder Output
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const bundlesSubdir = path.join(outputDir, 'bundles');
  if (!fs.existsSync(bundlesSubdir)) {
    fs.mkdirSync(bundlesSubdir, { recursive: true });
  }

  const zipFilename = `bundle-${targetVersion}.zip`;
  const zipPath = path.join(bundlesSubdir, zipFilename);

  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  // 4. Kompresi Folder dist menjadi ZIP menggunakan @capgo/cli resmi
  // Ini krusial: utilitas bawaan Windows (Compress-Archive) tidak memiliki izin atribut POSIX (0o000),
  // sedangkan @capgo/cli memastikan flag POSIX regular file (0o100644) dan struktur kompatibel Android 15.
  console.log(`\n🗜️  2/4 Mengompres folder dist/ menggunakan @capgo/cli untuk ${zipFilename}...`);
  const capgoZipOutputName = `id.my.schoolclassprogress.app_${targetVersion}.zip`;
  const capgoTempZip = path.join(rootDir, capgoZipOutputName);

  if (fs.existsSync(capgoTempZip)) {
    fs.unlinkSync(capgoTempZip);
  }

  execSync(
    `npx @capgo/cli bundle zip id.my.schoolclassprogress.app --path dist --bundle "${targetVersion}" --json`,
    { cwd: rootDir, stdio: 'inherit' }
  );

  if (!fs.existsSync(capgoTempZip)) {
    throw new Error(`Gagal membuat file ZIP bundle dengan @capgo/cli di: ${capgoTempZip}`);
  }

  // Pindahkan ke direktori ota-output/bundles/
  fs.copyFileSync(capgoTempZip, zipPath);
  fs.unlinkSync(capgoTempZip);

  if (!fs.existsSync(zipPath)) {
    throw new Error(`Gagal membuat file ZIP di: ${zipPath}`);
  }

  const zipStats = fs.statSync(zipPath);
  const zipSizeKb = (zipStats.size / 1024).toFixed(2);
  console.log(`   ✓ Ukuran file bundle: ${zipSizeKb} KB`);

  // 5. Hitung Checksum SHA-256
  console.log('\n🔒 3/4 Menghitung Checksum SHA-256 untuk integritas bundle...');
  const fileBuffer = fs.readFileSync(zipPath);
  const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  console.log(`   ✓ SHA-256: ${checksum}`);

  // 6. Buat File manifest.json
  console.log('\n📄 4/4 Membuat file manifest.json...');
  const manifestData = {
    version: targetVersion,
    minNativeVersion: '1.0.0',
    url: `https://schoolclassprogress.my.id/ota/bundles/${zipFilename}`,
    checksum: checksum,
    releaseNotes: releaseNotes,
    critical: isCritical,
    releasedAt: new Date().toISOString(),
  };

  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf-8');
  console.log(`   ✓ Manifest tersimpan di: ${manifestPath}`);

  console.log('\n==================================================');
  console.log('🎉 BUNDLE OTA BERHASIL DIBUAT DENGAN SUKSES!');
  console.log('==================================================');
  console.log('\n📁 File yang siap di-upload ke server:');
  console.log(`   1. [Manifest] : ${manifestPath}`);
  console.log(`   2. [ZIP File] : ${zipPath}`);
  console.log('\n🌐 Lokasi target di server produksi Anda (schoolclassprogress.my.id):');
  console.log('   Unggah file ke folder publik server Anda (misal public/ota/):');
  console.log('   - /var/www/schoolclassprogress/public/ota/manifest.json');
  console.log(`   - /var/www/schoolclassprogress/public/ota/bundles/${zipFilename}`);
  console.log('\n🔍 URL Publik yang akan diakses oleh HP:');
  console.log('   - https://schoolclassprogress.my.id/ota/manifest.json');
  console.log(`   - https://schoolclassprogress.my.id/ota/bundles/${zipFilename}`);
  console.log('==================================================\n');
} catch (error) {
  console.error('\n❌ Terjadi kesalahan saat membuat bundle OTA:', error.message);
  process.exit(1);
}
