/** @typedef {{ title?: string, paragraphs: string[] }} LegalSection */
/** @typedef {{ title: string, updatedAt: string, sections: LegalSection[] }} LegalDocument */

/** @type {LegalDocument} */
const PRIVACY_POLICY = {
  title: "Gizlilik Politikası",
  updatedAt: "10 Haziran 2026",
  sections: [
    {
      paragraphs: [
        "MyRank (“uygulama”), kullanıcıların profil bilgileri ve paylaşımları üzerinden sıralama ve keşif deneyimi sunan bir sosyal platformdur. Bu politika, hangi verileri topladığımızı ve nasıl kullandığımızı açıklar.",
      ],
    },
    {
      title: "Topladığımız veriler",
      paragraphs: [
        "Hesap bilgileri: e-posta adresi ve şifre (Firebase Authentication üzerinde saklanır).",
        "Profil bilgileri: ad, profil fotoğrafı, biyografi ve kayıt sırasında girdiğiniz metadata (ülke, şehir, cinsiyet, yaş, meslek, medeni durum).",
        "İçerik: gönderiler, yorumlar, mesajlar ve yüklediğiniz fotoğraf/video dosyaları.",
        "Etkileşim verileri: beğeni, beğenmeme, paylaşım, kaydetme, profil oyları ve takip ilişkileri.",
        "Teknik veriler: push bildirim token’ı ve cihaz platformu (iOS/Android).",
      ],
    },
    {
      title: "Verilerin kullanım amacı",
      paragraphs: [
        "Hesabınızı oluşturmak ve oturum açmanızı sağlamak.",
        "Profil, sıralama ve keşfet özelliklerini sunmak.",
        "Kullanıcılar arası mesajlaşmayı ve bildirimleri iletmek.",
        "Uygunsuz içerik şikayetlerini almak ve moderasyon süreçlerini yürütmek.",
        "Hizmet güvenliğini sağlamak ve kötüye kullanımı önlemek.",
      ],
    },
    {
      title: "Veri paylaşımı",
      paragraphs: [
        "Profil bilgileriniz ve paylaşımlarınız, uygulamaya giriş yapmış diğer kullanıcılar tarafından görülebilir.",
        "Altyapı hizmetleri için Google Firebase (kimlik doğrulama, veritabanı, depolama) ve Expo Push Notification servisleri kullanılır.",
        "Yasal zorunluluklar dışında verilerinizi üçüncü taraflara satmayız.",
      ],
    },
    {
      title: "Saklama ve silme",
      paragraphs: [
        "Hesabınız aktif olduğu sürece verileriniz saklanır.",
        "Hesabınızı uygulama içinden sildiğinizde profil, gönderi, mesaj ve ilişkili veriler kalıcı olarak silinmeye çalışılır.",
        "Silme işlemi tamamlandıktan sonra geri alınamaz.",
      ],
    },
    {
      title: "Haklarınız",
      paragraphs: [
        "6698 sayılı KVKK kapsamında verilerinize erişme, düzeltme ve silme talebinde bulunma hakkına sahipsiniz.",
        "Hesap silme işlemini uygulama menüsünden başlatabilirsiniz.",
      ],
    },
    {
      title: "İletişim",
      paragraphs: [
        "Gizlilik ile ilgili sorularınız için uygulama içi destek kanallarımızı kullanabilirsiniz.",
      ],
    },
  ],
};

/** @type {LegalDocument} */
const TERMS_OF_SERVICE = {
  title: "Kullanım Koşulları",
  updatedAt: "10 Haziran 2026",
  sections: [
    {
      paragraphs: [
        "MyRank uygulamasını kullanarak aşağıdaki koşulları kabul etmiş sayılırsınız. Koşulları kabul etmiyorsanız uygulamayı kullanmayın.",
      ],
    },
    {
      title: "Uygunluk",
      paragraphs: [
        "Uygulamayı kullanmak için en az 18 yaşında olmalısınız.",
        "Kayıt sırasında doğru ve güncel bilgi vermeyi kabul edersiniz.",
      ],
    },
    {
      title: "Kullanıcı içeriği",
      paragraphs: [
        "Paylaştığınız içeriklerden yalnızca siz sorumlusunuz.",
        "Yasa dışı, nefret söylemi, taciz, spam, müstehcen veya telif hakkı ihlali içeren içerik paylaşamazsınız.",
        "Diğer kullanıcıları engelleyebilir ve uygunsuz içerikleri şikayet edebilirsiniz.",
      ],
    },
    {
      title: "Sıralama sistemi",
      paragraphs: [
        "MyRank, etkileşim ve profil oylarına dayalı bir sıralama sistemi kullanır.",
        "Sıralama sonuçları bilgilendirme amaçlıdır; herhangi bir hukuki veya maddi hak doğurmaz.",
        "Manipülasyon, sahte hesap veya otomatik etkileşim yasaktır.",
      ],
    },
    {
      title: "Hesap güvenliği",
      paragraphs: [
        "Hesap bilgilerinizin gizliliğinden siz sorumlusunuz.",
        "Şüpheli aktivite fark ederseniz şifrenizi değiştirin ve destekle iletişime geçin.",
      ],
    },
    {
      title: "Hesap askıya alma ve silme",
      paragraphs: [
        "Koşulları ihlal eden hesaplar uyarı verilmeksizin askıya alınabilir veya silinebilir.",
        "İstediğiniz zaman uygulama içinden hesabınızı silebilirsiniz.",
      ],
    },
    {
      title: "Sorumluluk sınırı",
      paragraphs: [
        "Uygulama “olduğu gibi” sunulur. Kesintisiz veya hatasız çalışacağı garanti edilmez.",
        "Kullanıcılar arası etkileşimlerden doğan uyuşmazlıklarda MyRank aracı konumundadır.",
      ],
    },
  ],
};

/** @type {LegalDocument} */
const MODERATION_POLICY = {
  title: "İçerik ve Moderasyon",
  updatedAt: "10 Haziran 2026",
  sections: [
    {
      paragraphs: [
        "MyRank, güvenli bir topluluk ortamı sağlamak için kullanıcı bildirimlerine dayalı moderasyon uygular.",
      ],
    },
    {
      title: "Şikayet etme",
      paragraphs: [
        "Gönderi ve profil menülerinden “Şikayet et” seçeneğiyle içerik bildirebilirsiniz.",
        "Spam, taciz, uygunsuz içerik ve diğer nedenler arasından seçim yapabilirsiniz.",
      ],
    },
    {
      title: "Engelleme",
      paragraphs: [
        "İstemediğiniz kullanıcıları engelleyebilirsiniz. Engellediğiniz kişilerle mesajlaşma ve etkileşim kısıtlanır.",
      ],
    },
    {
      title: "Moderasyon süreci",
      paragraphs: [
        "Şikayetler incelenir; ihlal tespit edilen içerik veya hesaplar kaldırılabilir.",
        "Tekrarlayan ihlallerde hesap kalıcı olarak kapatılabilir.",
      ],
    },
    {
      title: "Destek",
      paragraphs: [
        "Moderasyon kararları veya güvenlik endişeleri için uygulama içi destek kanallarımızdan bize ulaşabilirsiniz.",
      ],
    },
  ],
};

const LEGAL_PAGES = {
  privacy: PRIVACY_POLICY,
  terms: TERMS_OF_SERVICE,
  moderation: MODERATION_POLICY,
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {LegalDocument} document
 */
function renderLegalHtml(document) {
  const sections = document.sections
    .map((section) => {
      const heading = section.title
        ? `<h2>${escapeHtml(section.title)}</h2>`
        : "";
      const body = section.paragraphs
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join("");
      return `${heading}${body}`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(document.title)} — MyRank</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; color: #111827; max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
    .updated { color: #6b7280; font-size: 0.875rem; margin-bottom: 1.5rem; }
    h2 { font-size: 1.125rem; margin-top: 1.5rem; margin-bottom: 0.5rem; }
    p { margin: 0 0 0.75rem; }
    nav { margin-top: 2rem; font-size: 0.875rem; }
    nav a { color: #2563eb; margin-right: 1rem; }
  </style>
</head>
<body>
  <h1>${escapeHtml(document.title)}</h1>
  <p class="updated">Son güncelleme: ${escapeHtml(document.updatedAt)}</p>
  ${sections}
  <nav>
    <a href="/privacy">Gizlilik</a>
    <a href="/terms">Kullanım Koşulları</a>
    <a href="/moderation">Moderasyon</a>
  </nav>
</body>
</html>`;
}

module.exports = {
  LEGAL_PAGES,
  renderLegalHtml,
};
