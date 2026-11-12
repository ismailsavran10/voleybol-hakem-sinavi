/* Resmi işaretler — Kurallar 2025-2028, Şema D11 (el işaretleri) ve D12 (bayrak işaretleri).
   Görseller: img/<id>.webp (Kurallar kitabından kırpıldı).
   kim: F = başhakem, S = yardımcı hakem; parantez içindeki (F)/(S) yalnızca özel durumlarda gösterir. */
(function (root) {
  var SIGNALS = {
    signals: [
      { id: 'el-01', no: '1', grup: 'el', ad: 'Servis atma izni', tarif: 'Servis yönünü belirtmek için eli hareket ettirir.', kim: 'F', kurallar: '12.3, 22.2.1.1', benzer: ['el-02', 'el-20', 'el-03'], zorluk: 1 },
      { id: 'el-02', no: '2', grup: 'el', ad: 'Servis atacak takım', tarif: 'Servis atacak takımın tarafına doğru kolunu uzatır.', kim: 'F S', kurallar: '22.2.3.1, 22.2.3.2, 22.2.3.4', benzer: ['el-01', 'el-14', 'el-22'], zorluk: 1 },
      { id: 'el-03', no: '3', grup: 'el', ad: 'Oyun alanı değişimi', tarif: 'Ön kollarını öne ve arkaya doğru kaldırıp vücudun etrafında döndürür.', kim: 'F', kurallar: '18.2', benzer: ['el-05', 'el-13', 'el-09'], zorluk: 2 },
      { id: 'el-04', no: '4', grup: 'el', ad: 'Mola', tarif: 'Bir elin avucunu diğerinin parmaklarının üzerine dikey yerleştirir (T) ve talepte bulunan takımı gösterir.', kim: '(F) S', kurallar: '15.4.1', benzer: ['el-05', 'el-24', 'el-02'], zorluk: 1 },
      { id: 'el-05', no: '5', grup: 'el', ad: 'Oyuncu değişikliği', tarif: 'Ön kollarını birbirleri etrafında dairesel olarak döndürür.', kim: '(F) (S)', kurallar: '15.5.1, 15.5.2, 15.8', benzer: ['el-13', 'el-03', 'el-04'], zorluk: 1 },
      { id: 'el-06a', no: '6a', grup: 'el', ad: 'Hatalı davranış uyarısı', tarif: 'Uyarı için sarı kart gösterir.', kim: 'F', kurallar: '21.1, 21.6, 23.3.2.2', benzer: ['el-06b', 'el-07', 'el-25'], zorluk: 1 },
      { id: 'el-06b', no: '6b', grup: 'el', ad: 'Hatalı davranış ihtarı', tarif: 'İhtar için kırmızı kart gösterir.', kim: 'F', kurallar: '21.3.1, 21.6, 23.3.2.2', benzer: ['el-06a', 'el-07', 'el-08'], zorluk: 1 },
      { id: 'el-07', no: '7', grup: 'el', ad: 'Oyundan çıkarma', tarif: 'Sarı ve kırmızı kartı birlikte, aynı elde gösterir.', kim: 'F', kurallar: '21.3.2, 21.6, 23.3.2.2', benzer: ['el-08', 'el-06b', 'el-06a'], zorluk: 2 },
      { id: 'el-08', no: '8', grup: 'el', ad: 'Diskalifiye', tarif: 'Kırmızı ve sarı kartı ayrı ayrı, iki elde gösterir.', kim: 'F', kurallar: '21.3.3, 21.6, 23.3.2.2', benzer: ['el-07', 'el-06b', 'el-25'], zorluk: 2 },
      { id: 'el-09', no: '9', grup: 'el', ad: 'Setin (veya maçın) sonu', tarif: 'Ön kollarını göğsünün önünde, eller açık olarak çaprazlar.', kim: 'F (S)', kurallar: '6.2, 6.3', benzer: ['el-23', 'el-15', 'el-03'], zorluk: 1 },
      { id: 'el-10', no: '10', grup: 'el', ad: 'Servis vuruşunda topun havaya atılmaması veya elden bırakılmaması', tarif: 'Avuç içi yukarı bakacak şekilde kolunu düz olarak yukarı kaldırır.', kim: 'F', kurallar: '12.4.1', benzer: ['el-16', 'el-11', 'el-01'], zorluk: 3 },
      { id: 'el-11', no: '11', grup: 'el', ad: 'Serviste gecikme', tarif: 'Sekiz parmağını açık şekilde kaldırır.', kim: 'F', kurallar: '12.4.4', benzer: ['el-18', 'el-17', 'el-10'], zorluk: 2 },
      { id: 'el-12', no: '12', grup: 'el', ad: 'Blok hatası veya perdeleme', tarif: 'Avuç içleri öne bakacak şekilde her iki kolunu dikey olarak kaldırır.', kim: 'F S', kurallar: '12.5, 12.6.2.3, 14.6.3, 19.3.1.3, 23.3.2.3a-g, 24.3.2.4', benzer: ['el-15', 'el-23', 'el-21'], zorluk: 2 },
      { id: 'el-13', no: '13', grup: 'el', ad: 'Pozisyon veya dönüş hatası', tarif: 'İşaret parmağıyla dairesel bir hareket yapar.', kim: 'F S', kurallar: '7.5, 7.7, 23.3.2.3a, 24.3.2.2', benzer: ['el-05', 'el-03', 'el-22'], zorluk: 1 },
      { id: 'el-14', no: '14', grup: 'el', ad: 'Dahil top', tarif: 'Kolunu ve parmaklarını yere doğru çevirir.', kim: 'F (S)', kurallar: '8.3', benzer: ['el-22', 'el-15', 'el-02'], zorluk: 1 },
      { id: 'el-15', no: '15', grup: 'el', ad: 'Hariç top', tarif: 'Eller açık, avuç içleri vücuda dönük olarak ön kollarını dikey kaldırır.', kim: 'F S', kurallar: '8.4.1-8.4.4, 24.3.2.5, 24.3.2.7, 24.3.2.8', benzer: ['el-14', 'el-12', 'el-24'], zorluk: 1 },
      { id: 'el-16', no: '16', grup: 'el', ad: 'Tutulmuş top', tarif: 'Avuç içi yukarı bakacak şekilde ön kolunu yavaşça kaldırır.', kim: 'F', kurallar: '9.2.2, 9.3.3, 23.3.2.3b', benzer: ['el-10', 'el-17', 'el-24'], zorluk: 2 },
      { id: 'el-17', no: '17', grup: 'el', ad: 'Çift vuruş', tarif: 'İki parmağını açık şekilde kaldırır.', kim: 'F', kurallar: '9.3.4, 23.3.2.3b', benzer: ['el-18', 'el-11', 'el-16'], zorluk: 1 },
      { id: 'el-18', no: '18', grup: 'el', ad: 'Dört vuruş', tarif: 'Dört parmağını açık şekilde kaldırır.', kim: 'F', kurallar: '9.3.1, 23.3.2.3b', benzer: ['el-17', 'el-11', 'el-16'], zorluk: 1 },
      { id: 'el-19', no: '19', grup: 'el', ad: 'Fileye temas / servisin geçiş boşluğundan geçmemesi', tarif: 'Filenin ilgili tarafını ilgili eliyle gösterir (oyuncunun fileye teması; servisten gelen topun fileye çarpıp geçmemesi).', kim: 'F S', kurallar: '11.4.4, 12.6.2.1', benzer: ['el-20', 'el-22', 'el-21'], zorluk: 2 },
      { id: 'el-20', no: '20', grup: 'el', ad: 'Filenin diğer tarafına uzanma', tarif: 'Avuç içi aşağı bakacak şekilde bir elini filenin üzerine konumlandırır.', kim: 'F', kurallar: '11.4.1, 13.3.1, 14.3, 14.6.1, 23.3.2.3c', benzer: ['el-19', 'el-21', 'el-12'], zorluk: 2 },
      { id: 'el-21', no: '21', grup: 'el', ad: 'Hücum vuruşu hatası', tarif: 'El açık şekilde ön koluyla aşağı doğru bir hareket yapar (arka hat oyuncusu/libero hücumu, servise hücum, liberonun ön bölgedeki parmak pasına hücum).', kim: 'F S', kurallar: '13.3.3-13.3.6, 23.3.2.3d-e, 24.3.2.4', benzer: ['el-20', 'el-12', 'el-19'], zorluk: 2 },
      { id: 'el-22', no: '22', grup: 'el', ad: 'Rakip alana girme / alt boşluktan geçen top / ayak hatası', tarif: 'Orta çizgiyi veya ilgili çizgiyi işaret eder (rakip alana girme, alt boşluktan tamamen geçen top, servis atanın sahaya basması, servis anında oyuncunun saha dışına basması).', kim: 'F S', kurallar: '8.4.5, 11.2, 12.4.3, 23.3.2.3a-f, 24.3.2.1', benzer: ['el-14', 'el-19', 'el-13'], zorluk: 2 },
      { id: 'el-23', no: '23', grup: 'el', ad: 'Çift hata ve ralli tekrarı', tarif: 'Her iki başparmağını dikey olarak yukarı kaldırır.', kim: 'F', kurallar: '6.1.2.2, 17.2, 22.2.3.4', benzer: ['el-09', 'el-12', 'el-17'], zorluk: 1 },
      { id: 'el-24', no: '24', grup: 'el', ad: 'Temas edilmiş top', tarif: 'Bir elinin avucuyla diğer elinin dikey tutulan parmaklarını fırçalar.', kim: 'F', kurallar: '23.3.2.3b, 24.2.2', benzer: ['el-15', 'el-16', 'el-04'], zorluk: 1 },
      { id: 'el-25', no: '25', grup: 'el', ad: 'Geciktirme uyarısı / geciktirme ihtarı', tarif: 'Bileğini sarı kart (uyarı) veya kırmızı kart (ihtar) ile örter.', kim: 'F', kurallar: '15.11.3, 16.2.2, 16.2.3, 23.3.2.2', benzer: ['el-06a', 'el-06b', 'el-07'], zorluk: 2 },
      { id: 'bayrak-1', no: '1', grup: 'bayrak', ad: 'Dahil top', tarif: 'Bayrağı aşağı doğru tutar.', kurallar: '8.3, 29.2.1.1', benzer: ['bayrak-2', 'bayrak-3'], zorluk: 1 },
      { id: 'bayrak-2', no: '2', grup: 'bayrak', ad: 'Hariç top', tarif: 'Bayrağı dikey olarak kaldırır.', kurallar: '8.4.1, 29.2.1.1', benzer: ['bayrak-1', 'bayrak-3'], zorluk: 1 },
      { id: 'bayrak-3', no: '3', grup: 'bayrak', ad: 'Temas edilmiş top', tarif: 'Bayrağı kaldırır ve üst kısmına serbest elinin avucuyla dokunur.', kurallar: '29.2.1.2', benzer: ['bayrak-2', 'bayrak-4'], zorluk: 1 },
      { id: 'bayrak-4', no: '4', grup: 'bayrak', ad: 'Geçiş boşluğu hatası, yabancı cisme temas veya servis sırasında ayak hatası', tarif: 'Bayrağı başının üzerinde sallar ve antene veya ilgili çizgiye işaret eder.', kurallar: '8.4.2-8.4.4, 12.4.3, 29.2.1.3-29.2.1.7', benzer: ['bayrak-3', 'bayrak-5'], zorluk: 2 },
      { id: 'bayrak-5', no: '5', grup: 'bayrak', ad: 'Karar vermenin mümkün olmaması', tarif: 'Her iki kolunu ve elini göğsünün önünde kaldırıp çaprazlar.', kurallar: '29.2', benzer: ['bayrak-4', 'bayrak-1'], zorluk: 2 },
    ],
  };
  if (typeof module === 'object' && module.exports) module.exports = SIGNALS; else root.HKM_SIGNALS = SIGNALS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
