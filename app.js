/* All identifiers in PascalCase (your preference). */

const ThemeStorageKey = "NotationSiteTheme";

const Elements = {
  ThemeToggleBtn: document.getElementById("ThemeToggleBtn"),
  SearchInput: document.getElementById("SearchInput"),
  LimitSelect: document.getElementById("LimitSelect"),
  ClearBtn: document.getElementById("ClearBtn"),
  LoadStatusPill: document.getElementById("LoadStatusPill"),
  ResultCountPill: document.getElementById("ResultCountPill"),
  ExactMatchPill: document.getElementById("ExactMatchPill"),
  ResultsTbody: document.getElementById("ResultsTbody"),
  CalcAInput: document.getElementById("CalcAInput"),
  CalcBInput: document.getElementById("CalcBInput"),
  CalcBtn: document.getElementById("CalcBtn"),
  SwapBtn: document.getElementById("SwapBtn"),
  FillExampleBtn: document.getElementById("FillExampleBtn"),
  CalcOutput: document.getElementById("CalcOutput"),
};

let MappingList = [];
let AbbrevToExponentMap = new Map();
let ExponentToAbbrevMap = new Map();

function SetTheme(ThemeName){
  if(ThemeName === "light"){
    document.documentElement.setAttribute("data-theme", "light");
  }else{
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem(ThemeStorageKey, ThemeName);
}

function InitTheme(){
  const StoredTheme = localStorage.getItem(ThemeStorageKey);
  if(StoredTheme === "light" || StoredTheme === "dark"){
    SetTheme(StoredTheme);
    return;
  }
  const PrefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  SetTheme(PrefersLight ? "light" : "dark");
}

function ToggleTheme(){
  const CurrentTheme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  SetTheme(CurrentTheme === "light" ? "dark" : "light");
}

function NormalizeQuery(Raw){
  return String(Raw || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function ParseNumbersTxt(Text){
  const Lines = String(Text || "").split(/\r?\n/);
  const Items = [];

  for(const Line of Lines){
    const CleanLine = Line.trim();
    if(!CleanLine) continue;
    if(CleanLine.startsWith("#")) continue;

    // Expected: "1QaD = 1e45"
    const Match = CleanLine.match(/^\s*([^=]+?)\s*=\s*([^=]+?)\s*$/);
    if(!Match) continue;

    const Abbrev = Match[1].trim();
    const Scientific = Match[2].trim();

    const ExponentMatch = Scientific.match(/e\s*([+-]?\d+)/i);
    if(!ExponentMatch) continue;

    const Exponent = BigInt(ExponentMatch[1]);

    Items.push({
      Abbrev,
      Scientific: NormalizeScientific(Scientific),
      Exponent,
    });
  }

  // Sort by exponent ascending
  Items.sort((A,B) => (A.Exponent < B.Exponent ? -1 : (A.Exponent > B.Exponent ? 1 : 0)));

  return Items;
}

function NormalizeScientific(ScientificText){
  // Normalize variations: "1e3", "1E3", "e3" -> "1e3"
  const Clean = String(ScientificText || "").replace(/\s+/g, "");
  const Match = Clean.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))?e([+-]?\d+)$/i);
  if(Match){
    const Coeff = Match[1] ? Match[1] : "1";
    const Exp = Match[2];
    return `${Coeff}e${Exp}`;
  }
  // Fallback: if it contains "e", try to coerce
  const ExpMatch = Clean.match(/e([+-]?\d+)/i);
  if(ExpMatch){
    return `1e${ExpMatch[1]}`;
  }
  return Clean;
}

function BuildIndexes(Items){
  const AbbrevMap = new Map();
  const ExponentMap = new Map();

  for(const Item of Items){
    // Abbrev keys: allow "1Qa" and "Qa"
    const AbbrevKey = NormalizeQuery(Item.Abbrev);
    AbbrevMap.set(AbbrevKey, Item);

    const AbbrevWithoutLeadingOne = Item.Abbrev.replace(/^\s*1\s*/i, "");
    const AbbrevKey2 = NormalizeQuery(AbbrevWithoutLeadingOne);
    AbbrevMap.set(AbbrevKey2, Item);

    // Exponent keys: allow "1e15", "e15", "15"
    const ExponentKey = `e${Item.Exponent.toString()}`;
    ExponentMap.set(NormalizeQuery(ExponentKey), Item);
    ExponentMap.set(NormalizeQuery(`1${ExponentKey}`), Item);
    ExponentMap.set(NormalizeQuery(Item.Exponent.toString()), Item);
  }

  return { AbbrevMap, ExponentMap };
}

function EscapeHtml(Text){
  return String(Text)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function CopyToClipboard(Text){
  if(!navigator.clipboard){
    const TextArea = document.createElement("textarea");
    TextArea.value = Text;
    document.body.appendChild(TextArea);
    TextArea.select();
    document.execCommand("copy");
    document.body.removeChild(TextArea);
    return;
  }
  navigator.clipboard.writeText(Text);
}

function RenderRows(Items){
  const Limit = Number(Elements.LimitSelect.value || 100);
  const Slice = Items.slice(0, Limit);

  Elements.ResultCountPill.textContent = `${Items.length} result${Items.length === 1 ? "" : "s"}`;

  const RowsHtml = Slice.map((Item) => {
    const AbbrevText = EscapeHtml(Item.Abbrev);
    const SciText = EscapeHtml(Item.Scientific);
    const ExpText = EscapeHtml(Item.Exponent.toString());

    const CopyValue = `${Item.Abbrev} = ${Item.Scientific}`;

    return `
      <tr>
        <td><code>${AbbrevText}</code></td>
        <td><code>${SciText}</code></td>
        <td><code>${ExpText}</code></td>
        <td><button class="CopyBtn" type="button" data-copy="${EscapeHtml(CopyValue)}">Copy</button></td>
      </tr>
    `;
  }).join("");

  Elements.ResultsTbody.innerHTML = RowsHtml || `
    <tr>
      <td colspan="4" class="Muted">No results. Try a different query (e.g., <code>Qa</code> or <code>e45</code>).</td>
    </tr>
  `;

  for(const Btn of Elements.ResultsTbody.querySelectorAll("button[data-copy]")){
    Btn.addEventListener("click", () => {
      CopyToClipboard(Btn.getAttribute("data-copy") || "");
      Btn.textContent = "Copied!";
      setTimeout(() => (Btn.textContent = "Copy"), 850);
    });
  }
}

function MatchesItem(Item, Query){
  if(!Query) return true;

  const Abbrev = NormalizeQuery(Item.Abbrev);
  const Sci = NormalizeQuery(Item.Scientific);
  const Exp = NormalizeQuery(Item.Exponent.toString());

  // Flexible matching: substring match on any field
  if(Abbrev.includes(Query)) return true;
  if(Sci.includes(Query)) return true;
  if(Exp.includes(Query)) return true;

  // Also allow matching "e###" even if user typed only digits
  if(Query.startsWith("e") && (`e${Exp}`.includes(Query))) return true;

  return false;
}

function UpdateSearch(){
  const Query = NormalizeQuery(Elements.SearchInput.value);
  const Filtered = MappingList.filter((Item) => MatchesItem(Item, Query));
  RenderRows(Filtered);

  const Exact = GetExactMatch(Query);
  Elements.ExactMatchPill.textContent = Exact
    ? `Exact: ${Exact.Abbrev} = ${Exact.Scientific}`
    : "No exact match";
}

function GetExactMatch(Query){
  if(!Query) return null;

  if(AbbrevToExponentMap.has(Query)){
    return AbbrevToExponentMap.get(Query);
  }
  if(ExponentToAbbrevMap.has(Query)){
    return ExponentToAbbrevMap.get(Query);
  }

  // Try normalize scientific-like input
  if(Query.startsWith("1e") || Query.startsWith("e")){
    const Norm = NormalizeQuery(NormalizeScientific(Query));
    if(ExponentToAbbrevMap.has(Norm)) return ExponentToAbbrevMap.get(Norm);
  }

  return null;
}

function ParseUserValue(InputText){
  // Accept:
  // - Abbrev (Qa, 1Qa, 2.5QaD)
  // - Scientific (1e15, e15, 2.5e15)
  // Returns: { Ok, Error, CoefficientNumber, ExponentBigInt, DisplayScientific, DisplayAbbrev? }
  const Raw = String(InputText || "").trim();
  if(!Raw) return { Ok:false, Error:"Empty value." };

  const CleanNoSpaces = Raw.replace(/\s+/g, "");

  // Scientific: [coeff]e[exp]
  const SciMatch = CleanNoSpaces.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))?e([+-]?\d+)$/i);
  if(SciMatch){
    const CoeffText = SciMatch[1] ? SciMatch[1] : "1";
    const ExpText = SciMatch[2];
    const Coeff = Number(CoeffText);
    if(!Number.isFinite(Coeff)) return { Ok:false, Error:"Invalid coefficient." };

    const Exp = BigInt(ExpText);
    return {
      Ok: true,
      CoefficientNumber: Coeff,
      ExponentBigInt: Exp,
      DisplayScientific: `${CoeffText}e${ExpText}`,
      DisplayAbbrev: LookupAbbrevByExponent(Exp) ? `~${CoeffText}${LookupAbbrevByExponent(Exp).replace(/^1/, "")}` : null,
    };
  }

  // Abbrev with coefficient: [coeff][suffix]
  const AbbrevMatch = CleanNoSpaces.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))?([a-z][a-z0-9]*)$/i);
  if(AbbrevMatch){
    const CoeffText = AbbrevMatch[1] ? AbbrevMatch[1] : "1";
    const SuffixText = AbbrevMatch[2];

    const Coeff = Number(CoeffText);
    if(!Number.isFinite(Coeff)) return { Ok:false, Error:"Invalid coefficient." };

    const Item = AbbrevToExponentMap.get(NormalizeQuery(SuffixText)) || AbbrevToExponentMap.get(NormalizeQuery(`1${SuffixText}`));
    if(!Item) return { Ok:false, Error:`Unknown abbreviation: ${SuffixText}` };

    const Exp = Item.Exponent;
    return {
      Ok: true,
      CoefficientNumber: Coeff,
      ExponentBigInt: Exp,
      DisplayScientific: `${CoeffText}e${Exp.toString()}`,
      DisplayAbbrev: `${CoeffText}${SuffixText}`,
    };
  }

  // If user typed full "1QaD"
  const ExactItem = AbbrevToExponentMap.get(NormalizeQuery(CleanNoSpaces));
  if(ExactItem){
    return {
      Ok: true,
      CoefficientNumber: 1,
      ExponentBigInt: ExactItem.Exponent,
      DisplayScientific: `1e${ExactItem.Exponent.toString()}`,
      DisplayAbbrev: ExactItem.Abbrev,
    };
  }

  return { Ok:false, Error:"Could not parse. Try like: 1QaD, QaD, 2.5QaD, 1e45, e45, 2.5e45." };
}

function LookupAbbrevByExponent(ExponentBigInt){
  const Key = NormalizeQuery(`e${ExponentBigInt.toString()}`);
  const Item = ExponentToAbbrevMap.get(Key);
  return Item ? Item.Abbrev : null;
}

function FormatRatio(ExpGapBigInt, RatioCoefficient){
  // Ratio = RatioCoefficient * 10^(ExpGap)
  const ExpText = ExpGapBigInt.toString();
  const CoeffText = Number.isFinite(RatioCoefficient) ? String(RatioCoefficient) : "NaN";
  return `${CoeffText}e${ExpText}`;
}

function CalculateComparison(){
  const A = ParseUserValue(Elements.CalcAInput.value);
  const B = ParseUserValue(Elements.CalcBInput.value);

  if(!A.Ok || !B.Ok){
    const Errors = [A.Ok ? null : `A: ${A.Error}`, B.Ok ? null : `B: ${B.Error}`].filter(Boolean).join(" • ");
    Elements.CalcOutput.innerHTML = `<div class="CalcPlaceholder"><span class="BadgeWarn"><b>Fix:</b></span> ${EscapeHtml(Errors)}</div>`;
    return;
  }

  // Compare magnitudes by exponent first; coefficients second (rough).
  const ExpGap = A.ExponentBigInt - B.ExponentBigInt; // BigInt
  const RatioCoeff = A.CoefficientNumber / B.CoefficientNumber;

  // A / B = (CoeffA/CoeffB) * 10^(ExpA-ExpB)
  const RatioText = FormatRatio(ExpGap, RatioCoeff);

  // Also provide "which is larger" summary.
  let LargerText = "Same magnitude (very close)";
  if(ExpGap > 0n) LargerText = "A is larger";
  if(ExpGap < 0n) LargerText = "B is larger";
  if(ExpGap === 0n){
    if(A.CoefficientNumber > B.CoefficientNumber) LargerText = "A is larger";
    if(A.CoefficientNumber < B.CoefficientNumber) LargerText = "B is larger";
  }

  const ExpGapAbs = ExpGap >= 0n ? ExpGap : (-ExpGap);
  const ExpGapAbsText = ExpGapAbs.toString();

  const AAbbrev = A.DisplayAbbrev ? EscapeHtml(A.DisplayAbbrev) : "—";
  const BAbbrev = B.DisplayAbbrev ? EscapeHtml(B.DisplayAbbrev) : "—";

  Elements.CalcOutput.innerHTML = `
    <div class="CalcGrid">
      <div class="CalcCard">
        <h3>Value A</h3>
        <div class="Big"><code>${EscapeHtml(A.DisplayScientific)}</code></div>
        <div class="Muted">Abbrev: <code>${AAbbrev}</code></div>
      </div>
      <div class="CalcCard">
        <h3>Value B</h3>
        <div class="Big"><code>${EscapeHtml(B.DisplayScientific)}</code></div>
        <div class="Muted">Abbrev: <code>${BAbbrev}</code></div>
      </div>
      <div class="CalcCard">
        <h3>Exponent Gap</h3>
        <div class="Big"><code>${EscapeHtml(ExpGap.toString())}</code></div>
        <div class="Muted">Absolute gap: <code>${EscapeHtml(ExpGapAbsText)}</code></div>
      </div>
      <div class="CalcCard">
        <h3>Ratio (A / B)</h3>
        <div class="Big"><code>${EscapeHtml(RatioText)}</code></div>
        <div class="Muted">${EscapeHtml(LargerText)} • This means A is about <code>${EscapeHtml(RatioText)}</code> times B.</div>
      </div>
    </div>
  `;
}

async function LoadData(){
  Elements.LoadStatusPill.textContent = "Loading…";
  try{
    const Response = await fetch("./numbers.txt", { cache: "no-store" });
    if(!Response.ok) throw new Error(`Fetch failed (${Response.status})`);
    const Text = await Response.text();

    MappingList = ParseNumbersTxt(Text);

    const Indexes = BuildIndexes(MappingList);
    AbbrevToExponentMap = Indexes.AbbrevMap;
    ExponentToAbbrevMap = Indexes.ExponentMap;

    Elements.LoadStatusPill.textContent = `Loaded ${MappingList.length} entries`;
    UpdateSearch();
  }catch(Error){
    console.error(Error);
    Elements.LoadStatusPill.textContent = "Load failed";
    Elements.ResultsTbody.innerHTML = `
      <tr>
        <td colspan="4" class="Muted">
          Could not load <code>numbers.txt</code>. Make sure it exists next to <code>index.html</code>.
        </td>
      </tr>
    `;
  }
}

function WireEvents(){
  Elements.ThemeToggleBtn.addEventListener("click", ToggleTheme);

  Elements.SearchInput.addEventListener("input", () => UpdateSearch());
  Elements.LimitSelect.addEventListener("change", () => UpdateSearch());

  Elements.ClearBtn.addEventListener("click", () => {
    Elements.SearchInput.value = "";
    UpdateSearch();
    Elements.SearchInput.focus();
  });

  Elements.CalcBtn.addEventListener("click", CalculateComparison);

  Elements.SwapBtn.addEventListener("click", () => {
    const Temp = Elements.CalcAInput.value;
    Elements.CalcAInput.value = Elements.CalcBInput.value;
    Elements.CalcBInput.value = Temp;
    CalculateComparison();
  });

  Elements.FillExampleBtn.addEventListener("click", () => {
    Elements.CalcAInput.value = "1QaD";
    Elements.CalcBInput.value = "1QiD";
    CalculateComparison();
  });

  // Enter key triggers calculate when focused in calc inputs
  Elements.CalcAInput.addEventListener("keydown", (Event) => {
    if(Event.key === "Enter") CalculateComparison();
  });
  Elements.CalcBInput.addEventListener("keydown", (Event) => {
    if(Event.key === "Enter") CalculateComparison();
  });
}

function Init(){
  InitTheme();
  WireEvents();
  LoadData();
}

Init();
