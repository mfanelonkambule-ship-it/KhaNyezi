import { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   KhaNyezi Treats — Lady of Light ✦ Star
   Bakery showcase + ordering + quote management
   Data is stored in shared artifact storage so everyone who
   opens this app sees the same cakes, orders and quotes.
   ============================================================ */

const ADMINS = {
  charity: { email: "Charity.Nkambule@gmail.com", name: "Charity", role: "Main administrator" },
  mfanelo: { email: "Mfanelo.Nkambule@gmail.com", name: "Mfanelo", role: "Administrator" },
};

const K = {
  cakes: "khanyezi-cakes-index",
  img: (id) => `khanyezi-img-${id}`,
  orders: "khanyezi-orders",
  settings: "khanyezi-settings",
};

/* ---------- storage helpers (shared = visible to everyone) ---------- */
async function sGet(key, fallback) {
  try {
    const r = await window.storage.get(key, true);
    return r ? JSON.parse(r.value) : fallback;
  } catch {
    return fallback;
  }
}
async function sSet(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), true);
    return true;
  } catch {
    return false;
  }
}
async function sDel(key) {
  try { await window.storage.delete(key, true); } catch {}
}

/* ---------- image compression so photos fit in storage ---------- */
function compressImage(file, maxSide = 900, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxSide / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- the logo: a radiant star rising from a cupcake ---------- */
function Logo({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-label="KhaNyezi Treats logo">
      <defs>
        <radialGradient id="glow" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#FFE28A" />
          <stop offset="100%" stopColor="#FFE28A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD34D" />
          <stop offset="100%" stopColor="#F5A623" />
        </linearGradient>
        <linearGradient id="icing" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF8FB5" />
          <stop offset="100%" stopColor="#E64980" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="42" r="34" fill="url(#glow)" />
      {/* rays of light */}
      {[...Array(8)].map((_, i) => {
        const a = (i * Math.PI) / 4;
        const x1 = 60 + Math.cos(a) * 22, y1 = 40 + Math.sin(a) * 22;
        const x2 = 60 + Math.cos(a) * 30, y2 = 40 + Math.sin(a) * 30;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#F5A623" strokeWidth="2.5" strokeLinecap="round" />;
      })}
      {/* star */}
      <path d="M60 24 L64.5 35.5 L76 37 L67.5 45 L70 56.5 L60 50.5 L50 56.5 L52.5 45 L44 37 L55.5 35.5 Z" fill="url(#star)" stroke="#C77800" strokeWidth="1.5" strokeLinejoin="round" />
      {/* cupcake icing */}
      <path d="M38 70 Q42 58 60 58 Q78 58 82 70 Q86 72 84 76 L36 76 Q34 72 38 70 Z" fill="url(#icing)" />
      <circle cx="47" cy="66" r="2.4" fill="#FFF6EC" /><circle cx="60" cy="63" r="2.4" fill="#FFE28A" /><circle cx="73" cy="66" r="2.4" fill="#FFF6EC" />
      {/* cupcake case */}
      <path d="M39 78 L81 78 L75 102 L45 102 Z" fill="#8A4B2E" />
      <path d="M46 78 L50 102 M54 78 L57 102 M62 78 L62 102 M70 78 L67 102 M78 78 L73 102" stroke="#6B3620" strokeWidth="2" />
    </svg>
  );
}

/* Zulu-beadwork-inspired divider */
function BeadDivider() {
  const beads = ["#E64980", "#F5A623", "#2FA88E", "#FFD34D", "#E64980", "#2FA88E", "#F5A623"];
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "26px 0" }} aria-hidden="true">
      {beads.map((c, i) => (
        <span key={i} style={{ width: 10, height: 10, background: c, transform: i % 2 ? "rotate(45deg)" : "none", borderRadius: i % 2 ? 2 : "50%" }} />
      ))}
    </div>
  );
}

/* ---------- quote message builder ---------- */
function buildQuoteMessage(order, amount, notes) {
  return (
    `✦ KhaNyezi Treats ✦%0A` +
    `Baked with light, topped with stars%0A%0A` +
    `Hello ${order.name},%0A%0A` +
    `Thank you for your cake request!%0A%0A` +
    `🎂 Your cake: ${order.desc}%0A` +
    `📅 Needed by: ${order.dateNeeded}%0A` +
    `💰 Quotation: R ${amount}%0A` +
    (notes ? `📝 Notes: ${notes}%0A` : "") +
    `%0APlease reply with ACCEPT to confirm your order, or DECLINE if you'd like to change anything.%0A%0A` +
    `With love and light,%0ACharity — KhaNyezi Treats ✦`
  );
}

export default function KhaNyeziTreats() {
  const [page, setPage] = useState("home");
  const [cakes, setCakes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(null); // 'charity' | 'mfanelo' | null
  const [viewCake, setViewCake] = useState(null);
  const [slide, setSlide] = useState(0);
  const [toast, setToast] = useState(null);

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  /* load everything */
  useEffect(() => {
    (async () => {
      const [c, o, s] = await Promise.all([
        sGet(K.cakes, []),
        sGet(K.orders, []),
        sGet(K.settings, { pins: {}, }),
      ]);
      setCakes(c); setOrders(o); setSettings(s);
      setLoading(false);
      // load images progressively
      for (const cake of c) {
        const r = await sGet(K.img(cake.id), null);
        if (r) setImages((m) => ({ ...m, [cake.id]: r }));
      }
    })();
  }, []);

  /* slideshow: next cake every 5 seconds */
  useEffect(() => {
    if (cakes.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % cakes.length), 5000);
    return () => clearInterval(t);
  }, [cakes.length]);

  const saveOrders = async (next) => { setOrders(next); await sSet(K.orders, next); };

  /* ---------- add / delete cakes (admins only) ---------- */
  const addCake = async (file, name, desc) => {
    try {
      const dataUrl = await compressImage(file);
      const id = Date.now().toString(36);
      const cake = { id, name: name || "Untitled cake", desc: desc || "", added: new Date().toISOString().slice(0, 10) };
      const okImg = await sSet(K.img(id), dataUrl);
      if (!okImg) { notify("Could not save the photo — it may be too large."); return; }
      const next = [cake, ...cakes];
      setCakes(next); setImages((m) => ({ ...m, [id]: dataUrl }));
      await sSet(K.cakes, next);
      notify("Cake added — everyone can now see it ✦");
    } catch {
      notify("Something went wrong saving the photo. Please try again.");
    }
  };
  const deleteCake = async (id) => {
    const next = cakes.filter((c) => c.id !== id);
    setCakes(next); await sSet(K.cakes, next); await sDel(K.img(id));
    notify("Cake removed");
  };

  /* ---------- styles ---------- */
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Nunito:wght@400;600;700&display=swap');
    .kz * { box-sizing: border-box; }
    .kz { font-family: 'Nunito', sans-serif; color: #4A2C2A; background:
      linear-gradient(180deg, #FFF6EC 0%, #FFEDE0 40%, #FFF6EC 100%); min-height: 100vh; }
    .kz h1,.kz h2,.kz h3 { font-family: 'Baloo 2', cursive; margin: 0; }
    .kz .wrap { max-width: 1000px; margin: 0 auto; padding: 0 18px; }
    .kz .btn { border: none; border-radius: 999px; padding: 12px 22px; font-weight: 700; font-family: 'Nunito';
      cursor: pointer; font-size: 15px; transition: transform .15s; }
    .kz .btn:hover { transform: translateY(-2px); }
    .kz .btn:focus-visible { outline: 3px solid #F5A623; outline-offset: 2px; }
    .kz .btn-pink { background: linear-gradient(180deg,#FF6FA5,#E64980); color: white; box-shadow: 0 4px 14px rgba(230,73,128,.35); }
    .kz .btn-gold { background: linear-gradient(180deg,#FFD34D,#F5A623); color: #4A2C2A; }
    .kz .btn-ghost { background: rgba(255,255,255,.7); color: #4A2C2A; border: 2px solid #F5C6A5; }
    .kz input, .kz textarea, .kz select { width: 100%; padding: 12px 14px; border-radius: 14px; border: 2px solid #F5C6A5;
      background: white; font-family: 'Nunito'; font-size: 15px; margin-bottom: 12px; }
    .kz input:focus, .kz textarea:focus { outline: 3px solid #FFD34D; border-color: #F5A623; }
    .kz .card { background: white; border-radius: 22px; box-shadow: 0 6px 24px rgba(74,44,42,.10); overflow: hidden; }
    .kz .nav-b { background: none; border: none; font-family:'Baloo 2'; font-weight:700; font-size:16px; color:#4A2C2A;
      padding: 8px 14px; border-radius: 999px; cursor: pointer; }
    .kz .nav-b.on { background: #E64980; color: white; }
    .kz .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 18px; }
    .kz .cakecard { cursor: pointer; transition: transform .18s; }
    .kz .cakecard:hover { transform: translateY(-4px) rotate(-.5deg); }
    .kz .collage { display: grid; grid-template-columns: repeat(6, 1fr); grid-auto-rows: 90px; gap: 8px; }
    .kz .collage img { width: 100%; height: 100%; object-fit: cover; border-radius: 14px; }
    .kz .collage > *:nth-child(4n+1) { grid-row: span 2; grid-column: span 2; }
    .kz table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .kz th { text-align: left; padding: 10px; background: #FFE8D6; font-family: 'Baloo 2'; }
    .kz td { padding: 10px; border-bottom: 1px solid #FFE8D6; vertical-align: top; }
    .kz .pill { display:inline-block; padding: 3px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    @media (max-width: 640px) { .kz .collage { grid-template-columns: repeat(3, 1fr); } }
    @media (prefers-reduced-motion: reduce) { .kz .btn, .kz .cakecard { transition: none; } }
  `;

  const statusPill = (s) => {
    const map = { new: ["#FFE8D6", "#8A4B2E", "New request"], quoted: ["#FFF3C4", "#8a6d00", "Quote sent"], accepted: ["#D9F2E5", "#1c7a53", "Accepted ✓"], declined: ["#FCE0E8", "#a1274f", "Declined"] };
    const [bg, fg, label] = map[s] || map.new;
    return <span className="pill" style={{ background: bg, color: fg }}>{label}</span>;
  };

  /* ================= PAGES ================= */

  const Home = () => (
    <div>
      {/* hero with slideshow */}
      <div style={{ textAlign: "center", padding: "36px 0 8px" }}>
        <Logo size={110} />
        <h1 style={{ fontSize: "clamp(34px, 6vw, 56px)", color: "#E64980", lineHeight: 1.05 }}>
          KhaNyezi <span style={{ color: "#F5A623" }}>Treats</span>
        </h1>
        <p style={{ fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", fontSize: 13, color: "#8A4B2E" }}>
          Nokukhanya ✦ Nkanyezi — Lady of Light, baked under a Star
        </p>
      </div>

      {cakes.length > 0 ? (
        <div className="card" style={{ maxWidth: 720, margin: "18px auto", position: "relative" }}>
          {images[cakes[slide % cakes.length]?.id] ? (
            <img src={images[cakes[slide % cakes.length].id]} alt={cakes[slide % cakes.length].name}
              style={{ width: "100%", height: 380, objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ height: 380, display: "grid", placeItems: "center", background: "#FFE8D6" }}>Loading photo…</div>
          )}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "30px 20px 14px", background: "linear-gradient(transparent, rgba(74,44,42,.75))", color: "white" }}>
            <h3 style={{ fontSize: 22 }}>{cakes[slide % cakes.length]?.name}</h3>
            <small>Photo {(slide % cakes.length) + 1} of {cakes.length} · changes every 5 seconds</small>
          </div>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 720, margin: "18px auto", padding: 40, textAlign: "center" }}>
          <h3>No cakes yet ✦</h3>
          <p>Charity or Mfanelo can sign in on the Admin page and add the first cake photos.</p>
        </div>
      )}

      <div style={{ textAlign: "center", margin: "10px 0 6px" }}>
        <button className="btn btn-pink" onClick={() => setPage("order")}>Ask about a cake 🎂</button>{" "}
        <button className="btn btn-gold" onClick={() => setPage("gallery")}>See the gallery</button>
      </div>

      <BeadDivider />

      {/* collage */}
      {cakes.length > 0 && (
        <div className="wrap" style={{ paddingBottom: 40 }}>
          <h2 style={{ textAlign: "center", color: "#8A4B2E", marginBottom: 14 }}>A little collage of joy</h2>
          <div className="collage">
            {cakes.slice(0, 12).map((c) =>
              images[c.id] ? <img key={c.id} src={images[c.id]} alt={c.name} onClick={() => setViewCake(c)} style={{ cursor: "pointer" }} /> : null
            )}
          </div>
        </div>
      )}
    </div>
  );

  const Gallery = () => (
    <div className="wrap" style={{ padding: "30px 18px 50px" }}>
      <h2 style={{ color: "#E64980", textAlign: "center", fontSize: 32 }}>Our cakes</h2>
      <p style={{ textAlign: "center", marginTop: 4 }}>Touch a picture to see more about that bake.</p>
      <BeadDivider />
      {cakes.length === 0 && <p style={{ textAlign: "center" }}>Nothing here yet — check back soon!</p>}
      <div className="grid">
        {cakes.map((c) => (
          <div key={c.id} className="card cakecard" onClick={() => setViewCake(c)} role="button" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setViewCake(c)}>
            {images[c.id] ? (
              <img src={images[c.id]} alt={c.name} style={{ width: "100%", height: 190, objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ height: 190, background: "#FFE8D6", display: "grid", placeItems: "center" }}>Loading…</div>
            )}
            <div style={{ padding: "12px 14px" }}>
              <h3 style={{ fontSize: 17 }}>{c.name}</h3>
              <small style={{ color: "#8A4B2E" }}>Baked {c.added}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ---------- order form ---------- */
  const OrderForm = () => {
    const [f, setF] = useState({ name: "", surname: "", desc: "", email: "", phone: "", dateNeeded: "" });
    const [done, setDone] = useState(false);
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
    const submit = async () => {
      if (!f.name || !f.surname || !f.desc || !f.email || !f.phone || !f.dateNeeded) { notify("Please fill in every field 🍰"); return; }
      const order = { id: Date.now().toString(36), ...f, submittedAt: new Date().toISOString().slice(0, 16).replace("T", " "), status: "new" };
      await saveOrders([order, ...orders]);
      setDone(order);
    };
    if (done) {
      const body = `New cake request from ${done.name} ${done.surname}%0A%0ACake wanted: ${done.desc}%0ANeeded by: ${done.dateNeeded}%0AEmail: ${done.email}%0APhone: ${done.phone}`;
      return (
        <div className="wrap" style={{ padding: 40, maxWidth: 560 }}>
          <div className="card" style={{ padding: 30, textAlign: "center" }}>
            <Logo size={70} />
            <h2 style={{ color: "#2FA88E" }}>Request received! ✦</h2>
            <p>Your request has been saved and Charity will see it on her dashboard. You can also send her an email copy right now so she gets it immediately:</p>
            <a className="btn btn-pink" style={{ textDecoration: "none", display: "inline-block", marginTop: 8 }}
              href={`mailto:${ADMINS.charity.email}?subject=New cake request — ${done.name} ${done.surname}&body=${body}`}>
              Email a copy to Charity 📧
            </a>
            <div style={{ marginTop: 14 }}><button className="btn btn-ghost" onClick={() => setPage("home")}>Back to home</button></div>
          </div>
        </div>
      );
    }
    return (
      <div className="wrap" style={{ padding: "30px 18px 50px", maxWidth: 600 }}>
        <h2 style={{ color: "#E64980", textAlign: "center", fontSize: 30 }}>Ask about a cake</h2>
        <p style={{ textAlign: "center" }}>Tell us what you dream of, and we'll send you a quotation.</p>
        <BeadDivider />
        <div className="card" style={{ padding: 24 }}>
          <label>Name</label><input value={f.name} onChange={set("name")} placeholder="e.g. Thandi" />
          <label>Surname</label><input value={f.surname} onChange={set("surname")} placeholder="e.g. Dlamini" />
          <label>What cake would you like? (flavour, size, occasion, colours…)</label>
          <textarea rows={4} value={f.desc} onChange={set("desc")} placeholder="e.g. 2-tier vanilla birthday cake with gold stars for 30 guests" />
          <label>Email address</label><input type="email" value={f.email} onChange={set("email")} placeholder="you@example.com" />
          <label>Telephone / WhatsApp number</label><input type="tel" value={f.phone} onChange={set("phone")} placeholder="e.g. 27821234567" />
          <label>When do you need it?</label><input type="date" value={f.dateNeeded} onChange={set("dateNeeded")} />
          <button className="btn btn-pink" style={{ width: "100%" }} onClick={submit}>Send my request ✦</button>
        </div>
      </div>
    );
  };

  /* ---------- admin ---------- */
  const AdminLogin = () => {
    const [who, setWho] = useState("charity");
    const [pin, setPin] = useState("");
    const tryLogin = async () => {
      const pins = settings?.pins || {};
      if (!pins[who]) {
        if (pin.length < 4) { notify("Choose a PIN of at least 4 digits to set up this admin."); return; }
        const next = { ...settings, pins: { ...pins, [who]: pin } };
        setSettings(next); await sSet(K.settings, next);
        setAdmin(who); notify(`PIN created. Welcome, ${ADMINS[who].name}!`);
      } else if (pins[who] === pin) {
        setAdmin(who);
      } else notify("Wrong PIN — please try again.");
    };
    return (
      <div className="wrap" style={{ padding: 40, maxWidth: 440 }}>
        <div className="card" style={{ padding: 26, textAlign: "center" }}>
          <Logo size={64} />
          <h2>Admin sign in</h2>
          <p style={{ fontSize: 14 }}>Only Charity (main administrator) and Mfanelo can update the site.</p>
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="charity">{ADMINS.charity.email} — main admin</option>
            <option value="mfanelo">{ADMINS.mfanelo.email}</option>
          </select>
          <input type="password" inputMode="numeric" placeholder={settings?.pins?.[who] ? "Enter your PIN" : "First time: create a PIN"} value={pin} onChange={(e) => setPin(e.target.value)} />
          <button className="btn btn-pink" style={{ width: "100%" }} onClick={tryLogin}>Sign in</button>
        </div>
      </div>
    );
  };

  const AdminPanel = () => {
    const me = ADMINS[admin];
    const fileRef = useRef(null);
    const [newName, setNewName] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [quoteFor, setQuoteFor] = useState(null);
    const [amount, setAmount] = useState("");
    const [notes, setNotes] = useState("");

    const accepted = orders.filter((o) => o.status === "accepted");
    const revenue = accepted.reduce((s, o) => s + (parseFloat(o.quoteAmount) || 0), 0);

    const setStatus = (id, status) => saveOrders(orders.map((o) => (o.id === id ? { ...o, status } : o)));
    const saveQuote = (id) => {
      if (!amount) { notify("Enter a quote amount first."); return; }
      saveOrders(orders.map((o) => (o.id === id ? { ...o, status: "quoted", quoteAmount: amount, quoteNotes: notes } : o)));
      notify("Quote saved — now send it by email or WhatsApp below.");
    };

    return (
      <div className="wrap" style={{ padding: "26px 18px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ color: "#E64980" }}>Hello {me.name} ✦ <small style={{ fontSize: 13, color: "#8A4B2E" }}>{me.role}</small></h2>
          <button className="btn btn-ghost" onClick={() => setAdmin(null)}>Sign out</button>
        </div>

        {/* money summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, margin: "16px 0" }}>
          {[
            ["Requests", orders.length, "#E64980"],
            ["Quotes sent", orders.filter((o) => o.status === "quoted").length, "#F5A623"],
            ["Accepted", accepted.length, "#2FA88E"],
            [`Money made`, `R ${revenue.toFixed(2)}`, "#8A4B2E"],
          ].map(([label, val, color]) => (
            <div key={label} className="card" style={{ padding: 16, textAlign: "center", borderTop: `5px solid ${color}` }}>
              <div style={{ fontFamily: "'Baloo 2'", fontSize: 26, color }}>{val}</div>
              <small>{label}</small>
            </div>
          ))}
        </div>

        {/* upload a cake */}
        <div className="card" style={{ padding: 20, marginBottom: 22 }}>
          <h3 style={{ marginBottom: 8 }}>Add a new cake photo</h3>
          <input placeholder="Cake name (e.g. Golden Star Wedding Cake)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input placeholder="Short description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          <input type="file" accept="image/*" ref={fileRef} />
          <button className="btn btn-pink" onClick={() => {
            const file = fileRef.current?.files?.[0];
            if (!file) { notify("Choose a photo first."); return; }
            addCake(file, newName, newDesc); setNewName(""); setNewDesc(""); fileRef.current.value = "";
          }}>Upload cake ✦</button>
          <p style={{ fontSize: 12, color: "#8A4B2E", marginTop: 8 }}>
            Photos are saved to shared storage, so they appear for everyone on every computer or phone that opens this app.
          </p>
          {cakes.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {cakes.map((c) => (
                <div key={c.id} style={{ position: "relative" }}>
                  {images[c.id] && <img src={images[c.id]} alt={c.name} style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 12 }} />}
                  <button onClick={() => deleteCake(c.id)} title="Delete" style={{ position: "absolute", top: -6, right: -6, background: "#E64980", color: "white", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: 11 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* orders & quotes database */}
        <div className="card" style={{ padding: 20, overflowX: "auto" }}>
          <h3 style={{ marginBottom: 10 }}>Requests, quotations & orders</h3>
          {orders.length === 0 ? <p>No requests yet.</p> : (
            <table>
              <thead><tr><th>Customer</th><th>Cake wanted</th><th>Needed</th><th>Status</th><th>Quote</th><th>Actions</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><b>{o.name} {o.surname}</b><br /><small>{o.email}<br />{o.phone}</small></td>
                    <td style={{ maxWidth: 220 }}>{o.desc}<br /><small>asked {o.submittedAt}</small></td>
                    <td>{o.dateNeeded}</td>
                    <td>{statusPill(o.status)}</td>
                    <td>{o.quoteAmount ? `R ${o.quoteAmount}` : "—"}</td>
                    <td style={{ minWidth: 190 }}>
                      <button className="btn btn-gold" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => { setQuoteFor(o.id === quoteFor ? null : o.id); setAmount(o.quoteAmount || ""); setNotes(o.quoteNotes || ""); }}>
                        {o.quoteAmount ? "Edit quote" : "Create quote"}
                      </button>{" "}
                      {o.status === "quoted" && (<>
                        <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 13 }} onClick={() => setStatus(o.id, "accepted")}>Mark accepted</button>{" "}
                        <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 13 }} onClick={() => setStatus(o.id, "declined")}>Mark declined</button>
                      </>)}
                      {quoteFor === o.id && (
                        <div style={{ marginTop: 10, background: "#FFF6EC", borderRadius: 14, padding: 12 }}>
                          <input placeholder="Amount in Rand, e.g. 850" value={amount} onChange={(e) => setAmount(e.target.value)} />
                          <input placeholder="Notes (deposit, collection…)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                          <button className="btn btn-pink" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => saveQuote(o.id)}>Save quote</button>{" "}
                          <a className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 13, textDecoration: "none", display: "inline-block" }}
                            href={`mailto:${o.email}?subject=Your KhaNyezi Treats quotation ✦&body=${buildQuoteMessage(o, amount || o.quoteAmount, notes || o.quoteNotes)}`}>
                            Send by email
                          </a>{" "}
                          <a className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 13, textDecoration: "none", display: "inline-block" }}
                            href={`https://wa.me/${(o.phone || "").replace(/[^0-9]/g, "")}?text=${buildQuoteMessage(o, amount || o.quoteAmount, notes || o.quoteNotes)}`}
                            target="_blank" rel="noreferrer">
                            Send by WhatsApp
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* accepted summary */}
        {accepted.length > 0 && (
          <div className="card" style={{ padding: 20, marginTop: 22 }}>
            <h3>Accepted quotes — money made</h3>
            <table>
              <thead><tr><th>Customer</th><th>Cake</th><th>Date</th><th>Amount</th></tr></thead>
              <tbody>
                {accepted.map((o) => (
                  <tr key={o.id}><td>{o.name} {o.surname}</td><td>{o.desc}</td><td>{o.dateNeeded}</td><td>R {o.quoteAmount}</td></tr>
                ))}
                <tr><td colSpan={3} style={{ fontWeight: 800 }}>Total</td><td style={{ fontWeight: 800, color: "#2FA88E" }}>R {revenue.toFixed(2)}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  /* ================= render ================= */
  return (
    <div className="kz">
      <style>{css}</style>

      {/* header */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(255,246,236,.92)", backdropFilter: "blur(6px)", borderBottom: "3px solid #F5A623" }}>
        <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 18px", flexWrap: "wrap", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setPage("home")}>
            <Logo size={40} />
            <span style={{ fontFamily: "'Baloo 2'", fontWeight: 800, fontSize: 20, color: "#E64980" }}>KhaNyezi <span style={{ color: "#F5A623" }}>Treats</span></span>
          </div>
          <nav>
            {[["home", "Home"], ["gallery", "Gallery"], ["order", "Ask about a cake"], ["admin", "Admin"]].map(([id, label]) => (
              <button key={id} className={`nav-b ${page === id ? "on" : ""}`} onClick={() => setPage(id)}>{label}</button>
            ))}
          </nav>
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80 }}><Logo size={80} /><p>Warming up the oven…</p></div>
      ) : (
        <>
          {page === "home" && <Home />}
          {page === "gallery" && <Gallery />}
          {page === "order" && <OrderForm />}
          {page === "admin" && (admin ? <AdminPanel /> : <AdminLogin />)}
        </>
      )}

      {/* cake detail modal */}
      {viewCake && (
        <div onClick={() => setViewCake(null)} style={{ position: "fixed", inset: 0, background: "rgba(74,44,42,.55)", display: "grid", placeItems: "center", zIndex: 50, padding: 20 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: "100%" }}>
            {images[viewCake.id] && <img src={images[viewCake.id]} alt={viewCake.name} style={{ width: "100%", maxHeight: 340, objectFit: "cover", display: "block" }} />}
            <div style={{ padding: 20 }}>
              <h3 style={{ color: "#E64980", fontSize: 22 }}>{viewCake.name}</h3>
              <p>{viewCake.desc || "A beautiful bake from the KhaNyezi kitchen."}</p>
              <small style={{ color: "#8A4B2E" }}>Baked {viewCake.added}</small>
              <div style={{ marginTop: 14 }}>
                <button className="btn btn-pink" onClick={() => { setViewCake(null); setPage("order"); }}>I want one like this ✦</button>{" "}
                <button className="btn btn-ghost" onClick={() => setViewCake(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "#4A2C2A", color: "white", padding: "12px 22px", borderRadius: 999, zIndex: 60, boxShadow: "0 8px 24px rgba(0,0,0,.3)" }}>{toast}</div>
      )}

      <footer style={{ textAlign: "center", padding: "26px 0 40px", color: "#8A4B2E" }}>
        <BeadDivider />
        <b style={{ fontFamily: "'Baloo 2'" }}>KhaNyezi Treats</b> ✦ Lady of Light · Star ✦<br />
        <small>Admins: {ADMINS.charity.email} (main) · {ADMINS.mfanelo.email}</small>
      </footer>
    </div>
  );
}
