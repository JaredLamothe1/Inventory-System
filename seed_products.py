import requests

BASE_URL = "https://inventory-system-xf8x.onrender.com/products"

# Default values
UNIT_COST = 10.0
REORDER_THRESHOLD = 5
RESTOCK_TARGET = 15
STORAGE_SPACE = 1
VENDOR_ID = 1

CATEGORY_SALE_PRICES = {
    "Sol Remedies": 90,
    "CaSol Formulations": 100,
    "Anti Formulations": 100,
    "A Formulations": 125,
    "ALG Formulations": 200,
    "Other": 125
}

CATEGORIES = {
    "Sol Remedies": 1,
    "CaSol Formulations": 2,
    "Anti Formulations": 3,
    "A Formulations": 4,
    "ALG Formulations": 5,
    "Other": 6
}
# Full list of products categorized
product_data = {
    "Sol Remedies": [
        "AcnSol", "AddiSol (addiction)", "AdrnSol (CFS)", "AldeSol (alzheimer’s & dementia)", "AlpSol", "AppeSol (Appetite control) sugars & carbs", "ArbSol" "ArtSol",
        "AstSol asthma", "AtsmSol (autism)", "BctSol", "Br1Sol", "Br2Sol", "CalmSol (adhd symptoms)",
        "CarSol (motion sickness)", "CephaSol", "ChemSol (chemotherapy and radiation therapy)", "ClcSol (celiac)",
        "CldSol (cold symptoms, staph & strep secondary infections)", "ColchiSol (gout)", "ColiSol (intestinal colic)",
        "CompuSol (OCD)", "ConSol (concussion)", "CrdioSol (hypertension)", "CraveSol", "DandruSol",
        "DarciSol (dark circles)", "DermaSol (molluscum contagiosum)", "DiaSol (diarrhea)", "DiscuSol", "DntSol",
        "DtxSol", "EchoSol (symptoms of viral infections)", "EczSol", "EleSol (ADD)", "EnceSol (encephalitis)",
        "EntrSol (intestinal)", "EnuSol (bedwetting)", "E&Psol (Previously EstroSol)", "EpiSol (epilepsy)",
        "FemaSol", "FibroSol (fibroids)", "FlatuSol", "GastroSol", "GeoSol(radon, etc.)", "HemSol(anemia)", "HistaSol(inflammation)",
        "HpaSolhepatitis", "HydraSol", "ImmuSol (stimulate immune)", "IpcaSol", "IxoSol", "KaliSol(warts, hpv)", "KiSol",
        "KlimaSol (hot flashes, menopause)", "Lipisol (cholesterSol)", "LmSol I", "LmSol II", "LmfSol", "LPLSol (lichen planus)",
        "LScSol (lichen scherosis)", "LpsSol (lupus)", "LycoSol F", "LycoSol M", "MSol (melanin)", "MagSol (muscle sopasms & restless leg)",
        "MeniSol", "MetroSol", "MitoSol(now contains 1,2 & 3)", "MpSol (myofascial pain)", "MrgSol", "MsthnSol", "MtlSol", "MycSol", "NeurSol (anxiety)",
        "NeutraSol (manic depressive)", "NrvSol (nerves)", "OcSol", "OligoSol (trace elements absorption & utilization)", "OnySol (nails)", "Optisol(vision/glaucoma/cataracts)",
        "ostSol F", "OstSol M", "OtiSol", "OxaSol", "PanSol (InsuSol) (diabetes)", "ParaSol", "ParkiSol", "PhobSol",
        "PlasmaSol", "PnmoSol", "PrctSol (hemorrhoids)", "PrstSol (health of the prostate)", "PsrSol", "RejuveSol F (convalescence)","RejuveSol M (convalescence)",
        "ResiSol", "RetroSol (forgetfulness, momeory)", "RevitaSol (skin Integrity)", "RogaSol (hair integrity)", "RoseSol", "ScaSol", "SclrSol (MS)", "SeroSol (depression)",
        "SlimSol (appetite in general)", "SnSol (sinus & nose)", "SnoSol (snoring)", "SomniSol (sleep irregularities)", "SorSol", "StreSol (PTSD) amygdala", "StonSol (gallbladder/kidney stones)",
        "surgiSol(p/s)", "SympaSol", "TSol previouslt called ThyroSol (stim thyroid)", "TemaSol (TMJ)", "TinniSol (tinnitus)", "TndSol", "TourSol (tourette)", "TravSol", "TstSol (previouslt named TestoSol)",
        "TxoSol (behavior problems/childish behavior)", "UriSol(UTI -bactieria/viruses/bladder)", "VCCSol P (preventative)", "VCCSol T(treatment)", "VerSol", "VertiSol(vertigo)", "VitaSol",
        "VitiSol", "VrSol 23", "VrSol SZ (simplex and zoster)", "XeroSol (dry mouth/dry eyes)", "ZincuSol (restless leg)"
    ],
    "CaSol Formulations": [
        "BraCaSol (brain)", "CaSol", "CerCaSol (cervix)", "EsCaSol (esophageal, gastric)", "HpaCaSol(liver)", "KiCaSol (kidney)", "LkiCaSol", "LuCaSol(lung, mesothelioma)",
        "MaCaSol (breast)", "MeCaSol (skin) previouslt labeled MelaCaSol", "MyeolCaSol (blood)", "OsCaSol (bone)", "OvCaSol (ovarioan)", "PanCaSol (pancreas) currently pancreasol",
        "ReCaSol (colon, rectal)", "UteCaSol"
    ],
    "Anti Formulations": [
        "AcnSol X", "AddiSol X", "AdrnSol X", "AlpSol X", "ArtSol X", "AtsmSol X", "AtxSol X", "AutoSol X", "ClcSol X (celiac)", "CoilSol X", "CompuSol X",
        "DemSol X", "EczSol X", "EleSol X","E&PSol X", "EpiSol X", "GastroSol X", "HPASol X", "HydraSolX", 
        "LmSol X", "LPLSol X", "LScSol X", "LpsSol X", "MarSol X", "MetroSol X", "MPSol X", "MsthnSol X",
        "NrvSol X", "NeutraSol X", "PanSol X", "ParkiSol X", "PmfSol X", "PcoSol X", "PSRSol X", "SclrSol X",
        "SeroSol X", "SpirSol X", "TstSol X", "TinniSol X", "TourSol X", "TSol X", "VitiSol X", "XeroSol X"
    ],
    "A Formulations": [
        "AlcSol A", "BondSol A", "IbeeSol XA", "MtlSol A"
    ],
    "ALG Formulations": [
        "AllrSol ALG", "AlmSol ALG", "BBYSol ALG", "BeefSol ALG", "CanSol ALG", "ChxSol ALG", "CitruSol ALG",
        "ClcSol ALG", "DyeSol ALG", "EgSol ALG", "Equesol ALG", "FelSol ALG", "GalSol ALG", "Hrmsol ALG",
        "MlkSol ALG", "MolSol ALG", "OctoSol ALG", "PrkSol ALG", "PreSol I ALG", "PreSol II ALG", "SubSol ALG",
        "SugSol ALG", "TmtSol ALG", "TurSol ALG"
    ],
    "Other": [
        "McSol", "McSol X"
    ]
}



for category_name, product_names in product_data.items():
    category_id = CATEGORIES[category_name]
    sale_price = CATEGORY_SALE_PRICES[category_name]

    for name in product_names:
        payload = {
            "name": name.strip(),
            "unit_cost": UNIT_COST,
            "sale_price": sale_price,
            "reorder_threshold": REORDER_THRESHOLD,
            "restock_target": RESTOCK_TARGET,
            "storage_space": STORAGE_SPACE,
            "vendor_id": VENDOR_ID,
            "category_id": category_id,
            "quantity_in_stock": 0
        }

        try:
            res = requests.post(BASE_URL, json=payload)
            if res.status_code == 200:
                print(f"✅ {name} added")
            elif res.status_code == 400 and "already exists" in res.text:
                print(f"⚠️ {name} already exists")
            else:
                print(f"❌ {name}: {res.status_code} - {res.text}")
        except Exception as e:
            print(f"🔥 Failed to add {name}: {e}")