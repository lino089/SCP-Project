<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kode Pemulihan Kata Sandi</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f4f6f8;
            margin: 0;
            padding: 24px;
            color: #333333;
        }
        .container {
            max-width: 520px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            border: 1px solid #e2e8f0;
        }
        .header {
            background-color: #1e3a8a;
            color: #ffffff;
            padding: 20px 24px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 600;
            letter-spacing: -0.5px;
        }
        .header p {
            margin: 4px 0 0;
            font-size: 12px;
            opacity: 0.9;
        }
        .content {
            padding: 28px 24px;
        }
        .greeting {
            font-size: 16px;
            margin-bottom: 16px;
            color: #0f172a;
        }
        .code-box {
            background-color: #f8fafc;
            border: 2px dashed #94a3b8;
            border-radius: 8px;
            text-align: center;
            padding: 18px 16px;
            margin: 24px 0;
        }
        .code-text {
            font-size: 34px;
            font-weight: 700;
            letter-spacing: 8px;
            color: #1e3a8a;
            font-family: 'Courier New', Courier, monospace;
        }
        .info-text {
            font-size: 14px;
            color: #475569;
            line-height: 1.6;
            margin-bottom: 12px;
        }
        .warning-box {
            background-color: #fffbeb;
            border-left: 4px solid #f59e0b;
            padding: 12px 16px;
            margin: 20px 0;
            border-radius: 0 6px 6px 0;
        }
        .warning-text {
            font-size: 12px;
            color: #92400e;
            margin: 0;
            line-height: 1.5;
        }
        .footer {
            background-color: #f8fafc;
            border-top: 1px solid #e2e8f0;
            padding: 16px 24px;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>School Class Progress (SCP)</h1>
            <p>SMK Negeri 1 Bantul &middot; Sistem Informasi Akademik Terpadu</p>
        </div>
        <div class="content">
            <p class="greeting">Halo, <strong>{{ $user->name }}</strong>!</p>
            <p class="info-text">
                Kami menerima permintaan untuk mereset kata sandi akun SCP Anda. Gunakan kode verifikasi (OTP) berikut untuk melanjutkan proses pembuatan kata sandi baru:
            </p>
            <div class="code-box">
                <span class="code-text">{{ $code }}</span>
            </div>
            <p class="info-text">
                Kode verifikasi di atas berlaku selama <strong>10 menit</strong>. Kode ini hanya dapat digunakan satu kali.
            </p>
            <div class="warning-box">
                <p class="warning-text">
                    <strong>PENTING:</strong> Jangan pernah membagikan kode ini kepada siapa pun, termasuk guru, staf kurikulum, atau pihak sekolah. Pihak sekolah tidak akan pernah meminta kode verifikasi Anda.
                </p>
            </div>
            <p class="info-text" style="font-size: 13px; color: #64748b;">
                Jika Anda tidak merasa meminta pemulihan kata sandi ini, abaikan email ini. Akun Anda tetap aman selama tidak ada pihak yang mengetahui kode verifikasi di atas.
            </p>
        </div>
        <div class="footer">
            &copy; {{ date('Y') }} SMKN 1 Bantul &middot; School Class Progress (SCP)
        </div>
    </div>
</body>
</html>
