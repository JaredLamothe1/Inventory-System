"""
Seed products via the HTTP API.

Windows CMD:
    set API_BASE=http://localhost:8000
    set API_USER=admin
    set API_PASS=yourpass
    python seed_products.py

PowerShell:
    $env:API_BASE = "http://localhost:8000"
    $env:API_USER = "admin"
    $env:API_PASS = "yourpass"
    python seed_products.py

Or set API_TOKEN if you already copied a JWT.
"""

import os
import sys
import requests
from typing import Dict, List

# ---------------- CONFIG ----------------
API_BASE = os.getenv("API_BASE", "http://localhost:8000")
LOGIN_PATHS = ["/auth/login", "/auth/token"]  # try in this order
CATEGORIES_URL = f"{API_BASE}/categories/"
PRODUCTS_URL = f"{API_BASE}/products/"

API_USER = os.getenv("API_USER")
API_PASS = os.getenv("API_PASS")
API_TOKEN = os.getenv("API_TOKEN", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTc1MzMxMTczMn0.AgZhOUVKLAVGeSVy7cUR969KFMtAt5XOKWB659rQCxU")  # optional preset JWT

# Defaults for fields we’re hiding in the UI
PURCHASE_COST_DEFAULT = 10.0          # unit_cost (what you pay vendor)
REORDER_THRESHOLD_DEFAULT = 0
RESTOCK_TARGET_DEFAULT = 0
STORAGE_SPACE_DEFAULT = None
INITIAL_QTY = 0

# Category -> default SALE price (to customer)
CATEGORY_SALE_PRICES: Dict[str, float] = {
    "Sol Remedies": 90,
    "CaSol Formulations": 100,
    "Anti Formulations": 100,
    "A Formulations": 125,
    "ALG Formulations": 200,
    "Other": 125,
}

# Category -> product names  (PASTE YOUR FULL LIST HERE)
PRODUCT_DATA: Dict[str, List[str]] = {
    "Sol Remedies": [
        "AcnSol", "AddiSol (addiction)", "AdrnSol (CFS)", "AldeSol (alzheimer’s & dementia)", "AlpSol",
        "AppeSol (Appetite control) sugars & carbs", "ArbSol", "ArtSol", "AstSol asthma", "AtsmSol (autism)",
        "BctSol", "Br1Sol", "Br2Sol", "CalmSol (adhd symptoms)", "CarSol (motion sickness)", "CephaSol",
        "ChemSol (chemotherapy and radiation therapy)", "ClcSol (celiac)", "CldSol (cold symptoms, staph & strep secondary infections)",
        "ColchiSol (gout)", "ColiSol (intestinal colic)", "CompuSol (OCD)", "ConSol (concussion)", "CrdioSol (hypertension)",
        "CraveSol", "DandruSol", "DarciSol (dark circles)", "DermaSol (molluscum contagiosum)", "DiaSol (diarrhea)",
        "DiscuSol", "DntSol", "DtxSol", "EchoSol (symptoms of viral infections)", "EczSol", "EleSol (ADD)",
        "EnceSol (encephalitis)", "EntrSol (intestinal)", "EnuSol (bedwetting)", "E&Psol (Previously EstroSol)",
        "EpiSol (epilepsy)", "FemaSol", "FibroSol (fibroids)", "FlatuSol", "GastroSol", "GeoSol(radon, etc.)",
        "HemSol(anemia)", "HistaSol(inflammation)", "HpaSolhepatitis", "HydraSol", "ImmuSol (stimulate immune)",
        "IpcaSol", "IxoSol", "KaliSol(warts, hpv)", "KiSol", "KlimaSol (hot flashes, menopause)",
        "Lipisol (cholesterSol)", "LmSol I", "LmSol II", "LmfSol", "LPLSol (lichen planus)",
        "LScSol (lichen scherosis)", "LpsSol (lupus)", "LycoSol F", "LycoSol M", "MSol (melanin)",
        "MagSol (muscle sopasms & restless leg)", "MeniSol", "MetroSol", "MitoSol(now contains 1,2 & 3)",
        "MpSol (myofascial pain)", "MrgSol", "MsthnSol", "MtlSol", "MycSol", "NeurSol (anxiety)",
        "NeutraSol (manic depressive)", "NrvSol (nerves)", "OcSol", "OligoSol (trace elements absorption & utilization)",
        "OnySol (nails)", "Optisol(vision/glaucoma/cataracts)", "ostSol F", "OstSol M", "OtiSol", "OxaSol",
        "PanSol (InsuSol) (diabetes)", "ParaSol", "ParkiSol", "PhobSol", "PlasmaSol", "PnmoSol",
        "PrctSol (hemorrhoids)", "PrstSol (health of the prostate)", "PsrSol", "RejuveSol F (convalescence)",
        "RejuveSol M (convalescence)", "ResiSol", "RetroSol (forgetfulness, momeory)", "RevitaSol (skin Integrity)",
        "RogaSol (hair integrity)", "RoseSol", "ScaSol", "SclrSol (MS)", "SeroSol (depression)",
        "SlimSol (appetite in general)", "SnSol (sinus & nose)", "SnoSol (snoring)", "SomniSol (sleep irregularities)",
        "SorSol", "StreSol (PTSD) amygdala", "StonSol (gallbladder/kidney stones)", "surgiSol(p/s)", "SympaSol",
        "TSol previouslt called ThyroSol (stim thyroid)", "TemaSol (TMJ)", "TinniSol (tinnitus)", "TndSol",
        "TourSol (tourette)", "TravSol", "TstSol (previouslt named TestoSol)", "TxoSol (behavior problems/childish behavior)",
        "UriSol(UTI -bactieria/viruses/bladder)", "VCCSol P (preventative)", "VCCSol T(treatment)", "VerSol",
        "VertiSol(vertigo)", "VitaSol", "VitiSol", "VrSol 23", "VrSol SZ (simplex and zoster)",
        "XeroSol (dry mouth/dry eyes)", "ZincuSol (restless leg)"
    ],
    "CaSol Formulations": [
        "BraCaSol (brain)", "CaSol", "CerCaSol (cervix)", "EsCaSol (esophageal, gastric)", "HpaCaSol(liver)",
        "KiCaSol (kidney)", "LkiCaSol", "LuCaSol(lung, mesothelioma)", "MaCaSol (breast)",
        "MeCaSol (skin) previouslt labeled MelaCaSol", "MyeolCaSol (blood)", "OsCaSol (bone)",
        "OvCaSol (ovarioan)", "PanCaSol (pancreas) currently pancreasol", "ReCaSol (colon, rectal)", "UteCaSol"
    ],
    "Anti Formulations": [
        "AcnSol X", "AddiSol X", "AdrnSol X", "AlpSol X", "ArtSol X", "AtsmSol X", "AtxSol X", "AutoSol X",
        "ClcSol X (celiac)", "CoilSol X", "CompuSol X", "DemSol X", "EczSol X", "EleSol X", "E&PSol X", "EpiSol X",
        "GastroSol X", "HPASol X", "HydraSolX", "LmSol X", "LPLSol X", "LScSol X", "LpsSol X", "MarSol X",
        "MetroSol X", "MPSol X", "MsthnSol X", "NrvSol X", "NeutraSol X", "PanSol X", "ParkiSol X", "PmfSol X",
        "PcoSol X", "PSRSol X", "SclrSol X", "SeroSol X", "SpirSol X", "TstSol X", "TinniSol X", "TourSol X",
        "TSol X", "VitiSol X", "XeroSol X"
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
    ],
}

# --------------- AUTH -------------------
def build_session() -> requests.Session:
    """
    Return a Session with auth (Bearer or cookies). Tries TOKEN first, then login.
    """
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})

    # Already have a token?
    if API_TOKEN:
        s.headers["Authorization"] = f"Bearer {API_TOKEN}"
        return s

    if not API_USER or not API_PASS:
        print("No API_TOKEN and no API_USER/API_PASS provided. Set env vars or hardcode.")
        sys.exit(1)

    for path in LOGIN_PATHS:
        url = f"{API_BASE}{path}"
        try:
            r = s.post(
                url,
                data={"username": API_USER, "password": API_PASS},
                timeout=10,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if r.status_code == 404:
                continue
            r.raise_for_status()
        except Exception:
            continue

        # Try token JSON
        try:
            token = r.json().get("access_token")
            if token:
                s.headers["Authorization"] = f"Bearer {token}"
                return s
        except Exception:
            pass

        # Cookie-based auth fallback
        return s

    print("Auth failed: none of the login endpoints responded correctly.")
    sys.exit(1)


# --------------- HELPERS ----------------
def fetch_category_map(sess: requests.Session) -> Dict[str, int]:
    """Return {'Category Name': id} from the API."""
    resp = sess.get(CATEGORIES_URL, timeout=10)
    if resp.status_code == 401:
        print("Unauthorized at /categories/. Token/cookies missing or expired.")
        print("Response:", resp.text)
        sys.exit(1)
    resp.raise_for_status()
    cats = resp.json()
    return {c["name"]: c["id"] for c in cats}


def main():
    sess = build_session()

    try:
        cat_map = fetch_category_map(sess)
    except Exception as e:
        print(f"Failed to load categories: {e}")
        sys.exit(1)

    print("Loaded categories:", cat_map)

    for cat_name, product_names in PRODUCT_DATA.items():
        cat_id = cat_map.get(cat_name)
        if cat_id is None:
            print(f"❌ Category '{cat_name}' not found. Skipping its products.")
            continue

        sale_price = CATEGORY_SALE_PRICES.get(cat_name)
        print(f"Seeding {len(product_names)} products into '{cat_name}'")

        for name in product_names:
            payload = {
                "name": name,
                "unit_cost": PURCHASE_COST_DEFAULT,             # purchase cost
                "sale_price": sale_price,                       # None = inherit from category
                "reorder_threshold": REORDER_THRESHOLD_DEFAULT,
                "restock_target": RESTOCK_TARGET_DEFAULT,
                "storage_space": STORAGE_SPACE_DEFAULT,
                "category_id": cat_id,
                "quantity_in_stock": INITIAL_QTY,
                "collection_ids": [],
            }

            try:
                res = sess.post(PRODUCTS_URL, json=payload, timeout=15)
                if res.status_code not in (200, 201):
                    print(f"  ❌ {name} — {res.status_code}: {res.text}")
                else:
                    print(f"  ✅ {name}")
            except Exception as e:
                print(f"  ❌ {name} EXCEPTION — {e}")


if __name__ == "__main__":
    main()
