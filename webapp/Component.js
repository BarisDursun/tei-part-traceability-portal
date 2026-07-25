sap.ui.define(
    ["sap/suite/ui/generic/template/lib/AppComponent"],
    function (Component) {
        "use strict";

        return Component.extend("com.tei.zteiparttrace.Component", {
            metadata: {
                manifest: "json"
            },

            init: function () {
                Component.prototype.init.apply(this, arguments);

                var oModel = this.getModel();
                if (oModel) {
                    // Bazi Gateway/ICF konfigurasyonlari GET isteklerini HTTP
                    // seviyesinde cache'leyebiliyor; bu, model refresh() cagirsak
                    // bile sunucudan eski veri donmesine yol acar. Cache'i devre disi
                    // birakiyoruz ki her refresh gercekten sunucuya gitsin.
                    oModel.setHeaders({
                        "Cache-Control": "no-cache, no-store, must-revalidate",
                        "Pragma": "no-cache"
                    });
                }

                var sComponentName = this.getMetadata().getName();

                // OperLog/QualStatus seviyesindeki Approve/Reject action'lari,
                // ztei_part_master tablosunu backend'de (roll-up ile) guncelliyor,
                // ama bu action'lar geriye sadece OperLog/QualStatus donduruyor -
                // Fiori'nin PartMaster listesi bu degisiklikten hic haberdar
                // olmuyor ve F5 atilana kadar eski (Status/Criticality) veriyi
                // gostermeye devam ediyor.
                //
                // Sayfa gecisi event'lerini (hash degisikligi, route match vb.)
                // yakalamaya calismak yerine kisa arayla modeli sunucudan yeniden
                // cekiyoruz - hangi event'in ne zaman ve hangi instance uzerinde
                // ateslendigiyle ugrasmaya gerek kalmadan, birkac saniye icinde
                // tutarli hale gelmeyi garanti eden basit ve saglam bir yontem.
                // Component her cagrida registry'den TAZE bulunuyor, bu yuzden
                // FLP'nin uygulamayi arka planda yeniden kurmus olmasi (birden
                // fazla instance) sorun teskil etmiyor.
                setInterval(function () {
                    var oLiveComponent;
                    sap.ui.core.Component.registry.forEach(function (c) {
                        if (c.getMetadata && c.getMetadata().getName() === sComponentName) {
                            oLiveComponent = c;
                        }
                    });
                    var oCurrentModel = oLiveComponent && oLiveComponent.getModel();
                    if (oCurrentModel) {
                        oCurrentModel.refresh(true);
                    }
                }, 5000);
            }
        });
    }
);
