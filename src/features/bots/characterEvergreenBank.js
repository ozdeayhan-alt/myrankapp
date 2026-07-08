const { CHARACTER_CONTENT_TYPES } = require("./characterContentTypes");

/** Kategori etiketleri — persona uid son iki hane ile eşleşir. */
const CHARACTER_TOPIC_TAGS = {
  bot_char_01: "tech",
  bot_char_02: "sport",
  bot_char_03: "auto",
  bot_char_04: "gaming",
  bot_char_05: "film",
  bot_char_06: "ai",
  bot_char_07: "science",
  bot_char_08: "economy",
  bot_char_09: "travel",
  bot_char_10: "news",
};

const EVERGREEN_BY_TAG = {
  tech: [
    "Telefonunu en çok hangi uygulama için kullanıyorsun?",
    "Android mi iOS mu — tartışma hiç bitmiyor. Sen hangisindesin?",
    "Eski telefonunu hâlâ kullanan var mı aranızda?",
    "Sence yapay zeka günlük işleri gerçekten kolaylaştırıyor mu?",
  ],
  sport: [
    "Messi mi Ronaldo mu? Hâlâ konuşuluyor.",
    "Sence bu sezon şampiyonluk yarışında sürpriz takım çıkar mı?",
    "Stadyuma gitmek mi evde izlemek mi?",
    "En sevdiğin spor anı hangisi?",
  ],
  auto: [
    "Elektrikli araba alır mıydın yoksa benzinli mi kalsın?",
    "İlk arabanı hatırlıyor musun?",
    "Sence şehir içi en mantıklı araç tipi hangisi?",
    "Otomatik mi manuel mi tercih edersin?",
  ],
  gaming: [
    "PC mi konsol mu?",
    "Tek oyunda 100 saat geçiren oldu mu hiç?",
    "Sence en abartılan oyun hangisi?",
    "Çocukken en çok hangi oyunu oynardın?",
  ],
  film: [
    "Dizi mi film mi?",
    "Spoiler yiyince sinir oluyor musun?",
    "Sence en iyi Türk dizisi hangisi?",
    "Sinema mı evde izlemek mi?",
  ],
  ai: [
    "Yapay zekaya günlük hayatta ne kadar güveniyorsun?",
    "Sence AI işleri elimizden alır mı yoksa abartılıyor mu?",
    "ChatGPT kullanan var mı düzenli?",
    "AI ile üretilen içeriği takip eder misin?",
  ],
  science: [
    "Uzaya gitme fırsatın olsa gider miydin?",
    "Sence en ilginç bilim haberi türü hangisi?",
    "Mars'a insan göndermek mantıklı mı?",
    "Okulda en sevdiğin ders neydi?",
  ],
  economy: [
    "Nakit mi kart mı kullanıyorsun daha çok?",
    "Sence en gereksiz harcama kalemi ne?",
    "Yatırım yapan var mı aranızda?",
    "Tasarruf yapmak mı harcamak mı daha zor?",
  ],
  travel: [
    "Türkiye'nin en güzel şehri hangisi sence?",
    "Deniz mi dağ mı tatili?",
    "Yurt dışına çıkmadan önce en çok nereye gitmek istersin?",
    "Tek başına seyahat eder misin?",
  ],
  news: [
    "Gündemi ne sıklıkla takip ediyorsun?",
    "Sosyal medyadan mı haber alıyorsun yoksa klasik kaynaklardan mı?",
    "Sence en çok abartılan gündem konusu ne tür?",
    "Haberleri yorumlamayı sever misin?",
  ],
};

const FUN_BY_TAG = {
  tech: [
    "Telefon şarjın %5'e düşünce panik yapan var mı? 😅",
    "Wi-Fi şifresi sormaktan utanan?",
    "Ekran süresine bakınca utanan biri var mı?",
  ],
  sport: [
    "Maç izlerken bağırınca komşu uyaran oldu mu?",
    "Forma koleksiyonu yapan var mı?",
    "Penaltıda gözlerini kapatan?",
  ],
  auto: [
    "Park ederken stres olan?",
    "Arabayı yıkamaya üşenen?",
    "Yakıt fiyatına bakınca iç çeken?",
  ],
  gaming: [
    "Gece 3'te bir maç daha diyen?",
    "Lag yüzünden sinir krizi geçiren?",
    "Oyun için uyku feda eden?",
  ],
  film: [
    "Fragman izleyip filmi izlemeyen?",
    "Dizi bitince boşluğa düşen?",
    "Popcorn olmadan sinemaya gidemeyen?",
  ],
  ai: [
    "AI'ya ödev yazdıran itiraf eder mi?",
    "Prompt yazarken ciddileşen?",
    "AI cevabına güvenip kontrol etmeyen?",
  ],
  science: [
    "Belgesel izleyip uzman kesilen?",
    "Evde deney yapıp patlatan oldu mu?",
    "Gezegen isimlerini karıştıran?",
  ],
  economy: [
    "İndirim görünce gereksiz alışveriş yapan?",
    "Fiyat etiketine bakmadan alan?",
    "Kupon biriktiren var mı?",
  ],
  travel: [
    "Valiz hazırlamayı son ana bırakan?",
    "Tatilde bile telefona bakan?",
    "Yolculukta uyuyamayan?",
  ],
  news: [
    "Sabah ilk iş gündem bakmak?",
    "Haber yorumlarını okumaktan sıkılan?",
    "Dedikodu ile gündemi karıştıran?",
  ],
};

/** Günde bir karakter için güçlü tartışma — spotlight. */
const SPOTLIGHT_PROMPTS = [
  "10 yıl boyunca tek sosyal medya kullanabilecek olsan hangisini seçerdin?",
  "Türkiye'nin en abartılan şehri hangisi sence?",
  "Sence en gereksiz üniversite bölümü hangisi?",
  "Para kazanmak mı mutlu olmak mı — hangisi önce gelir?",
  "Bir günlüğüne görünmez olsan ilk ne yapardın?",
  "Evde mi dışarıda mı çalışmak daha iyi?",
  "Sence en overrated yemek hangisi?",
  "Tek bir müzik türü dinleyebilecek olsan hangisi?",
  "Çocukken hayal ettiğin meslek neydi?",
  "Sence insanlar neden yorum yapmayı seviyor?",
  "Sabah insanı mısın gece insanı mı?",
  "En gereksiz harcama alışkanlığın ne?",
];

function getTopicTagForCharacter(uid) {
  return CHARACTER_TOPIC_TAGS[uid] ?? "news";
}

function pickRandomItem(items, exclude = new Set()) {
  const pool = items.filter((item) => !exclude.has(item));
  if (pool.length === 0) {
    return items[Math.floor(Math.random() * items.length)] ?? null;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickEvergreenPrompt(uid, exclude = new Set()) {
  const tag = getTopicTagForCharacter(uid);
  return pickRandomItem(EVERGREEN_BY_TAG[tag] ?? EVERGREEN_BY_TAG.news, exclude);
}

function pickFunPrompt(uid, exclude = new Set()) {
  const tag = getTopicTagForCharacter(uid);
  return pickRandomItem(FUN_BY_TAG[tag] ?? FUN_BY_TAG.news, exclude);
}

function pickSpotlightPrompt(exclude = new Set()) {
  return pickRandomItem(SPOTLIGHT_PROMPTS, exclude);
}

module.exports = {
  CHARACTER_TOPIC_TAGS,
  EVERGREEN_BY_TAG,
  FUN_BY_TAG,
  SPOTLIGHT_PROMPTS,
  CHARACTER_CONTENT_TYPES,
  getTopicTagForCharacter,
  pickEvergreenPrompt,
  pickFunPrompt,
  pickSpotlightPrompt,
};
