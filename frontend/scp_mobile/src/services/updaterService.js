import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import axios from 'axios';

const isNative = Capacitor.isNativePlatform();
const DEFAULT_MANIFEST_URL =
  import.meta.env.VITE_OTA_MANIFEST_URL || 'https://schoolclassprogress.my.id/ota/manifest.json';
const FALLBACK_BUNDLE_VERSION = import.meta.env.VITE_APP_BUNDLE_VERSION || '1.0.0';

class UpdaterService {
  constructor() {
    this.isNative = isNative;
    this.isChecking = false;
    this.isDownloading = false;
    this.currentBundle = null;
    this.readyListeners = new Set();
  }

  /**
   * Wajib dipanggil segera setelah aplikasi React berhasil me-render UI root.
   * Memberitahu layer native bahwa bundle JS sehat, mencegah auto-rollback.
   */
  async notifyAppReady() {
    if (!this.isNative) return null;
    try {
      const res = await CapacitorUpdater.notifyAppReady();
      this.currentBundle = res?.bundle || null;
      return res;
    } catch (err) {
      console.warn('[UpdaterService] notifyAppReady warning:', err);
      return null;
    }
  }

  /**
   * Mengambil informasi versi native dan versi bundle aktif saat ini
   */
  async getCurrentVersionInfo() {
    if (!this.isNative) {
      return {
        isNative: false,
        nativeVersion: 'Web / Dev Preview',
        bundleVersion: FALLBACK_BUNDLE_VERSION,
        status: 'web',
      };
    }

    try {
      const current = await CapacitorUpdater.current();
      this.currentBundle = current?.bundle || null;
      return {
        isNative: true,
        nativeVersion: current?.native || '1.0.0',
        bundleVersion: current?.bundle?.version || FALLBACK_BUNDLE_VERSION,
        bundleId: current?.bundle?.id || 'builtin',
        status: current?.bundle?.status || 'active',
      };
    } catch (err) {
      console.warn('[UpdaterService] getCurrentVersionInfo failed:', err);
      return {
        isNative: true,
        nativeVersion: '1.0.0',
        bundleVersion: FALLBACK_BUNDLE_VERSION,
        bundleId: 'builtin',
        status: 'error',
      };
    }
  }

  /**
   * Cek ketersediaan pembaruan OTA ke manifest server
   * @param {Object} [options]
   * @param {string} [options.manifestUrl]
   * @returns {Promise<{ hasUpdate: boolean, updateInfo?: Object, currentVersion: string, message?: string }>}
   */
  async checkForUpdate({ manifestUrl = DEFAULT_MANIFEST_URL } = {}) {
    if (this.isChecking) return { hasUpdate: false, message: 'Pengecekan sedang berjalan.' };
    this.isChecking = true;

    try {
      const currentInfo = await this.getCurrentVersionInfo();

      // Request manifest dengan no-cache query agar tidak tertahan CDN/browser cache
      const response = await axios.get(`${manifestUrl}?t=${Date.now()}`, {
        timeout: 8000,
      });

      const manifest = response.data;
      if (!manifest || !manifest.version || !manifest.url) {
        return {
          hasUpdate: false,
          currentVersion: currentInfo.bundleVersion,
          message: 'Format manifest pembaruan tidak valid.',
        };
      }

      // Validasi kompatibilitas native (mencegah crash jika bundle butuh native baru)
      if (manifest.minNativeVersion && currentInfo.nativeVersion !== 'Web / Dev Preview') {
        const isCompatible = this.compareSemver(currentInfo.nativeVersion, manifest.minNativeVersion) >= 0;
        if (!isCompatible) {
          return {
            hasUpdate: false,
            currentVersion: currentInfo.bundleVersion,
            message: `Pembaruan memerlukan update APK versi ${manifest.minNativeVersion} atau lebih baru.`,
            requiresApkUpdate: true,
          };
        }
      }

      // Bandingkan versi bundle
      const isNewer = this.compareSemver(manifest.version, currentInfo.bundleVersion) > 0;

      return {
        hasUpdate: isNewer,
        updateInfo: isNewer ? manifest : null,
        currentVersion: currentInfo.bundleVersion,
        latestVersion: manifest.version,
        releaseNotes: manifest.releaseNotes || 'Pembaruan stabilitas dan performa sistem.',
        critical: Boolean(manifest.critical),
      };
    } catch (err) {
      console.warn('[UpdaterService] Gagal memeriksa pembaruan OTA:', err.message);
      const currentInfo = await this.getCurrentVersionInfo();
      return {
        hasUpdate: false,
        currentVersion: currentInfo.bundleVersion,
        message: 'Tidak dapat terhubung ke server pembaruan.',
        error: err,
      };
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Mengunduh zip bundle OTA dari server
   * @param {Object} updateInfo - Data dari manifest
   * @param {Function} [onProgress] - Callback progress persentase (0 - 100)
   */
  async downloadUpdate(updateInfo, onProgress) {
    if (!this.isNative) {
      throw new Error('Unduhan OTA hanya didukung pada aplikasi mobile native.');
    }
    if (!updateInfo?.url || !updateInfo?.version) {
      throw new Error('Parameter url atau version pembaruan tidak valid.');
    }

    this.isDownloading = true;
    let progressListener = null;

    try {
      if (typeof onProgress === 'function') {
        progressListener = await CapacitorUpdater.addListener('download', (event) => {
          if (event && typeof event.percent === 'number') {
            onProgress(Math.min(100, Math.max(0, event.percent)));
          }
        });
      }

      const bundle = await CapacitorUpdater.download({
        url: updateInfo.url,
        version: updateInfo.version,
        checksum: updateInfo.checksum || undefined,
      });

      return bundle;
    } finally {
      this.isDownloading = false;
      if (progressListener) {
        progressListener.remove?.();
      }
    }
  }

  /**
   * Terapkan bundle untuk aktif pada saat aplikasi di-restart atau background
   */
  async setNextBundle(bundleId) {
    if (!this.isNative) return;
    await CapacitorUpdater.next({ id: bundleId });
  }

  /**
   * Terapkan bundle sekarang dan reload aplikasi langsung.
   * Menggunakan CapacitorUpdater.reload() yang otomatis menerapkan next bundle terantre.
   */
  async reloadImmediately(bundleId) {
    if (!this.isNative) {
      window.location.reload();
      return;
    }
    // Jika bundleId spesifik diberikan (ID internal acak Capgo, bukan nomor versi semver)
    if (bundleId && typeof bundleId === 'string' && !bundleId.includes('.')) {
      try {
        await CapacitorUpdater.set({ id: bundleId });
        return;
      } catch (err) {
        console.warn('[UpdaterService] set({ id }) fallback ke reload():', err);
      }
    }
    // Panggil reload() resmi Capgo untuk langsung menerapkan bundle yang sudah di-queue via next()
    await CapacitorUpdater.reload();
  }

  /**
   * Alur Silent Background: Cek -> Unduh di latar belakang -> Pasang untuk startup berikutnya
   * Mengembalikan info jika berhasil diunduh agar UI dapat menampilkan banner non-intrusif.
   */
  async checkAndDownloadBackground({ onUpdateReady } = {}) {
    if (!this.isNative) return null;

    try {
      const checkResult = await this.checkForUpdate();
      if (!checkResult.hasUpdate || !checkResult.updateInfo) {
        return null;
      }

      // Unduh bundle di background tanpa mengganggu user
      const bundle = await this.downloadUpdate(checkResult.updateInfo);
      if (bundle?.id) {
        // Daftarkan agar aktif otomatis saat app ditutup & dibuka lagi
        await this.setNextBundle(bundle.id);

        const updateEventData = {
          version: checkResult.updateInfo.version,
          releaseNotes: checkResult.releaseNotes,
          critical: checkResult.critical,
          bundleId: bundle.id,
        };

        // Panggil callback & dispatch event global
        if (typeof onUpdateReady === 'function') {
          onUpdateReady(updateEventData);
        }
        this.notifyListeners(updateEventData);

        return updateEventData;
      }
    } catch (err) {
      console.warn('[UpdaterService] Silent background update gagal:', err?.message || err);
    }
    return null;
  }

  /**
   * Listener global untuk notifikasi update siap
   */
  onUpdateReady(callback) {
    this.readyListeners.add(callback);
    return () => this.readyListeners.delete(callback);
  }

  notifyListeners(data) {
    this.readyListeners.forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error(e);
      }
    });
  }

  /**
   * Helper sederhana pembanding Semantic Versioning (SemVer)
   * Mengembalikan: > 0 jika a > b, < 0 jika a < b, 0 jika a == b
   */
  compareSemver(a, b) {
    const parse = (v) => {
      const parts = String(v || '0')
        .replace(/^v/, '')
        .split('.')
        .map((num) => parseInt(num, 10) || 0);
      while (parts.length < 3) {
        parts.push(0);
      }
      return parts;
    };

    const [a1, a2, a3] = parse(a);
    const [b1, b2, b3] = parse(b);

    if (a1 !== b1) return a1 - b1;
    if (a2 !== b2) return a2 - b2;
    return a3 - b3;
  }
}

export const updaterService = new UpdaterService();
export default updaterService;
