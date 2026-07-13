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
  bot_char_11: "literature",
};

const EVERGREEN_BY_TAG = {
  tech: [
    "Telefon piyasası yine hareketli. Bence her yıl değiştirmek artık mantıklı değil.",
    "Android–iOS tartışması bitmiyor; ben ekosistem alışkanlığına takılıyorum.",
    "Yapay zeka günlük işleri kolaylaştırıyor ama her şeyi de otomatikleştirmiyor.",
    "Eski telefon hâlâ iş görüyor; gereksiz yükseltme baskısı var gibi.",
  ],
  sport: [
    "Transfer dönemleri yine çok konuşuluyor. Bence kulüpler bazen abartılı harcıyor.",
    "Messi–Ronaldo tartışması bitmiyor; iki farklı çağ gibi geliyor bana.",
    "Stadyum atmosferi televizyondan bambaşka; evde izlemek de pratik tabii.",
    "Bu sezon şampiyonluk yarışı sıkı; sürpriz takım çıkabilir gibi duruyor.",
  ],
  auto: [
    "Elektrikli araçlar hızla yayılıyor. Bence şehir içi için mantıklı ama herkese göre değil.",
    "İlk araba hâlâ akılda kalıyor; sonraki modeller birbirine benziyor gibi.",
    "Otomatik vites rahat ama manuel sürüşün keyfi ayrı; ikisi de tutuyor.",
    "SUV modası devam ediyor; dar sokaklarda park derdi ayrı mesele.",
  ],
  gaming: [
    "PC–konsol tartışması hiç bitmiyor. Bence bütçe ve oyun türü belirliyor.",
    "Bir oyuna yüzlerce saat veren çok; ben de ara ara öyle yapıyorum.",
    "Hype edilen oyunlar bazen hayal kırıklığı; beklenti yönetmek zor.",
    "Çocukluk oyunları hâlâ nostalji; yeni nesil farklı bir dünyada büyüdü.",
  ],
  film: [
    "Dizi mi film mi sorusu bitmiyor. Bence uzun hikâyeler diziyle daha iyi oturuyor.",
    "Spoiler kültürü değişti; bir sahne bile gündem olabiliyor artık.",
    "Evde izlemek rahat ama sinema deneyimi ayrı; ikisinin de yeri var.",
    "Platform savaşları içerik kalitesini etkiliyor; bazen çok seçenek yoruyor.",
  ],
  ai: [
    "Yapay zeka araçları günlük işe girdi. Bence kontrolsüz kullanım riskli.",
    "AI işleri değiştirir mi sorusu açık; abartı da var gerçek de var.",
    "Prompt yazmak ayrı bir beceri oldu; herkes aynı sonucu almıyor.",
    "AI içerik üretimi hızlandı; özgünlük tartışması da büyüdü.",
  ],
  science: [
    "Uzay haberleri yine ilgi çekiyor. Bence insanlık adım adım ilerliyor.",
    "Bilim haberlerinde başlık bazen abartılı; detay okumak lazım.",
    "Mars misyonları pahalı ama merak insanı itiyor; tartışma normal.",
    "Okulda sevilen dersler meslek seçimini etkiliyor; hâlâ geçerli bence.",
  ],
  economy: [
    "Fiyatlar ve kur gündemde. Bence günlük hayatta herkesi doğrudan etkiliyor.",
    "Nakit–kart alışkanlığı değişti; temassız ödeme alışkanlık yaptı.",
    "Tasarruf ile harcama arasında denge kurmak zor; herkes farklı yönetiyor.",
    "Yatırım konuşmaları arttı; risk toleransı kişiden kişiye değişiyor.",
  ],
  travel: [
    "Tatil planları yine konuşuluyor. Bence deniz ve dağ tatili farklı dinlendiriyor.",
    "Türkiye'nin şehirleri tartışılır; herkesin favorisi değişiyor.",
    "Tek başına seyahat cesaret ister; özgürlük de getiriyor tabii.",
    "Yurt dışı listeler uzuyor; bütçe ve vize işleri ayrı dert.",
  ],
  news: [
    "Gündem hızlı akıyor. Bence sosyal medya haberi ilk yayına taşıyor.",
    "Haber kaynağı seçmek önemli; aynı konu farklı anlatılabiliyor.",
    "Abartılı başlıklar dikkat çekiyor; içerik okumadan yorum riskli.",
    "Gündemi takip etmek yorucu olabiliyor; ara vermek de lazım.",
  ],
  literature: [
    "Son dönemde çeviri romanlar raflarda çoğaldı. Bence okur kitlesi açık ama kalite dalgalı.",
    "Klasikleri yeniden okuma modası var. Ben eski baskıların tadını başka buluyorum.",
    "Yerli yazarların yeni kitapları sık çıkıyor; dil ve tempo her eserde farklı.",
    "Kitap fiyatları tartışılıyor. Bence okuma alışkanlığı fiyat kadar zamana da bağlı.",
    "Ödül listeleri yine merak uyandırdı. Her aday herkese hitap etmiyor tabii.",
    "Kısa hikâye mi roman mı sorusu bitmiyor; ben uzun anlatımda kalıyorum.",
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
  literature: [
    "Alışveriş listesi kitap listesine dönen var mı?",
    "Yarım bırakılan kitap sayısını itiraf eden?",
    "Rafta bekleyen kitap kulesi yapan?",
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
