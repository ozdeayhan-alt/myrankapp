/** 10 seed bots: 5 Kadın / 5 Erkek, 5 İzmir / 5 İstanbul, 5 Evli / 5 Bekar. */
const BOT_PERSONAS = [
  {
    uid: "bot_myrank_01",
    displayName: "Ayşe Yılmaz",
    gender: "Kadın",
    city: "İzmir",
    maritalStatus: "Evli",
    profession: "Öğretmen",
    age: 38,
    avatarIndex: 11,
    bio: "Kitap ve sabah kahvesi.",
    initialPost: {
      contentType: "tweet",
      content:
        "Sabah zilinden önce iki yudum kahve. İzmir'de öğretmenlik böyle başlıyor.",
    },
  },
  {
    uid: "bot_myrank_02",
    displayName: "Zeynep Kaya",
    gender: "Kadın",
    city: "İzmir",
    maritalStatus: "Bekar",
    profession: "Öğrenci",
    age: 23,
    avatarIndex: 22,
    bio: "Final haftası, moral yüksek.",
    initialPost: {
      contentType: "tweet",
      content:
        "Kütüphanede herkes kulaklık takmış. Final haftası böyle görünüyor.",
    },
  },
  {
    uid: "bot_myrank_03",
    displayName: "Elif Demir",
    gender: "Kadın",
    city: "İzmir",
    maritalStatus: "Bekar",
    profession: "Mühendis",
    age: 27,
    avatarIndex: 33,
    bio: "Sahil yürüyüşü olmadan gün başlamaz.",
    initialPost: {
      contentType: "tweet",
      content:
        "Sahilde mail açmadım. Mühendislikte en zor özellik bazen kapatmak.",
    },
  },
  {
    uid: "bot_myrank_04",
    displayName: "Merve Çelik",
    gender: "Kadın",
    city: "İzmir",
    maritalStatus: "Bekar",
    profession: "Hemşire",
    age: 29,
    avatarIndex: 44,
    bio: "Nöbet sonrası kısa notlar.",
    initialPost: {
      contentType: "tweet",
      content: "Nöbet çıkışı: ayakkabılar hâlâ ayakta, ben değilim.",
    },
  },
  {
    uid: "bot_myrank_05",
    displayName: "Selin Arslan",
    gender: "Kadın",
    city: "İzmir",
    maritalStatus: "Evli",
    profession: "Ev hanımı",
    age: 41,
    avatarIndex: 55,
    bio: "Mutfağı seviyorum.",
    initialPost: {
      contentType: "tweet",
      content: "Hamur mayalandı, ev de biraz. Mutfak bugün dürüst bir yer.",
    },
  },
  {
    uid: "bot_myrank_06",
    displayName: "Mehmet Öztürk",
    gender: "Erkek",
    city: "İstanbul",
    maritalStatus: "Evli",
    profession: "Yazar",
    age: 44,
    avatarIndex: 11,
    bio: "Gece yazarı.",
    initialPost: {
      contentType: "tweet",
      content:
        "Bir paragraf yazıp sildim. Silmek de yazmanın parçası; kimse bunu övmez.",
    },
  },
  {
    uid: "bot_myrank_07",
    displayName: "Can Aydın",
    gender: "Erkek",
    city: "İstanbul",
    maritalStatus: "Bekar",
    profession: "Öğrenci",
    age: 22,
    avatarIndex: 22,
    bio: "Kampüs, kod, kahve.",
    initialPost: {
      contentType: "tweet",
      content: "Kampüste Wi‑Fi düştü. Panik, sonra sabır. Sonra yine kod.",
    },
  },
  {
    uid: "bot_myrank_08",
    displayName: "Burak Şahin",
    gender: "Erkek",
    city: "İstanbul",
    maritalStatus: "Evli",
    profession: "Mühendis",
    age: 35,
    avatarIndex: 33,
    bio: "Detaylara takılırım.",
    initialPost: {
      contentType: "tweet",
      content:
        "Sprint sonunda 'neredeyse bitti' tehlikeli bir cümle. Neredeyse çoğu zaman yarım.",
    },
  },
  {
    uid: "bot_myrank_09",
    displayName: "Emre Koç",
    gender: "Erkek",
    city: "İstanbul",
    maritalStatus: "Bekar",
    profession: "Avukat",
    age: 31,
    avatarIndex: 44,
    bio: "Adalet ve düzen.",
    initialPost: {
      contentType: "tweet",
      content:
        "Duruşma öncesi dosyayı üçüncü kez okudum. Tekrar abartı değil; önlem.",
    },
  },
  {
    uid: "bot_myrank_10",
    displayName: "Kerem Yıldız",
    gender: "Erkek",
    city: "İstanbul",
    maritalStatus: "Bekar",
    profession: "Öğretmen",
    age: 28,
    avatarIndex: 55,
    bio: "Sınıftan selamlar.",
    initialPost: {
      contentType: "tweet",
      content:
        "Yanlış cevap gelince sınıf güldü. Gülmeyi kesip dinledik. Ders orada başladı.",
    },
  },
];

const BOT_UID_SET = new Set(BOT_PERSONAS.map((persona) => persona.uid));

const BIO_CATEGORY_VISIBILITY = {
  country: true,
  city: true,
  age: true,
  gender: true,
  profession: true,
  maritalStatus: true,
};

function buildMetadata(persona) {
  return {
    country: "Türkiye",
    city: persona.city,
    age: persona.age,
    gender: persona.gender,
    profession: persona.profession,
    maritalStatus: persona.maritalStatus,
  };
}

function buildBio(persona) {
  return typeof persona.bio === "string" ? persona.bio.trim() : "";
}

function avatarUrl(persona) {
  const folder = persona.gender === "Kadın" ? "women" : "men";
  const index = persona.avatarIndex ?? 1;
  return `https://randomuser.me/api/portraits/${folder}/${index}.jpg`;
}

function postImageUrl(seed) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/900/600`;
}

module.exports = {
  BOT_PERSONAS,
  BOT_UID_SET,
  BIO_CATEGORY_VISIBILITY,
  buildMetadata,
  buildBio,
  avatarUrl,
  postImageUrl,
};
