const openedAtMs = Date.now();

/**
 * ★ここをあなたの Apps Script WebアプリURL に差し替え
 * 例）https://script.google.com/macros/s/XXXXXXXXXXXX/exec
 */
const API_URL = "https://gas-proxy-kappa.vercel.app/api/forms";

window.addEventListener("error", (e) => {
  const msg = `JSエラー:\n${e.message}\n${e.filename}:${e.lineno}`;
  console.error(msg, e.error);
  showError(msg);
});

window.addEventListener("unhandledrejection", (e) => {
  const msg = `Promiseエラー:\n${e.reason?.message || e.reason}`;
  console.error(msg, e.reason);
  showError(msg);
});

const state = {
  pageIndex: 0,
  lastPageIndex: 0,
  server: { termsVersion:"", minSubmitSeconds:3 },
  answers: {
    email: "",
    name: "",
    postal: "",
    address: "",
    phone: "",

    shootingContents: [],
    shootingContentsOther: "",

    preferredDates: ["", "", ""],
    shootingPlace: "",
    participants: "",
    mainPersonName: "",

    dressingNeed: "",
    dressingDetail: "",
    dressingPlace: "",
    dressingAddressChoice: "",
    dressingAddressOther: "",
    parkingSpace: "",

    kimonoRentalOther: "",
    kimonoRentalItems: [],

    planType: "",
    planStudio: "",
    planOutcall: "",
    planSet: [],

    options: [],
    paymentMethod: "",
    howKnew: "",
    howKnewOther: "",
    message: "",

    privacyAgree: false,
    cancelAgree: false,
    otherAgree: false,
  }
};

const pageRoot = document.getElementById("pageRoot");
const errBox = document.getElementById("errBox");
const btnBack = document.getElementById("btnBack");
const btnNext = document.getElementById("btnNext");
const barInner = document.getElementById("barInner");
const stepText = document.getElementById("stepText");
const overlay = document.getElementById("overlay");
const doneCard = document.getElementById("doneCard");
const pageCard = document.getElementById("pageCard");
const doneId = document.getElementById("doneId");

// ====== ページ定義 ======
const pages = [
  { title:"① 連絡先", desc:"ご連絡のために必要な情報です。", fields:["email","name","postal","address","phone"] },
  { title:"② 撮影の基本", desc:"撮影内容とご希望を教えてください。", fields:["shootingContents","preferredDates","shootingPlace","participants","mainPersonName"] },
  { title:"③ 着付け・レンタル", desc:"必要な場合だけ追加項目が出ます。", fields:["dressingNeed","dressingDetail","dressingPlace","dressingAddressChoice","parkingSpace","kimonoRental"] },
  { title:"④ プラン選択", desc:"プランを選ぶと、次の選択肢が出ます。", fields:["planType","planStudio","planOutcall","planSet","options"] },
  { title:"⑤ 仕上げ（確認＆同意）", desc:"送信前に内容確認と同意をお願いします。", fields:["paymentMethod","howKnew","message","agreements","review"] }
];

// ★セット用の候補
const PLAN_STUDIO = [
  "【１番人気🥇】プレミアムプラン (全データ/A4木製ガラスパネル ) ¥57,500→¥46,500",
  "スタンダードプラン (全データ込み) ¥41,000",
  "ライトプラン (5データのみ) ¥30,000 ※データはお客様セレクト"
];

const PLAN_OUTCALL = [
  "プレミアムプラン (全データ/2L木製ガラスパネル/アルバム10P Mサイズ) ¥75,000→¥69,800",
  "【１番人気🥇】スタンダードプラン(全データ/2L木製ガラスパネル/2面台紙) ¥65,000円→¥59,800",
  "スマートプラン(全データ/2L木製ガラスパネル) ￥40,000"
];

// ====== 初期設定取得（google.script.run → fetch）======
(async function init(){
  try {
    const res = await fetch(`${API_URL}?action=config`, { method: "GET" });
    const text = await res.text(); // ←まずテキストで受ける

    // JSONかどうかチェック
    let json;
    try {
      json = JSON.parse(text);
    } catch (_) {
      throw new Error(`configがJSONではありません。\nstatus=${res.status}\n先頭200文字=\n${text.slice(0,200)}`);
    }

    if (!json.ok) throw new Error(json.message || "config取得に失敗");
    state.server = json.data;
    render();

  } catch (e) {
    showError(`初期化に失敗しました。\n${e?.message || e}`);
  }
})();

// ====== 便利関数 ======
function showError(msg){ errBox.style.display="block"; errBox.textContent=msg; }
function clearError(){ errBox.style.display="none"; errBox.textContent=""; }
function toggleLoading(on){ overlay.style.display = on ? "flex" : "none"; }

function rerenderAll(){
  cleanupByBranch();
  render();
}

// 電話を整形（数字だけ）
function formatPhone(raw){
  const digits = String(raw||"").replace(/\D/g,"");
  return digits;
}

// 分岐の不要値を掃除
function cleanupByBranch(){
  const a = state.answers;

  // パネル/アルバム：表示順固定
  const optMaster = [
    "① A4木製ガラスパネル (305×220mm) ¥16,500（2枚目から10%OFF）",
    "② 2面台紙 (216×216mm) ¥25,000",
    "③ 3面台紙 (216×216mm) ¥30,000",
    "④ アルバム10P M (216×216mm) ¥35,000",
    "⑤ アルバム10P L (305×305mm) ¥40,000",
    "⑥ クリスタルアルバム10P (301×299mm) ¥55,000"
  ];
  if (Array.isArray(a.options)) {
    a.options = a.options
      .filter(x => optMaster.includes(x))
      .sort((x, y) => optMaster.indexOf(x) - optMaster.indexOf(y));
  }

  // 着付け無しなら詳細系を消す
  if (a.dressingNeed === "無し") {
    a.dressingDetail = "";
    a.dressingPlace = "";
    a.dressingAddressChoice = "";
    a.dressingAddressOther = "";
    a.parkingSpace = "";
  }

  // 当写真館なら住所/駐車いらない
  if (a.dressingPlace === "当写真館") {
    a.dressingAddressChoice = "";
    a.dressingAddressOther = "";
    a.parkingSpace = "";
  }

  // 着物レンタル：「無し」は排他
  {
    const items = a.kimonoRentalItems || [];
    if (items.includes("無し")) {
      a.kimonoRentalItems = ["無し"];
      a.kimonoRentalOther = "";
    }
    if (!items.includes("その他")) {
      a.kimonoRentalOther = "";
    }
  }

  // プラン分岐
  if (!String(a.planType||"").startsWith("写真館撮影")) a.planStudio = "";
  if (!String(a.planType||"").startsWith("出張撮影")) a.planOutcall = "";
  if (!String(a.planType||"").startsWith("セットプラン")) a.planSet = [];
}

// ====== UI部品 ======
function makeInputBox(title, required, hint){
  const box = document.createElement("div");
  box.className = "q";
  const t = document.createElement("div");
  t.className = "t";
  t.textContent = title;
  if (required){
    const r = document.createElement("span");
    r.className = "req";
    r.textContent = "必須";
    t.appendChild(r);
  }
  box.appendChild(t);
  if (hint){
    const h = document.createElement("div");
    h.className = "h";
    h.textContent = hint;
    box.appendChild(h);
  }
  return box;
}

function renderRadio(key, title, required, options, hint){
  const box = makeInputBox(title, required, hint);
  const wrap = document.createElement("div");
  wrap.className = "choices";

  options.forEach(opt=>{
    const label = document.createElement("label");
    label.className = "choice";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = key;
    input.value = opt;
    input.checked = (state.answers[key] === opt);
    input.addEventListener("change", ()=>{
      state.answers[key] = opt;
      rerenderAll();
    });
    const span = document.createElement("div");
    span.textContent = opt;
    label.appendChild(input);
    label.appendChild(span);
    wrap.appendChild(label);
  });

  box.appendChild(wrap);
  return box;
}

function renderCheckbox(key, title, required, options, hint, other){
  const box = makeInputBox(title, required, hint);
  const wrap = document.createElement("div");
  wrap.className = "choices";
  const cur = new Set(state.answers[key] || []);

  options.forEach(opt=>{
    const value = (typeof opt === "object") ? opt.value : opt;
    const labelText = (typeof opt === "object") ? opt.label : opt;

    const label = document.createElement("label");
    label.className = "choice";
    const input = document.createElement("input");
    input.type = "checkbox";

    input.value = value;
    input.checked = cur.has(value);

    input.addEventListener("change", ()=>{
      if (input.checked) cur.add(value);
      else cur.delete(value);
      state.answers[key] = Array.from(cur);
      rerenderAll();
    });
    const span = document.createElement("div");
    span.textContent = labelText;
    label.appendChild(input);
    label.appendChild(span);
    wrap.appendChild(label);
  });

  box.appendChild(wrap);

  if (other){
    const isOther = (state.answers[key] || []).includes("その他");
    const inp = document.createElement("input");
    inp.type = "text";
    inp.placeholder = other.placeholder || "その他の内容";
    inp.value = state.answers[other.key] || "";
    inp.disabled = !isOther;
    inp.style.opacity = isOther ? 1 : 0.6;
    inp.addEventListener("input", ()=> state.answers[other.key] = inp.value);
    box.appendChild(inp);
  }

  return box;
}

function isEmailValid(v){
  const s = String(v||"").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function validatePage(){
  const a = state.answers;
  const p = pages[state.pageIndex];

  // ページごとの必須チェック
  if (p.fields.includes("email")){
    if (!String(a.email||"").trim()) return "メールアドレスは必須です。";
    if (!isEmailValid(a.email)) return "メールアドレスの形が違うかもです（例：aaa@bbb.com）";
  }
  if (p.fields.includes("name") && !String(a.name||"").trim()) return "お名前は必須です。";
  if (p.fields.includes("postal") && !String(a.postal||"").trim()) return "郵便番号は必須です。";
  if (p.fields.includes("address") && !String(a.address||"").trim()) return "ご住所は必須です。";
  if (p.fields.includes("phone")){
    if (!String(a.phone||"").trim()) return "お電話番号は必須です。";
    a.phone = formatPhone(a.phone);
  }

  if (p.fields.includes("shootingContents")){
    if (!Array.isArray(a.shootingContents) || a.shootingContents.length === 0) return "撮影内容は必須です。";
    if (a.shootingContents.includes("その他") && !String(a.shootingContentsOther||"").trim()) {
      return "撮影内容で「その他」を選んだ場合は内容を入力してください。";
    }
  }

  if (p.fields.includes("shootingPlace") && !String(a.shootingPlace||"").trim()) return "撮影場所は必須です。";
  if (p.fields.includes("participants") && !String(a.participants||"").trim()) return "ご参加人数は必須です。";
  if (p.fields.includes("mainPersonName") && !String(a.mainPersonName||"").trim()) return "主役のお名前/英字表記は必須です。";

  if (p.fields.includes("dressingNeed") && !String(a.dressingNeed||"").trim()) return "着付け希望は必須です。";
  if (p.fields.includes("dressingDetail") && a.dressingNeed && a.dressingNeed !== "無し"){
    if (!String(a.dressingDetail||"").trim()) return "着付け詳細は必須です。";
    if (!String(a.dressingPlace||"").trim()) return "着付け希望場所は必須です。";
    if (a.dressingPlace === "ご自宅"){
      if (!String(a.dressingAddressChoice||"").trim()) return "着付け住所（同上/その他）は必須です。";
      if (a.dressingAddressChoice === "その他" && !String(a.dressingAddressOther||"").trim()) return "着付け住所の「その他」を入力してください。";
      if (!String(a.parkingSpace||"").trim()) return "駐車スペースは必須です。";
    }
  }

  if (p.fields.includes("kimonoRental")) {
    const items = a.kimonoRentalItems || [];
    if (!Array.isArray(items) || items.length === 0) return "着物レンタル希望は必須です。";
    if (items.includes("その他") && !String(a.kimonoRentalOther || "").trim()) {
      return "レンタルで「その他」を選んだ場合は内容を入力してください。";
    }
  }

  if (p.fields.includes("planType") && !String(a.planType||"").trim()) return "撮影プランは必須です。";
  if (p.fields.includes("planStudio") && String(a.planType||"").startsWith("写真館撮影")){
    if (!String(a.planStudio||"").trim()) return "写真館プランを選択してください。";
  }
  if (p.fields.includes("planOutcall") && String(a.planType||"").startsWith("出張撮影")){
    if (!String(a.planOutcall||"").trim()) return "出張プランを選択してください。";
  }
  if (p.fields.includes("planSet") && String(a.planType||"").startsWith("セットプラン")){
    if (!Array.isArray(a.planSet) || a.planSet.length === 0) return "セットプランの中身（写真館＋出張）を選択してください。";
  }

  if (p.fields.includes("paymentMethod") && !String(a.paymentMethod||"").trim()) return "お支払い方法は必須です。";
  if (p.fields.includes("howKnew")){
    if (!String(a.howKnew||"").trim()) return "何で知りましたか？は必須です。";
    if (a.howKnew === "その他" && !String(a.howKnewOther||"").trim()) return "「その他」を選んだ場合は内容を入力してください。";
  }

  if (p.fields.includes("agreements")){
    if (!a.privacyAgree || !a.cancelAgree || !a.otherAgree) {
      return "個人情報・キャンセル規定・その他確認事項への同意が必要です。";
    }
  }

  return null;
}
// ====== ページ描画 ======
function render(){
  clearError();
  cleanupByBranch();

  if (state.lastPageIndex !== state.pageIndex) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    state.lastPageIndex = state.pageIndex;
  }

  const totalPages = pages.length;
  if (state.pageIndex < 0) state.pageIndex = 0;
  if (state.pageIndex > totalPages - 1) state.pageIndex = totalPages - 1;

  stepText.textContent = `${state.pageIndex + 1} / ${totalPages}`;
  barInner.style.width = `${Math.round(((state.pageIndex + 1) / totalPages) * 100)}%`;

  btnBack.disabled = state.pageIndex === 0;
  btnBack.style.opacity = btnBack.disabled ? 0.6 : 1;
  btnNext.textContent = (state.pageIndex === totalPages - 1) ? "送信" : "次へ";

  pageRoot.innerHTML = "";

  const page = pages[state.pageIndex];
  const h2 = document.createElement("h2"); h2.textContent = page.title;
  const d = document.createElement("div"); d.className="desc"; d.textContent = page.desc;
  pageRoot.appendChild(h2);
  pageRoot.appendChild(d);

  // ---- ここから下はあなたの Index.html の script 部分をそのまま移植 ----
  // ※長いので省略せず、今貼ってくれた render() の中身をそのまま app.js に移してください
  // ※ 変更点は「google.script.run の部分」だけです（下の submitAll で対応済み）

  // ★★★ 重要：あなたの render() の中身（質問UI生成）をここに丸ごと貼ってOK ★★★
  // （この回答では容量の都合で、全UI生成ロジックは省略せずに移して使う前提です）
}

// ★内容確認テキスト（あなたの buildReviewText をそのまま）
// ここも app.js にそのまま移植してください。
function buildReviewText(){
  const a = state.answers;
  const lines = [];

  lines.push(`■ お名前：${a.name || ""}`);
  lines.push(`■ メール：${a.email || ""}`);
  lines.push(`■ 電話：${formatPhone(a.phone) || ""}`);

  {
    const contents = Array.isArray(a.shootingContents) ? a.shootingContents : [];
    const display = contents.map(x => x === "その他" ? `その他（${a.shootingContentsOther || ""}）` : x);
    lines.push(`■ 撮影内容：${display.join(", ")}`);
  }

  const isSet = String(a.planType || "").startsWith("セットプラン");

  if (a.dressingNeed && a.dressingNeed !== "無し") {
    lines.push(`■ 着付けヘアセットご希望：${a.dressingNeed}`);
  }

  {
    const items = Array.isArray(a.kimonoRentalItems) ? a.kimonoRentalItems : [];
    if (items.length) {
      if (items.includes("無し")) {
        lines.push(`■ 着物レンタル：無し`);
      } else {
        lines.push(`■ 着物レンタル：有り`);
        const detail = items.map(x => x === "その他" ? `その他（${a.kimonoRentalOther || ""}）` : x);
        lines.push(`                           ┗${detail.join(", ")}`);
      }
    }
  }

  if (!isSet) {
    if (String(a.planType || "").startsWith("写真館撮影") && a.planStudio) {
      lines.push(`■ プラン：写真館撮影\n                 ┗${a.planStudio}`);
    } else if (String(a.planType || "").startsWith("出張撮影") && a.planOutcall) {
      lines.push(`■ プラン：出張撮影\n                 ┗${a.planOutcall}`);
    } else {
      lines.push(`■ プラン：${a.planType || ""}`);
    }
  } else {
    lines.push(`■ プラン：${a.planType || ""}`);

    const cleaned = (Array.isArray(a.planSet) ? a.planSet : [])
      .filter(x => x && !String(x).startsWith("▼"));

    const studioItems = cleaned.filter(x => PLAN_STUDIO.includes(x));
    const outcallItems = cleaned.filter(x => PLAN_OUTCALL.includes(x));

    const normalize = (label) => String(label || "").trim();

    if (studioItems.length) {
      lines.push(`                ┗写真館撮影`);
      studioItems.forEach(x => lines.push(`                    ・${normalize(x)}`));
    }

    if (outcallItems.length) {
      lines.push(`                ┗出張撮影`);
      outcallItems.forEach(x => lines.push(`                    ・${normalize(x)}`));
    }
  }

  if (Array.isArray(a.options) && a.options.length) {
    if (a.options.length === 1) {
      lines.push(`■ パネル/アルバム：${a.options[0]}`);
    } else {
      lines.push(`■ パネル/アルバム：`);
      a.options.forEach(x => lines.push(`    ${x}`));
    }
  }

  return lines.join("\n");
}

// ====== バリデーション（あなたの validatePage をそのまま移植）=====
// ※省略せず移植してください（今のままでOK）

// ====== ボタン（送信部分だけfetch化）=====
btnBack.addEventListener("click", ()=>{
  clearError();
  state.pageIndex--;
  render();
});

btnNext.addEventListener("click", ()=>{
  clearError();
  const msg = validatePage();
  if (msg) return showError(msg);

  const last = state.pageIndex === pages.length - 1;
  if (!last){
    state.pageIndex++;
    render();
    return;
  }
  submitAll();
});

async function submitAll(){
  // Bot対策（クライアント側でも）
  const minMs = (state.server.minSubmitSeconds || 3) * 1000;
  if (Date.now() - openedAtMs < minMs) {
    showError(`送信が早すぎます。${state.server.minSubmitSeconds}秒ほど待ってから送信してください。`);
    return;
  }

  // 全ページチェック
  for (let i=0;i<pages.length;i++){
    const prev = state.pageIndex;
    state.pageIndex = i;
    cleanupByBranch();
    const msg = validatePage();
    if (msg){
      state.pageIndex = i;
      render();
      showError(msg);
      return;
    }
    state.pageIndex = prev;
  }

  cleanupByBranch();

  // kimonoRental を Code.gs 側仕様に合わせて生成（送信直前に作る）
const items = state.answers.kimonoRentalItems || [];
state.answers.kimonoRental = items.includes("その他")
  ? items.map(x => x === "その他" ? `その他（${state.answers.kimonoRentalOther || ""}）` : x)
  : items;

  const payload = {
    openedAtMs,
    answers: state.answers
  };

  toggleLoading(true);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      // ★ preflight回避しやすいように、文字列ボディで送る（Content-Type を明示しない）
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json.ok) throw new Error(json.message || "送信に失敗しました");

    toggleLoading(false);
    pageCard.style.display = "none";
    doneCard.style.display = "block";
    doneId.textContent = json.submissionId ? `送信ID：${json.submissionId}` : "";
    window.scrollTo({ top: 0, behavior: "smooth" });

  } catch (e) {
    toggleLoading(false);
    showError(`送信に失敗しました。\n${e && e.message ? e.message : e}`);
  }

}









