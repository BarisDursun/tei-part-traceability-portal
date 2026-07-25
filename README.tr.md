*[English](README.md) | [Türkçe](README.tr.md)*

# ✈️ TEI Parça İzlenebilirlik Portalı

**Havacılık/uçak parçalarının üretim geçmişini, kalite kontrolünü ve otomatik uyum (compliance) uyarılarını yöneten uçtan uca bir SAP Fiori / ABAP uygulaması.**

> Kritik bir motor veya uçak parçası verildiğinde, saniyeler içinde cevap ver: *"Bu parçayı hangi tezgah üretti, hangi operatör çalıştırdı, hangi CMM cihazı ölçtü ve tüm ölçümler tolerans içinde miydi?"*

<!--
  📸 EKRAN GÖRÜNTÜSÜ — Ana görsel
  Parça listesi (donut chart ile birlikte) ekran görüntüsünü buraya ekle.
  Örnek: ![Parça Listesi](docs/images/PLACEHOLDER-list-report.png)
-->

![Parça Listesi](docs/images/PLACEHOLDER-list-report.png)

---

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [Öne Çıkan Özellikler](#öne-çıkan-özellikler)
- [Mimari](#mimari)
  - [Veri Modeli](#veri-modeli)
  - [OData Servisi](#odata-servisi)
  - [İş Mantığı: Otomatik Tolerans Doğrulama](#iş-mantığı-otomatik-tolerans-doğrulama)
  - [Onay / Red İş Akışı ve Durum Roll-Up'ı](#onay--red-iş-akışı-ve-durum-roll-upı)
  - [CDS View: Birleşik Üretim Zaman Çizelgesi](#cds-view-birleşik-üretim-zaman-çizelgesi)
  - [Frontend (SAP Fiori Elements)](#frontend-sap-fiori-elements)
- [Ekran Görüntüleri](#ekran-görüntüleri)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Proje Yapısı](#proje-yapısı)
- [Başlarken](#başlarken)
- [Kullanım Senaryoları](#kullanım-senaryoları)
- [Bilinen Kısıtlar](#bilinen-kısıtlar)
- [Yol Haritası](#yol-haritası)

---

## Genel Bakış

Havacılık ve savunma sanayiinde her kritik parçanın **dijital bir kimlik kartı** olması gerekir: hammadde girişinden nihai kalite onayına kadar başına gelen her şeyin eksiksiz, denetlenebilir bir kaydı. Bir parça yıllar sonra sahada arıza yaparsa, mühendislerin o parçanın tüm üretim ve muayene geçmişini anında geriye doğru izleyebilmesi gerekir.

**TEI Parça İzlenebilirlik Portalı**, tam olarak bu sistemin SAP'nin standart kurumsal teknoloji yığını üzerine kurulmuş bir demo/portföy uygulamasıdır:

- Backend servis katmanı için **SAP Gateway (OData V2)**
- Nesne yönelimli (OOP) bir kalite doğrulama motoru içeren **ABAP**
- Birleşik, tablolar arası raporlama için **CDS View**
- Sıfır özel kod gerektiren, annotation tabanlı bir arayüz için **SAP Fiori Elements**

Bu sadece bir CRUD uygulaması değil — gerçek bir **iş kuralı uygulama döngüsünü** gösteriyor: bir kalite mühendisi bir ölçüm giriyor, sistem bunu mühendislik toleranslarına göre otomatik olarak doğruluyor, ve eğer tolerans dışındaysa parça otomatik olarak işaretleniyor, reddediliyor, ve sorumlu kalite yöneticisine e-posta ile bildirim gidiyor — arada hiçbir manuel adım olmadan.

---

## Öne Çıkan Özellikler

| Özellik | Açıklama |
|---|---|
| 🔍 **Tam Parça İzlenebilirliği** | Her parçanın hammadde, işleme operasyonları ve kalite muayene sonuçları tek bir yerden birbirine bağlı ve sorgulanabilir. |
| 📊 **Analitik Gösterge Paneli** | Parçaların kritiklik seviyesine (A/B/C) göre gerçek dağılımını gösteren donut chart'lı liste ekranı — sunucu tarafında gerçek `GROUP BY` ile hesaplanıyor. |
| ✅ **Onay / Red İş Akışı** | Parçalar, tekil operasyonlar ve tekil kalite ölçümleri birbirinden bağımsız olarak onaylanıp reddedilebiliyor. |
| 🔗 **Otomatik Durum Roll-Up'ı** | Herhangi bir operasyon veya kalite ölçümünün reddedilmesi, **üst parçayı** otomatik olarak reddedilmiş işaretliyor — manuel takip gerekmiyor. |
| 🛑 **Otomatik Tolerans Doğrulama** | Yeni girilen kalite ölçümleri, özel bir ABAP OOP sınıfı tarafından `Nominal ± Tolerans` aralığına karşı otomatik kontrol ediliyor. Tolerans dışı girişler otomatik olarak "Fail" (Başarısız) işaretleniyor. |
| 📧 **Otomatik E-posta Uyarısı** | Tolerans dışı bir ölçüm, `CL_BCS` (SAP Business Communication Service) üzerinden kalite yöneticisine otomatik e-posta gönderiyor — sorunu ilk fark eden bir insan olması gerekmiyor. |
| 🧩 **CDS Tabanlı Birleşik Görünüm** | Operasyon geçmişi ve kalite sonuçlarını, her parça için tek bir kronolojik olay akışında birleştiren bir CDS View (kendi OData servisi olarak yayınlanmış) — timeline tarzı raporlamanın temeli. |
| ♻️ **Canlı Veri Yenileme** | Arayüz, backend ile periyodik olarak yeniden senkronize oluyor — böylece action'lar aracılığıyla yapılan değişiklikler (Fiori Elements'te doğal olarak kardeş bölümlere yansımayan) manuel sayfa yenilemeye gerek kalmadan görünür hale geliyor. |

---

## Mimari

### Veri Modeli

Sistemin omurgasını üç özel Z-tablosu oluşturuyor:

```
ZTEI_PART_MASTER (1)────────────────┬───────────────(N) ZTEI_OPER_LOG
  PART_ID (key)                     │                     PART_ID (key)
  PART_NO                           │                     OPERATION_SEQ (key)
  DRAWING_NO                        │                     OPERATION_TYPE
  PART_DESCRIPTION                  │                     MACHINE_ID
  MATERIAL_SPEC                     │                     OPERATOR_ID
  CRITICALITY_LEVEL (A/B/C)         │                     START_DATE / END_DATE
  STATUS (OK / RJ)                  │                     OPER_RESULT (P/F)
  CREATION_DATE / CREATED_BY        │
                                    └───────────────(N) ZTEI_QUAL_RESULT
                                                          PART_ID (key)
                                                          TEST_SEQ (key)
                                                          DIMENSION_NAME
                                                          NOMINAL_VALUE
                                                          TOLERANCE_PLUS / MINUS
                                                          ACTUAL_VALUE
                                                          QUAL_RESULT (P/F)
                                                          CMM_DEVICE_ID
                                                          INSPECTOR_ID
                                                          MEASUREMENT_DATE
```

Her parçanın (örn. bir türbin kanadı ya da kompresör diski) kendi operasyon geçmişi ve kendi kalite muayene sonuçlarıyla **bire-çok** ilişkisi var.

<!--
  📸 EKRAN GÖRÜNTÜSÜ — SE11/SE16 tablo yapısı ya da verisi
  Örnek: ![SE11'de Z Tabloları](docs/images/PLACEHOLDER-se11-tables.png)
-->

### OData Servisi

`ZTEI_PART_SRV_SRV` servisi (OData V2, klasik SAP Gateway / SEGW, MPC_EXT + DPC_EXT) şunları dışarı açıyor:

- **Entity set'ler:** `PartMasterSet`, `OperLogSet`, `QualStatusSet`
- **Navigasyon:** `PartMasterSet → OperLogs` ve `PartMasterSet → QualResults` (1:N ilişkiler, sunucu tarafında `PartId`'ye göre doğru filtreleniyor)
- **Özel bağlı action'lar:**
  | Action | Bağlı Olduğu Entity | Amaç |
  |---|---|---|
  | `ApprovePart` / `RejectPart` | PartMaster | Parça seviyesinde manuel onay |
  | `ApproveOperation` / `RejectOperation` | OperLog | Tekil bir operasyon adımında manuel onay |
  | `ApproveQuality` / `RejectQuality` | QualStatus | Tekil bir kalite ölçümünde manuel onay |
  | `SubmitQualityMeasurement` | PartMaster | **Yeni** bir kalite ölçümü girme — otomatik doğrulamayı tetikler (aşağıya bak) |

<!--
  📸 EKRAN GÖRÜNTÜSÜ — SEGW / ADT service builder ya da metadata görünümü
  Örnek: ![OData Servis Metadata](docs/images/PLACEHOLDER-odata-metadata.png)
-->

### İş Mantığı: Otomatik Tolerans Doğrulama

Bu, uygulamanın en önemli parçası. Gerçek mühendislik/kalite mantığını iki ABAP OOP sınıfı uyguluyor:

**`ZCL_TEI_QUALITY_VALIDATOR`** — yan etkisi olmayan, saf doğrulama mantığı:

```abap
CLASS zcl_tei_quality_validator DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    TYPES: BEGIN OF ty_validation_result,
             is_within_tolerance TYPE abap_bool,
             deviation           TYPE ztei_qual_result-actual_value,
           END OF ty_validation_result.

    CLASS-METHODS check_tolerance
      IMPORTING
        iv_nominal_value   TYPE ztei_qual_result-nominal_value
        iv_tolerance_plus  TYPE ztei_qual_result-tolerance_plus
        iv_tolerance_minus TYPE ztei_qual_result-tolerance_minus
        iv_actual_value    TYPE ztei_qual_result-actual_value
      RETURNING
        VALUE(rs_result)   TYPE ty_validation_result.
ENDCLASS.
```

**`ZCL_TEI_QUALITY_NOTIFIER`** — bir ölçüm başarısız olduğunda, hiçbir manuel tetikleme gerekmeden `CL_BCS` üzerinden e-posta gönderiyor.

<!--
  📸 EKRAN GÖRÜNTÜSÜ — ZCL_TEI_QUALITY_VALIDATOR / ZCL_TEI_QUALITY_NOTIFIER sınıflarının SE24/ADT görünümü
  Örnek: ![ABAP OOP Sınıfları](docs/images/PLACEHOLDER-oop-classes.png)
-->

`SubmitQualityMeasurement` action'ı tarafından tetiklenen akış:

```
Kalite mühendisi yeni bir ölçüm girer (Actual Value)
              │
              ▼
  ZCL_TEI_QUALITY_VALIDATOR, Actual değerini Nominal ± Tolerans ile karşılaştırır
              │
    ┌─────────┴─────────┐
    ▼                    ▼
 Tolerans içinde     Tolerans dışında
    │                    │
 Sonuç = 'P'         Sonuç = 'F'
                          │
                          ├─► Parça durumu otomatik olarak 'RJ' (Reddedildi) olur
                          └─► ZCL_TEI_QUALITY_NOTIFIER, kalite yöneticisine
                              otomatik olarak uyarı e-postası gönderir
```

<!--
  📸 EKRAN GÖRÜNTÜSÜ — Fiori'de "Yeni Ölçüm Gir" formu ve sonuç olarak oluşan Fail satırı
  Örnek: ![Tolerans İhlali Akışı](docs/images/PLACEHOLDER-tolerance-check.png)
-->

### Onay / Red İş Akışı ve Durum Roll-Up'ı

Onaylar üç seviyede gerçekleşiyor — parça, operasyon ve kalite ölçümü — ve bunlar bilerek birbirinden bağımsız: otomatik doğrulama objektif bir *sistem* sonucunu işaretlerken, insan onayı/reddi bir **kalite mühendisinin incelemesini** temsil ediyor — bu inceleme sistemin bulgusunu onaylayabilir ya da bilinçli olarak geçersiz kılabilir (gerçekçi bir "mühendislik sapma onayı" senaryosu).

Otomatikleştirilen tek kural şu: **herhangi bir alt kaydın (bir operasyon ya da kalite ölçümü) reddedilmesi, anında üst parçanın durumunu Reddedildi'ye çekiyor.** Bu doğrudan OData action handler'ında (`DPC_EXT`) uygulanıyor, yani reddedilmiş bir alt kaydın "OK" görünen bir parçanın içinde saklanması mümkün değil.

<!--
  📸 EKRAN GÖRÜNTÜSÜ — Kırmızı durumlu reddedilmiş bir parça ve onun reddedilmiş alt satırı
  Örnek: ![Roll-up Örneği](docs/images/PLACEHOLDER-rollup.png)
-->

### CDS View: Birleşik Üretim Zaman Çizelgesi

Bir parçanın tüm geçmişini *iki ayrı tablo* (operasyonlar ve kalite kontrolleri) olarak modellemek işe yarıyor, ama gerçek bir kronolojik resim vermiyor. Özel bir CDS View, operasyonları ve kalite kontrollerini ortak bir zaman çizelgesinde genel "olaylar" olarak ele alan bir `UNION` ile bunu çözüyor:

```sql
@AbapCatalog.sqlViewName: 'ZTEIPARTTRACV'
@AbapCatalog.compiler.compareFilter: true
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'TEI Part Full Traceability - Unified Event Timeline'
@OData.publish: true
define view ZTEI_I_PART_TRACE_EVT as
  select from ztei_oper_log as oper
    inner join ztei_part_master as part on part.part_id = oper.part_id
{
  key part.part_id                          as PartId,
  key oper.operation_seq                    as EventSeq,
      part.part_no                          as PartNo,
      cast( 'OPERATION' as abap.char( 10 ) ) as EventType,
      cast( oper.operation_type as abap.char( 50 ) ) as EventDescription,
      oper.machine_id                        as ResourceId,
      oper.operator_id                       as PersonId,
      oper.start_date                        as EventDate,
      cast( oper.oper_result as abap.char( 1 ) ) as EventResult
}
union
  select from ztei_qual_result as qual
    inner join ztei_part_master as part on part.part_id = qual.part_id
{
  key part.part_id                          as PartId,
  key qual.test_seq                         as EventSeq,
      part.part_no                          as PartNo,
      cast( 'QUALITY' as abap.char( 10 ) )    as EventType,
      cast( qual.dimension_name as abap.char( 50 ) ) as EventDescription,
      qual.cmm_device_id                     as ResourceId,
      qual.inspector_id                      as PersonId,
      qual.measurement_date                  as EventDate,
      cast( qual.qual_result as abap.char( 1 ) ) as EventResult
}
```

Bu view, `@OData.publish: true` ile doğrudan kendi OData servisi (`ZTEI_I_PART_TRACE_EVT_CDS`) olarak yayınlanıyor — elle MPC/DPC sınıfı yazmaya gerek kalmadan — ve herhangi bir istemciden bağımsız olarak tüketilebiliyor (SAP Gateway Client / düz OData `$metadata` ve entity-set çağrılarıyla doğrulandı).

<!--
  📸 EKRAN GÖRÜNTÜSÜ — CDS view'in ADT Data Preview'ı ya da Gateway Client test sonucu
  Örnek: ![CDS View Data Preview](docs/images/PLACEHOLDER-cds-preview.png)
-->

### Frontend (SAP Fiori Elements)

Arayüz bir **SAP Fiori Elements v2** uygulaması (SAPUI5 1.150, `sap_horizon` teması) — yani arayüzün neredeyse tamamı elle yazılmış ekranlar değil, OData metadata + annotation'lardan otomatik üretiliyor:

- **Analytical List Page**: parça listesi + kritiklik dağılımı donut chart'ı
- **Object Page**: General Information, Operation History ve Quality Results, üç annotation tabanlı bölüm olarak
- `webapp/annotations/annotation.xml` her şeyi yönetiyor: alan etiketleri, liste kolonları, chart tanımı, action butonları ve Object Page facet'leri
- Küçük bir `Component.js` uzantısı, OData modelini periyodik olarak yeniden senkronize ediyor — böylece bir alt entity üzerindeki action'larla yapılan değişiklikler (Fiori Elements'in üst listeye otomatik yansıtmadığı) manuel yenilemeye gerek kalmadan görünür oluyor.

<!--
  📸 EKRAN GÖRÜNTÜSÜ — 3 bölümün de göründüğü Object Page
  Örnek: ![Object Page](docs/images/PLACEHOLDER-object-page.png)
-->

---

## Ekran Görüntüleri

Ekran görüntüleri bu doküman boyunca ilgili bölümün hemen altında yer alıyor: en üstte parça listesi (hero görsel), [Mimari](#mimari) altında SE11/SE16 tabloları ve SEGW/ADT metadata, [İş Mantığı](#iş-mantığı-otomatik-tolerans-doğrulama) altında OOP sınıfları ve tolerans ihlali akışı, [Onay/Red İş Akışı](#onay--red-iş-akışı-ve-durum-roll-upı) altında roll-up örneği, [CDS View](#cds-view-birleşik-üretim-zaman-çizelgesi) altında CDS preview, [Frontend](#frontend-sap-fiori-elements) altında tam Object Page, ve [Bilinen Kısıtlar](#bilinen-kısıtlar) altında SOST'ta kuyruğa alınmış uyarı e-postası. Her `docs/images/PLACEHOLDER-*.png` referansını aynı isimle kendi ekran görüntünle değiştirmen yeterli.

---

## Teknoloji Yığını

**Backend**
- SAP NetWeaver AS ABAP (klasik SAP Gateway / SEGW)
- OData V2 (`ZTEI_PART_SRV_SRV`)
- ABAP OOP (özel doğrulama ve bildirim sınıfları)
- CDS View'lar (`@OData.publish`)
- E-posta için `CL_BCS` (SAP Business Communication Service)

**Frontend**
- SAP Fiori Elements v2 (Analytical List Page + Object Page şablonları)
- SAPUI5 / OpenUI5 1.150.0
- OData V2 annotation'ları (`UI.LineItem`, `UI.FieldGroup`, `UI.Facets`, `UI.Chart`, `UI.DataFieldForAction`)
- `@sap/ux-ui5-tooling`, `@ui5/cli`

---

## Proje Yapısı

```
zteiparttrace/
├── webapp/
│   ├── Component.js              # App component + periyodik model yenileme
│   ├── index.html                # Bağımsız giriş noktası
│   ├── manifest.json             # Uygulama tanımı: veri kaynakları, modeller, FE sayfa config'i
│   ├── annotations/
│   │   └── annotation.xml        # Tüm UI annotation'ları (etiketler, chart, action'lar, facet'ler)
│   ├── i18n/
│   │   └── i18n.properties
│   └── localService/
│       └── mainService/
│           └── metadata.xml      # Yerel OData metadata (geliştirme sırasında fiori-tools kullanır)
├── package.json
├── ui5.yaml                      # Gerçek backend proxy config'i
├── ui5-local.yaml                # Yerel UI5 framework config'i
└── ui5-mock.yaml                 # Mock server config'i (sadece geliştirme, varsayılan olarak veri yok)
```

> ABAP backend'i (Z-tablolar, MPC_EXT/DPC_EXT sınıfları, OOP sınıfları, CDS view) bu repoda değil, bağlı olduğu SAP sisteminde yaşıyor — referans için yukarıdaki bölümlerde belgelendi.

---

## Başlarken

**Ön Koşullar**
- `ZTEI_PART_SRV_SRV` OData servisi aktif ve yukarıda anlatılan backend nesneleri uygulanmış bir SAP sistemine erişim
- Node.js (LTS) ve npm

**Gerçek SAP backend'ine karşı çalıştırma**

```bash
npm install
npm start
```

Bu, OData çağrılarını `ui5.yaml`'da tanımlı backend'e proxy'ler (varsayılan olarak `http://vhcalnplci:8000` — kendi sistemine göre güncelle). Tarayıcın ilk yüklemede SAP giriş bilgilerini soracaktır.

> Bu proje bilinçli olarak **sadece gerçek bir backend'e karşı** çalışacak şekilde ayarlandı — hiç mock veri dahil edilmedi (bkz. [Bilinen Kısıtlar](#bilinen-kısıtlar)).

---

## Kullanım Senaryoları

- **Havacılık / savunma üretimi**: hammaddeden nihai muayeneye kadar uçuş-kritik parçaların (motor kanatları, diskler, şaftlar) tam soy ağacı (genealogy).
- **Kalite yönetimi demosu**: tolerans dışı ölçümler için eksiksiz, kapalı-döngü bir "tespit et → durdur → bildir → incele" akışını gösteriyor — havacılığın çok ötesinde uygulanabilir bir desen (otomotiv, tıbbi cihazlar, herhangi bir regüle üretim ortamı).
- **SAP Fiori Elements / CDS öğrenme referansı**: klasik OData V2 geliştirmesinin (MPC_EXT/DPC_EXT, bağlı action'lar, sunucu tarafı filtrelemeli navigasyon) modern bir `@OData.publish` CDS View ile birleştirildiği kompakt, gerçek bir örnek.
- **Portföy projesi**: ABAP OOP, OData servis tasarımı, CDS View'lar ve Fiori Elements annotation tabanlı UI geliştirmesini tek, bağlantılı bir örnekte gösteriyor.

---

## Bilinen Kısıtlar

- **E-posta gönderimi SAPconnect (SCOT) yapılandırmasına bağlı.** Bildirim mantığı (`ZCL_TEI_QUALITY_NOTIFIER`) uyarı e-postasını doğru şekilde oluşturup kuyruğa alıyor (`SOST`'ta doğrulanabilir), ama gerçek internet teslimatı `SCOT`'ta çalışan bir SMTP relay node'u gerektiriyor. İzole/deneme sistemlerinde (örn. geliştirme sırasında kullanılan SAP NetWeaver deneme sistemi), bu kuyruk adımı *Internal Routing Error* ile başarısız olabilir — bu bir altyapı/Basis yapılandırma eksikliği, uygulama hatası değil.

  <!--
    📸 EKRAN GÖRÜNTÜSÜ — SOST'ta kuyruğa alınmış uyarı e-postası
    Örnek: ![SOST Kuyruğa Alınmış Uyarı](docs/images/PLACEHOLDER-sost-queue.png)
  -->

- **Ana uygulamada gerçek bir "Timeline" bileşeni yok.** Fiori Elements Object Page'e gömülü gerçek bir `sap.m.Timeline` kontrolü denendi, ama bu SAPUI5 versiyonunun Smart Template implementasyonundaki dokümante edilmemiş extensibility kısıtlarına takıldı. Kronolojik veri bugün iki ayrı tablo (Operation History, Quality Results) üzerinden ve gelecekte bir timeline arayüzü tarafından tüketilmeye hazır, CDS tabanlı birleşik olay servisi üzerinden mevcut.
- **Hiç mock veri dahil edilmedi.** Uygulama bilinçli olarak sadece canlı bir backend'e karşı çalışacak şekilde yapılandırıldı (bkz. [Başlarken](#başlarken)).

---

## Yol Haritası

- [ ] CDS tabanlı birleşik olay görünümünü (`ZTEI_I_PART_TRACE_EVT_CDS`) gerçek bir `sap.m.Timeline` görselleştirmesine bağlamak
- [ ] Onay/Red/Gönder action'larına yetkilendirme kontrolü (`AUTHORITY-CHECK`) eklemek
- [ ] Başarısız ölçümlerin manuel override'ları için bir "sapma onayı / mühendislik feragati" gerekçe alanı eklemek
- [ ] Hibrit bir entegrasyon yolu keşfetmek (harici kalite cihazı verisinin bir mikroservis aracılığıyla OData'ya aktarılması)

---

<p align="center">Uygulamalı bir SAP Fiori / ABAP öğrenme ve portföy projesi olarak geliştirilmiştir.</p>
