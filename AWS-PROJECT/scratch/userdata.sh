#!/bin/bash
set -ex

# Log all output to /var/log/biosentinel-install.log
exec > >(tee /var/log/biosentinel-install.log|logger -t user-data -s 2>/dev/console) 2>&1

echo "=== Starting BioSentinel Backend Deployment ==="

# 1. Update and install packages
dnf update -y
dnf install -y python3.12 python3.12-pip python3.12-devel gcc gcc-c++ nginx tar gzip awscli

# 2. Setup application directory
mkdir -p /opt/biosentinel
aws s3 cp s3://biosentinel-report-photos-dev/deploy/biosentinel-backend.tar.gz /opt/biosentinel/backend.tar.gz --region ap-southeast-2
tar -xzf /opt/biosentinel/backend.tar.gz -C /opt/biosentinel
rm -f /opt/biosentinel/backend.tar.gz

# 3. Create virtual environment and install dependencies
python3.12 -m venv /opt/biosentinel/.venv
/opt/biosentinel/.venv/bin/pip install --upgrade pip
/opt/biosentinel/.venv/bin/pip install -r /opt/biosentinel/requirements.txt

# 4. Set permissions
chown -R ec2-user:ec2-user /opt/biosentinel

# 5. Configure Nginx reverse proxy
cat << 'EOF' > /etc/nginx/conf.d/biosentinel.conf
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Ensure default server in nginx.conf does not conflict
sed -i 's/listen       80 default_server;/listen       8080 default_server;/' /etc/nginx/nginx.conf || true
sed -i 's/listen       \[::\]:80 default_server;/listen       \[::\]:8080 default_server;/' /etc/nginx/nginx.conf || true
nginx -t
systemctl enable --now nginx

# 6. Configure systemd service for FastAPI
cat << 'EOF' > /etc/systemd/system/biosentinel-api.service
[Unit]
Description=Bio-Sentinel FastAPI Backend
After=network.target

[Service]
User=ec2-user
Group=ec2-user
WorkingDirectory=/opt/biosentinel
ExecStart=/opt/biosentinel/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
EnvironmentFile=/opt/biosentinel/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# 7. Configure systemd service for Telegram Bot
cat << 'EOF' > /etc/systemd/system/biosentinel-bot.service
[Unit]
Description=Bio-Sentinel Telegram Bot Service
After=network.target biosentinel-api.service

[Service]
User=ec2-user
Group=ec2-user
WorkingDirectory=/opt/biosentinel
ExecStart=/opt/biosentinel/.venv/bin/python -c "from app.services.telegram_bot import run_polling_loop; run_polling_loop()"
Restart=always
RestartSec=10
EnvironmentFile=/opt/biosentinel/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# 8. Reload, enable, and start services
systemctl daemon-reload
systemctl enable --now biosentinel-api.service
systemctl enable --now biosentinel-bot.service

echo "=== BioSentinel Backend Deployment Complete ==="
