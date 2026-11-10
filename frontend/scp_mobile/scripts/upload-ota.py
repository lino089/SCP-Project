import os
import sys

# Force UTF-8 on Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import paramiko

host = "43.173.50.225"
user = "ubuntu"
pwd = "(Marvel0809)"

current_dir = os.path.dirname(os.path.abspath(__file__))
mobile_dir = os.path.abspath(os.path.join(current_dir, ".."))
output_dir = os.path.join(mobile_dir, "ota-output")
manifest_file = os.path.join(output_dir, "manifest.json")
bundles_dir = os.path.join(output_dir, "bundles")

if not os.path.exists(manifest_file):
    print("[ERROR] File manifest.json belum dibuat! Jalankan 'npm run ota:build' terlebih dahulu.")
    sys.exit(1)

print("\n[*] Memulai upload bundle OTA ke VPS (43.173.50.225)...")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=pwd, timeout=15)

sftp = client.open_sftp()

# Upload manifest.json
print("[*] Uploading: manifest.json -> /var/www/SCP-Project/ota/manifest.json")
sftp.put(manifest_file, "/var/www/SCP-Project/ota/manifest.json")

# Upload all bundles in ota-output/bundles
for fname in os.listdir(bundles_dir):
    if fname.endswith(".zip"):
        local_path = os.path.join(bundles_dir, fname)
        remote_path = f"/var/www/SCP-Project/ota/bundles/{fname}"
        print(f"[*] Uploading: {fname} -> {remote_path} ({os.path.getsize(local_path) / 1024:.1f} KB)...")
        sftp.put(local_path, remote_path)

sftp.close()

# Also sync to scp_web/dist/ota
stdin, stdout, stderr = client.exec_command(f"echo '{pwd}' | sudo -S cp -rf /var/www/SCP-Project/ota/* /var/www/SCP-Project/frontend/scp_web/dist/ota/ 2>/dev/null")
stdout.channel.recv_exit_status()

client.close()

print("\n[SUCCESS] Upload ke VPS Berhasil!")
print("URL Status Publik: https://schoolclassprogress.my.id/ota/manifest.json")
print("Buka aplikasi di HP Anda untuk memeriksa pembaruan.\n")
