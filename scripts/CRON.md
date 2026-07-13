# Gece sıralama (ranking rebuild)

Profil TP gün içinde `users.totalScore` ve `rankings/.../entries.totalScore` ile senkronize edilir; **sıra numarası** (`rank`, momentum) gece job ile yenilenir.

**Varsayılan:** incremental rebuild (mevcut entry'lerden rank hesabı).

**Tam rebuild** (haftada bir önerilir — tüm kullanıcıları segmentlere ekler):

```bash
RANKING_FULL_REBUILD=true npm run rebuild-rankings
```

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

Ekleyin (node yolunu `which node` ile doğrulayın). Sunucu UTC ise `CRON_TZ` satırı şart; aksi halde job 03:00 İstanbul’da çalışır:

```cron
CRON_TZ=Europe/Istanbul
0 0 * * * cd /root/myrankapp && /usr/bin/node scripts/rebuild-rankings.js >> /root/myrankapp/logs/rebuild-rankings.log 2>&1 # myrankapp-rebuild-rankings
CRON_TZ=Etc/UTC
```

Alternatif (CRON_TZ desteklenmiyorsa, UTC sunucuda `0 21 * * *` = 00:00 İstanbul):

```cron
0 21 * * * cd /root/myrankapp && /usr/bin/node scripts/rebuild-rankings.js >> /root/myrankapp/logs/rebuild-rankings.log 2>&1 # myrankapp-rebuild-rankings
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

Periyodik job (welcome + haftalık post/combo + segment bot haftalık tweet):

```bash
npm run run-bot-jobs
```

**Segment botları:** Profil kategorileri tamamlanınca her tam lig için 7 bot otomatik seed edilir (`ensureUserRankingEntries`). Haftalık tweet cron ile farklı günlerde atılır.

Önerilen crontab (6 saatte bir):

```cron
0 */6 * * * cd /root/myrankapp && /usr/bin/node scripts/run-bot-jobs.js >> /root/myrankapp/logs/bot-jobs.log 2>&1 # myrankapp-bot-jobs
```

## Karakter içerik sistemi (tartışma başlatıcı Whisp)

İlk kurulum (11 karakter hesabı):

```bash
cd /root/myrankapp
npm run seed-character-bots
```

Periyodik job (vadesi gelen slotlar → Whisp):

```bash
npm run run-character-jobs
```

Önerilen crontab (20 dakikada bir):

```cron
*/20 * * * * cd /root/myrankapp && /usr/bin/node scripts/run-character-jobs.js >> /root/myrankapp/logs/character-jobs.log 2>&1 # myrankapp-character-jobs
```

### Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
|----------|------------|----------|
| `CHARACTER_POSTS_ENABLED` | `1` (açık) | `0` veya `false` ile kapat |
| `CHARACTER_AI_ENABLED` | AI key varsa açık | `0` ile sadece şablon/banka |
| `OPENAI_API_KEY` | — | AI rewrite için |
| `CHARACTER_AI_MODEL` | `gpt-4o-mini` | OpenAI model adı |
| `CHARACTER_LINK_CHANCE` | `0.25` | Haber Whisp'lerinde kaynak linki ekleme olasılığı |
| `CHARACTER_FLOW_ENABLED` | karakter post açıksa açık | `0` ile günlük Flow kapat |
| `YOUTUBE_API_KEY` | — | Opsiyonel; yoksa curated TR kanal RSS/HTML kullanılır |

Karakter Flow kaynakları yalnızca Türkiye YouTube kanallarıdır (`characterYoutubeChannels.js`).

Günlük Flow (karakter başına en fazla 1): `run-character-jobs` içinde otomatik. Bugüne özel tek sefer:

```bash
npm run run-character-flows-today
```

Karakter hesapları yorumlara cevap vermez; sadece Whisp paylaşır (`botRole: character`).

## Gereksinimler

- `/root/myrankapp/.env` (Firebase / proje ayarları)
- `/root/myrankapp/service-account.json`
- `npm install` yapılmış `node_modules`
