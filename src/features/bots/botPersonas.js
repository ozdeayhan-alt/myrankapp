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
      contentType: "image",
      content: "İzmir'de güzel bir sabah ☀️ Herkese iyi haftalar!",
      mediaSeed: "bot01-morning",
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
        "Sınav haftası ama motivasyon yüksek 📚 MyRank'te ilk günüm, merhaba herkese!",
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
      contentType: "image",
      content: "Sahilden kısa bir mola. Bazen durmak da üretmektir.",
      mediaSeed: "bot03-sea",
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
      content: "Gece nöbetinden sonra kahve ve kısa bir paylaşım ☕",
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
      contentType: "image",
      content: "Ev yapımı börek günü 🥐 Kimseye kıyamam.",
      mediaSeed: "bot05-food",
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
        "Yeni bir paragraf, yeni bir nefes. İstanbul geceleri yazmaya devam.",
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
      contentType: "image",
      content: "Kampüsten manzara. Bugün iyi hissediyorum.",
      mediaSeed: "bot07-campus",
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
      content: "Proje teslimi yaklaşıyor. Odak modu: açık.",
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
      contentType: "image",
      content: "Boğaz hattında kısa yürüyüşten bir kare.",
      mediaSeed: "bot09-bosphorus",
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
      content: "Yeni haftaya pozitif başlangıç. Herkese başarılar!",
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

const WEEKLY_POST_TEMPLATES = [
  {
    contentType: "tweet",
    content: "Haftanın ortasından kısa bir not: küçük adımlar birikir.",
  },
  {
    contentType: "image",
    content: "Bu hafta favori köşemden bir kare.",
    mediaSeed: "weekly-corner",
  },
  {
    contentType: "tweet",
    content: "Bugün minik bir hedef: bir paylaşım, bir teşekkür.",
  },
];

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
  WEEKLY_POST_TEMPLATES,
  buildMetadata,
  buildBio,
  avatarUrl,
  postImageUrl,
};
