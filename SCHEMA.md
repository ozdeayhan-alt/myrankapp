# MyRank Firestore Schema

Manifesto kaynağı: [PROJECT_MANIFEST.md](../PROJECT_MANIFEST.md)

## Collections

### `users/{userId}`

| Field | Type | Notes |
|-------|------|-------|
| email | string | Auth email |
| displayName | string | Ad Soyad (kimlik; metadata dışında) |
| photoURL | string | Profil fotoğrafı URL (bucket: `myrank-d62b9-storage`) |
| metadata | object | 6 metadata alanı (zorunlu profil tamamlama) |
| metadata.country | string | |
| metadata.city | string | |
| metadata.gender | string | |
| metadata.age | number | |
| metadata.profession | string | |
| metadata.maritalStatus | string | |
| totalScore | number | Default 0; **yalnızca backend atomic update** |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### `publicProfiles/{userId}`

Giriş yapmış kullanıcıların birbirinin profilini (TP, metadata, sıralama) görmesi için; **email yok**.

| Field | Type | Notes |
|-------|------|-------|
| displayName | string | |
| photoURL | string | |
| metadata | object | `users.metadata` ile aynı şekil |
| totalScore | number | Backend etkileşimde senkron; client create’te 0 |
| updatedAt | timestamp | |

- Client (sahip): profil kaydı / fotoğraf güncellemesinde yazar (totalScore değiştiremez).
- Backend (Admin SDK): `applyInteraction` ve `applyProfileVoteBatch` sonrası `totalScore` + metadata/displayName merge.

### `posts/{postId}`

| Field | Type | Notes |
|-------|------|-------|
| authorId | string | users/{userId} |
| authorDisplayName | string | Feed’de gösterim (oluşturma anı snapshot) |
| authorPhotoURL | string | Profil fotoğrafı URL snapshot (opsiyonel) |
| metadata | object | Yazarın 6 metadata snapshot (Keşfet segment) |
| segmentKey | string | `buildSegmentKey(metadata)` — tam segment sorgusu |
| postScore | number | Güncel gönderi puanı |
| likeCount | number | |
| dislikeCount | number | |
| shareCount | number | |
| saveCount | number | Kaydet (+66) |
| commentCount | number | |
| contentType | string | tweet, image, video |
| content | string | Metin içeriği / açıklama |
| mediaURL | string | Resim veya video Storage URL (opsiyonel) |
| posterURL | string | Video feed önizlemesi (JPEG poster; opsiyonel, geriye dönük yok) |
| createdAt | timestamp | |

**Post Score formülü:**

```
postScore = (likeCount - dislikeCount) + (shareCount × 66) + (saveCount × 66) + (commentCount × 33)
```

### `interactions/{autoId}` (immutable event log)

| Field | Type | Notes |
|-------|------|-------|
| type | string | like, dislike, share, comment, save |
| actorId | string | Etkileşimi yapan |
| postId | string | |
| authorId | string | Gönderi sahibi |
| commentText | string | Yorum metni (comment tipinde, opsiyonel log) |
| pointsDelta | number | Bu etkileşimin puan etkisi |
| createdAt | timestamp | |

### `actorEngagements/{actorId}_{postId}`

| Field | Type | Notes |
|-------|------|-------|
| actorId | string | |
| postId | string | |
| liked | boolean | Toggle beğeni |
| disliked | boolean | Toggle beğenmeme |
| shared | boolean | |
| saved | boolean | |
| updatedAt | timestamp | |

### `users/{userId}/notifications/{notificationId}`

In-app **"Sen yokken neler oldu?"** olayları (yalnızca backend yazar).

| Field | Type | Notes |
|-------|------|-------|
| type | string | `post_liked`, `post_commented`, `post_saved`, `profile_votes`, `rank_passed` |
| actorId | string | Etkileşimi yapan |
| actorDisplayName | string | O anki snapshot |
| payload | map | `postId`, `voteDelta`, `segmentKey`, `segmentLabel`, … |
| createdAt | timestamp | |

### `profileVoteBatches/{autoId}`

Profil ↑/↓ oylarının batch audit kaydı.

| Field | Type | Notes |
|-------|------|-------|
| actorId | string | Oy veren |
| targetUserId | string | Hedef kullanıcı |
| delta | number | Net TP değişimi |
| createdAt | timestamp | |

### `rankingSnapshots/latest`

Gece sıralama job meta (ör. son rebuild zamanı). Mobil profil accordion “Son resmi güncelleme” satırında okunur (signed-in read).

| Field | Type |
|-------|------|
| rebuiltAt | timestamp |
| timezone | string |
| userCount | number |
| segmentCount | number |

### `rankings/{segmentKey}/entries/{userId}` (denormalize)

- `segmentKey` = `global` → tüm kullanıcılar (global TP sıralaması)
- Diğer anahtarlar → metadata segment (tam veya kategori bazlı)

| Field | Type |
|-------|------|
| userId | string |
| displayName | string | Görünen ad |
| totalScore | number |
| metadata | object (6 alan snapshot) |
| rank | number | 1-based sıra (gece job veya kayıt sonrası ensure) |
| segmentTotal | number | Segmentteki toplam kişi sayısı |
| updatedAt | timestamp |

`segmentKey` örneği: `country:TR|city:Istanbul|gender:K|age:25|profession:Engineer|maritalStatus:Single`

### `stories/{storyId}`

24 saatlik klasik story (foto/video). Yazma yalnızca backend API.

| Field | Type | Notes |
|-------|------|-------|
| userId | string | Story sahibi |
| authorDisplayName | string | Snapshot |
| authorPhotoURL | string | Snapshot (opsiyonel) |
| mediaType | string | `image` veya `video` |
| mediaURL | string | Firebase Storage URL |
| posterURL | string | Video poster (opsiyonel) |
| caption | string | Opsiyonel, max 40 karakter |
| createdAt | timestamp | |
| expiresAt | timestamp | createdAt + 24h |

## Security Notes

- Client: `users` metadata read/write (own doc only), `totalScore` **write yasak**
- Client: `posts` read; create own posts
- Client: `interactions` read own; write yasak (backend API)
- Backend (Admin SDK): interactions, totalScore atomic updates

## Indexes

See [firestore.indexes.json](./firestore.indexes.json).
