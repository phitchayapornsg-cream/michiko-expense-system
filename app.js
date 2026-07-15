const storeKey = "michiko-expenses-v2";
const memoryKey = "michiko-memory-v1";

const fields = {
  date: document.getElementById("expenseDate"),
  voucherNo: document.getElementById("voucherNo"),
  paidTo: document.getElementById("paidTo"),
  branch: document.getElementById("branch"),
  category: document.getElementById("category"),
  paymentMethod: document.getElementById("paymentMethod"),
  billNo: document.getElementById("billNo"),
  detail: document.getElementById("detail"),
  preparedBy: document.getElementById("preparedBy"),
  reimbursementAccountName: document.getElementById("reimbursementAccountName"),
  reimbursementAccountNo: document.getElementById("reimbursementAccountNo"),
  note: document.getElementById("note")
};

const itemWrap = document.getElementById("items");
const recordList = document.getElementById("recordList");
const recordCount = document.getElementById("recordCount");
const recentList = document.getElementById("recentList");
const toast = document.getElementById("toast");
const documentDetail = document.getElementById("documentDetail");
const documentSubtitle = document.getElementById("documentSubtitle");
const pettyCashLimitInput = document.getElementById("pettyCashLimit");

const branchProfiles = [
  {
    match: "พหล",
    branch: "สาขาพหลโยธิน 21",
    companyThai: "บริษัท ไลฟ์ พาร์ทเนอร์ จำกัด",
    companyEn: "LIFE PARTNER CO., LTD.",
    clinicName: "LIFE PARTNER CLINIC",
    address: "9/2 ชั้น 1 โครงการศุภาลัย ปาร์ค อาคาร 1 ซอยพหลโยธิน 21 ถนนพหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพมหานคร 10900",
    taxId: "เลขทะเบียนนิติบุคคล 0105563080152",
    phone: "โทรศัพท์ : 064-165-5562",
    pettyCashLimit: 6000,
    voucherPrefix: "M"
  },
  {
    match: "ทองหล่อ",
    branch: "สาขาทองหล่อ",
    companyThai: "บริษัท มิชิโกะ456 จำกัด",
    companyEn: "MICHIKO456 CO.,LTD.",
    clinicName: "MICHIKO CLINIC",
    address: "สาขาทองหล่อ กรุงเทพมหานคร",
    taxId: "เลขประจำตัวผู้เสียภาษี 0105567045131",
    phone: "โทร : 095-4615442",
    pettyCashLimit: 4000,
    voucherPrefix: "M"
  },
  {
    match: "",
    branch: "สาขาเอ็มสเฟียร์",
    companyThai: "บริษัท มิชิโกะ456 จำกัด",
    companyEn: "MICHIKO456 CO.,LTD.",
    clinicName: "MICHIKO CLINIC",
    address: "628/630 ศูนย์การค้าเอ็มสเฟียร์ ชั้น 7 EM Tower แขวงคลองตัน เขตคลองเตย กรุงเทพ 10110",
    taxId: "เลขประจำตัวผู้เสียภาษี 0105567045131",
    phone: "โทร : 095-4615442",
    pettyCashLimit: 4000,
    voucherPrefix: "EM"
  }
];

let records = loadJson(storeKey, []);
let memory = normalizeMemory(loadJson(memoryKey, null), records);
let receiptData = "";
let selectedRecordId = null;
let activeDocTab = "voucher";
let editingRecordId = null;
let editingRecordType = "expense";

function getPettyCashLimit() {
  return Math.max(0, Number(pettyCashLimitInput?.value || localStorage.getItem("michiko-petty-cash-limit") || 4000));
}

function branchProfile(branchName = fields.branch?.value || "") {
  return branchProfiles.find(profile => profile.match && branchName.includes(profile.match)) || branchProfiles[branchProfiles.length - 1];
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeMemory(source, existingRecords) {
  const defaults = {
    expenseItems: ["ค่าอาหาร", "ค่าเดินทาง", "ค่าแท็กซี่", "ค่า Grab", "น้ำดื่ม", "เครื่องเขียน"],
    preparedBy: [],
    paidTo: [],
    reimbursementAccountNames: [],
    reimbursementAccountNumbers: [],
    category: ["ค่าเดินทาง", "ค่าส่งของ", "ซื้อวัสดุสำนักงาน", "ซื้ออุปกรณ์", "ค่าอาหาร", "อื่นๆ"]
  };
  const base = source && typeof source === "object" ? source : {};
  const next = {};
  Object.keys(defaults).forEach(type => {
    next[type] = {
      items: unique([...(defaults[type] || []), ...((base[type] && base[type].items) || [])]),
      favorites: unique((base[type] && base[type].favorites) || []),
      recent: unique((base[type] && base[type].recent) || [])
    };
  });

  existingRecords.forEach(record => {
    rememberValue("paidTo", record.paidTo, next, false);
    rememberValue("preparedBy", record.preparedBy, next, false);
    rememberValue("reimbursementAccountNames", record.reimbursementAccountName, next, false);
    rememberValue("reimbursementAccountNumbers", record.reimbursementAccountNo, next, false);
    rememberValue("category", record.category, next, false);
    (record.items || []).forEach(item => rememberValue("expenseItems", item.desc, next, false));
  });
  saveJson(memoryKey, next);
  return next;
}

function unique(values) {
  const seen = new Set();
  return values.map(v => String(v || "").trim()).filter(v => {
    const key = v.toLocaleLowerCase("th-TH");
    if (!v || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rememberValue(type, value, target = memory, persist = true) {
  const text = String(value || "").trim();
  if (!text || !target[type]) return;
  target[type].items = unique([text, ...target[type].items]);
  target[type].recent = unique([text, ...target[type].recent]).slice(0, 12);
  if (persist) {
    saveJson(memoryKey, target);
    renderRecentItems();
    refreshStars();
  }
}

function toggleFavorite(type, value) {
  const text = String(value || "").trim();
  if (!text || !memory[type]) return;
  rememberValue(type, text, memory, false);
  const favs = new Set(memory[type].favorites);
  favs.has(text) ? favs.delete(text) : favs.add(text);
  memory[type].favorites = unique([...favs]);
  saveJson(memoryKey, memory);
  refreshStars();
  renderRecentItems();
}

function suggestionsFor(type, query = "") {
  const data = memory[type] || { items: [], favorites: [], recent: [] };
  const q = query.trim().toLocaleLowerCase("th-TH");
  const ordered = unique([...data.favorites, ...data.recent, ...data.items]);
  return ordered
    .filter(item => !q || item.toLocaleLowerCase("th-TH").includes(q))
    .slice(0, 10)
    .map(item => ({ text: item, favorite: data.favorites.includes(item) }));
}

function setupSuggestField(wrapper, onPick) {
  const type = wrapper.dataset.memory;
  const input = wrapper.querySelector("input");
  const menu = wrapper.querySelector(".suggest-menu");
  const star = wrapper.querySelector(".star-btn");

  const render = () => {
    const options = suggestionsFor(type, input.value);
    menu.innerHTML = "";
    if (!options.length) {
      menu.innerHTML = `<div class="suggest-empty">ไม่พบรายการเดิม กด Enter หรือออกจากช่องเพื่อบันทึกรายการใหม่</div>`;
    } else {
      options.forEach(option => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "suggest-option";
        btn.innerHTML = `<span>${escapeHtml(option.text)}</span><span class="fav">${option.favorite ? "★" : ""}</span>`;
        btn.addEventListener("mousedown", event => {
          event.preventDefault();
          input.value = option.text;
          rememberValue(type, option.text);
          wrapper.classList.remove("open");
          onPick && onPick(option.text);
          updateTotals();
        });
        menu.appendChild(btn);
      });
    }
    wrapper.classList.add("open");
    refreshStars();
  };

  input.addEventListener("focus", render);
  input.addEventListener("input", () => {
    render();
    updateVoucher();
  });
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      rememberValue(type, input.value);
      wrapper.classList.remove("open");
      updateTotals();
    }
    if (event.key === "Escape") wrapper.classList.remove("open");
  });
  input.addEventListener("blur", () => {
    setTimeout(() => wrapper.classList.remove("open"), 120);
    rememberValue(type, input.value);
  });
  star.addEventListener("click", () => toggleFavorite(type, input.value));
}

function refreshStars() {
  document.querySelectorAll(".suggest-field").forEach(wrapper => {
    const type = wrapper.dataset.memory;
    const input = wrapper.querySelector("input");
    const star = wrapper.querySelector(".star-btn");
    const active = !!input.value.trim() && (memory[type]?.favorites || []).includes(input.value.trim());
    star.classList.toggle("active", active);
    star.textContent = active ? "★" : "☆";
  });
}

function renderRecentItems() {
  const items = suggestionsFor("expenseItems").slice(0, 12);
  recentList.innerHTML = "";
  if (!items.length) {
    recentList.innerHTML = `<span class="hint">ยังไม่มีรายการล่าสุด</span>`;
    return;
  }
  items.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "recent-chip";
    btn.textContent = `${item.favorite ? "★ " : ""}${item.text}`;
    btn.addEventListener("click", () => {
      const firstEmpty = [...itemWrap.querySelectorAll(".item-desc")].find(input => !input.value.trim());
      if (firstEmpty) {
        firstEmpty.value = item.text;
      } else {
        addItem(item.text, "");
      }
      rememberValue("expenseItems", item.text);
      updateTotals();
    });
    recentList.appendChild(btn);
  });
}

function todayISO() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function thaiDate(iso) {
  if (!iso) return "-";
  const date = new Date(iso + "T00:00:00");
  return date.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}

function voucherDate(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}/${Number(y)}`;
}

function englishMonthYear(value) {
  if (!value) return "-";
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatMoney(value) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(value || 0);
}

function formatPlainMoney(value) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

function makeVoucherNo() {
  const d = new Date(fields.date.value + "T00:00:00");
  const yy = String(d.getFullYear() + 543).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const profile = branchProfile(fields.branch.value);
  const prefix = `${profile.voucherPrefix || "M"}${yy}${mm}`;
  const used = records
    .filter(r => r.branch === fields.branch.value)
    .map(r => r.voucherNo)
    .filter(no => no && no.startsWith(prefix))
    .map(no => Number(no.slice(prefix.length)))
    .filter(Number.isFinite);
  const next = Math.max(0, ...used) + 1;
  fields.voucherNo.value = `${prefix}${String(next).padStart(3, "0")}`;
  updateVoucher();
}

function addItem(desc = "", amount = "") {
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <label>รายการ
      <div class="suggest-field" data-memory="expenseItems">
        <input class="item-desc" type="text" placeholder="รายละเอียดรายการ" value="${escapeHtml(desc)}" autocomplete="off">
        <button type="button" class="star-btn" title="รายการโปรด">☆</button>
        <div class="suggest-menu"></div>
      </div>
    </label>
    <label>จำนวนเงิน (บาท)
      <input class="item-amount" type="number" min="0" step="0.01" placeholder="0.00" value="${amount}">
    </label>
    <button class="item-remove" type="button" title="ลบรายการ">×</button>
  `;
  setupSuggestField(row.querySelector(".suggest-field"), updateTotals);
  row.querySelector(".item-remove").addEventListener("click", () => {
    if (itemWrap.children.length === 1) {
      row.querySelector(".item-desc").value = "";
      row.querySelector(".item-amount").value = "";
    } else {
      row.remove();
    }
    updateTotals();
  });
  row.addEventListener("input", updateTotals);
  row.querySelector(".item-desc").addEventListener("blur", event => rememberValue("expenseItems", event.target.value));
  itemWrap.appendChild(row);
  refreshStars();
  updateTotals();
}

function getItems() {
  return [...itemWrap.querySelectorAll(".item-row")].map(row => ({
    desc: row.querySelector(".item-desc").value.trim(),
    amount: Number(row.querySelector(".item-amount").value || 0)
  })).filter(item => item.desc || item.amount > 0);
}

function getTotal() {
  return getItems().reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

function thaiBahtText(amount) {
  amount = Math.round((Number(amount) || 0) * 100) / 100;
  if (amount === 0) return "ศูนย์บาทถ้วน";
  const nums = ["ศูนย์","หนึ่ง","สอง","สาม","สี่","ห้า","หก","เจ็ด","แปด","เก้า"];
  const units = ["","สิบ","ร้อย","พัน","หมื่น","แสน","ล้าน"];
  const readUnderMillion = num => {
    const str = String(Number(num));
    let result = "";
    for (let i = 0; i < str.length; i++) {
      const n = Number(str[i]);
      const pos = str.length - i - 1;
      if (n === 0) continue;
      if (pos === 0 && n === 1 && str.length > 1) result += "เอ็ด";
      else if (pos === 1 && n === 1) result += "สิบ";
      else if (pos === 1 && n === 2) result += "ยี่สิบ";
      else result += nums[n] + units[pos];
    }
    return result;
  };
  const readInt = num => {
    const str = String(Number(num));
    if (str.length <= 6) return readUnderMillion(str);
    const head = str.slice(0, -6);
    const tail = str.slice(-6);
    return readInt(head) + units[6] + (Number(tail) ? readUnderMillion(tail) : "");
  };
  const [baht, satangRaw] = amount.toFixed(2).split(".");
  const satang = Number(satangRaw);
  return `${readInt(Number(baht))}บาท${satang ? readInt(satang) + "สตางค์" : "ถ้วน"}`;
}

function updateTotals() {
  const total = getTotal();
  document.getElementById("totalAmount").textContent = formatMoney(total);
  document.getElementById("totalText").textContent = thaiBahtText(total);
  updateVoucher();
}

function collectForm(recordType = "expense") {
  return {
    id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    date: fields.date.value,
    voucherNo: fields.voucherNo.value,
    paidTo: fields.paidTo.value.trim(),
    branch: fields.branch.value,
    category: fields.category.value.trim(),
    paymentMethod: fields.paymentMethod.value,
    billNo: fields.billNo.value.trim(),
    detail: fields.detail.value.trim(),
    preparedBy: fields.preparedBy.value.trim(),
    reimbursementAccountName: fields.reimbursementAccountName.value.trim(),
    reimbursementAccountNo: fields.reimbursementAccountNo.value.trim(),
    note: fields.note.value.trim(),
    items: getItems(),
    total: getTotal(),
    recordType,
    receiptData,
    createdAt: new Date().toISOString()
  };
}

function validateForm(data) {
  if (!data.date) return "กรุณาระบุวันที่";
  if (!data.paidTo) return "กรุณาระบุผู้รับเงิน";
  if (!data.preparedBy) return "กรุณาระบุผู้จัดทำ";
  if (!data.category) return "กรุณาระบุหมวดหมู่";
  if (!data.items.length) return "กรุณาเพิ่มรายการค่าใช้จ่ายอย่างน้อย 1 รายการ";
  if (data.items.some(item => !item.desc || item.amount <= 0)) return "แต่ละรายการต้องมีรายละเอียดและจำนวนเงินมากกว่า 0";
  return "";
}

function saveRecord(recordType = "expense") {
  const data = collectForm(recordType);
  const error = validateForm(data);
  if (error) {
    showToast(error);
    return;
  }

  const editIndex = records.findIndex(record => record.id === editingRecordId);
  if (editIndex >= 0) {
    data.id = records[editIndex].id;
    data.createdAt = records[editIndex].createdAt || data.createdAt;
    data.updatedAt = new Date().toISOString();
    records[editIndex] = data;
  } else {
    records.unshift(data);
  }

  selectedRecordId = data.id;
  saveJson(storeKey, records);
  rememberValue("paidTo", data.paidTo);
  rememberValue("preparedBy", data.preparedBy);
  rememberValue("reimbursementAccountNames", data.reimbursementAccountName);
  rememberValue("reimbursementAccountNumbers", data.reimbursementAccountNo);
  rememberValue("category", data.category);
  data.items.forEach(item => rememberValue("expenseItems", item.desc));
  renderRecords();

  if (editIndex >= 0) {
    editingRecordId = null;
    editingRecordType = "expense";
    renderDocumentTemplates(data);
    showToast("บันทึกการแก้ไขแล้ว");
  } else {
    prepareNextVoucherForm(data.date);
    renderDocumentTemplates(data);
    showToast("บันทึกรายจ่ายแล้ว พร้อมเลขเอกสารถัดไป");
  }
  documentDetail.hidden = true;
}

function saveExpense() {
  saveRecord(editingRecordId ? editingRecordType : "expense");
}

function saveIncome() {
  saveRecord("income");
}
function renderRecords() {
  recordList.innerHTML = "";
  recordCount.textContent = `${records.length} รายการ`;
  if (!records.length) {
    recordList.innerHTML = `<p class="hint">ยังไม่มีรายการที่บันทึก</p>`;
    return;
  }
  records.forEach(record => {
    const el = document.createElement("article");
    el.className = "record";
    el.innerHTML = `
      <div class="record-top">
        <span>${escapeHtml(record.voucherNo)}${record.recordType === "income" ? " · รายรับ" : ""}</span>
        <span>${formatMoney(record.total)}</span>
      </div>
      <small>${thaiDate(record.date)} · ${escapeHtml(record.paidTo)} · ${escapeHtml(record.category)}</small>
      <div class="toolbar" style="justify-content:flex-start">
        <button class="secondary" type="button">เปิดดู</button>
        <button class="danger" type="button">ลบ</button>
      </div>
    `;
    const [openBtn, deleteBtn] = el.querySelectorAll("button");
    openBtn.addEventListener("click", () => openDocumentDetail(record));
    deleteBtn.addEventListener("click", () => {
      records = records.filter(item => item.id !== record.id);
      saveJson(storeKey, records);
      renderRecords();
      makeVoucherNo();
      showToast("ลบรายการแล้ว");
    });
    recordList.appendChild(el);
  });
}

function loadRecord(record) {
  fields.date.value = record.date;
  fields.voucherNo.value = record.voucherNo;
  fields.paidTo.value = record.paidTo;
  fields.branch.value = record.branch;
  fields.category.value = record.category;
  fields.paymentMethod.value = record.paymentMethod;
  fields.billNo.value = record.billNo;
  fields.detail.value = record.detail;
  fields.preparedBy.value = record.preparedBy;
  fields.reimbursementAccountName.value = record.reimbursementAccountName || "";
  fields.reimbursementAccountNo.value = record.reimbursementAccountNo || "";
  fields.note.value = record.note;
  receiptData = record.receiptData || "";
  itemWrap.innerHTML = "";
  (record.items || []).forEach(item => addItem(item.desc, item.amount));
  updateReceiptPreview();
  updateTotals();
  document.getElementById("voucher").scrollIntoView({ behavior: "smooth", block: "start" });
}

function applyRecordToForm(record) {
  fields.date.value = record.date || todayISO();
  fields.voucherNo.value = record.voucherNo || "";
  fields.paidTo.value = record.paidTo || "";
  fields.branch.value = record.branch || fields.branch.value;
  fields.category.value = record.category || "";
  fields.paymentMethod.value = record.paymentMethod || "เงินสด";
  fields.billNo.value = record.billNo || "";
  fields.detail.value = record.detail || "";
  fields.preparedBy.value = record.preparedBy || "";
  fields.reimbursementAccountName.value = record.reimbursementAccountName || "";
  fields.reimbursementAccountNo.value = record.reimbursementAccountNo || "";
  fields.note.value = record.note || "";
  receiptData = record.receiptData || "";
  itemWrap.innerHTML = "";
  (record.items || []).forEach(item => addItem(item.desc, item.amount));
  if (!itemWrap.children.length) addItem();
  updateReceiptPreview();
  updateTotals();
}

function openDocumentDetail(record) {
  selectedRecordId = record.id;
  renderDocumentTemplates(record);
  switchDocTab(activeDocTab || "voucher");
  documentDetail.hidden = false;
  documentSubtitle.textContent = `${record.voucherNo || "-"} · ${record.paidTo || "-"}`;
  documentDetail.scrollIntoView({ behavior: "smooth", block: "start" });
}

function selectedRecord() {
  return records.find(record => record.id === selectedRecordId) || collectForm();
}

function switchDocTab(tab) {
  activeDocTab = tab;
  document.querySelectorAll(".doc-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.docTab === tab));
  document.querySelectorAll(".doc-pane").forEach(pane => pane.classList.toggle("active", pane.dataset.docPane === tab));
}

function renderDocumentTemplates(record) {
  renderExpenseDetail(record);
  renderMonthlyPettyCash(record);
  updateVoucher(record);
}

function renderExpenseDetail(record) {
  const monthKey = (record.date || todayISO()).slice(0, 7);
  const monthLabel = englishMonthYear(record.date || todayISO());
  const monthRecords = records
    .filter(item => (item.date || "").startsWith(monthKey))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const pettyCashLimit = getPettyCashLimit();
  let balance = pettyCashLimit;
  let incomeTotal = 0;
  let outTotal = 0;
  setText("detailVoucherNo", `Expense Detail ${monthLabel}`);
  setText("detailDate", voucherDate(record.date));
  setText("detailPaidTo", record.paidTo || "-");
  setText("detailBalanceLabel", `Petty Cash Balance as of ${monthLabel}`);
  const body = document.getElementById("detailItems");
  body.innerHTML = "";
  monthRecords.forEach(entry => {
    const descriptions = (entry.items || []).map(item => item.desc).filter(Boolean).join(", ") || entry.detail || "-";
    const amount = Number(entry.total) || 0;
    const isIncome = entry.recordType === "income";
    if (isIncome) {
      incomeTotal += amount;
      balance += amount;
    } else {
      outTotal += amount;
      balance -= amount;
    }
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${voucherDate(entry.date)}</td>
      <td>${escapeHtml(entry.voucherNo || "")}</td>
      <td>${escapeHtml(entry.paidTo || "")}</td>
      <td>${escapeHtml(descriptions)}</td>
      <td>${escapeHtml(entry.billNo || "")}</td>
      <td style="text-align:right">${isIncome ? formatPlainMoney(amount) : ""}</td>
      <td style="text-align:right">${isIncome ? "" : formatPlainMoney(amount)}</td>
      <td style="text-align:right">${formatPlainMoney(balance)}</td>
    `;
    body.appendChild(tr);
  });
  while (body.children.length < 26) {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>";
    body.appendChild(tr);
  }
  setText("detailInTotal", formatPlainMoney(pettyCashLimit + incomeTotal));
  setText("detailOutTotal", formatPlainMoney(outTotal));
  setText("detailTotal", formatPlainMoney(balance));
}

function renderMonthlyPettyCash(record) {
  fields.reimbursementAccountName.value = record.reimbursementAccountName || "";
  fields.reimbursementAccountNo.value = record.reimbursementAccountNo || "";
  const monthKey = (record.date || todayISO()).slice(0, 7);
  const monthLabel = englishMonthYear(record.date || todayISO());
  const monthRecords = records.filter(item => (item.date || "").startsWith(monthKey));
  const total = monthRecords
    .filter(item => item.recordType !== "income")
    .reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const incomeTotal = monthRecords
    .filter(item => item.recordType === "income")
    .reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const limit = getPettyCashLimit();
  const remaining = Math.max(0, limit + incomeTotal - total);
  const reimbursement = Math.max(0, limit - remaining);
  setText("monthlyPeriod", monthLabel);
  setText("monthlyLimit", formatPlainMoney(limit));
  setText("monthlyExpenses", formatPlainMoney(total));
  setText("monthlyRemaining", formatPlainMoney(remaining));
  setText("monthlyReimbursement", formatPlainMoney(reimbursement));
  setText("monthlyWords", thaiBahtText(reimbursement));
  setText("monthlyTotal", formatPlainMoney(reimbursement));
  const body = document.getElementById("monthlyItems");
  body.innerHTML = "";
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${voucherDate(record.date)}</td>
    <td>ขอเบิกเงินสดย่อยประจำเดือน ${monthLabel}</td>
    <td style="text-align:right">${formatPlainMoney(reimbursement)}</td>
  `;
  body.appendChild(tr);
  const bankRow = document.createElement("tr");
  const accountName = record.reimbursementAccountName || "-";
  const accountNo = record.reimbursementAccountNo || "-";
  bankRow.innerHTML = `
    <td></td>
    <td>รายการตามใบเบิกเงินสดย่อยแนบ จำนวน ${monthRecords.length} รายการ · รายรับระหว่างเดือน ${formatPlainMoney(incomeTotal)} บาท<br>ชื่อบัญชีผู้เบิก: ${escapeHtml(accountName)} · เลขบัญชี: ${escapeHtml(accountNo)}</td>
    <td></td>
  `;
  body.appendChild(bankRow);
  while (body.children.length < 5) {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td></td><td></td><td></td>";
    body.appendChild(tr);
  }
}

function openCurrentDocument(tab) {
  const record = selectedRecord();
  renderDocumentTemplates(record);
  switchDocTab(tab);
  documentDetail.hidden = false;
  documentSubtitle.textContent = `${record.voucherNo || "-"} · ${record.paidTo || "-"}`;
  documentDetail.scrollIntoView({ behavior: "smooth", block: "start" });
}

function saveMonthlyAccountDetails() {
  const record = records.find(item => item.id === selectedRecordId);
  if (!record) return;
  record.reimbursementAccountName = fields.reimbursementAccountName.value.trim();
  record.reimbursementAccountNo = fields.reimbursementAccountNo.value.trim();
  saveJson(storeKey, records);
  rememberValue("reimbursementAccountNames", record.reimbursementAccountName);
  rememberValue("reimbursementAccountNumbers", record.reimbursementAccountNo);
  renderMonthlyPettyCash(record);
}

function printActiveDocument() {
  documentDetail.hidden = false;
  renderDocumentTemplates(selectedRecord());
  switchDocTab(activeDocTab || "voucher");
  document.body.classList.remove("print-voucher", "print-detail", "print-monthly");
  document.body.classList.add(`print-${activeDocTab}`);
  requestAnimationFrame(() => window.print());
}

function clearPrintMode() {
  document.body.classList.remove("print-voucher", "print-detail", "print-monthly");
}

function editSelectedRecord() {
  const record = selectedRecord();
  editingRecordId = record.id || null;
  editingRecordType = record.recordType || "expense";
  applyRecordToForm(record);
  document.getElementById("form").scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteSelectedRecord() {
  const record = selectedRecord();
  if (!record.id) return;
  records = records.filter(item => item.id !== record.id);
  saveJson(storeKey, records);
  selectedRecordId = null;
  documentDetail.hidden = true;
  renderRecords();
  makeVoucherNo();
  showToast("ลบรายการแล้ว");
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || "-";
}

function applyDocumentProfile(data = collectForm()) {
  const profile = branchProfile(data.branch);
  const companyLines = [
    `<strong>${escapeHtml(profile.companyThai)}</strong>`,
    `<strong>${escapeHtml(profile.companyEn)}</strong>`,
    escapeHtml(profile.address),
    profile.taxId ? escapeHtml(profile.taxId) : "",
    escapeHtml(profile.phone)
  ].filter(Boolean);
  const companyHtml = companyLines.join("<br>");
  const pvCompany = document.getElementById("pvCompanyInfo");
  if (pvCompany) pvCompany.innerHTML = companyHtml;
  setText("pvFooterBranch", profile.branch);
  setText("pvFooterCompany", profile.companyEn);
  setText("detailCompanyName", profile.companyEn);
  setText("detailCompanyLine", `${profile.companyEn} · ${profile.branch}`);
  setText("monthlyCompanyName", profile.clinicName);
  setText("monthlyCompanyLine", `${profile.companyEn} · ${profile.branch}`);
}

function updateVoucher(data = collectForm()) {
  applyDocumentProfile(data);
  setText("vVoucherNo", data.voucherNo);
  setText("vDate", voucherDate(data.date));
  setText("vPaidTo", data.paidTo);
  setText("vPrepared", data.preparedBy);
  setText("vReceivedBy", data.paidTo);
  setText("vReceivedDate", `วันที่ ${voucherDate(data.date)}`);
  setText("vPreparedDate", `วันที่ ${voucherDate(data.date)}`);
  setText("vTotal", formatPlainMoney(data.total));
  setText("vTotalText", thaiBahtText(data.total));
  document.getElementById("vCheckCash").textContent = data.paymentMethod === "เงินสด" ? "✓" : "";
  document.getElementById("vCheckTransfer").textContent = data.paymentMethod === "โอน" ? "✓" : "";
  document.getElementById("vCheckCheque").textContent = data.paymentMethod === "เช็คธนาคาร" ? "✓" : "";
  const body = document.getElementById("vItems");
  body.innerHTML = "";
  const items = data.items.length ? data.items : [{ desc: "-", amount: 0 }];
  body.classList.toggle("is-compact", items.length > 5);
  const rows = [...items];
  while (rows.length < 4) rows.push({ desc: "", amount: "" });
  rows.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(item.desc || "")}</td>
      <td class="pv-amount">${item.amount ? formatPlainMoney(item.amount) : ""}</td>
    `;
    body.appendChild(tr);
  });
}

function clearForm() {
  editingRecordId = null;
  editingRecordType = "expense";
  fields.date.value = todayISO();
  ["paidTo", "billNo", "detail", "preparedBy", "reimbursementAccountName", "reimbursementAccountNo", "note", "category"].forEach(key => fields[key].value = "");
  fields.branch.selectedIndex = 0;
  fields.paymentMethod.selectedIndex = 0;
  itemWrap.innerHTML = "";
  addItem();
  receiptData = "";
  updateReceiptPreview();
  makeVoucherNo();
  showToast("ล้างฟอร์มแล้ว");
}

function prepareNextVoucherForm(dateValue = fields.date.value) {
  editingRecordId = null;
  editingRecordType = "expense";
  fields.date.value = dateValue || todayISO();
  ["paidTo", "billNo", "detail", "preparedBy", "reimbursementAccountName", "reimbursementAccountNo", "note"].forEach(key => fields[key].value = "");
  itemWrap.innerHTML = "";
  addItem();
  receiptData = "";
  updateReceiptPreview();
  makeVoucherNo();
}

function exportCsv() {
  if (!records.length) {
    showToast("ยังไม่มีข้อมูลสำหรับส่งออก");
    return;
  }
  const header = ["Voucher No.","Date","Paid To","Branch","Category","Payment","Bill No.","Detail","Prepared By","Total","Items"];
  const rows = records.map(r => [
    r.voucherNo, r.date, r.paidTo, r.branch, r.category, r.paymentMethod, r.billNo,
    r.detail, r.preparedBy, r.total,
    (r.items || []).map(i => `${i.desc}: ${i.amount}`).join(" | ")
  ]);
  const csv = [header, ...rows].map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "michiko-expenses.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function updateReceiptPreview() {
  const img = document.getElementById("receiptPreview");
  img.src = receiptData || "";
  img.style.display = receiptData ? "block" : "none";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function readReceipt(file) {
  if (!file) return;
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    showToast("รองรับเฉพาะไฟล์ JPG หรือ PNG");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    receiptData = reader.result;
    updateReceiptPreview();
    showToast("แนบใบเสร็จแล้ว");
  };
  reader.readAsDataURL(file);
}

function init() {
  documentDetail.hidden = true;
  document.getElementById("todayText").textContent = thaiDate(todayISO());
  fields.date.value = todayISO();
  fields.category.value = "ค่าเดินทาง";

  if (pettyCashLimitInput) {
    pettyCashLimitInput.value = localStorage.getItem("michiko-petty-cash-limit") || pettyCashLimitInput.value || "4000";
    pettyCashLimitInput.addEventListener("input", () => {
      localStorage.setItem("michiko-petty-cash-limit", String(getPettyCashLimit()));
      renderDocumentTemplates(selectedRecord());
    });
  }

  document.querySelectorAll(".suggest-field").forEach(wrapper => {
    const isMonthlyAccount = wrapper.dataset.memory.startsWith("reimbursementAccount");
    setupSuggestField(wrapper, isMonthlyAccount ? saveMonthlyAccountDetails : updateVoucher);
  });
  fields.date.addEventListener("change", makeVoucherNo);
  fields.branch.addEventListener("change", () => {
    const profile = branchProfile(fields.branch.value);
    if (pettyCashLimitInput && !localStorage.getItem("michiko-petty-cash-limit")) {
      pettyCashLimitInput.value = String(profile.pettyCashLimit || 4000);
    }
    updateVoucher();
    renderDocumentTemplates(selectedRecord());
  });
  Object.values(fields).forEach(field => field.addEventListener("input", () => {
    updateVoucher();
    refreshStars();
  }));
  fields.reimbursementAccountName.addEventListener("change", saveMonthlyAccountDetails);
  fields.reimbursementAccountNo.addEventListener("change", saveMonthlyAccountDetails);
  document.getElementById("addItem").addEventListener("click", () => addItem());
  document.getElementById("saveExpense").addEventListener("click", saveExpense);
  document.getElementById("saveExpenseBottom").addEventListener("click", saveExpense);
  document.getElementById("saveIncome").addEventListener("click", saveIncome);
  document.getElementById("saveIncomeBottom").addEventListener("click", saveIncome);
  document.getElementById("clearForm").addEventListener("click", clearForm);
  document.getElementById("printVoucher").addEventListener("click", () => {
    documentDetail.hidden = false;
    switchDocTab("voucher");
    printActiveDocument();
  });
  document.querySelectorAll(".doc-tab").forEach(btn => {
    btn.addEventListener("click", () => switchDocTab(btn.dataset.docTab));
  });
  document.getElementById("docPrint").addEventListener("click", printActiveDocument);
  document.getElementById("docExportPdf").addEventListener("click", () => {
    showToast("เลือก Save as PDF ในหน้าต่างพิมพ์");
    printActiveDocument();
  });
  document.getElementById("docEdit").addEventListener("click", editSelectedRecord);
  document.getElementById("docDelete").addEventListener("click", deleteSelectedRecord);
  document.querySelectorAll("[data-open-doc]").forEach(btn => {
    btn.addEventListener("click", () => openCurrentDocument(btn.dataset.openDoc));
  });
  window.addEventListener("beforeprint", () => renderDocumentTemplates(selectedRecord()));
  window.addEventListener("afterprint", clearPrintMode);
  document.getElementById("exportCsv").addEventListener("click", exportCsv);
  document.querySelectorAll("[data-jump]").forEach(btn => {
    btn.addEventListener("click", () => document.getElementById(btn.dataset.jump).scrollIntoView({ behavior: "smooth", block: "start" }));
  });

  const dropzone = document.getElementById("dropzone");
  const receiptInput = document.getElementById("receiptInput");
  receiptInput.addEventListener("change", () => readReceipt(receiptInput.files[0]));
  dropzone.addEventListener("dragover", event => {
    event.preventDefault();
    dropzone.style.borderColor = "var(--brand)";
  });
  dropzone.addEventListener("dragleave", () => dropzone.style.borderColor = "#d6beb3");
  dropzone.addEventListener("drop", event => {
    event.preventDefault();
    dropzone.style.borderColor = "#d6beb3";
    readReceipt(event.dataTransfer.files[0]);
  });

  addItem();
  makeVoucherNo();
  renderRecords();
  renderRecentItems();
  updateVoucher();
}

init();
