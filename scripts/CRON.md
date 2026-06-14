# Gece sıralama (ranking rebuild)

Profil TP ve gönderi etkileşimleri gün içinde `users.totalScore` günceller; **sıralama listeleri** (`rankings/.../entries`) yalnızca bu job ile yenilenir.

## Otomatik kurulum (önerilen)

Sunucuda proje dizininde:

```bash
cd /root/myrankapp
chmod +x scripts/setup-cron.sh
bash scripts/setup-cron.sh
```

Farklı dizin:

```bash
PROJECT_DIR=/opt/myrankapp bash /opt/myrankapp/scripts/setup-cron.sh
```

Script:

- `node` yolunu `command -v node` ile bulur (sabit `/usr/bin/node` gerektirmez)
- Eski `myrankapp-rebuild-rankings` satırını kaldırıp yeniden ekler (tekrar çalıştırılabilir)
- Log: `/root/myrankapp/logs/rebuild-rankings.log` (veya yazılabilirse `/var/log/myrank-rankings.log`)

## Manuel çalıştırma

```bash
cd /root/myrankapp
npm run rebuild-rankings
```

Başarılı çıktı örneği: `[rebuild-rankings] Done.`

## Manuel crontab (setup-cron kullanmıyorsanız)

```bash
crontab -e
```

Ekleyin (node yolunu `which node` ile doğrulayın):

```cron
0 0 * * * cd /root/myrankapp && TZ=Europe/Istanbul /usr/bin/node scripts/rebuild-rankings.js >> /root/myrankapp/logs/rebuild-rankings.log 2>&1 # myrankapp-rebuild-rankings
```

## Kontrol

```bash
crontab -l | grep myrankapp
tail -50 /root/myrankapp/logs/rebuild-rankings.log
```

## API sunucusu (kod deploy sonrası)

```bash
pm2 restart myrankapp
```

## Bot otomasyonu

İlk kurulum (10 bot + bugünkü paylaşımlar):

```bash
cd /root/myrankapp
npm run seed-bots
npm run rebuild-rankings
```

Periyodik job (welcome + haftalık post/combo):

```bash
npm run run-bot-jobs
```

Önerilen crontab (6 saatte bir):

```cron
0 */6 * * * cd /root/myrankapp && /usr/bin/node scripts/run-bot-jobs.js >> /root/myrankapp/logs/bot-jobs.log 2>&1 # myrankapp-bot-jobs
```

## Gereksinimler

- `/root/myrankapp/.env` (Firebase / proje ayarları)
- `/root/myrankapp/service-account.json`
- `npm install` yapılmış `node_modules`
