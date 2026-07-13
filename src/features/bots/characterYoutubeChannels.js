/**
 * Curated YouTube channels for character Flow discovery (Türkiye only).
 * Prefer RSS (channelId); HTML scrape via handle when RSS is blocked/rate-limited.
 */
const CHARACTER_YOUTUBE_CHANNELS = {
  // Teknoloji Kafası
  bot_char_01: [
    { channelId: "UCek3UNSj6gq4FOPIOZkjc1g", handle: "ShiftDeleteNet", label: "ShiftDelete.Net" },
    { channelId: "UCsh0Qd1GDHK8Hnvn02bluzA", handle: "technopat", label: "Technopat" },
    { channelId: "UCA2lnDgBRP9lIbusYGngeCw", handle: "DonanimhaberTV", label: "Donanımhaber" },
  ],
  // Spor Sevdalısı
  bot_char_02: [
    { channelId: "UCJElRTCNEmLemgirqvsW63Q", handle: "aspor", label: "A Spor" },
    { channelId: "UCNopxUNUMinlK3ybMGlpbGQ", handle: "beinsportsturkiye", label: "beIN SPORTS Türkiye" },
    { channelId: "UCebdo7-2NdjcktKzco64iNw", handle: "TRTSpor", label: "TRT Spor" },
  ],
  // Otomobil Delisi
  bot_char_03: [
    { channelId: "UCBUV6u7iynyc8SQg48cYkAQ", handle: "otohaber", label: "Otohaber" },
    { channelId: "UCGoi3UGQQUd5sEndnoDmC6Q", handle: "Otoparkcom", label: "Otopark.com" },
    { channelId: "UCIqHQIw_T5YP5EKxKfUQ8pQ", handle: "Motor1Turkiye", label: "Motor1 Türkiye" },
    { channelId: "UCb1DnA26RT-bPIJw0LV5SgA", handle: "arabamcom", label: "arabam.com" },
  ],
  // Oyun Tutkunu
  bot_char_04: [
    { channelId: "UCUWeodiMY_6L8nZkKhthSjw", handle: "TuruncuLevye", label: "Turuncu Levye" },
    { channelId: "UCrTo3HDliaWeHWQeMDCE9Ug", handle: "Oyungezer", label: "Oyungezer" },
    { channelId: "UCbxlxWpPATPoF_yrUmk5Bqg", handle: "oyuneks", label: "Oyuneks" },
  ],
  // Filmkolik
  bot_char_05: [
    { channelId: "UCmqIE1hMRy9_yG0DtGwbsNA", handle: "Filmloverss", label: "Filmloverss" },
    { channelId: "UCRs4KImKivYwTwIP83z2n_g", handle: "BeyazPerde", label: "Beyazperde" },
    { channelId: "UCeZOywU-zg9j3SxYG0FdLtw", handle: "NetflixTurkiye", label: "Netflix Türkiye" },
  ],
  // Yapay Zeka Meraklısı
  bot_char_06: [
    { channelId: "UC04cPAH-irfZkF6EtFGrhhQ", handle: "Webrazzi", label: "Webrazzi" },
    { channelId: "UC_VcK12yKv-FG0hLXVg4jng", handle: "Miuul", label: "Miuul" },
    { channelId: "UCs5UyVbVBM2QStL90LrkvaA", handle: "DataScienceTR", label: "Data Science TR" },
  ],
  // Bilim Kafası
  bot_char_07: [
    { channelId: "UCatnasFAiXUvWwH8NlSdd3A", handle: "EvrimAgaci", label: "Evrim Ağacı" },
    { channelId: "UCv6jcPwFujuTIwFQ11jt1Yw", handle: "BarisOzcan", label: "Barış Özcan" },
    { channelId: "UC7jmlbmLNGbGBWexZorASyA", handle: "TUBITAK", label: "TÜBİTAK" },
  ],
  // Ekonomi Takipçisi
  bot_char_08: [
    { channelId: "UCWgGEIw9k_BB0VRMhy_w21Q", handle: "BloombergHT", label: "Bloomberg HT" },
    { channelId: "UCGMghpDmBAqhz2p7eLHX-eg", handle: "NTV", label: "NTV" },
    { channelId: "UCK3mI2lsk3LSo8PBUc8JTSw", handle: "Haberturk", label: "Habertürk" },
  ],
  // Seyahat Seven
  bot_char_09: [
    { channelId: "UCCfEBFokOG8vHPcJRhJmkxA", handle: "SeyahatTV", label: "Seyahat TV" },
    { channelId: "UC2wdh7qR8Ne0Mm4zMg5Xe1g", handle: "GezimanyaTV", label: "Gezimanya" },
    { channelId: "UCjfjz7EdUZq8cHfCbnv1TsA", handle: "TatilBudur", label: "Tatil Budur" },
  ],
  // Gündem Takipçisi
  bot_char_10: [
    { channelId: "UCJCYKGZ4ZyjjshYa6fhRgRw", handle: "CNNTurk", label: "CNN Türk" },
    { channelId: "UCBgTP2LOFVPmq15W-RH-WXA", handle: "TRTHaber", label: "TRT Haber" },
    { channelId: "UCGMghpDmBAqhz2p7eLHX-eg", handle: "NTV", label: "NTV" },
  ],
  // Edebiyat Sever
  bot_char_11: [
    { channelId: "UCAK9TpuDTdWrYzRyFVB3X-Q", handle: "kitapyurdu", label: "Kitapyurdu" },
    { channelId: "UCCbaz38TzwuRw5bNopSC3lQ", handle: "CanYayinlari", label: "Can Yayınları" },
    { channelId: "UCK3edbvoZKgSsls9O3pr1YQ", handle: "OkumaGunlugu", label: "Okuma Günlüğü" },
    { channelId: "UCQp_qUHs9jW92LuFGGw1rnQ", handle: "1000Kitap", label: "1000Kitap" },
  ],
};

function getYoutubeChannelsForCharacter(characterUid) {
  return CHARACTER_YOUTUBE_CHANNELS[characterUid] ?? [];
}

module.exports = {
  CHARACTER_YOUTUBE_CHANNELS,
  getYoutubeChannelsForCharacter,
};
