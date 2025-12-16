/* eslint-disable no-console */
(() => {
  "use strict";

  const PageSize = 200;

  /** @type {{Entries: Array<{Abbreviation: string, Scientific: string, Exponent: number}>}} */
  let Data = { Entries: [] };

  /** @type {Array<{Abbreviation: string, Scientific: string, Exponent: number}>} */
  let FilteredEntries = [];

  let CurrentPageIndex = 0;

  const SearchInput = /** @type {HTMLInputElement} */ (document.getElementById("SearchInput"));
  const ClearSearchButton = /** @type {HTMLButtonElement} */ (document.getElementById("ClearSearchButton"));

  const LookupInput = /** @type {HTMLInputElement} */ (document.getElementById("LookupInput"));
  const LookupAbbr = document.getElementById("LookupAbbr");
  const LookupSci = document.getElementById("LookupSci");
  const LookupExp = document.getElementById("LookupExp");

  const TableBody = document.getElementById("TableBody");
  const TableCount = document.getElementById("TableCount");
  const PrevPageButton = /** @type {HTMLButtonElement} */ (document.getElementById("PrevPageButton"));
  const NextPageButton = /** @type {HTMLButtonElement} */ (document.getElementById("NextPageButton"));
  const PageLabel = document.getElementById("PageLabel");

  const CalcAInput = /** @type {HTMLInputElement} */ (document.getElementById("CalcAInput"));
  const CalcBInput = /** @type {HTMLInputElement} */ (document.getElementById("CalcBInput"));
  const CalcCompareButton = /** @type {HTMLButtonElement} */ (document.getElementById("CalcCompareButton"));
  const CalcDiffButton = /** @type {HTMLButtonElement} */ (document.getElementById("CalcDiffButton"));
  const CalcAddButton = /** @type {HTMLButtonElement} */ (document.getElementById("CalcAddButton"));
  const CalcMulButton = /** @type {HTMLButtonElement} */ (document.getElementById("CalcMulButton"));
  const CalcDivButton = /** @type {HTMLButtonElement} */ (document.getElementById("CalcDivButton"));

  const CalcParsedA = document.getElementById("CalcParsedA");
  const CalcParsedB = document.getElementById("CalcParsedB");
  const CalcOutput = document.getElementById("CalcOutput");
  const CalcNotes = document.getElementById("CalcNotes");

  /** @type {Map<string, {Abbreviation: string, Scientific: string, Exponent: number}>} */
  const ByAbbreviation = new Map();

  /** @type {Map<number, {Abbreviation: string, Scientific: string, Exponent: number}>} */
  const ByExponent = new Map();

  // Calculator mode (controls both behavior + button highlighting)
  /** @type {"Compare" | "Sub" | "Add" | "Mul" | "Div"} */
  let CurrentCalcMode = "Compare";

  function NormalizeQuery(Value) {
    return (Value || "")
      .trim()
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function Clamp(Value, Min, Max) {
    return Math.max(Min, Math.min(Max, Value));
  }

  function BuildIndexes() {
    ByAbbreviation.clear();
    ByExponent.clear();

    for (const Entry of Data.Entries) {
      const AbbrKey = NormalizeQuery(Entry.Abbreviation);
      ByAbbreviation.set(AbbrKey, Entry);
      ByExponent.set(Entry.Exponent, Entry);
    }
  }

  function FormatWithCommas(Value) {
    return Value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function RenderTable() {
    const Total = FilteredEntries.length;
    const TotalPages = Math.max(1, Math.ceil(Total / PageSize));
    CurrentPageIndex = Clamp(CurrentPageIndex, 0, TotalPages - 1);

    const StartIndex = CurrentPageIndex * PageSize;
    const EndIndex = Math.min(Total, StartIndex + PageSize);
    const PageItems = FilteredEntries.slice(StartIndex, EndIndex);

    TableBody.textContent = "";
    const Fragment = document.createDocumentFragment();

    for (const Row of PageItems) {
      const Tr = document.createElement("tr");

      const TdA = document.createElement("td");
      TdA.className = "Mono";
      TdA.textContent = Row.Abbreviation;

      const TdS = document.createElement("td");
      TdS.className = "Mono";
      TdS.textContent = Row.Scientific;

      const TdE = document.createElement("td");
      TdE.className = "Mono";
      TdE.textContent = `1e${Row.Exponent}`;

      Tr.appendChild(TdA);
      Tr.appendChild(TdS);
      Tr.appendChild(TdE);
      Fragment.appendChild(Tr);
    }

    TableBody.appendChild(Fragment);
    TableCount.textContent = `${FormatWithCommas(Total)} items (showing ${FormatWithCommas(StartIndex + 1)}–${FormatWithCommas(EndIndex)})`;
    PageLabel.textContent = `Page ${CurrentPageIndex + 1} / ${TotalPages}`;

    PrevPageButton.disabled = CurrentPageIndex === 0;
    NextPageButton.disabled = CurrentPageIndex >= TotalPages - 1;
  }

  function ApplySearchFilter() {
    const Query = NormalizeQuery(SearchInput.value);
    if (!Query) {
      FilteredEntries = Data.Entries.slice();
      CurrentPageIndex = 0;
      RenderTable();
      return;
    }

    // search in abbreviation, scientific string, and exponent
    FilteredEntries = Data.Entries.filter((Entry) => {
      const Abbr = NormalizeQuery(Entry.Abbreviation);
      const Sci = NormalizeQuery(Entry.Scientific);
      const Exp = `e${Entry.Exponent}`;
      return Abbr.includes(Query) || Sci.includes(Query) || Exp.includes(Query);
    });

    CurrentPageIndex = 0;
    RenderTable();
  }

  function Lookup(Value) {
    const Query = NormalizeQuery(Value);
    if (!Query) return null;

    // Support coefficient+suffix lookups like "32Qi" or "0.5Qa" by
    // resolving the suffix portion against the index.
    // (We still return the base Entry for the suffix exponent.)
    const CoefSuffixMatch = Query.match(/^(\d+(?:\.\d+)?)?([a-z][a-z0-9]*)$/i);
    if (CoefSuffixMatch) {
      const SuffixOnly = CoefSuffixMatch[2];
      const SuffixQuery = SuffixOnly.startsWith("1") ? SuffixOnly : `1${SuffixOnly}`;
      if (ByAbbreviation.has(SuffixQuery)) return ByAbbreviation.get(SuffixQuery);
      if (ByAbbreviation.has(SuffixOnly)) return ByAbbreviation.get(SuffixOnly);
    }

    // Try exact abbreviation (with or without leading "1")
    const AbbrQuery = Query.startsWith("1") ? Query : `1${Query}`;
    if (ByAbbreviation.has(AbbrQuery)) return ByAbbreviation.get(AbbrQuery);

    // Try scientific patterns: 1e15, e15
    const SciMatch = Query.match(/^(?:1)?e(\d+)$/i);
    if (SciMatch) {
      const Exp = Number(SciMatch[1]);
      if (ByExponent.has(Exp)) return ByExponent.get(Exp);
    }

    // Try abbreviation without the leading "1" in the index
    if (ByAbbreviation.has(Query)) return ByAbbreviation.get(Query);

    return null;
  }

  function SetLookupResult(Entry) {
    if (!Entry) {
      LookupAbbr.textContent = "—";
      LookupSci.textContent = "—";
      LookupExp.textContent = "—";
      return;
    }
    LookupAbbr.textContent = Entry.Abbreviation;
    LookupSci.textContent = Entry.Scientific;
    LookupExp.textContent = `1e${Entry.Exponent}`;
  }

  /**
   * Parses an input into (Coefficient, Exponent).
   * Supported:
   * - Abbreviation from the file: 1Qa, Qa, 1MiQi, etc (coefficient assumed 1)
   * - Scientific: 1e123 or e123 (coefficient assumed 1)
   * - General: 12.34e56, -2e10, 250Qa, 0.5Qi  (suffix exponent taken from file)
   *
   * Returns a normalized object (Sign, Digits, Exponent).
   * Digits: integer digits without sign or decimal point.
   * Value = Sign * Digits * 10^(Exponent - (Digits.length - 1))
   */
  function ParseMagnitude(Input) {
    const Raw = (Input || "").trim();
    if (!Raw) return null;

    const Compact = Raw.replace(/\s+/g, "");
    const Sign = Compact.startsWith("-") ? -1 : 1;
    const NoSign = Compact.replace(/^[-+]/, "");

    // scientific like 12.3e45
    const SciMatch = NoSign.match(/^(\d+(?:\.\d+)?)e(\d+)$/i);
    if (SciMatch) {
      const CoefText = SciMatch[1];
      const Exp = Number(SciMatch[2]);
      const Digits = CoefText.replace(".", "");
      const DecimalPlaces = (CoefText.split(".")[1] || "").length;
      const NormalizedExponent = Exp - DecimalPlaces + (Digits.length - 1);
      return { Sign, Digits, Exponent: NormalizedExponent };
    }

    // "1e123" or "e123"
    const OneSciMatch = NoSign.match(/^(?:1)?e(\d+)$/i);
    if (OneSciMatch) {
      const Exp = Number(OneSciMatch[1]);
      return { Sign, Digits: "1", Exponent: Exp };
    }

    // abbreviation - allow optional coefficient + suffix, e.g. "250Qa" or "Qa"
    const AbbrMatch = NoSign.match(/^(\d+(?:\.\d+)?)?([a-z][a-z0-9]*)$/i);
    if (AbbrMatch) {
      const CoefText = AbbrMatch[1] || "1";
      const Suffix = AbbrMatch[2];
      const Entry = Lookup(Suffix) || Lookup(`1${Suffix}`);
      if (!Entry) return null;

      const Digits = CoefText.replace(".", "");
      const DecimalPlaces = (CoefText.split(".")[1] || "").length;
      const BaseExp = Entry.Exponent;
      const NormalizedExponent = BaseExp - DecimalPlaces + (Digits.length - 1);
      return { Sign, Digits, Exponent: NormalizedExponent };
    }

    return null;
  }

  function ToPrettyScientific(Mag, SignificantDigits = 8) {
    if (!Mag) return "—";

    // Normalize Digits to at least 1
    let Digits = Mag.Digits.replace(/^0+/, "");
    if (!Digits) Digits = "0";

    const Exponent = Mag.Exponent;
    const SignPrefix = Mag.Sign < 0 ? "-" : "";
    const Head = Digits.slice(0, SignificantDigits);
    const Tail = Digits.length > SignificantDigits ? "…" : "";
    const Mantissa = Head.length === 1 ? Head : `${Head[0]}.${Head.slice(1)}`;
    const TrueExponent = Exponent; // already represents exponent of leading digit
    return `${SignPrefix}${Mantissa}${Tail}e${TrueExponent}`;
  }

  function StripLeadingOne(Abbreviation) {
    const Text = String(Abbreviation || "");
    return Text.startsWith("1") && /[a-z]/i.test(Text[1] || "") ? Text.slice(1) : Text;
  }

  function FormatCoefficientFromDigits(Digits, ShiftRight, MaxDecimals) {
    // Digits represent the mantissa digits (no decimal). ShiftRight is 0..2 where
    // coefficient = mantissa * 10^ShiftRight.
    const Clean = (Digits || "").replace(/^0+/, "") || "0";
    const NeededLen = ShiftRight + 1;
    const Padded = Clean.length < NeededLen ? Clean.padEnd(NeededLen, "0") : Clean;
    const IntegerPart = Padded.slice(0, NeededLen);
    const FractionRaw = Padded.slice(NeededLen, NeededLen + MaxDecimals);
    const Fraction = FractionRaw.replace(/0+$/, "");
    return Fraction ? `${IntegerPart}.${Fraction}` : IntegerPart;
  }

  function FormatRobloxSuffix(Mag, MaxDecimals = 2) {
    if (!Mag) return "—";
    if (Mag.Exponent < 3) return ToPrettyScientific(Mag, 8);

    const BaseExp = Math.floor(Mag.Exponent / 3) * 3;
    const Entry = ByExponent.get(BaseExp);
    if (!Entry) return ToPrettyScientific(Mag, 8);

    const ShiftRight = Mag.Exponent - BaseExp; // 0..2
    const Coef = FormatCoefficientFromDigits(Mag.Digits, ShiftRight, MaxDecimals);
    const SignPrefix = Mag.Sign < 0 ? "-" : "";
    return `${SignPrefix}${Coef}${StripLeadingOne(Entry.Abbreviation)}`;
  }


function FormatDualOutput(Mag, MaxSuffixDecimals = 2, SciDigits = 8) {
  if (!Mag) return "—";
  const Suffix = FormatRobloxSuffix(Mag, MaxSuffixDecimals);
  const Sci = ToPrettyScientific(Mag, SciDigits);
  return `${Suffix} (${Sci})`;
}

  function CompareMagnitudes(A, B) {
    if (!A || !B) return null;
    if (A.Sign !== B.Sign) return A.Sign > B.Sign ? 1 : -1;
    if (A.Exponent !== B.Exponent) return A.Exponent > B.Exponent ? A.Sign : -A.Sign;

    // Same exponent: compare digits (length then lexicographic)
    if (A.Digits.length !== B.Digits.length) {
      return A.Digits.length > B.Digits.length ? A.Sign : -A.Sign;
    }
    if (A.Digits === B.Digits) return 0;
    return A.Digits > B.Digits ? A.Sign : -A.Sign;
  }

  function AddOrSubtractMagnitudes(A, B, IsSubtract) {
    // Returns approximate normalized scientific (safe).
    // If exponents differ a lot, dominant term wins.
    const AdjustedB = IsSubtract ? { ...B, Sign: -B.Sign } : B;

    // If one is null
    if (!A || !AdjustedB) return null;

    const Dominant = Math.abs(A.Exponent - AdjustedB.Exponent) > 18
      ? (A.Exponent > AdjustedB.Exponent ? A : AdjustedB)
      : null;

    if (Dominant) {
      return {
        Magnitude: Dominant,
        Output: FormatDualOutput(Dominant, 2, 10),
        Notes: "Exponent gap is huge; smaller term doesn't affect the first ~18 digits.",
      };
    }

    // Scale both to same exponent using BigInt on first ~30 digits.
    const TargetExp = Math.max(A.Exponent, AdjustedB.Exponent);
    const ScaledA = ScaleToExponent(A, TargetExp, 30);
    const ScaledB = ScaleToExponent(AdjustedB, TargetExp, 30);

    if (!ScaledA || !ScaledB) {
      return { Output: "—", Notes: "Could not scale values safely." };
    }

    const Sum = ScaledA + ScaledB;
    const Sign = Sum < 0n ? -1 : 1;
    const Abs = Sum < 0n ? -Sum : Sum;
    const Digits = Abs.toString();

    // Normalize: Digits represent an integer whose leading digit is at exponent TargetExp (ish)
    const NormalizedExponent = TargetExp;
    return {
      Magnitude: { Sign, Digits, Exponent: NormalizedExponent },
      Output: FormatDualOutput({ Sign, Digits, Exponent: NormalizedExponent }, 2, 10),
      Notes: "Computed with ~30-digit precision.",
    };
  }

  function ScaleToExponent(Mag, TargetExponent, MaxDigits) {
    // Turn Mag into an integer-ish BigInt aligned to TargetExponent using up to MaxDigits digits.
    // We approximate by taking the first MaxDigits digits of the coefficient.
    const Shift = TargetExponent - Mag.Exponent;
    if (Shift < 0) {
      // Mag has bigger exponent than target; scale down by shifting digits right
      const Cut = -Shift;
      const Digits = Mag.Digits;
      if (Cut >= Digits.length) return 0n;
      const Kept = Digits.slice(0, Math.max(1, Digits.length - Cut));
      const Trunc = Kept.slice(0, MaxDigits);
      const Value = BigInt(Trunc);
      const Padding = BigInt(10) ** BigInt(Math.max(0, MaxDigits - Trunc.length));
      const Signed = BigInt(Mag.Sign) * Value * Padding;
      return Signed;
    }

    // Shift >= 0: append zeros (but cap digits)
    const Digits = Mag.Digits;
    const Needed = Shift;
    const Trunc = Digits.slice(0, MaxDigits);
    let Value = BigInt(Trunc);
    const ExtraZeroCount = Math.min(Needed, MaxDigits - Trunc.length);
    if (ExtraZeroCount > 0) Value = Value * (10n ** BigInt(ExtraZeroCount));
    const Signed = BigInt(Mag.Sign) * Value;
    return Signed;
  }

  function MultiplyMagnitudes(A, B) {
    if (!A || !B) return null;

    // Multiply leading digits approx
    const ADigits = A.Digits.slice(0, 12);
    const BDigits = B.Digits.slice(0, 12);
    const AInt = BigInt(ADigits);
    const BInt = BigInt(BDigits);
    const Product = AInt * BInt;
    const Sign = A.Sign * B.Sign;

    // Exponents add; but because we truncated digits, adjust exponent by digit lengths
    const AAdj = A.Exponent - (A.Digits.length - 1);
    const BAdj = B.Exponent - (B.Digits.length - 1);

    // Product digits correspond to (AInt * 10^(AAdj)) * (BInt * 10^(BAdj))
    const ProductDigits = Product.toString();
    const ProductExponent = (AAdj + BAdj) + (ProductDigits.length - 1);

    const Magnitude = { Sign, Digits: ProductDigits, Exponent: ProductExponent };

    return {
      Magnitude,
      Output: FormatDualOutput(Magnitude, 2, 10),
      Notes: "Multiplication uses ~12 leading digits of each input (fast approximation).",
    };
  }

  function DivideMagnitudes(A, B) {
    if (!A || !B) return null;
    if (B.Digits.replace(/^0+/, "") === "") return { Output: "—", Notes: "Division by zero." };

    // Use leading digits for ratio
    const ADigits = A.Digits.slice(0, 16);
    const BDigits = B.Digits.slice(0, 16);
    const AInt = BigInt(ADigits);
    const BInt = BigInt(BDigits);

    // Scale numerator for some decimal precision
    const Scale = 24n;
    const Numer = AInt * (10n ** Scale);
    const Quot = Numer / BInt;

    const Sign = A.Sign * B.Sign;
    const QuotDigits = Quot.toString();

    const AAdj = A.Exponent - (A.Digits.length - 1);
    const BAdj = B.Exponent - (B.Digits.length - 1);
    const QuotExponent = (AAdj - BAdj) + (QuotDigits.length - 1) - Number(Scale);

    const Mantissa = QuotDigits.length === 1 ? QuotDigits : `${QuotDigits[0]}.${QuotDigits.slice(1, 10)}…`;
    const Magnitude = { Sign, Digits: QuotDigits, Exponent: QuotExponent };

    return {
      Magnitude,
      Output: FormatDualOutput(Magnitude, 2, 10),
      Notes: "Division uses leading digits and fixed precision scaling (approx).",
    };
  }

  function DifferenceSummary(A, B) {
    if (!A || !B) return null;
    const ExponentDelta = A.Exponent - B.Exponent;
    const FactorText = ExponentDelta === 0 ? "1" : `1e${Math.abs(ExponentDelta)} (×10^${ExponentDelta > 0 ? "+" : ""}${ExponentDelta})`;
    const Compare = CompareMagnitudes(A, B);
    const Relation = Compare === 0 ? "A = B" : (Compare > 0 ? "A > B" : "A < B");
    return {
      Output: `${Relation}; Exponent Δ = ${ExponentDelta}`,
      Notes: `Magnitude factor (rough): ${FactorText}`,
    };
  }

  function SetCalcParsed(ParsedA, ParsedB) {
    CalcParsedA.textContent = ParsedA ? ToPrettyScientific(ParsedA, 12) : "—";
    CalcParsedB.textContent = ParsedB ? ToPrettyScientific(ParsedB, 12) : "—";
  }

  function SetCalcOutput(Output, Notes) {
    CalcOutput.textContent = Output || "—";
    CalcNotes.textContent = Notes || "—";
  }

  function SetCalcMode(Mode) {
    CurrentCalcMode = Mode;

    const AllButtons = [
      CalcCompareButton,
      CalcDiffButton,
      CalcAddButton,
      CalcMulButton,
      CalcDivButton,
    ];

    for (const Button of AllButtons) {
      Button.classList.add("ButtonGhost");
    }

    let ActiveButton = CalcCompareButton;
    if (Mode === "Sub") ActiveButton = CalcDiffButton;
    else if (Mode === "Add") ActiveButton = CalcAddButton;
    else if (Mode === "Mul") ActiveButton = CalcMulButton;
    else if (Mode === "Div") ActiveButton = CalcDivButton;

    ActiveButton.classList.remove("ButtonGhost");
  }

  function RunCalculator(Mode) {
    const ActualMode = Mode || CurrentCalcMode;

    const A = ParseMagnitude(CalcAInput.value);
    const B = ParseMagnitude(CalcBInput.value);
    SetCalcParsed(A, B);

    if (!A || !B) {
      SetCalcOutput("—", "Could not parse A or B. Try: 1Qa, Qa, 1e15, 12.5Qi, 250No, etc.");
      return;
    }

    if (ActualMode === "Compare") {
      const Summary = DifferenceSummary(A, B);
      SetCalcOutput(Summary.Output, Summary.Notes);
      return;
    }

    if (ActualMode === "Sub") {
      const Res = AddOrSubtractMagnitudes(A, B, true);
      SetCalcOutput(Res.Output, Res.Notes);
      return;
    }

    if (ActualMode === "Add") {
      const Res = AddOrSubtractMagnitudes(A, B, false);
      SetCalcOutput(Res.Output, Res.Notes);
      return;
    }

    if (ActualMode === "Mul") {
      const Res = MultiplyMagnitudes(A, B);
      SetCalcOutput(Res.Output, Res.Notes);
      return;
    }

    if (ActualMode === "Div") {
      const Res = DivideMagnitudes(A, B);
      SetCalcOutput(Res.Output, Res.Notes);
      return;
    }

    SetCalcOutput("—", "Unknown mode.");
  }

  async function Init() {
    const Response = await fetch("data.json", { cache: "no-store" });
    Data = await Response.json();

    BuildIndexes();
    FilteredEntries = Data.Entries.slice();
    RenderTable();

    // Search bar filters table (and doesn't affect lookup/calc unless you want it to)
    SearchInput.addEventListener("input", ApplySearchFilter);
    ClearSearchButton.addEventListener("click", () => {
      SearchInput.value = "";
      ApplySearchFilter();
      SearchInput.focus();
    });

    // Lookup input is independent, but also works nicely to paste exact items
    const LookupHandler = () => {
      const Mag = ParseMagnitude(LookupInput.value);
      if (!Mag) {
        SetLookupResult(null);
        return;
      }

      // Base mapping entry (for displaying the canonical suffix mapping)
      const BaseExp = Math.floor(Mag.Exponent / 3) * 3;
      const Entry = ByExponent.get(BaseExp) || Lookup(`e${BaseExp}`);

      LookupAbbr.textContent = FormatRobloxSuffix(Mag, 2);
      LookupSci.textContent = ToPrettyScientific(Mag, 10);
      LookupExp.textContent = `1e${Mag.Exponent}`;

      // If we don't have a suffix entry (rare), fall back to the old behavior
      if (!Entry) return;
    };
    LookupInput.addEventListener("input", LookupHandler);
    LookupInput.addEventListener("change", LookupHandler);

    PrevPageButton.addEventListener("click", () => {
      CurrentPageIndex -= 1;
      RenderTable();
    });
    NextPageButton.addEventListener("click", () => {
      CurrentPageIndex += 1;
      RenderTable();
    });

    // Ensure the initial visual state matches the starting mode
    SetCalcMode("Compare");

    CalcCompareButton.addEventListener("click", () => {
      SetCalcMode("Compare");
      RunCalculator();
    });
    CalcDiffButton.addEventListener("click", () => {
      SetCalcMode("Sub");
      RunCalculator();
    });
    CalcAddButton.addEventListener("click", () => {
      SetCalcMode("Add");
      RunCalculator();
    });
    CalcMulButton.addEventListener("click", () => {
      SetCalcMode("Mul");
      RunCalculator();
    });
    CalcDivButton.addEventListener("click", () => {
      SetCalcMode("Div");
      RunCalculator();
    });

    // Auto-run the CURRENT mode when typing (so UI + behavior stay consistent)
    const AutoCalc = () => RunCalculator();
    CalcAInput.addEventListener("input", AutoCalc);
    CalcBInput.addEventListener("input", AutoCalc);

    // Initial calc render
    RunCalculator();
  }

  Init().catch((Error) => {
    console.error(Error);
    TableCount.textContent = "Failed to load data.json";
  });
})();