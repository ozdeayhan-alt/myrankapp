const { randomInt } = require("./botUtils");

/**
 * Persona-specific Whisp banks for the 10 seed bots.
 * Prefer concrete city/profession detail; avoid generic motivation / "MyRank'e hoş geldiniz".
 */
const BOT_WHISP_BANKS = {
  bot_myrank_01: [
    {
      contentType: "tweet",
      content:
        "Bugün sınıfta bir öğrenci 'neden öğreniyoruz ki' diye sordu. Cevabı tahtaya yazdık: çünkü merak bitince hayat daralıyor. Sizde de böyle anlar oluyor mu?",
    },
    {
      contentType: "tweet",
      content:
        "İzmir'de sabah zili çalmadan önce iki yudum kahve, bir sayfa kitap. Öğretmenlik bazen ders planından çok bu küçük ritüellerle ayakta duruyor.",
    },
    {
      contentType: "tweet",
      content:
        "Veliler toplantısında herkes not tutuyor, kimse birbirini dinlemiyor. Okulda asıl ders bazen koridorda öğreniliyor.",
    },
    {
      contentType: "tweet",
      content:
        "Çocuklar teneffüste koşarken biz öğretmen odasında sınav kağıdı yığınına bakıyoruz. Enerji dengesi hiç adil değil.",
    },
    {
      contentType: "tweet",
      content:
        "Bu hafta ödev olarak 'bir şeyi merak et' dedim. En güzel cevap: 'Neden yağmur kokusu herkese aynı gelmiyor?'",
    },
    {
      contentType: "tweet",
      content:
        "Evli + öğretmen olmak: akşam yemeği ile yarınki ders arasında ince bir çizgi. Çizgiyi koruyanlar ayakta kalıyor.",
    },
  ],
  bot_myrank_02: [
    {
      contentType: "tweet",
      content:
        "Final haftasında kütüphanede herkes kulaklık takmış, kimse kimseye bakmıyor. Yalnızlık da bir tür çalışma tekniği olmuş.",
    },
    {
      contentType: "tweet",
      content:
        "İzmir'de kampüs ile ev arası yol, kafamda formüllerle geçiyor. Bu şehirde tramvay bile ders tekrarı gibi.",
    },
    {
      contentType: "tweet",
      content:
        "Sınavdan çıktım, 'iyi geçti' demek istemiyorum. Sadece 'bitti' diyorum. O da bir başarı sayılır mı?",
    },
    {
      contentType: "tweet",
      content:
        "Not ortalaması konuşulunca herkes sessizleşiyor. Konuşulması gereken asıl şey: uykusuzluk ve ucuz kahve.",
    },
    {
      contentType: "tweet",
      content:
        "Arkadaşım 'bu dönem yetişmez' dedi. Ben de 'yetişmezse yeniden deneriz' dedim. Öğrencilik biraz inat işi.",
    },
    {
      contentType: "tweet",
      content:
        "Bekar öğrenci bütçesi: yemek mi, fotokopi mi? Bugün fotokopi kazandı. Karnım itiraz etti.",
    },
  ],
  bot_myrank_03: [
    {
      contentType: "tweet",
      content:
        "Sahilde yürürken iş maili açmadım. Mühendislikte en zor özellik bazen 'kapat' tuşu.",
    },
    {
      contentType: "tweet",
      content:
        "Toplantıda herkes 'hızlı çözüm' istiyor. Hızlı çözümün faturası genelde üç ay sonra geliyor.",
    },
    {
      contentType: "tweet",
      content:
        "İzmir'de rüzgâr kod yazarken bile pencereyi kapatıyor. Deniz kenarı ofis romantik, klavye pratik değil.",
    },
    {
      contentType: "tweet",
      content:
        "Bugün bir bug'ı iki saatte çözdüm, sonra bir satırlık hataydı. Ego biraz küçüldü, kahve büyüdü.",
    },
    {
      contentType: "tweet",
      content:
        "Dokümantasyon yazmayan ekip, gelecekteki kendine tuzak kuruyor. Bunu her sprintte yeniden öğreniyoruz.",
    },
    {
      contentType: "tweet",
      content:
        "Bekar mühendis akşamı: ya PR review ya da sahil. Bugün sahil kazandı. Yarın PR intikam alır.",
    },
  ],
  bot_myrank_04: [
    {
      contentType: "tweet",
      content:
        "Nöbet çıkışı ayakkabılarımı çıkarmadan oturdum. Hemşirelikte yorgunluk bazen cümle kurmayı unutturuyor.",
    },
    {
      contentType: "tweet",
      content:
        "Gece servisinde bir hasta 'teşekkür ederim' dedi. O iki kelime, uzun vardiyayı taşıyor.",
    },
    {
      contentType: "tweet",
      content:
        "İzmir'de sabahın dördünde hastane koridoru başka bir şehir gibi. Sessizlik bile yorgun.",
    },
    {
      contentType: "tweet",
      content:
        "Eldiven çıkarırken aklıma gelen tek şey: duş ve sessiz bir oda. Lüksün tanımı değişiyor.",
    },
    {
      contentType: "tweet",
      content:
        "Meslektaşlarla kahve molası beş dakika sürüyor ama o beş dakika olmasa kimse ayakta kalmaz.",
    },
    {
      contentType: "tweet",
      content:
        "Nöbet çizelgesi açıkken tatil planı yapmak cesaret. Yine de bir hafta sonu hayali kurmadan duramıyorum.",
    },
  ],
  bot_myrank_05: [
    {
      contentType: "tweet",
      content:
        "Bugün hamur mayalandı, ev de biraz mayalandı. Mutfakta tempo, dışarıdaki gürültüden daha dürüst.",
    },
    {
      contentType: "tweet",
      content:
        "İzmir'de pazar dönüşü poşetler ağır, sohbet hafif. Komşularla üç kelime yetiyor bazen.",
    },
    {
      contentType: "tweet",
      content:
        "Çocuklar okuldayken evin sessizliği tuhaf. Alışınca da o sessizliği kıskanıyorum.",
    },
    {
      contentType: "tweet",
      content:
        "Tariften saptım, yemek yine tuttu. Mutfakta kural: cesaret + biraz tuz.",
    },
    {
      contentType: "tweet",
      content:
        "Akşam yemeği masasında telefonlar kapalı olsun istiyorum. Kolay değil, denemek bile bir şey.",
    },
    {
      contentType: "tweet",
      content:
        "Ev işi bitmiyor diye şikâyet etmek kolay. Bitiren şey çoğu zaman bir fincan çay molası.",
    },
  ],
  bot_myrank_06: [
    {
      contentType: "tweet",
      content:
        "İstanbul gecesinde bir paragraf yazıp sildim. Silmek de yazmanın parçası; kimse bunu övmez.",
    },
    {
      contentType: "tweet",
      content:
        "Kahve soğumadan cümle bitmiyor. Yazarlık bazen sıcaklıkla yarışmak.",
    },
    {
      contentType: "tweet",
      content:
        "Editör notu geldi: 'daha sade'. Sadelik en zor süs. Tekrar deniyorum.",
    },
    {
      contentType: "tweet",
      content:
        "Boğaz'a bakıp yazmak romantik geliyor. Asıl iş, perdeleri kapatıp masaya dönmek.",
    },
    {
      contentType: "tweet",
      content:
        "Evli yazar olmak: 'beş dakika' demek, bir saate çıkıyor. Eşimin sabrı metinden uzun.",
    },
    {
      contentType: "tweet",
      content:
        "Bugün üç sayfa yazdım, biri tuttu. Oran kötü görünüyor ama tutan sayfa her şeyi taşıyor.",
    },
  ],
  bot_myrank_07: [
    {
      contentType: "tweet",
      content:
        "Kampüste Wi‑Fi düştü, herkes panik. Kod yazmak bazen bağlantıdan çok sabır işi.",
    },
    {
      contentType: "tweet",
      content:
        "İstanbul'da yurt odasında gece 02:00, derste anlatılanı yeniden izliyorum. Uyku ertelenmiş bir feature.",
    },
    {
      contentType: "tweet",
      content:
        "Proje grubunda herkes 'ben yaptım' diyor. Git history daha dürüst bir ayna.",
    },
    {
      contentType: "tweet",
      content:
        "Kahve + kulaklık + deadline. Öğrenci starter pack hâlâ değişmedi.",
    },
    {
      contentType: "tweet",
      content:
        "Hoca 'soru var mı' deyince sınıf susuyor. Sonra koridorda herkes soruyor. Tuhaf bir cesaret ekonomisi.",
    },
    {
      contentType: "tweet",
      content:
        "Bugün bir lab'ı ilk seferde çalıştırdım. Kutlama: ucuz tost. Lüks bu.",
    },
  ],
  bot_myrank_08: [
    {
      contentType: "tweet",
      content:
        "Sprint sonunda 'neredeyse bitti' cümlesi tehlikeli. Neredeyse, çoğu zaman yarım demek.",
    },
    {
      contentType: "tweet",
      content:
        "İstanbul trafiğinde toplantıya yetişirken aklımda risk listesi. Mühendislik ofiste bitmiyor.",
    },
    {
      contentType: "tweet",
      content:
        "Detaya takılmak kusur sayılır bazen. Benim işim biraz da o kusuru mesleğe çevirmek.",
    },
    {
      contentType: "tweet",
      content:
        "Evde 'iş bitti mi' sorusu geliyor. Cevap: bitti sandığım yerden iki madde daha çıktı.",
    },
    {
      contentType: "tweet",
      content:
        "Kod review'da nazik ama net olmak sanat. Hem ilişkiyi hem sistemi korumak lazım.",
    },
    {
      contentType: "tweet",
      content:
        "Bugün bir tahmini üç gün erteledik. Erken söylemek, geç yetişmekten ucuz.",
    },
  ],
  bot_myrank_09: [
    {
      contentType: "tweet",
      content:
        "Duruşma öncesi dosyayı üçüncü kez okudum. Avukatlıkta tekrar, abartı değil; önlem.",
    },
    {
      contentType: "tweet",
      content:
        "İstanbul adliyesi koridorunda herkes acele ediyor. Adalet yavaş, ayakkabılar hızlı.",
    },
    {
      contentType: "tweet",
      content:
        "Müvekkil 'hızlı sonuç' istiyor. Hukukta hızlı çoğu zaman riskli demek. Bunu anlatmak işin yarısı.",
    },
    {
      contentType: "tweet",
      content:
        "Boğaz yürüyüşü kısa sürdü; kafamda hâlâ dilekçe cümleleri vardı. Meslek tatili de işgal ediyor.",
    },
    {
      contentType: "tweet",
      content:
        "Bekar avukat akşamı: ya dosya ya da dışarı. Bugün dosya kazandı. Yarın itiraz ederim.",
    },
    {
      contentType: "tweet",
      content:
        "Bir cümleyi sadeleştirince dosya güçlendi. Hukukta da sadelik silah.",
    },
  ],
  bot_myrank_10: [
    {
      contentType: "tweet",
      content:
        "Sınıfta bir öğrenci yanlış cevap verdi, sınıf güldü. Gülmeyi kesip 'yanlış da öğrenmedir' dedim. Sessizlik daha öğretici oldu.",
    },
    {
      contentType: "tweet",
      content:
        "İstanbul'da sabah servisi + yoklama. Öğretmenlik günü daha zil çalmadan başlıyor.",
    },
    {
      contentType: "tweet",
      content:
        "Tahtaya yazarken kalem bitince bütün plan değişiyor. Küçük malzemeler büyük dersler bozuyor.",
    },
    {
      contentType: "tweet",
      content:
        "Veliler 'çocuğum neden düşük aldı' diye sorunca cevabım hazır: çünkü öğrenme düz çizgi değil.",
    },
    {
      contentType: "tweet",
      content:
        "Teneffüste basket oynayanlarla konuşmak, ders anlatmaktan daha samimi geliyor bazen.",
    },
    {
      contentType: "tweet",
      content:
        "Bu hafta ödev az verdim, tartışma çok. Sınıf daha canlıydı. Belki de doğru doz buydu.",
    },
  ],
};

/** Legacy fallback if a uid is missing from the bank. */
const WEEKLY_POST_TEMPLATES = [
  {
    contentType: "tweet",
    content:
      "Bugün kısa bir not: küçük bir gözlem, uzun bir gün. Sizde de böyle mi?",
  },
];

function getWhispBankForBot(botId) {
  const bank = BOT_WHISP_BANKS[botId];
  if (Array.isArray(bank) && bank.length > 0) {
    return bank;
  }
  return WEEKLY_POST_TEMPLATES;
}

/**
 * Pick a weekly Whisp, avoiding the last used bank index when possible.
 * @returns {{ contentType: string, content: string, mediaSeed?: string, bankIndex: number }}
 */
function pickWeeklyWhisp(botId, lastBankIndex = null) {
  const bank = getWhispBankForBot(botId);
  if (bank.length === 1) {
    return { ...bank[0], bankIndex: 0 };
  }

  let index = randomInt(0, bank.length - 1);
  if (
    typeof lastBankIndex === "number" &&
    lastBankIndex >= 0 &&
    lastBankIndex < bank.length
  ) {
    let guard = 0;
    while (index === lastBankIndex && guard < 8) {
      index = randomInt(0, bank.length - 1);
      guard += 1;
    }
  }

  return { ...bank[index], bankIndex: index };
}

/**
 * Stagger bots across weekdays so they don't all post the same cron tick.
 * Returns true if this bot is allowed to attempt a weekly post today.
 */
function isBotWeeklySlotToday(botId, now = new Date()) {
  const personas = Object.keys(BOT_WHISP_BANKS);
  const index = personas.indexOf(botId);
  if (index < 0) {
    return true;
  }
  // Sunday=0 … Saturday=6 — spread 10 bots across the week.
  const day = now.getDay();
  return index % 7 === day || (index % 7 === (day + 3) % 7);
}

module.exports = {
  BOT_WHISP_BANKS,
  WEEKLY_POST_TEMPLATES,
  getWhispBankForBot,
  pickWeeklyWhisp,
  isBotWeeklySlotToday,
};
