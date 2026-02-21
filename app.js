// app.js（完全版）
// --------------------
const openedAtMs = Date.now();

// ★Vercel経由で叩く（同一オリジンなのでCORSにならない）
const API_BASE = "/api/forms";

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

// DOM
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
  { title:"② 撮影の基本", desc:"撮影内容とご希望を教えてください。", fields:["shootingContents","shootingPlace","participants","mainPersonName"] },
  { title:"③ 着付け・レンタル", desc:"必要な場合だけ追加項目が出ます。", fields:["dressingNeed","dressingDetail","dressingPlace","dressingAddressChoice","parkingSpace","kimonoRental"] },
  { title:"④ プラン選択", desc:"プランを選ぶと、次の選択肢が出ます。", fields:["planType","planStudio","planOutcall","planSet","options"] },
  { title:"⑤ 仕上げ（確認＆同意）", desc:"送信前に内容確認と同意をお願いします。", fields:["paymentMethod","howKnew","message","agreements","review"] }
];

// セット候補
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

// ====== 初期化 ======
(async function init(){
  try {
    const res = await fetch(`${API_BASE}?action=config`, { method:"GET" });
    const json = await res.json();
    if (!json.ok) throw new Error(json.message || "config取得に失敗");
    state.server = json.data;
    render();
  } catch (e) {
    showError(`初期化に失敗しました。\n${e && e.message ? e.message : e}`);
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

// 電話：数字だけ
function formatPhone(raw){
  return String(raw||"").replace(/\D/g,"");
}

// 分岐の不要値を掃除
function cleanupByBranch(){
  const a = state.answers;

  // options 表示順固定
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

  // 着付け無し
  if (a.dressingNeed === "無し") {
    a.dressingDetail = "";
    a.dressingPlace = "";
    a.dressingAddressChoice = "";
    a.dressingAddressOther = "";
    a.parkingSpace = "";
  }

  // 当写真館なら住所/駐車なし
  if (a.dressingPlace === "当写真館") {
    a.dressingAddressChoice = "";
    a.dressingAddressOther = "";
    a.parkingSpace = "";
  }

  // 着物レンタル：無し排他
  {
    const items = a.kimonoRentalItems || [];
    if (items.includes("無し")) {
      a.kimonoRentalItems = ["無し"];
      a.kimonoRentalOther = "";
    }
    if (!items.includes("その他")) a.kimonoRentalOther = "";
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

// ====== render ======
function render(){
  clearError();
  cleanupByBranch();

  // ページ変化時だけ上へ
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

  // ① 連絡先
  if (page.fields.includes("email") || page.fields.includes("name")){
    const grid = document.createElement("div"); grid.className="grid";

    if (page.fields.includes("email")){
      const box = makeInputBox("メールアドレス", true, "自動返信メールをお送りします");
      const input = document.createElement("input"); input.type="email";
      input.value = state.answers.email;
      input.addEventListener("input", ()=> state.answers.email = input.value);
      box.appendChild(input);
      grid.appendChild(box);
    }

    if (page.fields.includes("name")){
      const box = makeInputBox("お名前", true, "");
      const input = document.createElement("input"); input.type="text";
      input.value = state.answers.name;
      input.addEventListener("input", ()=> state.answers.name = input.value);
      box.appendChild(input);
      grid.appendChild(box);
    }
    pageRoot.appendChild(grid);
  }

  if (page.fields.includes("postal") || page.fields.includes("address") || page.fields.includes("phone")){
    const grid = document.createElement("div"); grid.className="grid";

    if (page.fields.includes("postal")){
      const box = makeInputBox("郵便番号", true, "例：123-4567");
      const input = document.createElement("input"); input.type="text";
      input.value = state.answers.postal;
      input.addEventListener("input", ()=> state.answers.postal = input.value);
      box.appendChild(input);
      grid.appendChild(box);
    }

    if (page.fields.includes("phone")){
      const box = makeInputBox("お電話番号", true, "ハイフン不要");
      const input = document.createElement("input"); input.type="tel";
      input.value = state.answers.phone;
      input.addEventListener("input", ()=> state.answers.phone = input.value);
      input.addEventListener("blur", ()=>{
        state.answers.phone = formatPhone(input.value);
        input.value = state.answers.phone;
      });
      box.appendChild(input);
      grid.appendChild(box);
    }
    pageRoot.appendChild(grid);

    if (page.fields.includes("address")){
      const box = makeInputBox("ご住所", true, "");
      const input = document.createElement("input"); input.type="text";
      input.value = state.answers.address;
      input.addEventListener("input", ()=> state.answers.address = input.value);
      box.appendChild(input);
      pageRoot.appendChild(box);
    }
  }

  // ② 撮影内容
  if (page.fields.includes("shootingContents")){
    pageRoot.appendChild(
      renderCheckbox(
        "shootingContents",
        "撮影内容（複数選択）",
        true,
        ["家族撮影","お宮参り撮影","バースデー撮影","七五三撮影","入学園/卒学園撮影","成人式撮影","還暦撮影(米寿なども含む)","ペット撮影","ウェディング前撮り","挙式披露宴撮影","その他"],
        "当てはまるものをすべて選択してください。",
        { key:"shootingContentsOther", placeholder:"その他の内容" }
      )
    );
  }

  if (page.fields.includes("shootingPlace")){
    const box = makeInputBox("撮影場所", true, "例：写真館、枚岡神社、石切神社、自宅、〇〇公園 など");
    const input = document.createElement("input"); input.type="text";
    input.value = state.answers.shootingPlace;
    input.addEventListener("input", ()=> state.answers.shootingPlace = input.value);
    box.appendChild(input);
    pageRoot.appendChild(box);
  }

  if (page.fields.includes("participants") || page.fields.includes("mainPersonName")){
    const grid = document.createElement("div"); grid.className="grid";

    if (page.fields.includes("participants")){
      const box = makeInputBox("ご参加人数", true, "例：5名（父/母/主役1歳女の子/祖父/祖母）");
      const input = document.createElement("input"); input.type="text";
      input.value = state.answers.participants;
      input.addEventListener("input", ()=> state.answers.participants = input.value);
      box.appendChild(input);
      grid.appendChild(box);
    }

    if (page.fields.includes("mainPersonName")){
      const box = makeInputBox("主役のお名前/英字表記", true, "例：十色 / toiro");
      const input = document.createElement("input"); input.type="text";
      input.value = state.answers.mainPersonName;
      input.addEventListener("input", ()=> state.answers.mainPersonName = input.value);
      box.appendChild(input);
      grid.appendChild(box);
    }

    pageRoot.appendChild(grid);
  }

// ③ 着付け
if (page.fields.includes("dressingNeed")) {
  pageRoot.appendChild(
    renderRadio(
      "dressingNeed",
      "着付けヘアセットご希望",
      true,
      ["着付けのみ", "着付けヘアセット", "無し"],
      ""
    )
  );

  // ✅ カレンダー（着付け無しの時だけ）
  if (state.answers.dressingNeed === "無し") {
    const calBox = makeInputBox(
      "撮影日予約（着付け無しの場合のみこちらから予約。着付け有りの場合は別途調整いたします。）",
      false,
      "空いている日時をご確認の上、カレンダーから直接ご予約ください。"
    );

    const iframe = document.createElement("iframe");
    iframe.src =
      "https://calendar.google.com/calendar/appointments/schedules/AcZssZ2Q_wC0CzmcBHxXcfeMv3yPEdyCGsU1A3MtYt5cnkGSwM6d5MiHEjRs7pBUoGYVCp4kUR2HXvW-?gv=true";
    iframe.style.border = "0";
    iframe.style.width = "100%";
    iframe.style.height = "650px";
    iframe.loading = "lazy";
    calBox.appendChild(iframe);

    const link = document.createElement("div");
    link.className = "h";
    link.innerHTML =
      '表示がうまく出ない場合は <a href="https://calendar.google.com/calendar/appointments/schedules/AcZssZ2Q_wC0CzmcBHxXcfeMv3yPEdyCGsU1A3MtYt5cnkGSwM6d5MiHEjRs7pBUoGYVCp4kUR2HXvW-?gv=true" target="_blank" rel="noopener">こちら</a> からご確認ください。';
    calBox.appendChild(link);

    pageRoot.appendChild(calBox);
  }
}

  // 着付け詳細（無し以外）
  if (page.fields.includes("dressingDetail") && state.answers.dressingNeed && state.answers.dressingNeed !== "無し"){
    const box = makeInputBox("着付けされる希望者の詳細", true, "例：着付けヘア 母1名 訪問着 / 7歳女の子1名 など");
    const input = document.createElement("input"); input.type="text";
    input.value = state.answers.dressingDetail;
    input.addEventListener("input", ()=> state.answers.dressingDetail = input.value);
    box.appendChild(input);
    pageRoot.appendChild(box);

    pageRoot.appendChild(
      renderRadio("dressingPlace","着付け希望場所",true,["当写真館","ご自宅"],"")
    );

    if (state.answers.dressingPlace === "ご自宅"){
      const box2 = makeInputBox("着付け場所ご住所", true, "祖母様ご自宅などの場合は「その他」にご記入ください");
      const wrap = document.createElement("div"); wrap.className="choices";

      ["同上","その他"].forEach(opt=>{
        const label = document.createElement("label"); label.className="choice";
        const input = document.createElement("input"); input.type="radio"; input.name="dressingAddressChoice";
        input.value = opt; input.checked = (state.answers.dressingAddressChoice === opt);
        input.addEventListener("change", ()=>{
          state.answers.dressingAddressChoice = opt;
          if (opt !== "その他") state.answers.dressingAddressOther = "";
          rerenderAll();
        });
        const span = document.createElement("div"); span.textContent = opt;
        label.appendChild(input); label.appendChild(span);
        wrap.appendChild(label);
      });
      box2.appendChild(wrap);

      const other = document.createElement("input");
      other.type="text";
      other.placeholder="その他の住所（必要な場合）";
      other.value = state.answers.dressingAddressOther;
      const enabled = (state.answers.dressingAddressChoice === "その他");
      other.disabled = !enabled;
      other.style.opacity = enabled ? 1 : 0.6;
      other.addEventListener("input", ()=> state.answers.dressingAddressOther = other.value);
      box2.appendChild(other);
      pageRoot.appendChild(box2);

      pageRoot.appendChild(
        renderRadio("parkingSpace","駐車空きスペースの有無",true,["空きスペース有り","空きスペース無し"],"")
      );
    }
  }

  // 着物レンタル
  if (page.fields.includes("kimonoRental")) {
    const box = makeInputBox("着物レンタル(訪問着、産着等)ご希望", true, "");
    const wrap = document.createElement("div");
    wrap.className = "choices";

    const OPTIONS = [
      "お支度セットプラン（着物/小物一式レンタル/着付けヘアセット代含む）",
      "訪問着",
      "産着",
      "七五三着物",
      "無し",
      "その他"
    ];

    const cur = new Set(state.answers.kimonoRentalItems || []);

    function applyExclusiveRules(changedValue, checked){
      if (changedValue === "無し" && checked){
        cur.clear();
        cur.add("無し");
        state.answers.kimonoRentalOther = "";
        return;
      }
      if (changedValue !== "無し" && checked){
        cur.delete("無し");
      }
      if (changedValue === "その他" && !checked){
        state.answers.kimonoRentalOther = "";
      }
    }

    OPTIONS.forEach(labelText => {
      const label = document.createElement("label");
      label.className = "choice";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = cur.has(labelText);

      input.addEventListener("change", () => {
        const checked = input.checked;
        if (checked) cur.add(labelText);
        else cur.delete(labelText);

        applyExclusiveRules(labelText, checked);
        state.answers.kimonoRentalItems = Array.from(cur);
        rerenderAll();
      });

      const span = document.createElement("div");
      span.textContent = labelText;

      label.appendChild(input);
      label.appendChild(span);
      wrap.appendChild(label);
    });

    box.appendChild(wrap);

    const other = document.createElement("input");
    other.type = "text";
    other.placeholder = "その他の内容をご記入ください";
    const isOther = (state.answers.kimonoRentalItems || []).includes("その他");
    other.value = state.answers.kimonoRentalOther || "";
    other.disabled = !isOther;
    other.style.opacity = isOther ? 1 : 0.6;
    other.addEventListener("input", () => state.answers.kimonoRentalOther = other.value);
    box.appendChild(other);

    pageRoot.appendChild(box);
}
    
  // ④ プラン
  if (page.fields.includes("planType")){
    pageRoot.appendChild(
      renderRadio("planType","ご希望の撮影プラン",true,[
        "写真館撮影 30,000円~",
        "出張撮影 ※東大阪市のみ出張費無料",
        "セットプラン(写真館&出張撮影) 合計金額 -5,000円OFF🉐"
      ],"")
    );
  }

  if (page.fields.includes("planStudio") && String(state.answers.planType||"").startsWith("写真館撮影")){
    pageRoot.appendChild(renderRadio("planStudio","写真館撮影プラン（当日変更OK）",true, PLAN_STUDIO,""));
  }

  if (page.fields.includes("planOutcall") && String(state.answers.planType||"").startsWith("出張撮影")){
    pageRoot.appendChild(renderRadio("planOutcall","出張撮影プラン",true, PLAN_OUTCALL,""));
  }

  if (page.fields.includes("planSet") && String(state.answers.planType||"").startsWith("セットプラン")){
    const opts = ["▼写真館撮影", ...PLAN_STUDIO, "▼出張撮影", ...PLAN_OUTCALL];

    const box = makeInputBox("セットプラン選択（写真館＋出張）", true, "合計から5,000円OFFになります");
    const wrap = document.createElement("div"); wrap.className="choices";
    const cur = new Set(state.answers.planSet || []);

    opts.forEach(opt=>{
      const isHeader = opt.startsWith("▼");
      const label = document.createElement("label"); label.className="choice";
      if (isHeader){ label.style.opacity = 0.75; label.style.cursor="default"; }

      const input = document.createElement("input"); input.type="checkbox";
      input.disabled = isHeader;
      input.checked = cur.has(opt);

      input.addEventListener("change", ()=>{
        if (input.checked) cur.add(opt);
        else cur.delete(opt);

        // 見出し除外
        opts.filter(x=>x.startsWith("▼")).forEach(x=>cur.delete(x));

        state.answers.planSet = Array.from(cur);
        rerenderAll();
      });

      const span = document.createElement("div"); span.textContent = opt;
      label.appendChild(input); label.appendChild(span);
      wrap.appendChild(label);
    });

    box.appendChild(wrap);
    pageRoot.appendChild(box);
  }

  // options
  if (page.fields.includes("options")){
    pageRoot.appendChild(
      renderCheckbox("options","パネル/アルバム（任意）",false,[
        "① A4木製ガラスパネル (305×220mm) ¥16,500（2枚目から10%OFF）",
        "② 2面台紙 (216×216mm) ¥25,000",
        "③ 3面台紙 (216×216mm) ¥30,000",
        "④ アルバム10P M (216×216mm) ¥35,000",
        "⑤ アルバム10P L (305×305mm) ¥40,000",
        "⑥ クリスタルアルバム10P (301×299mm) ¥55,000"
      ],"ご予約時のご注文に限り → 表記価格より10%OFF")
    );
  }

  // ⑤ 仕上げ
  if (page.fields.includes("paymentMethod")){
    pageRoot.appendChild(renderRadio("paymentMethod","お支払い方法",true,["現金払い","お振り込み"],""));
  }

  if (page.fields.includes("howKnew")){
    const box = makeInputBox("当店を何で知りましたか？", true, "ご紹介の場合はその他にご記入ください");
    const wrap = document.createElement("div"); wrap.className="choices";

    ["ホームページ","Instagram","Googleマップ","リピーター","その他"].forEach(opt=>{
      const label = document.createElement("label"); label.className="choice";
      const input = document.createElement("input"); input.type="radio"; input.name="howKnew";
      input.value = opt; input.checked = (state.answers.howKnew === opt);
      input.addEventListener("change", ()=>{
        state.answers.howKnew = opt;
        if (opt !== "その他") state.answers.howKnewOther = "";
        rerenderAll();
      });
      const span = document.createElement("div"); span.textContent = opt;
      label.appendChild(input); label.appendChild(span);
      wrap.appendChild(label);
    });

    box.appendChild(wrap);

    const other = document.createElement("input");
    other.type="text";
    other.placeholder="その他（ご紹介者名など）";
    other.value = state.answers.howKnewOther;
    const enabled = (state.answers.howKnew === "その他");
    other.disabled = !enabled;
    other.style.opacity = enabled ? 1 : 0.6;
    other.addEventListener("input", ()=> state.answers.howKnewOther = other.value);
    box.appendChild(other);

    pageRoot.appendChild(box);
  }

  if (page.fields.includes("message")){
    const box = makeInputBox("備考（任意）", false, "");
    const ta = document.createElement("textarea");
    ta.value = state.answers.message;
    ta.addEventListener("input", ()=> state.answers.message = ta.value);
    box.appendChild(ta);
    pageRoot.appendChild(box);
  }

  if (page.fields.includes("agreements")){
    const box = document.createElement("div");
    box.className = "q";
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = "同意（送信に必要です）";
    const r = document.createElement("span"); r.className="req"; r.textContent="必須";
    t.appendChild(r);
    box.appendChild(t);

    const details1 = document.createElement("details");
    const sum1 = document.createElement("summary");
    sum1.textContent = "個人情報の取扱い（タップで表示）";
    const body1 = document.createElement("div");
    body1.className = "terms";
    body1.textContent =
`・ご入力いただいた情報は、ご予約対応・連絡・サービス提供の目的で利用します。
・第三者へ提供しません（法令に基づく場合を除きます）。
・必要に応じて、確認のためご連絡する場合があります。`;
    details1.appendChild(sum1); details1.appendChild(body1);

    const details2 = document.createElement("details");
    const sum2 = document.createElement("summary");
    sum2.textContent = "キャンセル規定（タップで表示）";
    const body2 = document.createElement("div");
    body2.className = "terms";
    body2.textContent =
`・日程変更/キャンセルは、出来るだけ早めにご連絡下さい。
・天候や体調不良など、事情ある場合は柔軟に対応させていただきます。
・お客様の都合で撮影をキャンセルする場合は以下のキャンセル料が発生します。
撮影当日〜3日前　撮影料金の全額
撮影日の4〜7日前　撮影料金の50%
撮影日の8〜14日前　撮影料金の30%`;
    details2.appendChild(sum2); details2.appendChild(body2);

    const details3 = document.createElement("details");
    const sum3 = document.createElement("summary");
    sum3.textContent = "その他確認事項（タップで表示）";
    const body3 = document.createElement("div");
    body3.className = "terms";
    body3.textContent = "（ここは必要ならあなたの文章に差し替えOK）";
    details3.appendChild(sum3); details3.appendChild(body3);

    box.appendChild(details1);
    box.appendChild(details2);
    box.appendChild(details3);

    function addAgree(key, labelText){
      const c = document.createElement("label"); c.className="choice";
      const i = document.createElement("input"); i.type="checkbox"; i.checked = !!state.answers[key];
      i.addEventListener("change", ()=> state.answers[key] = i.checked);
      const s = document.createElement("div"); s.textContent = labelText;
      c.appendChild(i); c.appendChild(s);
      box.appendChild(c);
    }

    addAgree("privacyAgree", "個人情報の取扱いに同意します");
    addAgree("cancelAgree", "キャンセル規定に同意します");
    addAgree("otherAgree", "その他確認事項に同意します");

    pageRoot.appendChild(box);
  }

  if (page.fields.includes("review")){
    const box = makeInputBox("内容確認（送信前）", false, "");
    const rv = document.createElement("div");
    rv.className = "review";
    rv.textContent = buildReviewText();
    box.appendChild(rv);
    pageRoot.appendChild(box);
  }
  }

function buildReviewText(){
  const a = state.answers;
  const lines = [];

  lines.push(`■ お名前：${a.name || ""}`);
  lines.push(`■ メール：${a.email || ""}`);
  lines.push(`■ 電話：${formatPhone(a.phone) || ""}`);

  const contents = Array.isArray(a.shootingContents) ? a.shootingContents : [];
  const display = contents.map(x => x === "その他" ? `その他（${a.shootingContentsOther || ""}）` : x);
  lines.push(`■ 撮影内容：${display.join(", ")}`);

  if (a.dressingNeed && a.dressingNeed !== "無し") {
    lines.push(`■ 着付けヘアセットご希望：${a.dressingNeed}`);
  }

  const items = Array.isArray(a.kimonoRentalItems) ? a.kimonoRentalItems : [];
  if (items.length) {
    if (items.includes("無し")) lines.push(`■ 着物レンタル：無し`);
    else {
      lines.push(`■ 着物レンタル：有り`);
      const detail = items.map(x => x === "その他" ? `その他（${a.kimonoRentalOther || ""}）` : x);
      lines.push(`            ┗${detail.join(", ")}`);
    }
  }

  const isSet = String(a.planType || "").startsWith("セットプラン");
  if (!isSet) {
    if (String(a.planType || "").startsWith("写真館撮影") && a.planStudio) {
      lines.push(`■ プラン：写真館撮影\n        ┗${a.planStudio}`);
    } else if (String(a.planType || "").startsWith("出張撮影") && a.planOutcall) {
      lines.push(`■ プラン：出張撮影\n        ┗${a.planOutcall}`);
    } else {
      lines.push(`■ プラン：${a.planType || ""}`);
    }
  } else {
    lines.push(`■ プラン：${a.planType || ""}`);
    const cleaned = (Array.isArray(a.planSet) ? a.planSet : []).filter(x => x && !String(x).startsWith("▼"));
    const studioItems = cleaned.filter(x => PLAN_STUDIO.includes(x));
    const outcallItems = cleaned.filter(x => PLAN_OUTCALL.includes(x));
    if (studioItems.length){
      lines.push(`        ┗写真館撮影`);
      studioItems.forEach(x => lines.push(`          ・${x}`));
    }
    if (outcallItems.length){
      lines.push(`        ┗出張撮影`);
      outcallItems.forEach(x => lines.push(`          ・${x}`));
    }
  }

  if (Array.isArray(a.options) && a.options.length) {
    lines.push(`■ パネル/アルバム：`);
    a.options.forEach(x => lines.push(`     ${x}`));
  }

  return lines.join("\n");
}

// レビューHTML
function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#39;");
}

function buildReviewHTML(){
  const a = state.answers;

  const items = [];

  // 連絡先
  items.push(rowL1("お名前", a.name));
  items.push(rowL1("メール", a.email));
  items.push(rowL1("電話", formatPhone(a.phone)));

  // 撮影内容
  {
    const contents = Array.isArray(a.shootingContents) ? a.shootingContents : [];
    const display = contents.map(x => x === "その他" ? `その他（${a.shootingContentsOther || ""}）` : x);
    items.push(rowL1("撮影内容", display.join("、")));
  }

  // 着付け
  if (a.dressingNeed && a.dressingNeed !== "無し"){
    items.push(rowL1("着付けヘアセットご希望", a.dressingNeed));
  }

  // 着物レンタル（★このブロックが画像の1つ目の対象）
  {
    const r = Array.isArray(a.kimonoRentalItems) ? a.kimonoRentalItems : [];
    if (r.length){
      if (r.includes("無し")){
        items.push(rowL1("着物レンタル", "無し"));
      } else {
        items.push(rowL1("着物レンタル", "有り"));
        const detail = r.map(x => x === "その他" ? `その他（${a.kimonoRentalOther || ""}）` : x);
        items.push(rowL2(detail.join("、"))); // ← 子を L2 で固定インデント
      }
    }
  }

  // プラン（★画像の2つ目の対象）
  const isSet = String(a.planType || "").startsWith("セットプラン");
  if (!isSet){
    if (String(a.planType || "").startsWith("写真館撮影") && a.planStudio){
      items.push(rowL1("プラン", "写真館撮影"));
      items.push(rowL2(a.planStudio));
    } else if (String(a.planType || "").startsWith("出張撮影") && a.planOutcall){
      items.push(rowL1("プラン", "出張撮影"));
      items.push(rowL2(a.planOutcall));
    } else {
      items.push(rowL1("プラン", a.planType || ""));
    }
  } else {
    items.push(rowL1("プラン", a.planType || ""));

    const cleaned = (Array.isArray(a.planSet) ? a.planSet : [])
      .filter(x => x && !String(x).startsWith("▼"));

    const studioItems = cleaned.filter(x => PLAN_STUDIO.includes(x));
    const outcallItems = cleaned.filter(x => PLAN_OUTCALL.includes(x));

    if (studioItems.length){
      items.push(rowL2("写真館撮影"));
      studioItems.forEach(x => items.push(rowL3(x))); // ← 孫を L3
    }
    if (outcallItems.length){
      items.push(rowL2("出張撮影"));
      outcallItems.forEach(x => items.push(rowL3(x)));
    }
  }

  // パネル/アルバム（★画像の3つ目の対象）
  if (Array.isArray(a.options) && a.options.length){
    items.push(rowL1("パネル/アルバム", ""));
    a.options.forEach(x => items.push(rowL2(x))); // ← まとめて L2 に揃う
  }

  return `<div class="reviewList">${items.join("")}</div>`;
}

// レベル別行
function rowL1(label, value){
  return `
    <div class="rv rv-l1">
      <div class="rv-mark">■</div>
      <div class="rv-body">
        <div class="rv-label">${esc(label)}：</div>
        <div class="rv-value">${esc(value)}</div>
      </div>
    </div>
  `;
}
function rowL2(text){
  return `
    <div class="rv rv-l2">
      <div class="rv-mark">┗</div>
      <div class="rv-body">
        <div class="rv-value">${esc(text)}</div>
      </div>
    </div>
  `;
}
function rowL3(text){
  return `
    <div class="rv rv-l3">
      <div class="rv-mark">・</div>
      <div class="rv-body">
        <div class="rv-value">${esc(text)}</div>
      </div>
    </div>
  `;
}

// ====== バリデーション ======
function isEmailValid(v){
  const s = String(v||"").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function validatePage(){
  const a = state.answers;
  const p = pages[state.pageIndex];

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
    if (a.shootingContents.includes("その他") && !String(a.shootingContentsOther||"").trim())
      return "撮影内容で「その他」を選んだ場合は内容を入力してください。";
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
      if (a.dressingAddressChoice === "その他" && !String(a.dressingAddressOther||"").trim())
        return "着付け住所の「その他」を入力してください。";
      if (!String(a.parkingSpace||"").trim()) return "駐車スペースは必須です。";
    }
  }

  if (p.fields.includes("kimonoRental")){
    const items = a.kimonoRentalItems || [];
    if (!Array.isArray(items) || items.length === 0) return "着物レンタル希望は必須です。";
    if (items.includes("その他") && !String(a.kimonoRentalOther||"").trim())
      return "レンタルで「その他」を選んだ場合は内容を入力してください。";
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

// ====== ボタン ======
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

  // GAS側へ渡すための整形（kimonoRental）
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
    const res = await fetch(`${API_BASE}?action=submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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














