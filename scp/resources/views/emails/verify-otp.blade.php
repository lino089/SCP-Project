<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kode Verifikasi Email</title>
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
        }
        .content {
            padding: 28px 24px;
        }
        .greeting {
            font-size: 16px;
            margin-bottom: 16px;
        }
        .code-box {
            background-color: #f1f5f9;
            border: 2px dashed #cbd5e1;
            border-radius: 8px;
            text-align: center;
            padding: 16px;
            margin: 24px 0;
        }
        .code-text {
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 6px;
            color: #1e3a8a;
            font-family: monospace;
        }
        .info-text {
            font-size: 14px;
            color: #64748b;
            line-height: 1.5;
            margin-bottom: 8px;
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
        </div>
        <div class="content">
            <p class="greeting">Halo, <strong>{{ $user->name }}</strong>!</p>
            <p class="info-text">
                Kami menerima permintaan untuk menautkan dan memverifikasi alamat email ini pada akun SCP Anda di SMKN 1 Bantul.
            </p>
            <div class="code-box">
                <span class="code-text">{{ $code }}</span>
            </div>
            <p class="info-text">
                Kode verifikasi di atas berlaku selama <strong>10 menit</strong>. Jangan bagikan kode ini kepada siapa pun demi keamanan akun Anda.
            </p>
            <p class="info-text">
                Jika Anda tidak merasa melakukan permintaan ini, silakan abaikan email ini.
            </p>
        </div>
        <div class="footer">
            &copy; {{ date('Y') }} SMKN 1 Bantul &middot; School Class Progress (SCP)
        </div>
    </div>
</body>
</html>
