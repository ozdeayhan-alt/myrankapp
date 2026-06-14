module.exports = {
  apps: [
    {
      name: "myrankapp",
      cwd: "/root/myrankapp",
      script: "index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        GRPC_DNS_RESOLVER: "ares",
        API_TIMEOUT_MS: 25000,
        FIREBASE_STORAGE_BUCKET: "myrankapp-d62b9.firebasestorage.app",
      },
    },
  ],
};
